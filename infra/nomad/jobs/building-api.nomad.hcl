job "building-api" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "building-api" {
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
        static = 8090
      }
    }

    # Ceph-backed host volume for /data — same mount hosting/api uses.
    # Provides /data/workspaces + /data/artifacts for SpinBuild.
    volume "spinforge-data" {
      type      = "host"
      source    = "spinforge-data"
      read_only = false
    }

    # Consul service name matches openresty's expected shape:
    #   site-${slug(domain)}  →  site-build-spinforge-dev
    service {
      name     = "site-build-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "building-api"]

      check {
        name     = "http"
        type     = "http"
        path     = "/health"
        interval = "15s"
        timeout  = "3s"
      }
    }

    task "building-api" {
      driver = "docker"

      volume_mount {
        volume      = "spinforge-data"
        destination = "/data"
      }

      config {
        image = "192.168.88.171:5000/spinforge/building-api:aidetect-20260829212243"
        ports = ["http"]
      }

      # All secrets (Vault tokens, admin-JWT) come from the Nomad Variable
      # at nomad/jobs/building-api. VAULT_TOKEN is the periodic 168h
      # spinbuild-service token; PLATFORM_VAULT_TOKEN is the read-only
      # platform-service token used by /api/vault/platform/* routes to
      # read secret/platform/*. Bootstrap token + unseal key live on Ceph
      # at /mnt/cephfs/spinforge/hosting/data/openbao/.bootstrap.json.
      template {
        destination = "secrets/platform.env"
        env         = true
        change_mode = "restart"
        data        = <<EOT
{{- with nomadVar "nomad/jobs/building-api" -}}
ADMIN_TOKEN_SECRET={{ .ADMIN_TOKEN_SECRET.Value }}
VAULT_TOKEN={{ .VAULT_TOKEN.Value }}
PLATFORM_VAULT_TOKEN={{ .PLATFORM_VAULT_TOKEN.Value }}
{{- end }}
EOT
      }

      # VAULT_ADDR is resolved via public DNS — no Consul dependency, so
      # building-api can bootstrap without waiting on service discovery.
      template {
        destination = "secrets/vault.env"
        env         = true
        change_mode = "restart"
        data        = <<EOT
VAULT_ADDR=https://vault.spinforge.dev
VAULT_KV_MOUNT=secret
EOT
      }

      # Mid-migration: keydb is still docker-compose on each host with
      # 16378 published on the host network. Point at the local node's
      # copy via attr.unique.network.ip-address. Nomad + Consul HTTP
      # APIs live on the same interface.
      env {
        PORT                 = "8090"
        REDIS_HOST           = "${attr.unique.network.ip-address}"
        REDIS_PORT           = "16378"
        REDIS_DB             = "1"
        REDIS_PASSWORD       = ""
        NOMAD_ADDR           = "http://${attr.unique.network.ip-address}:4646"
        # Registry the build runner images are pulled from. The code default
        # is .170:5000, which nothing serves — the registry lives on .171, so
        # without this every build stage fails at image pull.
        BUILDER_REGISTRY     = "192.168.88.171:5000"
        NOMAD_DATACENTER     = "spinforge-dc1"
        CONSUL_HTTP_ADDR     = "http://${attr.unique.network.ip-address}:8500"
        WORKSPACE_ROOT       = "/data/workspaces"
        ARTIFACT_ROOT        = "/data/artifacts"
        NODE_ENV             = "production"

        # AI project-type detection: containers carry no `claude` binary or
        # key — they POST the project snapshot to the detection sidecar (an
        # authed Claude Code on .170) which classifies static vs container and
        # returns the build commands. Falls back to Railpack if unreachable.
        SPINFORGE_DETECT_URL = "http://192.168.88.170:9095/detect"

        # Static builds go through Railpack + BuildKit: it detects the
        # package manager, toolchain version and output directory per
        # project instead of assuming npm/dist, and BuildKit's layer cache
        # turns rebuilds from minutes into seconds. Set to "command" to
        # fall back to the hardcoded `npm ci && npm run build`.
        BUILD_DEFAULT_MODE   = "railpack"

        # Customer builds run only on nodes carrying this class —
        # spinforge-build-01 (.173), a Nomad client that is deliberately
        # NOT a Nomad/Consul server, so it can never affect quorum.
        BUILD_NODE_CLASS     = "build"

        # Admission control. The build node advertises 16000 MHz, so six
        # concurrent 2000 MHz stages leaves headroom for the runner's own
        # overhead. Previously unbounded: builds were fire-and-forget.
        BUILD_MAX_CONCURRENT = "6"
        BUILD_MAX_CONCURRENT_PER_CUSTOMER = "2"

        # Pin the runner image to a specific tag so Nomad clients don't
        # hold on to a stale :latest cache. Bump this when you push a
        # new runner build (building/runners/linux/Dockerfile changes).
        #
        # These are read by DispatchService (the legacy per-job dispatch
        # path), NOT by the pipeline stage handlers — handlers/nomad.js
        # builds its own ref from BUILDER_REGISTRY. They pointed at
        # .170:5000, which nothing serves, and at the pre-fix runner tag
        # that still set NODE_ENV=production.
        BUILDER_IMAGE_WEB    = "192.168.88.171:5000/spinforge/builder-linux:20260812073806"
        BUILDER_IMAGE_LINUX  = "192.168.88.171:5000/spinforge/builder-linux:20260812073806"
      }

      resources {
        cpu    = 400
        memory = 512
      }
    }
  }
}
