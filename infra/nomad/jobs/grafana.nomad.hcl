job "grafana" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "grafana" {
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

    network {
      mode = "bridge"

      port "http" {
        static = 3000
        to     = 3000
      }
    }

    volume "grafana-data" {
      type      = "host"
      source    = "spinforge-data"
      read_only = false
    }

    service {
      name     = "site-grafana-spinforge-dev"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "grafana"]

      check {
        type     = "http"
        path     = "/api/health"
        interval = "30s"
        timeout  = "3s"
      }
    }

    task "grafana" {
      driver = "docker"

      volume_mount {
        volume      = "grafana-data"
        destination = "/data-root"
      }

      # Pull community dashboards at job start. Nomad caches artifacts
      # so restarts don't re-download. If grafana.com is unreachable the
      # task still comes up — the dashboard provider just reports "no
      # dashboards found" and our inline one below still loads.
      artifact {
        source      = "https://grafana.com/api/dashboards/15764/revisions/latest/download"
        destination = "local/dashboards/nomad.json"
        mode        = "file"
      }
      artifact {
        source      = "https://grafana.com/api/dashboards/13396/revisions/latest/download"
        destination = "local/dashboards/consul.json"
        mode        = "file"
      }
      # Dashboard 12708 was designed for the `nginx-prometheus-exporter`
      # tool (different metric names). Our openresty uses
      # `nginx-lua-prometheus` which emits `spinforge_*` series; the
      # SpinForge — HTTP Requests dashboard below covers the same
      # ground against our actual metric names.
      #
      # "Node Exporter Full" — the canonical community dashboard for
      # prom/node-exporter, 95k+ installs. Covers CPU, memory, disk,
      # network, filesystem, load average with drill-downs per host.
      artifact {
        source      = "https://grafana.com/api/dashboards/1860/revisions/latest/download"
        destination = "local/dashboards/node-exporter.json"
        mode        = "file"
      }

      # Run as root so the wrapping entrypoint can sed-edit the
      # downloaded dashboard JSONs (they arrive owned by root). After
      # the substitution `exec /run.sh` drops to grafana internally.
      user = "root"

      config {
        image = "grafana/grafana:11.2.0"
        ports = ["http"]
        # Wrap the default entrypoint so we can pre-process the
        # downloaded dashboards before Grafana reads them. The stock
        # `/run.sh` launches grafana-server; we sed-patch the JSONs in
        # place then hand control over to it.
        # Bracket the dollar sign as [$] in the regex so HCL and Nomad's
        # runtime interpolation never see `${...}`. Grep wouldn't need
        # this, but sed's regex treats [$] as literal $ only — perfect.
        entrypoint = ["/bin/sh", "-c"]
        args = [
          "cd /local/dashboards 2>/dev/null && for f in *.json; do sed -i -e 's|[$]{DS_PROMETHEUS}|prometheus|g' -e 's|[$]{DS_VICTORIAMETRICS}|prometheus|g' \"$f\" 2>/dev/null; done; exec /run.sh"
        ]
      }

      env {
        GF_SECURITY_ADMIN_USER     = "admin"
        GF_SECURITY_ADMIN_PASSWORD = "spinforge-admin"
        GF_PATHS_DATA              = "/data-root/grafana"
        GF_PATHS_LOGS              = "/data-root/grafana/logs"
        GF_PATHS_PROVISIONING      = "/local/provisioning"

        # Served behind openresty at a different port/host; Grafana 11's
        # CSRF origin check rejects the login POST unless we tell it the
        # public domain and the originating hostname openresty presents.
        GF_SERVER_ROOT_URL               = "https://grafana.spinforge.dev"
        GF_SERVER_DOMAIN                 = "grafana.spinforge.dev"
        GF_SECURITY_CSRF_TRUSTED_ORIGINS = "grafana.spinforge.dev"
        # Grafana takes a list of additional Origin headers it will
        # accept. Include the bare domain + HTTPS form.
        GF_SECURITY_CSRF_ADDITIONAL_HEADERS = ""

        GF_AUTH_ANONYMOUS_ENABLED  = "false"
        GF_INSTALL_PLUGINS         = ""
      }

      template {
        data = <<EOT
apiVersion: 1
datasources:
  # name MUST match the string the community dashboards substitute into
  # their `${DS_PROMETHEUS}` placeholder. uid is a stable reference our
  # custom dashboard uses. We set them to the same value so queries
  # resolve whether the dashboard references by uid or by name.
  - name: prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://{{ range service "site-prometheus-spinforge-dev" }}{{ .Address }}:{{ .Port }}{{ end }}
    isDefault: true
    editable: false
  # Loki — container stdout/stderr shipped by Promtail. One instance
  # (monolithic mode), Consul resolves to whichever node hosts it.
  - name: loki
    uid: loki
    type: loki
    access: proxy
    url: http://{{ range service "site-logs-spinforge-dev" }}{{ .Address }}:{{ .Port }}{{ end }}
    editable: false
EOT
        destination = "local/provisioning/datasources/prometheus.yml"
      }

      # Tell Grafana where to find dashboard JSON. Everything under
      # /local/dashboards/ is auto-loaded into the "SpinForge" folder.
      template {
        data = <<EOT
apiVersion: 1
providers:
  - name: spinforge
    orgId: 1
    folder: SpinForge
    type: file
    disableDeletion: false
    editable: true
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /local/dashboards
      foldersFromFilesStructure: false
  # The hosted-app database dashboards live in their own "appengine" folder,
  # loaded from a separate directory. Grafana creates the folder on boot.
  - name: appengine
    orgId: 1
    folder: appengine
    type: file
    disableDeletion: false
    editable: true
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /local/dashboards-appengine
      foldersFromFilesStructure: false
EOT
        destination = "local/provisioning/dashboards/provider.yml"
      }

      # Custom SpinForge HTTP request dashboard — built against the
      # openresty `spinforge_*` metrics emitted from nginx.conf.
      # Grafana uses {{label}} in its legend format strings; Consul
      # Template would try to parse those as its own directives, so we
      # override the delimiters to [[ ]] for this template only.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "spinforge-http",
  "title": "SpinForge — HTTP Requests",
  "tags": ["spinforge", "openresty", "http"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 3,
  "refresh": "10s",
  "time": { "from": "now-1h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "Request rate (req/s)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(spinforge_http_requests_total[1m]))", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "reqps", "decimals": 1}}
    },
    {
      "id": 2, "type": "stat", "title": "p95 latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 6, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.95, sum(rate(spinforge_http_request_duration_seconds_bucket[5m])) by (le))", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "decimals": 3}}
    },
    {
      "id": 3, "type": "stat", "title": "Error rate (5xx/s)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 12, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(spinforge_http_requests_total{status=~\"5..\"}[1m]))", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "reqps", "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "green", "value": null}, {"color": "red", "value": 0.1}]}}}
    },
    {
      "id": 4, "type": "stat", "title": "Total 2xx (5m)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 18, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(increase(spinforge_http_requests_total{status=~\"2..\"}[5m]))", "refId": "A"}]
    },
    {
      "id": 10, "type": "timeseries", "title": "Request rate by status code",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (status) (rate(spinforge_http_requests_total[1m]))", "legendFormat": "{{status}}", "refId": "A"}]
    },
    {
      "id": 11, "type": "timeseries", "title": "Latency percentiles",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 4},
      "targets": [
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.50, sum(rate(spinforge_http_request_duration_seconds_bucket[5m])) by (le))", "legendFormat": "p50", "refId": "A"},
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.95, sum(rate(spinforge_http_request_duration_seconds_bucket[5m])) by (le))", "legendFormat": "p95", "refId": "B"},
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.99, sum(rate(spinforge_http_request_duration_seconds_bucket[5m])) by (le))", "legendFormat": "p99", "refId": "C"}
      ],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 20, "type": "timeseries", "title": "Top domains by request rate",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "topk(10, sum by (host) (rate(spinforge_http_requests_total[1m])))", "legendFormat": "{{host}}", "refId": "A"}]
    },
    {
      "id": 21, "type": "timeseries", "title": "Requests by route type",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (route_type) (rate(spinforge_http_requests_total[1m]))", "legendFormat": "{{route_type}}", "refId": "A"}]
    },
    {
      "id": 30, "type": "timeseries", "title": "Response size p95 by domain",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 20},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.95, sum by (host, le) (rate(spinforge_http_response_size_bytes_bucket[5m])))", "legendFormat": "{{host}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "bytes"}}
    },
    {
      "id": 31, "type": "timeseries", "title": "Upstream latency p95",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 20},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.95, sum by (host, le) (rate(spinforge_http_upstream_response_seconds_bucket[5m])))", "legendFormat": "{{host}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 40, "type": "timeseries", "title": "Active nginx connections",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 6, "w": 24, "x": 0, "y": 28},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (state) (spinforge_nginx_http_connections)", "legendFormat": "{{state}}", "refId": "A"}]
    }
  ]
}
EOT
        destination = "local/dashboards/spinforge-http.json"
      }

      # SpinBuild — Jobs dashboard. Queries `spinbuild_*` metrics from
      # building-api's /metrics endpoint (scraped by prometheus as the
      # 'building-api' job). Same delimiter override as above so Grafana
      # legend `{{label}}` tokens aren't eaten by Consul Template.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "spinbuild-jobs",
  "title": "SpinBuild — Jobs",
  "tags": ["spinforge", "spinbuild"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "10s",
  "time": { "from": "now-1h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "Jobs/min",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(spinbuild_jobs_total[1m])) * 60", "refId": "A"}]
    },
    {
      "id": 2, "type": "stat", "title": "Active jobs",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 6, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(spinbuild_active_jobs)", "refId": "A"}]
    },
    {
      "id": 3, "type": "stat", "title": "p95 job duration",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 12, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.95, sum by (le) (rate(spinbuild_job_duration_seconds_bucket[5m])))", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "decimals": 1}}
    },
    {
      "id": 4, "type": "stat", "title": "Policy rejects/min",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 18, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(spinbuild_policy_rejections_total[1m])) * 60", "refId": "A"}]
    },
    {
      "id": 10, "type": "timeseries", "title": "Jobs by platform",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (platform) (rate(spinbuild_jobs_total[1m]))", "legendFormat": "{{platform}}", "refId": "A"}]
    },
    {
      "id": 11, "type": "timeseries", "title": "Status breakdown",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (status) (rate(spinbuild_jobs_total[1m]))", "legendFormat": "{{status}}", "refId": "A"}]
    },
    {
      "id": 20, "type": "timeseries", "title": "Job duration p50/p95/p99",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
      "targets": [
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.5, sum by (le) (rate(spinbuild_job_duration_seconds_bucket[5m])))", "legendFormat": "p50", "refId": "A"},
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.95, sum by (le) (rate(spinbuild_job_duration_seconds_bucket[5m])))", "legendFormat": "p95", "refId": "B"},
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.99, sum by (le) (rate(spinbuild_job_duration_seconds_bucket[5m])))", "legendFormat": "p99", "refId": "C"}
      ],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 21, "type": "timeseries", "title": "Queue wait p95 by platform",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "histogram_quantile(0.95, sum by (platform, le) (rate(spinbuild_job_queue_wait_seconds_bucket[5m])))", "legendFormat": "{{platform}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 30, "type": "timeseries", "title": "Policy rejections by reason",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 24, "x": 0, "y": 20},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (error) (rate(spinbuild_policy_rejections_total[1m]))", "legendFormat": "{{error}}", "refId": "A"}]
    }
  ]
}
EOT
        destination = "local/dashboards/spinbuild-jobs.json"
      }

      # SpinForge — Logs dashboard. Single Loki "logs" panel showing a
      # live tail of every container with a non-empty `container` label
      # (so docker-compose keydb/openresty appear alongside Nomad tasks).
      # Grafana labels use {{ }} — same Consul Template delimiter trick
      # as the dashboards above.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "spinforge-logs",
  "title": "SpinForge — Logs",
  "tags": ["spinforge", "logs"],
  "schemaVersion": 39,
  "version": 1,
  "refresh": "5s",
  "time": {"from": "now-15m", "to": "now"},
  "panels": [
    {
      "id": 1, "type": "logs", "title": "All containers",
      "datasource": {"type": "loki", "uid": "loki"},
      "gridPos": {"h": 20, "w": 24, "x": 0, "y": 0},
      "targets": [{"datasource": {"type": "loki", "uid": "loki"}, "expr": "{container!=\"\"}", "refId": "A"}],
      "options": {"showLabels": true, "showTime": true, "wrapLogMessage": false, "sortOrder": "Descending"}
    }
  ]
}
EOT
        destination = "local/dashboards/spinforge-logs.json"
      }

      # Application MongoDB — Replica Set rs0 (.140 primary / .141 secondary).
      # This is the hosted-apps datastore (appmint/appengine collections), NOT
      # SpinForge's own control-plane store, which lives in spinforge-keydb
      # (:16378 db 1). Built against the metric names the
      # percona/mongodb_exporter 0.43 actually emits (mongodb_ss_* from
      # FTDC, mongodb_rs_members_* from replSetGetStatus) — the community
      # dashboards target the old pre-0.40 names and render empty here.
      # Both members are scraped, tagged role=primary/secondary in the
      # prometheus scrape config; queries split on that so the two
      # exporters never double-count, and the rs_members_* panels dedupe
      # with `max by (member_idx)` since each exporter reports the whole
      # set's view.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "spinforge-mongodb",
  "title": "Apps — MongoDB (.140/.141)",
  "tags": ["apps", "mongodb", "database", "tenant-data"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-3h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "Members up",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 4, "x": 0, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "count(max by (member_idx) (mongodb_rs_members_health) == 1)", "refId": "A"}],
      "fieldConfig": {"defaults": {"color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 1}, {"color": "green", "value": 2}]}}}
    },
    {
      "id": 2, "type": "stat", "title": "Replication lag (secondary)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 4, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "(scalar(max(mongodb_rs_members_optimeDate{member_state=\"PRIMARY\"})) - max by (member_idx) (mongodb_rs_members_optimeDate{member_state=\"SECONDARY\"})) / 1000", "legendFormat": "{{member_idx}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "decimals": 1, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "green", "value": null}, {"color": "yellow", "value": 5}, {"color": "red", "value": 30}]}}}
    },
    {
      "id": 3, "type": "stat", "title": "Ops/s (primary)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 9, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(mongodb_ss_opcounters{role=\"primary\"}[1m]))", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "ops", "decimals": 0}}
    },
    {
      "id": 4, "type": "stat", "title": "Current connections",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 14, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (role) (mongodb_ss_connections{conn_type=\"current\"})", "legendFormat": "{{role}}", "refId": "A"}]
    },
    {
      "id": 5, "type": "stat", "title": "Resident memory (primary)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 19, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "max(mongodb_ss_mem_resident{role=\"primary\"})", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "decmbytes"}}
    },
    {
      "id": 10, "type": "timeseries", "title": "Operations/s by type (primary)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (legacy_op_type) (rate(mongodb_ss_opcounters{role=\"primary\"}[1m]))", "legendFormat": "{{legacy_op_type}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "ops"}}
    },
    {
      "id": 11, "type": "timeseries", "title": "Connections (current) by member",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (role) (mongodb_ss_connections{conn_type=\"current\"})", "legendFormat": "{{role}}", "refId": "A"}]
    },
    {
      "id": 20, "type": "timeseries", "title": "Network throughput by member",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
      "targets": [
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (role) (rate(mongodb_ss_network_bytesIn[1m]))", "legendFormat": "in {{role}}", "refId": "A"},
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (role) (rate(mongodb_ss_network_bytesOut[1m]))", "legendFormat": "out {{role}}", "refId": "B"}
      ],
      "fieldConfig": {"defaults": {"unit": "Bps"}}
    },
    {
      "id": 21, "type": "timeseries", "title": "Replication lag over time",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "(scalar(max(mongodb_rs_members_optimeDate{member_state=\"PRIMARY\"})) - max by (member_idx) (mongodb_rs_members_optimeDate{member_state=\"SECONDARY\"})) / 1000", "legendFormat": "{{member_idx}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 30, "type": "timeseries", "title": "Queued operations (global lock)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 20},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (role, count_type) (mongodb_ss_globalLock_currentQueue{count_type=~\"readers|writers\"})", "legendFormat": "{{role}} {{count_type}}", "refId": "A"}]
    },
    {
      "id": 31, "type": "timeseries", "title": "Document ops/s (primary)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 20},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (doc_op_type) (rate(mongodb_ss_metrics_document{role=\"primary\"}[1m]))", "legendFormat": "{{doc_op_type}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "ops"}}
    }
  ]
}
EOT
        destination = "local/dashboards-appengine/spinforge-mongodb.json"
      }

      # Application KeyDB — master (.143) + replica (.144): the hosted-apps
      # cache/queue store (fundu:, bull:, chat- keys), NOT SpinForge's own
      # spinforge-keydb (:16378). redis_exporter runs in
      # multi-target mode, so both instances arrive on the same 'keydb'
      # prometheus job distinguished only by the instance_role label
      # (master/replica) set in the scrape config — every query splits on
      # it. KeyDB is RESP-compatible, so the redis_* metric names apply
      # unchanged.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "spinforge-keydb",
  "title": "Apps — KeyDB (.143/.144)",
  "tags": ["apps", "keydb", "redis", "database", "tenant-data"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "15s",
  "time": { "from": "now-3h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "Instances up",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 4, "x": 0, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(redis_up)", "refId": "A"}],
      "fieldConfig": {"defaults": {"color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 1}, {"color": "green", "value": 2}]}}}
    },
    {
      "id": 2, "type": "stat", "title": "Ops/s (master)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 4, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(redis_commands_processed_total{instance_role=\"master\"}[1m]))", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "ops", "decimals": 0}}
    },
    {
      "id": 3, "type": "stat", "title": "Hit ratio (master)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 9, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(redis_keyspace_hits_total{instance_role=\"master\"}[5m])) / clamp_min(sum(rate(redis_keyspace_hits_total{instance_role=\"master\"}[5m])) + sum(rate(redis_keyspace_misses_total{instance_role=\"master\"}[5m])), 1)", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "percentunit", "decimals": 2, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 0.8}, {"color": "green", "value": 0.95}]}}}
    },
    {
      "id": 4, "type": "stat", "title": "Connected clients",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 14, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (instance_role) (redis_connected_clients)", "legendFormat": "{{instance_role}}", "refId": "A"}]
    },
    {
      "id": 5, "type": "stat", "title": "Memory used (master)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 19, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "max(redis_memory_used_bytes{instance_role=\"master\"})", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "bytes"}}
    },
    {
      "id": 10, "type": "timeseries", "title": "Commands/s by instance",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (instance_role) (rate(redis_commands_processed_total[1m]))", "legendFormat": "{{instance_role}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "ops"}}
    },
    {
      "id": 11, "type": "timeseries", "title": "Memory used by instance",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "max by (instance_role) (redis_memory_used_bytes)", "legendFormat": "{{instance_role}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "bytes"}}
    },
    {
      "id": 20, "type": "timeseries", "title": "Keyspace hits vs misses (master)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
      "targets": [
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(redis_keyspace_hits_total{instance_role=\"master\"}[1m]))", "legendFormat": "hits", "refId": "A"},
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(redis_keyspace_misses_total{instance_role=\"master\"}[1m]))", "legendFormat": "misses", "refId": "B"}
      ],
      "fieldConfig": {"defaults": {"unit": "ops"}}
    },
    {
      "id": 21, "type": "timeseries", "title": "Network throughput by instance",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
      "targets": [
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (instance_role) (rate(redis_net_input_bytes_total[1m]))", "legendFormat": "in {{instance_role}}", "refId": "A"},
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (instance_role) (rate(redis_net_output_bytes_total[1m]))", "legendFormat": "out {{instance_role}}", "refId": "B"}
      ],
      "fieldConfig": {"defaults": {"unit": "Bps"}}
    },
    {
      "id": 30, "type": "timeseries", "title": "Keys per instance",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 20},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (instance_role) (redis_db_keys)", "legendFormat": "{{instance_role}}", "refId": "A"}]
    },
    {
      "id": 31, "type": "timeseries", "title": "Evicted / expired keys per s (master)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 20},
      "targets": [
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(redis_evicted_keys_total{instance_role=\"master\"}[5m]))", "legendFormat": "evicted", "refId": "A"},
        {"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(rate(redis_expired_keys_total{instance_role=\"master\"}[5m]))", "legendFormat": "expired", "refId": "B"}
      ],
      "fieldConfig": {"defaults": {"unit": "ops"}}
    }
  ]
}
EOT
        destination = "local/dashboards-appengine/spinforge-keydb.json"
      }

      # appengine — App Uptime. Blackbox probes (blackbox-apps job) for the
      # four k8s-hosted apps, measured through the Traefik ingress. Shows
      # up/down, HTTP status, latency and TLS cert expiry per app. This is
      # the external-behaviour view; pod/deployment internals would need
      # k8s API access we don't hold. Lives in the appengine folder via the
      # dashboards-appengine provider.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "appengine-apps",
  "title": "appengine — App Uptime",
  "tags": ["appengine", "apps", "blackbox", "uptime"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-6h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "Apps up",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 4, "x": 0, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(probe_success)", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "none", "max": 4, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 3}, {"color": "green", "value": 4}]}}}
    },
    {
      "id": 2, "type": "stat", "title": "Status per app",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 12, "x": 4, "y": 0},
      "options": {"colorMode": "background", "textMode": "value_and_name"},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success", "legendFormat": "{{app}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}], "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "green", "value": 1}]}}}
    },
    {
      "id": 3, "type": "stat", "title": "Nearest cert expiry",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 8, "x": 16, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "min(probe_ssl_earliest_cert_expiry - time()) / 86400", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "d", "decimals": 0, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 14}, {"color": "green", "value": 30}]}}}
    },
    {
      "id": 10, "type": "timeseries", "title": "Up / down over time",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success", "legendFormat": "{{app}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "none", "max": 1, "min": 0, "custom": {"drawStyle": "line", "lineInterpolation": "stepAfter", "fillOpacity": 20}}}
    },
    {
      "id": 11, "type": "timeseries", "title": "HTTP status code",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code", "legendFormat": "{{app}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "none", "decimals": 0}}
    },
    {
      "id": 20, "type": "timeseries", "title": "Probe latency (total)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds", "legendFormat": "{{app}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 21, "type": "timeseries", "title": "Latency breakdown by phase (all apps)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum by (phase) (probe_http_duration_seconds)", "legendFormat": "{{phase}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "custom": {"stacking": {"mode": "normal"}}}}
    },
    {
      "id": 30, "type": "timeseries", "title": "TLS cert days remaining",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 24, "x": 0, "y": 20},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "(probe_ssl_earliest_cert_expiry - time()) / 86400", "legendFormat": "{{app}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "d", "decimals": 0}}
    }
  ]
}
EOT
        destination = "local/dashboards-appengine/appengine-apps.json"
      }

      # Kubernetes — Reachability. Blackbox control-plane probes (k8s_reach
      # module). Shows the API server and kubelets are alive; it does NOT
      # read cluster state (pods/deployments/nodes) — that needs a kubeconfig
      # we don't hold. When a credential arrives, kube-state-metrics fills
      # the gap and this stays as the liveness layer.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "k8s-reachability",
  "title": "Kubernetes — Reachability",
  "tags": ["appengine", "kubernetes", "k8s", "blackbox"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-6h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "API server",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
      "options": {"colorMode": "background"},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{component=\"apiserver\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}], "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "green", "value": 1}]}}}
    },
    {
      "id": 2, "type": "stat", "title": "Kubelets up",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 6, "x": 6, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "sum(probe_success{component=\"kubelet\"})", "refId": "A"}],
      "fieldConfig": {"defaults": {"max": 7, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 6}, {"color": "green", "value": 7}]}}}
    },
    {
      "id": 3, "type": "stat", "title": "Node reachability",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 12, "x": 12, "y": 0},
      "options": {"colorMode": "background", "textMode": "value_and_name"},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{component=\"kubelet\"}", "legendFormat": "{{node}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}], "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "green", "value": 1}]}}}
    },
    {
      "id": 10, "type": "timeseries", "title": "Control-plane up / down",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{job=\"k8s-reachability\"}", "legendFormat": "{{node}}/{{component}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"max": 1, "min": 0, "custom": {"lineInterpolation": "stepAfter", "fillOpacity": 20}}}
    },
    {
      "id": 11, "type": "timeseries", "title": "Probe latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{job=\"k8s-reachability\"}", "legendFormat": "{{node}}/{{component}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 20, "type": "text", "title": "Coverage",
      "gridPos": {"h": 5, "w": 24, "x": 0, "y": 12},
      "options": {"mode": "markdown", "content": "**This board = liveness only.** It confirms the k8s API server (.131:6443) and kubelets (.131/.132/.133:10250) are responding. It does **not** show pods, deployments, node resource use, or per-app HTTP traffic — those require read access to the k8s API (a kubeconfig or read-only ServiceAccount token). Once that's provided, `kube-state-metrics` + node metrics fill in the rest here."}
    }
  ]
}
EOT
        destination = "local/dashboards-appengine/k8s-reachability.json"
      }


      # Individual dashboard for the appengine app (namespace fundu, probed at
      # appengine.appmint.io/health). Filtered to app="appengine" — up/down, status, latency,
      # availability% and cert. Sits in the appengine folder.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "app-appengine",
  "title": "appengine",
  "tags": ["appengine", "app", "appengine"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-24h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "State",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 0, "y": 0},
      "options": {"colorMode": "background"},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{app=\"appengine\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}], "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "green", "value": 1}]}}}
    },
    {
      "id": 2, "type": "stat", "title": "HTTP status",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 5, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code{app=\"appengine\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"decimals": 0}}
    },
    {
      "id": 3, "type": "stat", "title": "Latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 10, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{app=\"appengine\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "decimals": 3}}
    },
    {
      "id": 4, "type": "stat", "title": "Availability (24h)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 15, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "avg_over_time(probe_success{app=\"appengine\"}[$__range]) * 100", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "percent", "decimals": 2, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 99}, {"color": "green", "value": 99.9}]}}}
    },
    {
      "id": 5, "type": "stat", "title": "Cert days left",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 4, "x": 20, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "(probe_ssl_earliest_cert_expiry{app=\"appengine\"} - time()) / 86400", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "d", "decimals": 0, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 14}, {"color": "green", "value": 30}]}}}
    },
    {
      "id": 10, "type": "timeseries", "title": "Up / down",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{app=\"appengine\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"max": 1, "min": 0, "custom": {"lineInterpolation": "stepAfter", "fillOpacity": 25}}}
    },
    {
      "id": 11, "type": "timeseries", "title": "HTTP status code",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code{app=\"appengine\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"decimals": 0}}
    },
    {
      "id": 20, "type": "timeseries", "title": "Total latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 11},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{app=\"appengine\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 21, "type": "timeseries", "title": "Latency by phase",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 11},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_duration_seconds{app=\"appengine\"}", "legendFormat": "{{phase}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "custom": {"stacking": {"mode": "normal"}}}}
    }
  ]
}
EOT
        destination = "local/dashboards-appengine/app-appengine.json"
      }

      # Individual dashboard for the base-app app (namespace base-app, probed at
      # www.appmint.io/). Filtered to app="base-app" — up/down, status, latency,
      # availability% and cert. Sits in the appengine folder.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "app-base-app",
  "title": "base-app",
  "tags": ["appengine", "app", "base-app"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-24h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "State",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 0, "y": 0},
      "options": {"colorMode": "background"},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{app=\"base-app\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}], "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "green", "value": 1}]}}}
    },
    {
      "id": 2, "type": "stat", "title": "HTTP status",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 5, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code{app=\"base-app\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"decimals": 0}}
    },
    {
      "id": 3, "type": "stat", "title": "Latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 10, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{app=\"base-app\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "decimals": 3}}
    },
    {
      "id": 4, "type": "stat", "title": "Availability (24h)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 15, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "avg_over_time(probe_success{app=\"base-app\"}[$__range]) * 100", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "percent", "decimals": 2, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 99}, {"color": "green", "value": 99.9}]}}}
    },
    {
      "id": 5, "type": "stat", "title": "Cert days left",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 4, "x": 20, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "(probe_ssl_earliest_cert_expiry{app=\"base-app\"} - time()) / 86400", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "d", "decimals": 0, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 14}, {"color": "green", "value": 30}]}}}
    },
    {
      "id": 10, "type": "timeseries", "title": "Up / down",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{app=\"base-app\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"max": 1, "min": 0, "custom": {"lineInterpolation": "stepAfter", "fillOpacity": 25}}}
    },
    {
      "id": 11, "type": "timeseries", "title": "HTTP status code",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code{app=\"base-app\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"decimals": 0}}
    },
    {
      "id": 20, "type": "timeseries", "title": "Total latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 11},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{app=\"base-app\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 21, "type": "timeseries", "title": "Latency by phase",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 11},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_duration_seconds{app=\"base-app\"}", "legendFormat": "{{phase}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "custom": {"stacking": {"mode": "normal"}}}}
    }
  ]
}
EOT
        destination = "local/dashboards-appengine/app-base-app.json"
      }

      # Individual dashboard for the builder-dev app (namespace fundu, probed at
      # builder-dev.appmint.app/). Filtered to app="builder-dev" — up/down, status, latency,
      # availability% and cert. Sits in the appengine folder.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "app-builder-dev",
  "title": "builder-dev",
  "tags": ["appengine", "app", "builder-dev"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-24h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "State",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 0, "y": 0},
      "options": {"colorMode": "background"},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{app=\"builder-dev\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}], "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "green", "value": 1}]}}}
    },
    {
      "id": 2, "type": "stat", "title": "HTTP status",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 5, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code{app=\"builder-dev\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"decimals": 0}}
    },
    {
      "id": 3, "type": "stat", "title": "Latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 10, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{app=\"builder-dev\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "decimals": 3}}
    },
    {
      "id": 4, "type": "stat", "title": "Availability (24h)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 15, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "avg_over_time(probe_success{app=\"builder-dev\"}[$__range]) * 100", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "percent", "decimals": 2, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 99}, {"color": "green", "value": 99.9}]}}}
    },
    {
      "id": 5, "type": "stat", "title": "Cert days left",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 4, "x": 20, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "(probe_ssl_earliest_cert_expiry{app=\"builder-dev\"} - time()) / 86400", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "d", "decimals": 0, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 14}, {"color": "green", "value": 30}]}}}
    },
    {
      "id": 10, "type": "timeseries", "title": "Up / down",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{app=\"builder-dev\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"max": 1, "min": 0, "custom": {"lineInterpolation": "stepAfter", "fillOpacity": 25}}}
    },
    {
      "id": 11, "type": "timeseries", "title": "HTTP status code",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code{app=\"builder-dev\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"decimals": 0}}
    },
    {
      "id": 20, "type": "timeseries", "title": "Total latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 11},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{app=\"builder-dev\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 21, "type": "timeseries", "title": "Latency by phase",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 11},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_duration_seconds{app=\"builder-dev\"}", "legendFormat": "{{phase}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "custom": {"stacking": {"mode": "normal"}}}}
    }
  ]
}
EOT
        destination = "local/dashboards-appengine/app-builder-dev.json"
      }

      # Individual dashboard for the businessmade app (namespace fundu, probed at
      # businessmade.io/). Filtered to app="businessmade" — up/down, status, latency,
      # availability% and cert. Sits in the appengine folder.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
{
  "uid": "app-businessmade",
  "title": "businessmade",
  "tags": ["appengine", "app", "businessmade"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-24h", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "State",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 0, "y": 0},
      "options": {"colorMode": "background"},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{app=\"businessmade\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}], "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "green", "value": 1}]}}}
    },
    {
      "id": 2, "type": "stat", "title": "HTTP status",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 5, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code{app=\"businessmade\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"decimals": 0}}
    },
    {
      "id": 3, "type": "stat", "title": "Latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 10, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{app=\"businessmade\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "decimals": 3}}
    },
    {
      "id": 4, "type": "stat", "title": "Availability (24h)",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 5, "x": 15, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "avg_over_time(probe_success{app=\"businessmade\"}[$__range]) * 100", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "percent", "decimals": 2, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 99}, {"color": "green", "value": 99.9}]}}}
    },
    {
      "id": 5, "type": "stat", "title": "Cert days left",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 4, "w": 4, "x": 20, "y": 0},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "(probe_ssl_earliest_cert_expiry{app=\"businessmade\"} - time()) / 86400", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "d", "decimals": 0, "color": {"mode": "thresholds"}, "thresholds": {"steps": [{"color": "red", "value": null}, {"color": "yellow", "value": 14}, {"color": "green", "value": 30}]}}}
    },
    {
      "id": 10, "type": "timeseries", "title": "Up / down",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_success{app=\"businessmade\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"max": 1, "min": 0, "custom": {"lineInterpolation": "stepAfter", "fillOpacity": 25}}}
    },
    {
      "id": 11, "type": "timeseries", "title": "HTTP status code",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 4},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_status_code{app=\"businessmade\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"decimals": 0}}
    },
    {
      "id": 20, "type": "timeseries", "title": "Total latency",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 0, "y": 11},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_duration_seconds{app=\"businessmade\"}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s"}}
    },
    {
      "id": 21, "type": "timeseries", "title": "Latency by phase",
      "datasource": {"type": "prometheus", "uid": "prometheus"},
      "gridPos": {"h": 7, "w": 12, "x": 12, "y": 11},
      "targets": [{"datasource": {"type": "prometheus", "uid": "prometheus"}, "expr": "probe_http_duration_seconds{app=\"businessmade\"}", "legendFormat": "{{phase}}", "refId": "A"}],
      "fieldConfig": {"defaults": {"unit": "s", "custom": {"stacking": {"mode": "normal"}}}}
    }
  ]
}
EOT
        destination = "local/dashboards-appengine/app-businessmade.json"
      }



      # Alert rules — provisioned via /etc/grafana/provisioning/alerting.
      # GF_PATHS_PROVISIONING is set to /local/provisioning, so Grafana
      # auto-loads everything under local/provisioning/alerting/ on boot.
      # 4 practical alerts covering the metrics we already emit:
      #   - node down (node-exporter `up` series)
      #   - edge 5xx rate (openresty `spinforge_http_requests_total`)
      #   - disk near full (node-exporter filesystem series)
      #   - policy rejection spike (building-api `spinbuild_policy_rejections_total`)
      # Grafana legend/annotation tokens use {{ }}; override delimiters so
      # Consul Template leaves them intact.
      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data = <<EOT
