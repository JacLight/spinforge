#!/usr/bin/env bash
#
# SpinForge Nomad + Consul reset + cluster-form script.
#
# Tears down the existing disjoint single-node Nomad/Consul installs and
# replaces them with identical, clustered installs on all 3 nodes.
#
# Run on ALL 3 nodes (170, 171, 172) in any order. Idempotent.
#
# Usage:
#   sudo ./nomad-consul-reset.sh
#
# What it does (per node):
#   1. Stops any running nomad/consul (systemd or ad-hoc)
#   2. Removes old binaries, configs, data dirs, docker consul container
#   3. Installs pinned Nomad 1.9.7 + Consul 1.20.6 to /usr/local/bin
#   4. Writes identical /etc/{nomad,consul}.d/*.hcl with retry_join + bootstrap_expect=3
#   5. Writes systemd units and starts both services
#
# The platform containers (spinforge-api, openresty, admin-ui, keydb,
# website, mcp) are NOT touched. They keep serving throughout.

set -euo pipefail

NOMAD_VERSION="${NOMAD_VERSION:-1.9.7}"
CONSUL_VERSION="${CONSUL_VERSION:-1.20.6}"
PEERS=("192.168.88.170" "192.168.88.171" "192.168.88.172")

log() { printf "\n\e[1;36m[reset]\e[0m %s\n" "$*"; }
die() { printf "\n\e[1;31m[reset]\e[0m %s\n" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."

# ─── Required tools ───────────────────────────────────────────────────
for cmd in curl unzip; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Installing missing prerequisite: $cmd"
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$cmd"
  fi
done

# ─── Identity from IP ─────────────────────────────────────────────────
MY_IP=$(ip -4 addr show | awk '/inet 192\.168\.88\./{print $2}' | cut -d/ -f1 | head -1)
[[ -n "$MY_IP" ]] || die "Could not detect 192.168.88.x IP on this host."
case "$MY_IP" in
  192.168.88.170) NODE_NAME="spinforge-01" ;;
  192.168.88.171) NODE_NAME="spinforge-02" ;;
  192.168.88.172) NODE_NAME="spinforge-03" ;;
  *) die "Unknown node IP $MY_IP — expected 170/171/172." ;;
esac
log "Node: $NODE_NAME ($MY_IP)"

RETRY_JOIN_HCL=$(printf '"%s",' "${PEERS[@]}" | sed 's/,$//')

# ─── 1. Stop existing services ────────────────────────────────────────
log "Stopping any running nomad / consul …"

systemctl stop nomad.service 2>/dev/null || true
systemctl stop consul.service 2>/dev/null || true
systemctl disable nomad.service 2>/dev/null || true
systemctl disable consul.service 2>/dev/null || true

# 170-style: ad-hoc nomad process via sudo shell
pkill -f 'nomad agent' 2>/dev/null || true
pkill -f 'consul agent' 2>/dev/null || true

# 170-style: Consul running in a docker container
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx spinforge-consul; then
  log "Removing spinforge-consul docker container …"
  docker rm -f spinforge-consul 2>&1 | sed 's/^/  /'
fi

sleep 2
if pgrep -af 'nomad agent|consul agent' >/dev/null 2>&1; then
  die "Nomad/Consul process still running after stop attempts. Aborting."
fi
log "All nomad / consul processes stopped."

# ─── 2. Remove old binaries, configs, data ────────────────────────────
log "Removing old binaries, configs, data dirs …"

rm -f /usr/local/bin/nomad /usr/local/bin/consul
rm -f /home/imzee/bin/nomad /home/imzee/bin/consul

rm -rf /etc/nomad.d /etc/consul.d
rm -rf /var/lib/spinforge/nomad /var/lib/spinforge/consul

# Ceph-hosted old data dirs (various historical paths)
for p in \
  /mnt/cephfs/spinforge/hosting/data/nomad/data \
  /mnt/cephfs/spinforge/hosting/data/nomad/alloc_mounts \
  /mnt/cephfs/spinforge/hosting/data/nomad/config \
  /mnt/cephfs/spinforge/nomad/data-spinforge-01 \
  /mnt/cephfs/spinforge/nomad/data-spinforge-02 \
  /mnt/cephfs/spinforge/nomad/data-spinforge-03 \
  /mnt/cephfs/spinforge/consul/data-spinforge-01 \
  /mnt/cephfs/spinforge/consul/data-spinforge-02 \
  /mnt/cephfs/spinforge/consul/data-spinforge-03; do
  if [[ -e "$p" ]]; then
    log "  rm -rf $p"
    rm -rf "$p"
  fi
done

# ─── 3. Install pinned binaries ───────────────────────────────────────
log "Installing Nomad $NOMAD_VERSION + Consul $CONSUL_VERSION to /usr/local/bin …"

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

(
  cd "$TMP"
  curl -fsSLo nomad.zip "https://releases.hashicorp.com/nomad/${NOMAD_VERSION}/nomad_${NOMAD_VERSION}_linux_amd64.zip"
  curl -fsSLo consul.zip "https://releases.hashicorp.com/consul/${CONSUL_VERSION}/consul_${CONSUL_VERSION}_linux_amd64.zip"
  unzip -o nomad.zip >/dev/null
  unzip -o consul.zip >/dev/null
  install -m 0755 nomad  /usr/local/bin/nomad
  install -m 0755 consul /usr/local/bin/consul
)

/usr/local/bin/nomad  version | head -1
/usr/local/bin/consul version | head -1

