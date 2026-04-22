job "loki" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "loki" {
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
        static = 3100
        to     = 3100
      }
    }

    # Ceph-backed host volume — chunks + index survive restarts and can
    # move to any node when Nomad reschedules. Monolithic single-node
    # Loki so replication_factor = 1; scale-out is a separate deployment
    # mode (read/write/backend split) we'll revisit when this hurts.
    volume "loki-data" {
      type      = "host"
      source    = "spinforge-data"
      read_only = false
    }

    service {
      name     = "site-logs-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "loki"]

      check {
        type     = "http"
        path     = "/ready"
        interval = "30s"
        timeout  = "3s"
      }
    }

    task "loki" {
      driver = "docker"

      # Loki's upstream image defaults to uid 10001 which can't mkdir
      # inside our Ceph host volume (owned 1000:1000 mode 775, same as
      # every other service's subtree). Running as root lets loki create
      # /data-root/loki/{chunks,rules,boltdb,…} on first boot; once it's
      # inside its own dir there's no further permission issue.
      user = "root"

      volume_mount {
        volume      = "loki-data"
        destination = "/data-root"
      }

      config {
        image      = "grafana/loki:3.2.0"
        ports      = ["http"]
        entrypoint = ["/usr/bin/loki"]
        args       = ["-config.file=/local/loki.yaml"]
      }

      # BoltDB-shipper + filesystem object store. Retention 7d is enough
      # while we bed things in; bump retention_period (and a matching
      # compactor block) if operators want longer windows.
      template {
        data = <<EOT
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /data-root/loki
  storage:
    filesystem:
      chunks_directory: /data-root/loki/chunks
      rules_directory: /data-root/loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  allow_structured_metadata: true
  retention_period: 168h
EOT
        destination = "local/loki.yaml"
        change_mode = "restart"
      }

      resources {
        cpu    = 300
        memory = 512
      }
    }
  }
}
