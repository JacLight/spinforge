# SpinBuild — artifact + workspace retention sweep.
#
# Runs nightly at 03:00 UTC (off-peak for every SpinForge region today).
# Re-runs the same image as building-api but with a different entrypoint,
# so the script always ships with the API code it reads from.
#
# Retention knobs live on each customer's policy doc — see
# building/docs/policy-schema.md (build.keepSuccessfulBuilds,
# build.keepFailedBuildsHours, build.workspaceRetentionHours). No knobs
# on this job spec itself; the script is the decision-maker.
#
# This is a periodic batch job. Nomad fires a new allocation every 24h.
# We intentionally don't enable `prohibit_overlap` — the script is
# idempotent (everything it deletes is already terminal) and an overlap
# would only happen if a run pinned for 24h, which would need diagnosing
# anyway.
#
# Retry max_attempts=1: if the sweep fails (KeyDB blip mid-run, Ceph
# hiccup), next day's run picks it up. No point burning cycles retrying
# a transient infra issue.

job "artifact-retention" {
  datacenters = ["spinforge-dc1"]
  type        = "batch"

  # 03:00 UTC daily. `@daily` is also accepted by Nomad but the explicit
  # cron form keeps the exact timing obvious to operators.
  # Use `crons` (list form) — `cron` is deprecated in modern Nomad.
  periodic {
    crons            = ["0 3 * * *"]
    prohibit_overlap = false
    time_zone        = "UTC"
  }

  group "sweep" {
    count = 1

    restart {
      attempts = 1
      interval = "30m"
      delay    = "30s"
      mode     = "fail"
    }

    reschedule {
      attempts  = 1
      unlimited = false
      interval  = "1h"
      delay     = "1m"
    }

    # Ceph-backed host volume — same one hosting-api + building-api use.
    # Must be mounted read-write so the script can delete files.
    volume "spinforge-data" {
      type      = "host"
      source    = "spinforge-data"
      read_only = false
    }

    task "retention" {
      driver = "docker"

      volume_mount {
        volume      = "spinforge-data"
        destination = "/data"
      }

      config {
        image      = "192.168.88.170:5000/spinforge/building-api:latest"
        # Override the default entrypoint (which runs server.js) so this
        # alloc executes the sweep and then exits — batch semantics.
        entrypoint = ["node", "bin/artifact-retention.js"]
      }

      env {
        # KeyDB connection — identical shape to building-api.nomad.hcl.
        # Each node talks to its own local KeyDB; multi-master replicates
        # the policy reads across all 3.
        REDIS_HOST     = "${attr.unique.network.ip-address}"
        REDIS_PORT     = "16378"
        REDIS_DB       = "1"
        REDIS_PASSWORD = ""

        DATA_ROOT      = "/data"
        NODE_ENV       = "production"

        # Flip to "1" to rehearse a run without deleting anything. Useful
        # when tuning retention knobs on a live cluster.
        DRY_RUN        = "0"
      }

      resources {
        # Light workload — mostly KeyDB round-trips + rm -rf. 300 MHz / 256
        # MB is plenty and leaves headroom for the serving building-api
        # on the same node if they happen to land together.
        cpu    = 300
        memory = 256
      }
    }
  }
}
