#!/usr/bin/env bash
#
# SpinForge node setup script
#
# Run on a fresh Ubuntu 24.04 VM (cloned from your Proxmox template) to
# turn it into a working SpinForge node. Handles:
#
#   * Docker + compose plugin
#   * HashiCorp Nomad + Consul binaries as systemd services
#   * CephFS mount at /mnt/cephfs/spinforge (optional — skip if already mounted)
#   * SpinForge repo checkout
#   * Per-node .env + Consul/Nomad configs
#   * Bringing the stack up
#
# Usage:
#   sudo ./setup-node.sh                          # interactive prompts
#   sudo NODE_IP=192.168.88.171 \
#        KEYDB_PEERS=192.168.88.170:16378 \
#        CONSUL_PEERS=192.168.88.170 \
#        NOMAD_PEERS=192.168.88.170 \
#        BOOTSTRAP_EXPECT=3 \
#        ./setup-node.sh                          # unattended
#
# Idempotent — safe to re-run. Skips steps that are already done.

set -euo pipefail

# ─── Config (env vars or prompts) ─────────────────────────────────────
SPINFORGE_REPO="${SPINFORGE_REPO:-https://github.com/JacLight/spinforge.git}"
SPINFORGE_BRANCH="${SPINFORGE_BRANCH:-server-edit}"
SPINFORGE_DIR="${SPINFORGE_DIR:-/home/imzee/spinforge}"
SPINFORGE_USER="${SPINFORGE_USER:-imzee}"

CEPH_MOUNT="${CEPH_MOUNT:-/mnt/cephfs/spinforge}"

CONSUL_VERSION="${CONSUL_VERSION:-1.19.2}"
NOMAD_VERSION="${NOMAD_VERSION:-1.8.4}"

BOOTSTRAP_EXPECT="${BOOTSTRAP_EXPECT:-1}"

