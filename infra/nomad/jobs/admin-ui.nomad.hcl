job "admin-ui" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "admin-ui" {
    count = 3

    # One instance per unique host — matches today's 3-node HAProxy fanout
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
        static = 8083
        to     = 80
      }
    }

    # Consul service name matches the pattern router.lua expects for
    # container-type sites: `site-${slug(domain)}`. For admin.spinforge.dev
    # the slug is "admin-spinforge-dev".
    service {
      name     = "site-admin-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "admin-ui"]

      check {
        name     = "http"
        type     = "http"
        path     = "/"
        interval = "15s"
        timeout  = "3s"
      }
    }

    task "admin-ui" {
      driver = "docker"

      config {
        image = "192.168.88.170:5000/spinforge/admin-ui:server-edit-20260423075528"
        ports = ["http"]
      }

      # Each admin-ui instance proxies /api calls to its LOCAL host's
      # docker-compose api container (published on port 8080). This is
      # the mid-migration bridge — once the api is on Nomad too we'll
      # switch to Consul service discovery via a template stanza.
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