# ─── 4. Data dirs — LOCAL disk, per-node ──────────────────────────────
#
# IMPORTANT: Raft state MUST be on local disk, not shared Ceph. Raft
# expects exclusive writer semantics; sharing a data_dir across peers
# corrupts the log. Nomad/Consul docs are explicit about this.
#
log "Creating local data dirs …"
install -d -o nomad  -g nomad  -m 0755 /var/lib/nomad  2>/dev/null || install -d -m 0755 /var/lib/nomad
install -d -o consul -g consul -m 0755 /var/lib/consul 2>/dev/null || install -d -m 0755 /var/lib/consul

# ─── 5. Create service users if missing ───────────────────────────────
id -u nomad  &>/dev/null || useradd --system --home /var/lib/nomad  --shell /usr/sbin/nologin nomad
id -u consul &>/dev/null || useradd --system --home /var/lib/consul --shell /usr/sbin/nologin consul

# imzee needs docker access for job spec work later; nomad needs docker too
usermod -aG docker nomad 2>/dev/null || true

chown -R nomad:nomad   /var/lib/nomad
chown -R consul:consul /var/lib/consul

# ─── 6. Consul config ─────────────────────────────────────────────────
log "Writing /etc/consul.d/consul.hcl …"
install -d -m 0755 /etc/consul.d

cat > /etc/consul.d/consul.hcl <<EOF
datacenter       = "spinforge-dc1"
data_dir         = "/var/lib/consul"
log_level        = "INFO"
node_name        = "$NODE_NAME"

server           = true
bootstrap_expect = 3

bind_addr        = "0.0.0.0"
advertise_addr   = "$MY_IP"
client_addr      = "0.0.0.0"

retry_join = [$RETRY_JOIN_HCL]

ports {
  http = 8500
  dns  = 8600
}

ui_config { enabled = true }

connect { enabled = true }

performance { raft_multiplier = 1 }
EOF
chown -R consul:consul /etc/consul.d
chmod 640 /etc/consul.d/consul.hcl

# ─── 7. Nomad config ──────────────────────────────────────────────────
log "Writing /etc/nomad.d/nomad.hcl …"
install -d -m 0755 /etc/nomad.d

cat > /etc/nomad.d/nomad.hcl <<EOF
datacenter = "spinforge-dc1"
data_dir   = "/var/lib/nomad"
log_level  = "INFO"
name       = "$NODE_NAME"

bind_addr = "0.0.0.0"

advertise {
  http = "$MY_IP"
  rpc  = "$MY_IP"
  serf = "$MY_IP"
}

server {
  enabled          = true
  bootstrap_expect = 3
  server_join {
    retry_join = [$RETRY_JOIN_HCL]
  }
}

client {
  enabled = true

  meta {
    "node_type" = "converged"
  }

  host_volume "spinforge-data" {
    path      = "/mnt/cephfs/spinforge/hosting/data"
    read_only = false
  }

  host_volume "certbot-webroot" {
    path      = "/mnt/cephfs/spinforge/hosting/data/certbot-webroot"
    read_only = false
  }
}

consul {
  address = "127.0.0.1:8500"
  server_service_name = "nomad-server"
  client_service_name = "nomad-client"
  auto_advertise   = true
  server_auto_join = true
  client_auto_join = true
}

plugin "docker" {
  config {
    volumes {
      enabled = true
    }
    allow_privileged = false
  }
}

plugin "raw_exec" {
  config {
    enabled = true
  }
}

telemetry {
  collection_interval        = "10s"
  disable_hostname           = true
  prometheus_metrics         = true
  publish_allocation_metrics = true
  publish_node_metrics       = true
}
EOF
# Nomad server needs root to use docker driver; keep root-owned
chmod 640 /etc/nomad.d/nomad.hcl

# ─── 8. systemd units ─────────────────────────────────────────────────
log "Writing systemd units …"

cat > /etc/systemd/system/consul.service <<'EOF'
[Unit]
Description=Consul
Documentation=https://www.consul.io/
Requires=network-online.target
After=network-online.target
ConditionFileNotEmpty=/etc/consul.d/consul.hcl

[Service]
Type=notify
User=consul
Group=consul
ExecStart=/usr/local/bin/consul agent -config-dir=/etc/consul.d
ExecReload=/bin/kill --signal HUP $MAINPID
KillMode=process
Restart=on-failure
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/nomad.service <<'EOF'
[Unit]
Description=Nomad
Documentation=https://www.nomadproject.io/
Wants=network-online.target
After=network-online.target
Wants=consul.service
After=consul.service
ConditionFileNotEmpty=/etc/nomad.d/nomad.hcl

[Service]
Type=notify
# Nomad needs root for the docker driver + host networking
User=root
ExecReload=/bin/kill --signal HUP $MAINPID
ExecStart=/usr/local/bin/nomad agent -config=/etc/nomad.d
KillMode=process
KillSignal=SIGINT
Restart=on-failure
LimitNOFILE=65536
LimitNPROC=infinity
TasksMax=infinity
OOMScoreAdjust=-1000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# ─── 9. Start Consul first (Nomad depends on it) ──────────────────────
log "Starting Consul …"
systemctl enable --now consul.service
sleep 3
systemctl status consul.service --no-pager -l | head -15

# ─── 10. Start Nomad ──────────────────────────────────────────────────
log "Starting Nomad …"
systemctl enable --now nomad.service
sleep 5
systemctl status nomad.service --no-pager -l | head -15

# ─── 11. Report ───────────────────────────────────────────────────────
log "Done on $NODE_NAME. Current cluster view from this node:"
echo ""
echo "-- consul members --"
/usr/local/bin/consul members 2>&1 | head -6 || true
echo ""
echo "-- nomad server members --"
/usr/local/bin/nomad server members 2>&1 | head -6 || true
echo ""
echo "Run this same script on the other two nodes to form the 3-server quorum."
