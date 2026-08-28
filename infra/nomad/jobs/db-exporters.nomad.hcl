# Prometheus exporters for the databases that live OUTSIDE the SpinForge
# Nomad cluster:
#
#   MongoDB   replica set "rs0" — 192.168.88.140 (primary), .141 (secondary)
#   KeyDB     replication pair  — 192.168.88.143 (master),  .144 (replica)
#
# We have no shell on any of those four hosts, so nothing is installed on
# them. Instead the exporters run here and connect over the network — the
# standard remote-exporter pattern. Both databases accept unauthenticated
# connections from this subnet today, which is why no credentials appear
# below; if auth is ever turned on, add the URI secrets as a Nomad
# Variable and template them in the way building-api does.
#
# One group, three tasks: a group is scheduled as a unit, so all three
# exporters land on the same node and Prometheus resolves them from a
# single Consul lookup per service.

job "db-exporters" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "exporters" {
    count = 1

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

      port "mongo_140" {
        static = 9216
        to     = 9216
      }
      # 9217/9218, not another 9216: every task in a bridge-mode group shares
      # one network namespace, so the mongo exporters cannot all bind :9216
      # internally — distinct internal ports per exporter.
      port "mongo_141" {
        static = 9217
        to     = 9217
      }
      port "mongo_142" {
        static = 9218
        to     = 9218
      }
      port "keydb" {
        static = 9121
        to     = 9121
      }
    }

    # One Consul service per exporter. Prometheus resolves each by name in
    # its own config template, so these addresses never have to be
    # hardcoded — the job can move nodes without a Prometheus edit.
    service {
      name     = "mongodb-exporter-140"
      port     = "mongo_140"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "mongodb", "primary"]

      check {
        type     = "http"
        path     = "/metrics"
        interval = "30s"
        timeout  = "10s"
      }
    }

    service {
      name     = "mongodb-exporter-141"
      port     = "mongo_141"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "mongodb", "secondary"]

      check {
        type     = "http"
        path     = "/metrics"
        interval = "30s"
        timeout  = "10s"
      }
    }

    service {
      name     = "mongodb-exporter-142"
      port     = "mongo_142"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "mongodb", "secondary"]

      check {
        type     = "http"
        path     = "/metrics"
        interval = "30s"
        timeout  = "10s"
      }
    }

    service {
      name     = "keydb-exporter"
      port     = "keydb"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "keydb", "redis"]

      # /metrics on the multi-target exporter reports the exporter's own
      # health, not any KeyDB — exactly what a health check wants.
      check {
        type     = "http"
        path     = "/metrics"
        interval = "30s"
        timeout  = "5s"
      }
    }

    # ---- MongoDB primary (.140) --------------------------------------
    #
    # Collector choice matters here. --collect-all turns on $collstats
    # per collection, which on this instance walks every collection in
    # every database and pushed a single scrape past 18k series and 3.6s.
    # diagnosticdata (FTDC: opcounters, connections, memory, network,
    # global lock, WiredTiger cache) plus replicasetstatus gives the
    # numbers an operator actually watches, in ~1.3s.
    task "mongodb-140" {
      driver = "docker"

      config {
        image = "percona/mongodb_exporter:0.43"
        ports = ["mongo_140"]
        args = [
          "--mongodb.uri=mongodb://192.168.88.140:27017/admin",
          "--collector.diagnosticdata",
          "--collector.replicasetstatus",
          "--web.listen-address=:9216",
        ]
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }

    # ---- MongoDB secondary (.141) ------------------------------------
    #
    # Scraped separately rather than relying on the primary's view: the
    # replica-set status the primary reports is what it *believes* about
    # its peer. Only .141's own exporter shows whether .141 itself is
    # healthy, and it is the one that reveals replication lag from the
    # side that is actually lagging.
    task "mongodb-141" {
      driver = "docker"

      config {
        image = "percona/mongodb_exporter:0.43"
        ports = ["mongo_141"]
        args = [
          "--mongodb.uri=mongodb://192.168.88.141:27017/admin",
          "--collector.diagnosticdata",
          "--collector.replicasetstatus",
          "--web.listen-address=:9217",
        ]
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }

    # ---- MongoDB member 3 (.142) -------------------------------------
    #
    # Added when rs0 grew from a 2-member to a 3-member set. Scraped on its
    # own so its health and replication lag are visible from its own side,
    # same as .141.
    task "mongodb-142" {
      driver = "docker"

      config {
        image = "percona/mongodb_exporter:0.43"
        ports = ["mongo_142"]
        args = [
          "--mongodb.uri=mongodb://192.168.88.142:27017/admin",
          "--collector.diagnosticdata",
          "--collector.replicasetstatus",
          "--web.listen-address=:9218",
        ]
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }

    # ---- KeyDB (.143 master + .144 replica) --------------------------
    #
    # Started with no target address on purpose. redis_exporter then runs
    # in multi-target mode: Prometheus passes the instance as
    # /scrape?target=redis://host:port, so one exporter covers both
    # KeyDB nodes and any future one is a Prometheus config line rather
    # than another task here.
    #
    # KeyDB is protocol-compatible with Redis, so the Redis exporter and
    # the community Redis dashboards work against it unmodified.
    task "keydb" {
      driver = "docker"

      config {
        image = "oliver006/redis_exporter:v1.66.0"
        ports = ["keydb"]
        args = [
          "--redis.addr=",
          "--web.listen-address=:9121",
        ]
      }

      resources {
        cpu    = 100
        memory = 96
      }
    }
  }
}