apiVersion: 1
groups:
  - orgId: 1
    name: spinforge-core
    folder: SpinForge
    interval: 1m
    rules:
      - uid: spinforge-node-down
        title: Node down
        condition: A
        # Grafana requires a non-zero relativeTimeRange per query or
        # provisioning rejects the rule ("invalid relative time range
        # [From: 0s, To: 0s]"). 5m lookback is plenty for instant queries.
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: 'up{job="node"} == 0'
              refId: A
              instant: true
        noDataState: OK
        execErrState: Alerting
        for: 2m
        annotations:
          summary: "Node {{ $labels.instance }} is down"

      - uid: spinforge-edge-5xx
        title: Edge 5xx > 1/s
        condition: A
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: 'sum(rate(spinforge_http_requests_total{status=~"5.."}[1m])) > 1'
              refId: A
              instant: true
        noDataState: OK
        for: 5m
        annotations:
          summary: "Edge returning 5xx at {{ $value }}/s"

      - uid: spinforge-disk-full
        title: Disk >90%
        condition: A
        data:
          - refId: A
            relativeTimeRange:
              from: 600
              to: 0
            datasourceUid: prometheus
            model:
              expr: '(1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) > 0.9'
              refId: A
              instant: true
        noDataState: OK
        for: 10m
        annotations:
          summary: "{{ $labels.instance }} root disk at {{ $value | humanizePercentage }}"

      - uid: spinforge-policy-rejects
        title: Policy rejections elevated
        condition: A
        data:
          - refId: A
            relativeTimeRange:
              from: 600
              to: 0
            datasourceUid: prometheus
            model:
              expr: 'sum(rate(spinbuild_policy_rejections_total[5m])) > 0.1'
              refId: A
              instant: true
        noDataState: OK
        for: 5m
        annotations:
          summary: "Policy rejects at {{ $value }}/s — partner quota issue?"

  - orgId: 1
    name: appengine-apps
    folder: appengine
    interval: 1m
    rules:
      - uid: app-down
        title: App down
        condition: A
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: 'probe_success{job="blackbox-apps"} == 0'
              refId: A
              instant: true
        noDataState: NoData
        execErrState: Alerting
        for: 2m
        labels:
          team: appengine
        annotations:
          summary: "App {{ $labels.app }} is DOWN (namespace {{ $labels.namespace }}) — probe to {{ $labels.instance }} failing"

      - uid: app-cert-expiring
        title: App TLS cert expiring
        condition: A
        data:
          - refId: A
            relativeTimeRange:
              from: 600
              to: 0
            datasourceUid: prometheus
            model:
              expr: '(probe_ssl_earliest_cert_expiry{job="blackbox-apps"} - time()) / 86400 < 14'
              refId: A
              instant: true
        noDataState: OK
        for: 15m
        labels:
          team: appengine
        annotations:
          summary: "TLS cert for {{ $labels.app }} expires in under 14 days"

      - uid: k8s-component-down
        title: k8s control-plane component down
        condition: A
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: 'probe_success{job="k8s-reachability"} == 0'
              refId: A
              instant: true
        noDataState: NoData
        execErrState: Alerting
        for: 3m
        labels:
          team: appengine
        annotations:
          summary: "k8s {{ $labels.component }} on {{ $labels.node }} ({{ $labels.ip }}) not responding"

      - uid: mongodb-member-down
        title: MongoDB member down
        condition: A
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: 'max by (member_idx) (mongodb_rs_members_health) < 1'
              refId: A
              instant: true
        noDataState: NoData
        for: 3m
        labels:
          team: appengine
        annotations:
          summary: "MongoDB member {{ $labels.member_idx }} is unhealthy"

      - uid: keydb-down
        title: KeyDB instance down
        condition: A
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: 'redis_up == 0'
              refId: A
              instant: true
        noDataState: NoData
        for: 3m
        labels:
          team: appengine
        annotations:
          summary: "KeyDB {{ $labels.instance_role }} ({{ $labels.keydb_instance }}) is down"
