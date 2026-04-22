job "openbao" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  # OpenBao OSS is single-node. Proper HA requires a different storage
  # backend (raft / integrated storage) and seal automation — defer until
  # we have real customer signing material. For dev: count=1, rescheduled
  # unlimited so it can hop nodes on host failure (Ceph-backed storage).
  group "openbao" {
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

    # Host network — OpenBao wants a stable api_addr and 8200 is its
    # standard port. Ceph-backed host volume means the alloc can move
    # hosts without data loss (but needs manual unseal after move
    # until auto-unseal is wired).
    network {
      mode = "host"

      port "http" {
        static = 8200
      }
      port "cluster" {
        static = 8201
      }
    }

    volume "spinforge-data" {
      type      = "host"
      source    = "spinforge-data"
      read_only = false
    }

    # Consul service name matches openresty's router shape:
    #   site-${slug(domain)}  →  site-vault-spinforge-dev
    service {
      name     = "site-vault-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "openbao", "vault"]

      check {
        name     = "http"
        type     = "http"
        # standbyok + sealedok prevent flapping when a fresh alloc is
        # still being unsealed manually.
        path     = "/v1/sys/health?standbyok=true&sealedok=true"
        interval = "15s"
        timeout  = "3s"
      }
    }

    task "openbao" {
      driver = "docker"

      volume_mount {
        volume      = "spinforge-data"
        destination = "/data-root"
      }

      config {
        image = "openbao/openbao:latest"
        ports = ["http", "cluster"]

        # Bypass docker-entrypoint.sh so we can point at our rendered
        # template directly (the entrypoint would otherwise auto-inject
        # -config=/openbao/config and swallow -dev flags).
        entrypoint = ["bao"]
        args       = ["server", "-config=/local/openbao.hcl"]

        # NOTE: IPC_LOCK (for mlock) is blocked by our Nomad docker plugin
        # allowlist. Config sets disable_mlock = true so this is safe for
        # dev. Tighten when we move to production signing material.
      }

      # Run as the openbao user baked into the image (UID 100, GID 1000).
      # Ceph directory pre-chowned 100:1000 by operator.
      user = "100:1000"

      template {
        destination = "local/openbao.hcl"
        change_mode = "noop"
        data        = <<EOH
# OpenBao — single-node dev config. Raft/HA + auto-unseal are deferred
# until we have real customer signing material.
storage "file" {
  path = "/data-root/openbao/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

api_addr     = "http://0.0.0.0:8200"
cluster_addr = "http://0.0.0.0:8201"
ui           = true
disable_mlock = true
EOH
      }

      env {
        BAO_ADDR     = "http://0.0.0.0:8200"
        BAO_API_ADDR = "http://${attr.unique.network.ip-address}:8200"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }
  }
}