log()   { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[setup]\033[0m %s\n' "$*"; }
die()   { printf '\033[1;31m[setup]\033[0m %s\n' "$*" >&2; exit 1; }
done_() { printf '\033[1;32m[setup]\033[0m ✓ %s\n' "$*"; }

prompt() {
  local var="$1" msg="$2" default="${3:-}"
  if [ -n "${!var:-}" ]; then return; fi
  if [ -t 0 ] && [ -t 1 ]; then
    if [ -n "$default" ]; then
      read -r -p "$msg [$default]: " val || true
      val="${val:-$default}"
    else
      read -r -p "$msg: " val
    fi
    export "$var=$val"
  elif [ -n "$default" ]; then
    export "$var=$default"
  else
    die "$var not set and no TTY for prompt"
  fi
}

# ─── Preflight ────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || die "run as root (use sudo)"

. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || warn "Tested on Ubuntu 24.04. You have $PRETTY_NAME — continuing anyway."

# Detect this node's primary IP for defaults
DEFAULT_IP=$(ip -4 -o addr show scope global | awk 'NR==1{print $4}' | cut -d/ -f1)

prompt NODE_IP       "This node's LAN IP"       "$DEFAULT_IP"
prompt NODE_HOSTNAME "This node's hostname"     "spinforge-$(echo "$NODE_IP" | awk -F. '{print $4}')"
prompt KEYDB_PEERS   "Other KeyDB peers (comma-separated host:port, empty = single node)" ""
prompt CONSUL_PEERS  "Other Consul server IPs (comma-separated, empty = single server)" ""
prompt NOMAD_PEERS   "Other Nomad server IPs (comma-separated, empty = single server)"   ""
prompt MOUNT_CEPH    "Mount CephFS? [y/N]" "N"

log "Node config:"
log "  hostname:          $NODE_HOSTNAME"
log "  ip:                $NODE_IP"
log "  keydb peers:       ${KEYDB_PEERS:-<none>}"
log "  consul peers:      ${CONSUL_PEERS:-<none>}"
log "  nomad peers:       ${NOMAD_PEERS:-<none>}"
log "  bootstrap_expect:  $BOOTSTRAP_EXPECT"
log "  mount cephfs:      $MOUNT_CEPH"

# ─── Hostname ─────────────────────────────────────────────────────────
if [ "$(hostname)" != "$NODE_HOSTNAME" ]; then
  log "setting hostname to $NODE_HOSTNAME"
  hostnamectl set-hostname "$NODE_HOSTNAME"
fi
done_ "hostname"

# ─── Base packages ────────────────────────────────────────────────────
log "installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  git jq unzip wget \
  systemd-timesyncd \
  >/dev/null
done_ "base packages"

# ─── Docker + compose plugin ──────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker
fi
usermod -aG docker "$SPINFORGE_USER" 2>/dev/null || true
done_ "Docker $(docker --version)"

# ─── Consul binary ────────────────────────────────────────────────────
if ! command -v consul >/dev/null 2>&1; then
  log "installing Consul $CONSUL_VERSION"
  cd /tmp
  curl -fsSL "https://releases.hashicorp.com/consul/${CONSUL_VERSION}/consul_${CONSUL_VERSION}_linux_amd64.zip" -o consul.zip
  unzip -oq consul.zip
  mv consul /usr/local/bin/
  chmod +x /usr/local/bin/consul
  rm consul.zip
fi
done_ "Consul $(consul version | head -1)"

# ─── Nomad binary ─────────────────────────────────────────────────────
if ! command -v nomad >/dev/null 2>&1; then
  log "installing Nomad $NOMAD_VERSION"
  cd /tmp
  curl -fsSL "https://releases.hashicorp.com/nomad/${NOMAD_VERSION}/nomad_${NOMAD_VERSION}_linux_amd64.zip" -o nomad.zip
  unzip -oq nomad.zip
  mv nomad /usr/local/bin/
  chmod +x /usr/local/bin/nomad
  rm nomad.zip
fi
done_ "Nomad $(nomad version | head -1)"

# ─── CephFS mount (optional) ──────────────────────────────────────────
if [ "${MOUNT_CEPH,,}" = "y" ] || [ "${MOUNT_CEPH,,}" = "yes" ]; then
  if ! mountpoint -q "$CEPH_MOUNT"; then
    log "configuring CephFS mount at $CEPH_MOUNT (fstab entry only — won't attempt live mount)"
    mkdir -p "$CEPH_MOUNT"
    apt-get install -y -qq ceph-common >/dev/null
    warn "You still need to:"
    warn "  * put your Ceph client keyring at /etc/ceph/ceph.client.spinforge.keyring"
    warn "  * put your ceph.conf at /etc/ceph/ceph.conf"
    warn "  * add an /etc/fstab entry like:"
    warn "      <mon1>,<mon2>:/ $CEPH_MOUNT ceph name=spinforge,secretfile=/etc/ceph/cephfs.secret,_netdev 0 0"
    warn "  * mount -a"
  else
    done_ "CephFS already mounted at $CEPH_MOUNT"
  fi
fi

# ─── SpinForge repo ───────────────────────────────────────────────────
if [ ! -d "$SPINFORGE_DIR/.git" ]; then
  log "cloning SpinForge to $SPINFORGE_DIR"
  sudo -u "$SPINFORGE_USER" git clone -b "$SPINFORGE_BRANCH" "$SPINFORGE_REPO" "$SPINFORGE_DIR"
else
  log "SpinForge repo already present — pulling latest $SPINFORGE_BRANCH"
  sudo -u "$SPINFORGE_USER" git -C "$SPINFORGE_DIR" fetch --all --quiet
  sudo -u "$SPINFORGE_USER" git -C "$SPINFORGE_DIR" checkout "$SPINFORGE_BRANCH" --quiet
  sudo -u "$SPINFORGE_USER" git -C "$SPINFORGE_DIR" pull --quiet --ff-only
fi
chown -R "$SPINFORGE_USER:$SPINFORGE_USER" "$SPINFORGE_DIR"
done_ "SpinForge repo"

# ─── .env ─────────────────────────────────────────────────────────────
ENV_FILE="$SPINFORGE_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  log "creating $ENV_FILE"
  cat > "$ENV_FILE" <<EOF
# Generated by setup-node.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
NODE_ENV=production

NODE_IP=$NODE_IP
PUBLIC_IP=$NODE_IP
SERVER_NAME=$NODE_HOSTNAME

# Port the api process binds to (inside the container)
API_PORT=8080

# Service IPs inside the spinforge_spinforge docker network
KEYDB_IP=172.18.0.10
API_IP=172.18.0.12
ADMIN_UI_IP=172.18.0.14
WEBSITE_IP=172.18.0.15
OPENRESTY_IP=172.18.0.11

REDIS_HOST=172.18.0.10
REDIS_PORT=16378
REDIS_PASSWORD=
REDIS_DB=1

# Multi-master KeyDB — empty means this node runs standalone
KEYDB_PEERS=$KEYDB_PEERS

# Data dirs
SPINFORGE_DATA_ROOT=$CEPH_MOUNT/hosting/data
DATA_ROOT=/data
STATIC_ROOT=/data/static

# HAProxy trust (change if your HAProxy IPs are different)
HAPROXY_TRUSTED_IP=192.168.88.0/24

# API + website URLs (edit if using different DNS)
API_URL=http://$NODE_IP:8080
INTERNAL_API_URL=http://spinforge-api:8080
NEXT_PUBLIC_API_URL=http://$NODE_IP:8080
SPINHUB_API_URL=http://spinforge-api:8080
VITE_API_BASE_URL=http://$NODE_IP:8080

# AWS SES — fill in real keys before emails will send
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=CHANGE_ME
AWS_SECRET_ACCESS_KEY=CHANGE_ME
MAIL_FROM=SpinForge <noreply@spinforge.dev>

ENABLE_METRICS=true
ENABLE_LOGGING=true
DEBUG=false
EOF
  chown "$SPINFORGE_USER:$SPINFORGE_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  done_ ".env written"
else
  log ".env already exists — not overwriting. Check KEYDB_PEERS + NODE_IP manually."
fi

# ─── Consul config ────────────────────────────────────────────────────
CONSUL_DATA="${CEPH_MOUNT}/consul/data-${NODE_HOSTNAME}"
CONSUL_CFG="/etc/consul.d"
mkdir -p "$CONSUL_CFG" "$CONSUL_DATA"
chown -R consul:consul "$CONSUL_DATA" 2>/dev/null || true

RETRY_JOIN_JSON="[]"
if [ -n "$CONSUL_PEERS" ]; then
  RETRY_JOIN_JSON=$(echo "$CONSUL_PEERS" | awk -F, '{
    printf "["
    for (i=1; i<=NF; i++) { if (i>1) printf ", "; printf "\"%s\"", $i }
    printf "]"
  }')
fi

cat > "$CONSUL_CFG/consul.hcl" <<EOF
datacenter       = "dc1"
data_dir         = "$CONSUL_DATA"
log_level        = "INFO"
server           = true
bootstrap_expect = $BOOTSTRAP_EXPECT
bind_addr        = "0.0.0.0"
advertise_addr   = "$NODE_IP"
client_addr      = "0.0.0.0"

retry_join = $RETRY_JOIN_JSON

ports {
  http = 8500
  dns  = 8600
}

ui_config { enabled = true }
EOF
done_ "Consul config"

# ─── Nomad config ─────────────────────────────────────────────────────
NOMAD_DATA="${CEPH_MOUNT}/nomad/data-${NODE_HOSTNAME}"
NOMAD_CFG="/etc/nomad.d"
mkdir -p "$NOMAD_CFG" "$NOMAD_DATA"

NOMAD_RETRY_JOIN_LIST=""
if [ -n "$NOMAD_PEERS" ]; then
  IFS=',' read -ra peers <<< "$NOMAD_PEERS"
  for p in "${peers[@]}"; do
    NOMAD_RETRY_JOIN_LIST+="\"$p\", "
  done
  NOMAD_RETRY_JOIN_LIST="${NOMAD_RETRY_JOIN_LIST%, }"
fi

cat > "$NOMAD_CFG/nomad.hcl" <<EOF
datacenter = "dc1"
data_dir   = "$NOMAD_DATA"
log_level  = "INFO"

advertise {
  http = "$NODE_IP"
  rpc  = "$NODE_IP"
  serf = "$NODE_IP"
}

server {
  enabled          = true
  bootstrap_expect = $BOOTSTRAP_EXPECT
  server_join {
    retry_join = [${NOMAD_RETRY_JOIN_LIST}]
  }
}

client {
  enabled = true
  host_volume "spinforge-data" {
    path      = "${CEPH_MOUNT}/hosting/data"
    read_only = false
  }
}

plugin "docker" {
  config { volumes { enabled = true } }
}

plugin "raw_exec" {
  config { enabled = true }
}

consul {
  address = "127.0.0.1:8500"
}
EOF
done_ "Nomad config"

# ─── systemd units ────────────────────────────────────────────────────
cat > /etc/systemd/system/consul.service <<EOF
[Unit]
Description=Consul
Documentation=https://consul.io/docs
Requires=network-online.target
After=network-online.target

[Service]
ExecStart=/usr/local/bin/consul agent -config-dir=/etc/consul.d
ExecReload=/bin/kill -HUP \$MAINPID
KillSignal=SIGTERM
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/nomad.service <<EOF
[Unit]
Description=Nomad
Documentation=https://nomadproject.io/docs/
Wants=network-online.target consul.service
After=network-online.target consul.service

[Service]
ExecStart=/usr/local/bin/nomad agent -config=/etc/nomad.d
ExecReload=/bin/kill -HUP \$MAINPID
KillSignal=SIGINT
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now consul
sleep 2
systemctl enable --now nomad
done_ "systemd units for Consul + Nomad"

# ─── Start SpinForge ──────────────────────────────────────────────────
log "starting SpinForge stack"
cd "$SPINFORGE_DIR"
sudo -u "$SPINFORGE_USER" docker compose up -d

# ─── Verify ───────────────────────────────────────────────────────────
log "waiting 10s for services to come up..."
sleep 10

fail=0
if curl -fsS -m 3 "http://127.0.0.1:8080/api/health" >/dev/null 2>&1; then
  done_ "api:     http://$NODE_IP:8080/api/health"
else
  warn "api failed health check"; fail=$((fail+1))
fi

if curl -fsS -m 3 "http://127.0.0.1:80/api/health" >/dev/null 2>&1; then
  done_ "openresty: http://$NODE_IP:80/api/health"
else
  warn "openresty failed health check"; fail=$((fail+1))
fi

if docker exec spinforge-keydb keydb-cli -p 16378 ping 2>/dev/null | grep -q PONG; then
  done_ "keydb:   responding"
else
  warn "keydb not responding"; fail=$((fail+1))
fi

if consul members 2>/dev/null | grep -q "$NODE_HOSTNAME"; then
  done_ "consul:  joined"
else
  warn "consul not showing this node as a member"; fail=$((fail+1))
fi

if nomad server members 2>/dev/null | grep -q "$NODE_HOSTNAME"; then
  done_ "nomad:   server up"
else
  warn "nomad server not reporting"; fail=$((fail+1))
fi

echo
if [ "$fail" -eq 0 ]; then
  done_ "Node setup complete"
  echo
  echo "Next steps:"
  echo "  1. Check admin UI at http://$NODE_IP:8083"
  echo "  2. First-run setup token: docker exec spinforge-api cat /data/admin/first-run-token.txt"
  echo "  3. Add this node to HAProxy as 192.168.88.X:8480 (and :8443)"
  [ -z "$KEYDB_PEERS" ] && echo "  4. If adding more nodes later, set KEYDB_PEERS in .env + restart keydb"
else
  warn "Setup finished with $fail failing checks. Review logs above + docker compose logs."
  exit 1
fi
