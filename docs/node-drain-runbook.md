# Node drain + re-add runbook

Covers: planned maintenance (take a SpinForge node offline, apply
updates, bring it back) and unplanned loss (node dies, what happens).

## Prerequisites

- HAProxy at 192.168.88.20 fronts all SpinForge nodes (192.168.88.170+)
- Each node runs: openresty, api, admin-ui, website, keydb (or connects
  to shared keydb), consul client, nomad client
- Shared state: KeyDB (single instance today), Ceph for /data

---

## Planned drain (maintenance window)

### 1. Remove node from HAProxy

On the HAProxy host (192.168.88.20):

```bash
# Disable the node in both backends (HTTP + HTTPS)
echo "disable server be_spinforge_80/node170" | sudo socat stdio /var/run/haproxy/admin.sock
echo "disable server be_spinforge_443/node170" | sudo socat stdio /var/run/haproxy/admin.sock
```

Or edit `/etc/haproxy/haproxy.cfg`, comment out the server line, reload:
```bash
sudo systemctl reload haproxy
```

HAProxy stops sending traffic. In-flight connections finish naturally.

### 2. Drain Nomad workloads

On the node being drained:

```bash
# Mark the node as ineligible for new allocations
nomad node drain -enable -self

# Wait until all allocations are migrated (Nomad moves them to other nodes)
nomad node drain -monitor -self
```

Once drain completes, Nomad has rescheduled all customer containers to
other nodes. Consul deregisters the services so OpenResty on other nodes
stops routing to this host.

### 3. Do maintenance

```bash
cd /home/imzee/spinforge
git pull
docker compose down
docker compose up -d --build
# or: apply OS updates, reboot, etc.
```

### 4. Re-enable Nomad

```bash
nomad node drain -disable -self
```

Node becomes eligible again. Nomad may or may not move workloads back
(depends on bin-packing and resource availability).

### 5. Re-add to HAProxy

```bash
echo "enable server be_spinforge_80/node170" | sudo socat stdio /var/run/haproxy/admin.sock
echo "enable server be_spinforge_443/node170" | sudo socat stdio /var/run/haproxy/admin.sock
```

Or uncomment in config and `sudo systemctl reload haproxy`.

HAProxy's health check (`GET /api/health`) must return 200 before the
node receives traffic. Default: check every 5s, 2 consecutive passes.

### 6. Verify

```bash
# From HAProxy host
curl -sS http://192.168.88.170:80/api/health
# Expected: {"ok":true,"service":"spinforge-openresty"}

# From outside
curl -sS https://api.spinforge.dev/health
# Expected: {"status":"healthy","timestamp":"..."}
```

---

## Unplanned node loss

### What happens automatically

1. **HAProxy** marks the node as DOWN after 3 failed health checks
   (~15s). Traffic stops going to it. Other nodes absorb all requests.

2. **Nomad** detects the node as lost after its heartbeat times out
   (~30s default). Customer container allocations on that node are
   rescheduled to surviving nodes (if capacity allows).

3. **Consul** deregisters the dead node's services after the same
   heartbeat timeout. OpenResty on other nodes stops routing container
   traffic to allocations that were on the dead node (within 5s cache
   TTL).

4. **Redis/KeyDB** — if the dead node was NOT the KeyDB host, no
   impact. If it WAS the KeyDB host, everything breaks (see §HA below).

5. **Ceph** — if the dead node had Ceph OSDs, Ceph self-heals. Static
   file + cert access continues on surviving nodes that mount CephFS.

### What you need to do manually

1. **Confirm HAProxy removed it:**
   ```bash
   echo "show servers state" | sudo socat stdio /var/run/haproxy/admin.sock
   ```

2. **Check Nomad rescheduled:**
   ```bash
   nomad node status
   # The dead node shows "down". Check its allocations:
   nomad node status <dead-node-id>
   ```

3. **When the node comes back:** it auto-joins Nomad + Consul (gossip
   protocol). HAProxy re-enables it once health checks pass. No manual
   re-add needed if the config isn't commented out.

---

## KeyDB single-point-of-failure (current state)

Today KeyDB is a single container on one node. If that node dies:
- All reads/writes fail
- OpenResty serves from per-process cache for up to 60s, then degrades
- No new deploys, no new auth, no cert renewals

**Mitigation (in progress):** task #91 — KeyDB HA (replication or
shared-nothing). Until then, KeyDB's node is the one you NEVER drain
without first migrating KeyDB to another host.

### Emergency KeyDB migration (manual)

If the KeyDB node is about to die (disk warning, hardware error):

```bash
# On the KeyDB node, dump the dataset
docker exec spinforge-keydb keydb-cli -p 16378 BGSAVE

# Copy the dump to another node
scp /mnt/cephfs/spinforge/hosting/data/keydb/dump.rdb newnode:/data/keydb/

# On the new node, start KeyDB with the dump
# (edit docker-compose to point at the new node's IP or just start it there)
```

This is ugly. HA (task #91) fixes it properly.
