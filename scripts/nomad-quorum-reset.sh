#!/usr/bin/env bash
#
# Forces a fresh Nomad raft bootstrap across all 3 nodes.
#
# Symptom this fixes: "No cluster leader" that never resolves even though
# `nomad server members` shows all 3 alive. Cause: stale serf-reported raft
# peer tags made each fresh server disable its own bootstrap on join.
#
# Run on ONE node only — it SSHes to the other two.

set -euo pipefail

PEERS=(192.168.88.170 192.168.88.171 192.168.88.172)
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=no)

log() { printf "\n\e[1;36m[quorum]\e[0m %s\n" "$*"; }

# ─── 1. Stop nomad on all 3 at once ───────────────────────────────────
log "Stopping nomad on all 3 nodes …"
for ip in "${PEERS[@]}"; do
  if [[ "$ip" = "192.168.88.170" ]]; then
    sudo systemctl stop nomad.service || true
  else
    ssh "${SSH_OPTS[@]}" imzee@"$ip" 'sudo -n systemctl stop nomad.service' || {
      echo "Need sudo password on $ip — please run interactively." >&2
      ssh -t "${SSH_OPTS[@]}" imzee@"$ip" 'sudo systemctl stop nomad.service'
    }
  fi
done

sleep 2

# ─── 2. Wipe raft state everywhere ────────────────────────────────────
log "Wiping /var/lib/nomad/server/raft on all 3 …"
for ip in "${PEERS[@]}"; do
  if [[ "$ip" = "192.168.88.170" ]]; then
    sudo rm -rf /var/lib/nomad/server/raft /var/lib/nomad/server/serf.keyring /var/lib/nomad/server/server.keystore 2>/dev/null || true
    sudo ls /var/lib/nomad/server/ 2>&1 | head
  else
    ssh "${SSH_OPTS[@]}" imzee@"$ip" 'sudo -n rm -rf /var/lib/nomad/server/raft /var/lib/nomad/server/serf.keyring /var/lib/nomad/server/server.keystore 2>/dev/null || true; sudo -n ls /var/lib/nomad/server/ 2>&1 | head'
  fi
done

# ─── 3. Start nomad on all 3 as close to simultaneously as possible ──
log "Starting nomad on all 3 simultaneously …"
(sudo systemctl start nomad.service) &
ssh "${SSH_OPTS[@]}" imzee@192.168.88.171 'sudo -n systemctl start nomad.service' &
ssh "${SSH_OPTS[@]}" imzee@192.168.88.172 'sudo -n systemctl start nomad.service' &
wait

log "Waiting 20s for raft election …"
sleep 20

# ─── 4. Verify ────────────────────────────────────────────────────────
log "Cluster state:"
echo ""
echo "-- consul members --"
/usr/local/bin/consul members 2>&1 | head -6
echo ""
echo "-- nomad server members --"
/usr/local/bin/nomad server members 2>&1 | head -6
echo ""
echo "-- nomad operator raft list-peers --"
/usr/local/bin/nomad operator raft list-peers 2>&1 | head -6
echo ""
echo "-- nomad node status --"
/usr/local/bin/nomad node status 2>&1 | head -6
