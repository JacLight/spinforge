job "promtail" {
  datacenters = ["spinforge-dc1"]
  # system type → one per Nomad client, auto-scales to new nodes. Needs
  # host networking + /var/lib/docker access to tail container stdout
  # via Docker service discovery.
  type = "system"

  group "promtail" {
    network {
      mode = "host"

      port "http" {
        static = 9080
      }
    }

    service {
      name     = "promtail"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "logs"]

      check {
        type     = "http"
        path     = "/ready"
        interval = "30s"
        timeout  = "3s"
      }
    }

    restart {
      attempts = 3
      interval = "5m"
      delay    = "15s"
      mode     = "delay"
    }

    task "promtail" {
      driver = "docker"

      config {
        image        = "grafana/promtail:3.2.0"
        network_mode = "host"
        # Docker SD needs the socket; container log files live under
        # /var/lib/docker/containers/<id>/<id>-json.log — mounted ro so
        # promtail can tail them after discovery resolves the path.
        volumes = [
          "/var/lib/docker/containers:/var/lib/docker/containers:ro",
          "/var/log:/var/log:ro",
          "/var/run/docker.sock:/var/run/docker.sock:ro",
        ]
        args = [
          "-config.file=/local/promtail.yaml",
        ]
      }

      # Client URL templated off Consul so promtail always pushes to
      # whichever node currently hosts Loki (monolithic count=1 → one
      # entry). On reschedule Consul updates and the template re-renders.
      template {
        data = <<EOT
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://{{ range service "site-logs-spinforge-dev" }}{{ .Address }}:{{ .Port }}{{ end }}/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 10s
    relabel_configs:
      # Nomad names containers `<taskname>-<allocid>` (taskname typically
      # matches the job name). Strip leading slash + trailing 8-4-4-4-12
      # UUID to derive the job.
      - source_labels: [__meta_docker_container_name]
        regex: '/(.*)'
        target_label: container
      - source_labels: [__meta_docker_container_name]
        regex: '/(.+)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        target_label: nomad_job
      - source_labels: [__meta_docker_container_label_com_hashicorp_nomad_alloc_id]
        target_label: nomad_alloc
      # Docker-compose services (spinforge-keydb, spinforge-openresty)
      # don't carry the Nomad label → their nomad_job stays empty; the
      # `container` label still identifies them in Grafana.
EOT
        destination = "local/promtail.yaml"
        change_mode = "restart"
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
}
