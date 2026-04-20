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
        image = "192.168.88.171:5000/spinforge/api:5ee1b97-20260418002444"
        ports = ["http"]
      }

      # During mid-migration, keydb + openresty are still docker-compose on
      # each host with 16378 / 8082 published on the host network. Point
      # the api at the LOCAL node's copies via attr.unique.network.ip-address.
      # Post-migration these become Consul service names.
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

        # TODO: move these to Nomad variables / Vault once we're out of dev.
        ADMIN_TOKEN_SECRET       = "sf_jwt_05e09183150df78907a120698d4fb40ed87fae4aa4950e6dc93b099b2e18f9bb"
        AWS_REGION               = "us-east-1"
        AWS_ACCESS_KEY_ID        = "CHANGE_ME"
        AWS_SECRET_ACCESS_KEY    = "CHANGE_ME"
        MAIL_FROM                = "SpinForge <noreply@spinforge.dev>"
      }

      resources {
        cpu    = 400
        memory = 512
      }
    }
  }
}
