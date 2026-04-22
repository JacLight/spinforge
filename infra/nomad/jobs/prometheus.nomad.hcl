job "prometheus" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "prometheus" {
    count = 1

    reschedule {
      attempts       = 0
      unlimited      = true
      delay          = "10s"
      delay_function = "constant"
    }

    restart {
      attempts = 3
      interval = "5m"
      delay    = "15s"
      mode     = "delay"
    }

    network {
      mode = "bridge"

      port "http" {
        static = 9090
        to     = 9090
      }
    }

    # Persistent storage on Ceph so the time-series survive restarts + can
    # move to any node when Nomad reschedules.
    volume "prom-data" {
      type      = "host"
      source    = "spinforge-data"
      read_only = false
    }

    service {
      name     = "site-prometheus-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "prometheus"]

      check {
        type     = "http"
        path     = "/-/healthy"
        interval = "30s"
        timeout  = "3s"
      }
    }

    task "prometheus" {
      driver = "docker"

      volume_mount {
        volume      = "prom-data"
        destination = "/data-root"
      }

      config {
        image = "prom/prometheus:v2.55.0"
        ports = ["http"]
        args = [
          "--config.file=/local/prometheus.yml",
          "--storage.tsdb.path=/data-root/prometheus",
          "--storage.tsdb.retention.time=30d",
          "--web.listen-address=0.0.0.0:9090",
          "--web.enable-lifecycle",
        ]
      }

      # Scrape config. Consul service discovery would give us 3 ports per
      # Nomad agent (HTTP 4646, RPC 4647, Serf 4648) — only 4646 serves
      # prometheus metrics, so we static-target the HTTP port explicitly.
      template {
        data = <<EOT
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'nomad'
    metrics_path: /v1/metrics
    params:
      format: ['prometheus']
    static_configs:
      - targets:
          - '192.168.88.170:4646'
          - '192.168.88.171:4646'
          - '192.168.88.172:4646'
        labels:
          cluster: 'spinforge'

  - job_name: 'consul'
    metrics_path: /v1/agent/metrics
    params:
      format: ['prometheus']
    static_configs:
      - targets:
          - '192.168.88.170:8500'
          - '192.168.88.171:8500'
          - '192.168.88.172:8500'
        labels:
          cluster: 'spinforge'

  # OpenResty edge — exposes per-request metrics via nginx-lua-prometheus
  # at /_metrics on port 8081 (the internal non-SSL port already in use
  # for internal health checks). If the module isn't loaded this scrape
  # 404s, which Prometheus shows as 'up=0'.
  - job_name: 'openresty'
    metrics_path: /_metrics
    static_configs:
      - targets:
          - '192.168.88.170:8082'
          - '192.168.88.171:8082'
          - '192.168.88.172:8082'
        labels:
          cluster: 'spinforge'
          tier: 'edge'

  # SpinBuild API — Node/Express service running on each node at :8090.
  # Exposes /metrics (no auth) via prom-client. The `spinbuild_*` series
  # sit alongside hosting's `spinforge_*` — both end up in Grafana under
  # the SpinBuild — Jobs dashboard.
  - job_name: 'building-api'
    metrics_path: /metrics
    static_configs:
      - targets:
          - '192.168.88.170:8090'
          - '192.168.88.171:8090'
          - '192.168.88.172:8090'
        labels:
          cluster: 'spinforge'
          tier: 'build'

  # node-exporter on every VM via Nomad system job → one instance per
  # node on port 9100. Emits CPU, memory, disk, network, filesystem,
  # load average — everything Nomad's own metrics don't expose.
  - job_name: 'node'
    static_configs:
      - targets:
          - '192.168.88.170:9100'
          - '192.168.88.171:9100'
          - '192.168.88.172:9100'
        labels:
          cluster: 'spinforge'

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOT
        destination = "local/prometheus.yml"
        change_mode = "signal"
        change_signal = "SIGHUP"
      }

      resources {
        cpu    = 300
        memory = 512
      }
    }
  }
}
