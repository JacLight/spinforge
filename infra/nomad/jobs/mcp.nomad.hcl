job "mcp" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "mcp" {
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
        static = 3002
        to     = 3000
      }
    }

    service {
      name     = "site-mcp-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "mcp"]

      check {
        name     = "http"
        type     = "http"
        path     = "/"
        interval = "15s"
        timeout  = "5s"
      }
    }

    task "mcp" {
      driver = "docker"

      config {
        image = "192.168.88.171:5000/spinforge/mcp:5ee1b97-20260417173621"
        ports = ["http"]
      }

      env {
        PORT               = "3000"
        SPINFORGE_API_URL  = "http://${attr.unique.network.ip-address}:8080/api"
        NODE_ENV           = "production"
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
}