EOT
        destination = "local/provisioning/alerting/rules.yaml"
      }

      # Contact points. No-op webhook placeholder — user will swap for
      # Slack / PagerDuty / email once they decide how they want paging.
      # Grafana still requires *some* receiver to exist or the default
      # routing policy fails validation.
      template {
        data = <<EOT
apiVersion: 1
contactPoints:
  - orgId: 1
    name: default-no-op
    receivers:
      - uid: noop
        type: webhook
        settings:
          url: http://localhost:1/noop
          httpMethod: POST
  - orgId: 1
    name: appmint-support-email
    receivers:
      - uid: appmint-email
        type: email
        settings:
          addresses: support@appmint.io
          singleEmail: false
EOT
        destination = "local/provisioning/alerting/contactpoints.yaml"
      }

      # Default notification policy — sends everything to default-no-op.
      # Grouped by alertname so repeat firings on the same rule collapse.
      template {
        data = <<EOT
apiVersion: 1
policies:
  - orgId: 1
    receiver: default-no-op
    group_by: ['alertname']
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h
    routes:
      - receiver: appmint-support-email
        group_by: ['alertname', 'app']
        matchers:
          - team = appengine
        group_wait: 30s
        group_interval: 5m
        repeat_interval: 2h
EOT
        destination = "local/provisioning/alerting/policies.yaml"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }
  }
}
