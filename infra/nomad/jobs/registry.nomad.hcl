job "registry" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "registry" {
    count = 1

    # Reschedule aggressively if the host dies — registry storage is on
    # Ceph so the allocation can come up anywhere.
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
      mode = "host"

      port "http" {
        static = 5000
      }
    }

    # Ceph-backed storage so any node can serve the registry
    volume "registry-data" {
      type      = "host"
      source    = "spinforge-data"
      read_only = false
    }

    service {
      name     = "registry"
      port     = "http"
      provider = "consul"
      tags     = ["docker", "spinforge"]

      check {
        name     = "http"
        type     = "http"
        path     = "/v2/"
        interval = "15s"
        timeout  = "3s"
      }
    }

    task "registry" {
      driver = "docker"

      volume_mount {
        volume      = "registry-data"
        destination = "/data-root"
      }

      config {
        image = "registry:2"
        ports = ["http"]
      }

      env {
        REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY = "/data-root/registry"
        REGISTRY_HTTP_ADDR                        = ":5000"
        REGISTRY_LOG_ACCESSLOG_DISABLED           = "true"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }
  }
}
