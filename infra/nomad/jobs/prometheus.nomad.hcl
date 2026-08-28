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

  # MongoDB replica set rs0. The two percona/mongodb_exporter instances run
  # in the db-exporters Nomad job; their addresses are resolved from Consul
  # at template-render time — the same range-service mechanism the Grafana
  # datasource block uses — so if the job reschedules to another
  # node, a Prometheus SIGHUP (change_mode = signal) picks up the new
  # address. Both members are scraped: .140 as primary, .141 as secondary,
  # so replication lag is visible from each side.
  #
  # The first FTDC scrape is slow (~1.3s cold), so the timeout is generous.
  - job_name: 'mongodb'
    # Its own 30s interval: the FTDC scrape can take ~1.3s cold and the
    # 20s timeout must stay below the interval, which the global 15s would
    # forbid.
    scrape_interval: 30s
    scrape_timeout: 20s
    static_configs:
{{- range service "mongodb-exporter-140" }}
      - targets: ['{{ .Address }}:{{ .Port }}']
        labels:
          cluster: 'spinforge'
          role: 'primary'
          member: '192.168.88.140'
{{- end }}
{{- range service "mongodb-exporter-141" }}
      - targets: ['{{ .Address }}:{{ .Port }}']
        labels:
          cluster: 'spinforge'
          role: 'secondary'
          member: '192.168.88.141'
{{- end }}
{{- range service "mongodb-exporter-142" }}
      - targets: ['{{ .Address }}:{{ .Port }}']
        labels:
          cluster: 'spinforge'
          role: 'secondary'
          member: '192.168.88.142'
{{- end }}

  # KeyDB master (.143) + replica (.144). ONE redis_exporter in multi-target
  # mode serves both: Prometheus passes the instance as the __param_target,
  # the exporter connects to it, and the series come back labelled by the
  # real KeyDB address rather than the exporter's. Adding a third KeyDB is a
  # line in the targets list below — no new exporter.
  - job_name: 'keydb'
    metrics_path: /scrape
    static_configs:
      - targets: ['redis://192.168.88.143:6379']
        labels: { instance_role: 'master' }
      - targets: ['redis://192.168.88.144:6379']
        labels: { instance_role: 'replica' }
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: keydb_instance
      - target_label: __address__
        replacement: '{{- range service "keydb-exporter" }}{{ .Address }}:{{ .Port }}{{- end }}'

  # k8s-hosted apps, probed through the Traefik ingress by blackbox
  # (blackbox-apps Nomad job). We can't scrape inside the k8s cluster —
  # its API and kubelets require auth we don't have — so this measures the
  # apps the way a user hits them: up/down, status, latency, cert expiry.
  # Each target carries an `app` + `namespace` label; the __address__ is
  # rewritten to the blackbox exporter (resolved from Consul), the real URL
  # travels as __param_target.
  - job_name: 'blackbox-apps'
    metrics_path: /probe
    params:
      module: ['http_app']
    scrape_interval: 30s
    scrape_timeout: 20s
    static_configs:
      - targets: ['https://appengine.appmint.io/health']
        labels: { app: 'appengine',    namespace: 'fundu' }
      - targets: ['https://builder-dev.appmint.app/']
        labels: { app: 'builder-dev',  namespace: 'fundu' }
      - targets: ['https://businessmade.io/']
        labels: { app: 'businessmade', namespace: 'fundu' }
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: '{{- range service "blackbox-exporter" }}{{ .Address }}:{{ .Port }}{{- end }}'

  # k8s control-plane reachability via blackbox (module k8s_reach). We can't
  # read cluster state without a kubeconfig, but we CAN prove the API server
  # (.131:6443) and every kubelet (.131/.132/.133:10250) are responding.
  # 401 over self-signed TLS = alive. Component/role labels drive the board.
  - job_name: 'k8s-reachability'
    metrics_path: /probe
    params:
      module: ['k8s_reach']
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['https://192.168.88.131:6443/livez']
        labels: { component: 'apiserver', node: 'k8s-master', ip: '192.168.88.131' }
      - targets: ['https://192.168.88.131:10250/healthz']
        labels: { component: 'kubelet',   node: 'k8s-master', ip: '192.168.88.131' }
      - targets: ['https://192.168.88.132:10250/healthz']
        labels: { component: 'kubelet',   node: 'k8s-worker-1', ip: '192.168.88.132' }
      - targets: ['https://192.168.88.133:10250/healthz']
        labels: { component: 'kubelet',   node: 'k8s-worker-2', ip: '192.168.88.133' }
      - targets: ['https://192.168.88.134:10250/healthz']
        labels: { component: 'kubelet',   node: 'k8s-worker-3', ip: '192.168.88.134' }
      - targets: ['https://192.168.88.135:10250/healthz']
        labels: { component: 'kubelet',   node: 'k8s-worker-4', ip: '192.168.88.135' }
      - targets: ['https://192.168.88.136:10250/healthz']
        labels: { component: 'kubelet',   node: 'k8s-worker-5', ip: '192.168.88.136' }
      - targets: ['https://192.168.88.137:10250/healthz']
        labels: { component: 'kubelet',   node: 'k8s-worker-6', ip: '192.168.88.137' }
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: '{{- range service "blackbox-exporter" }}{{ .Address }}:{{ .Port }}{{- end }}'

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
