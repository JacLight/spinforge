job "node-exporter" {
  datacenters = ["spinforge-dc1"]
  # system type → Nomad places exactly one instance on every eligible
  # client node, no count needed. New nodes automatically get one too.
  type = "system"

  group "node-exporter" {
    network {
      mode = "host"

      port "metrics" {
        static = 9100
      }
    }

    service {
      name     = "node-exporter"
      port     = "metrics"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "metrics"]

      check {
        type     = "http"
        path     = "/metrics"
        interval = "30s"
        timeout  = "3s"
      }
    }

    restart {
      attempts = 3
      interval = "5m"
      delay    = "15s"
      mode     = "delay"
    }

    task "node-exporter" {
      driver = "docker"

      config {
        image        = "prom/node-exporter:v1.8.2"
        network_mode = "host"
        # Node-exporter needs to read the host's /proc, /sys and rootfs,
        # not the container's. Bind them in read-only.
        volumes = [
          "/proc:/host/proc:ro",
          "/sys:/host/sys:ro",
          "/:/host/rootfs:ro,rslave",
        ]
        args = [
          "--path.procfs=/host/proc",
          "--path.sysfs=/host/sys",
          "--path.rootfs=/host/rootfs",
          "--web.listen-address=:9100",
          # Exclude mounts we don't care about (container overlays, nomad
          # bind mounts, ceph autofs stub)
          "--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc|rootfs/var/lib/docker/.+)($|/)",
          "--collector.filesystem.fs-types-exclude=^(autofs|binfmt_misc|bpf|cgroup2?|configfs|debugfs|devpts|devtmpfs|fusectl|hugetlbfs|iso9660|mqueue|nsfs|overlay|proc|procfs|pstore|rpc_pipefs|securityfs|selinuxfs|squashfs|sysfs|tracefs)$",
        ]
      }

      resources {
        cpu    = 100
        memory = 64
      }
    }
  }
}
