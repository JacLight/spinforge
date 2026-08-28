# Blackbox monitoring for the k8s-hosted apps + k8s control-plane reachability.
#
# The Kubernetes cluster (.131 control plane, .132/.133 workers) is a
# separate trust domain: its API (6443) and kubelets (10250) require auth
# we don't hold, so kube-state-metrics / Traefik-internal metrics are out
# of reach. What we CAN see is the same thing a user sees — the app's HTTP
# response through the Traefik ingress. This job probes each app from
# inside the network and records up/down, status code, latency and TLS
# cert expiry.
#
# Cloudflare is deliberately bypassed: extra_hosts pins every app hostname
# to the cluster ingress IP (.131), so the probe hits Traefik directly with
# the correct SNI + Host + real certificate — no public round-trip, no CDN
# caching, true internal latency.
#
# Apps probed (namespace in parens):
#   appengine    appengine.appmint.io/health   (fundu)         API server
#   base-app     <UNKNOWN ingress host>        (base-app)      SaaS UI — hostname TBD
#   builder-dev  builder-dev.appmint.app/      (builder-dev)   builder
#   businessmade businessmade.io/              (businessmade)  site

job "blackbox-apps" {
  datacenters = ["spinforge-dc1"]
  type        = "service"

  group "blackbox" {
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
      port "http" {
        static = 9115
        to     = 9115
      }
    }

    service {
      name     = "blackbox-exporter"
      port     = "http"
      provider = "consul"
      tags     = ["spinforge", "monitoring", "blackbox"]

      check {
        type     = "http"
        path     = "/-/healthy"
        interval = "30s"
        timeout  = "5s"
      }
    }

    task "blackbox" {
      driver = "docker"

      config {
        image = "prom/blackbox-exporter:v0.25.0"
        ports = ["http"]
        args  = ["--config.file=/local/blackbox.yml"]

        # Bypass Cloudflare / public DNS: resolve each app hostname to the
        # cluster ingress so probes stay on the LAN with correct SNI. If
        # the ingress moves off .131, update these (the workers .132/.133
        # also serve 443).
        extra_hosts = [
          "appengine.appmint.io:192.168.88.131",
          "builder-dev.appmint.app:192.168.88.131",
          "businessmade.io:192.168.88.131",
        ]
      }

      template {
        destination = "local/blackbox.yml"
        data        = <<EOT
modules:
  # "App is serving" = any real HTTP response that isn't a server error.
  # 2xx/3xx and auth gates (401/403) count as up; 5xx and timeouts are
  # down. appengine's /health returning 503 is therefore correctly a
  # failure, not a pass. TLS verification stays ON so an expired or wrong
  # cert also trips the probe — the ingress serves valid per-host certs.
  http_app:
    prober: http
    timeout: 15s
    http:
      method: GET
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: [200, 201, 204, 301, 302, 303, 307, 308, 401, 403]
      follow_redirects: false
      preferred_ip_protocol: ip4

  # k8s control-plane reachability. The API server and kubelets answer 401
  # (auth required) over self-signed TLS, so verification is skipped and
  # 401/403 count as "responding". This proves the control plane and nodes
  # are alive; it does NOT read cluster state (that needs a kubeconfig).
  k8s_reach:
    prober: http
    timeout: 8s
    http:
      method: GET
      valid_status_codes: [200, 401, 403]
      fail_if_not_ssl: true
      tls_config:
        insecure_skip_verify: true
      preferred_ip_protocol: ip4
EOT
      }

      resources {
        cpu    = 100
        memory = 96
      }
    }
  }
}
