job "website" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "website" {
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
        static = 8084
        to     = 3000
      }
    }

    # site-spinforge-dev matches the router's Consul name shape for the
    # spinforge.dev domain.
    service {
      name     = "site-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "website"]

      check {
        name     = "http"
        type     = "http"
        path     = "/"
        interval = "15s"
        timeout  = "5s"
      }
    }

    task "website" {
      driver = "docker"

      config {
        image = "192.168.88.170:5000/spinforge/website:5ee1b97-20260417172923"
        ports = ["http"]
      }

      env {
        # website's API calls go to api.spinforge.dev via HAProxy (public
        # endpoint) — no direct container-to-container dep.
        VITE_API_BASE_URL = "https://api.spinforge.dev"
        SPINHUB_API_URL   = "https://api.spinforge.dev"
        NEXT_PUBLIC_API_URL = "https://api.spinforge.dev"
        NODE_ENV          = "production"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }
  }
}
