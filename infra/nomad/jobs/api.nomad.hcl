job "api" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "api" {
    count = 3

    constraint {
      distinct_hosts = true
    }

    restart {
      attempts = 3
      interval = "5m"
      delay    = "15s"
      mode     = "delay"
    }

    reschedule {
      attempts       = 0
      unlimited      = true
      delay          = "10s"
      delay_function = "constant"
    }

    network {
      mode = "bridge"

      port "http" {
        static = 8080
      }
    }

    # Ceph-backed host volume for /data (same mount docker-compose used)
    volume "spinforge-data" {
      type      = "host"
      source    = "spinforge-data"
      read_only = false
    }

    # Consul service name matches router.lua's expected shape:
    #   site-${slug(domain)}  →  site-api-spinforge-dev
    service {
      name     = "site-api-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "api"]

      check {
        name     = "http"
        type     = "http"
        path     = "/api/health"
        interval = "15s"
        timeout  = "5s"
      }
    }

    task "api" {
      driver = "docker"

      volume_mount {
        volume      = "spinforge-data"
        destination = "/data"
      }

      config {
        image = "192.168.88.170:5000/spinforge/api:5ee1b97-20260418002444"
        ports = ["http"]
      }

      # During mid-migration, keydb + openresty are still docker-compose on
      # each host with 16378 / 8082 published on the host network. Point
      # the api at the LOCAL node's copies via attr.unique.network.ip-address.
      # Post-migration these become Consul service names.
      # Platform secrets (AWS, admin-JWT, mail) live in a Nomad Variable at
      # nomad/jobs/api — mirrored from OpenBao's secret/platform/* paths by
      # building-api's /api/vault/platform/* routes. Any mutation from the
      # admin-ui writes both sides, and Nomad re-renders the template +
      # restarts this task automatically via change_mode=restart.
      template {
        destination = "secrets/platform.env"
        env         = true
        change_mode = "restart"
        data        = <<EOT
{{- with nomadVar "nomad/jobs/api" -}}
ADMIN_TOKEN_SECRET={{ .ADMIN_TOKEN_SECRET.Value }}
AWS_ACCESS_KEY_ID={{ .AWS_ACCESS_KEY_ID.Value }}
AWS_SECRET_ACCESS_KEY={{ .AWS_SECRET_ACCESS_KEY.Value }}
AWS_REGION={{ .AWS_REGION.Value }}
MAIL_FROM={{ .MAIL_FROM.Value }}
{{- end }}
EOT
      }

      env {
        PORT                     = "8080"
        DATA_ROOT                = "/data"
        STATIC_ROOT              = "/data/static"
        REDIS_HOST               = "${attr.unique.network.ip-address}"
        REDIS_PORT               = "16378"
        REDIS_DB                 = "1"
        REDIS_PASSWORD           = ""
        OPENRESTY_INTERNAL_URL   = "http://${attr.unique.network.ip-address}:8082"
        # Nomad HTTP API — reachable on the host's primary interface.
        # The api's /_admin/platform/* endpoints proxy to this.
        NOMAD_ADDR               = "http://${attr.unique.network.ip-address}:4646"
        CONSUL_HTTP_ADDR         = "http://${attr.unique.network.ip-address}:8500"
        BASE_DOMAIN              = "192.168.88.170"
        NODE_ENV                 = "production"
        ENABLE_METRICS           = "true"
        ENABLE_LOGGING           = "true"
        DEBUG                    = "false"
        KEYDB_PEERS              = "192.168.88.171:16378,192.168.88.172:16378"
      }

      resources {
        cpu    = 400
        memory = 512
      }
    }
  }
}
