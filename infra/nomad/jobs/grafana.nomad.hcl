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
