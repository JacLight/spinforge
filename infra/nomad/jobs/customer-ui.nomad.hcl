job "customer-ui" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "customer-ui" {
    count = 3

    # One instance per host — same fan-out as admin-ui.
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
        static = 8085
        to     = 80
      }
    }

    # Consul service name follows the `site-${slug(domain)}` pattern that
    # router.lua resolves for container-type sites. For app.spinforge.dev
    # the slug is "app-spinforge-dev".
    service {
      name     = "site-app-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "customer-ui"]

      check {
        name     = "http"
        type     = "http"
        path     = "/"
        interval = "15s"
        timeout  = "3s"
      }
    }

    task "customer-ui" {
      driver = "docker"

      config {
        image = "192.168.88.171:5000/spinforge/customer-ui:final-20260813081552"
        ports = ["http"]
      }

      # Each customer-ui instance proxies API calls to its LOCAL host's
      # docker-compose api container (published on port 8080). Same bridge
      # admin-ui uses while we finish the api → Nomad migration.
      env {
        NGINX_LISTEN_PORT = "80"
        NGINX_RESOLVER    = "127.0.0.11"
        API_UPSTREAM      = "${attr.unique.network.ip-address}:8080"
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
}
