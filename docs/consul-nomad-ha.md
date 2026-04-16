# Consul + Nomad HA (3-server quorum)

Currently Consul and Nomad run as single-server bootstrap on one node.
For HA, both need ≥3 server nodes for Raft quorum (tolerates 1 failure).

## Current state (single-server)

```
Node 170:  consul server (bootstrap_expect=1)
           nomad  server (bootstrap_expect=1) + client
```

## Target state (3-server)

```
Node 170:  consul server + client     nomad server + client
Node 171:  consul server + client     nomad server + client
Node 172:  consul server + client     nomad server + client
```

Every node is both server and client. Works for small clusters (≤5).
For larger clusters, separate server-only nodes from client-only.

---

## Consul 3-server deployment

### 1. Config for each node

Create `/data/consul/config/consul.hcl` on each node. Only
`advertise_addr` and `retry_join` differ per node.

**Node 170:**
```hcl
datacenter       = "dc1"
data_dir         = "/data/consul/data"
log_level        = "INFO"
server           = true
bootstrap_expect = 3
bind_addr        = "0.0.0.0"
advertise_addr   = "192.168.88.170"
client_addr      = "0.0.0.0"

retry_join = ["192.168.88.171", "192.168.88.172"]

ports {
  http = 8500
  dns  = 8600
}

ui_config {
  enabled = true
}
```

**Node 171:** same but `advertise_addr = "192.168.88.171"` and
`retry_join = ["192.168.88.170", "192.168.88.172"]`.

**Node 172:** same but `advertise_addr = "192.168.88.172"` and
`retry_join = ["192.168.88.170", "192.168.88.171"]`.

### 2. Start Consul on all 3 nodes

```bash
# On each node (adjust path as needed)
sudo nomad agent -config /data/consul/config/ &
# Or if running via systemd:
sudo systemctl start consul
```

They'll retry_join until all 3 are up, then elect a leader.

### 3. Verify

```bash
consul members
# Should show 3 nodes, all "alive", role "server"

consul operator raft list-peers
# Should show 3 voters, 1 leader
```

### 4. Update docker-compose

Change `CONSUL_HTTP_ADDR` to point to `http://127.0.0.1:8500` (each
node's local Consul agent). This is already the default in our code.

---

## Nomad 3-server deployment

### 1. Config for each node

Create `/data/nomad/config/nomad.hcl` on each node.

**Node 170:**
```hcl
datacenter = "dc1"
data_dir   = "/data/nomad/data"
log_level  = "INFO"

advertise {
  http = "192.168.88.170"
  rpc  = "192.168.88.170"
  serf = "192.168.88.170"
}

server {
  enabled          = true
  bootstrap_expect = 3
  server_join {
    retry_join = ["192.168.88.171", "192.168.88.172"]
  }
}

client {
  enabled = true
  host_volume "spinforge-data" {
    path      = "/mnt/cephfs/spinforge/hosting/data"
    read_only = false
  }
}

plugin "docker" {
  config {
    volumes { enabled = true }
  }
}

plugin "raw_exec" {
  config { enabled = true }
}

consul {
  address = "127.0.0.1:8500"
}
```

**Nodes 171/172:** same but with their own IP in `advertise`.

### 2. Start Nomad on all 3

```bash
sudo nomad agent -config /data/nomad/config/ &
```

### 3. Verify

```bash
nomad server members
# 3 members, 1 leader

nomad node status
# 3 nodes, all "ready"
```

### 4. Test workload scheduling

```bash
# Create a site via the API (any node's api will do)
curl -X POST http://192.168.88.170:8080/api/sites \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"domain":"test-ha.spinforge.dev","type":"container","containerConfig":{"image":"nginx:alpine","port":80}}'

# Check Nomad placed the allocation
nomad job status site-test-ha-spinforge-dev
# Should show an allocation running on one of the 3 nodes
```

---

## Rollout order

1. **Consul first** — Nomad depends on Consul for service discovery.
2. Stop the single-server Consul on node 170.
3. Deploy 3-server Consul configs on all 3 nodes.
4. Start Consul on all 3. Wait for leader election (~5s).
5. **Nomad second.**
6. Stop single-server Nomad on node 170.
7. Deploy 3-server Nomad configs on all 3 nodes.
8. Start Nomad on all 3. Wait for leader election.
9. Verify all existing Nomad jobs are healthy.

### Downtime window

- Consul stop → 3-server start: customer container routing via Consul
  breaks for those seconds. OpenResty's 5s consul_upstream cache masks
  a brief outage. Static/proxy sites are unaffected (Redis-only).
- Nomad stop → 3-server start: no new container deploys until leader
  is elected. Running containers keep running (Nomad client stays up
  even if the server is down).

**Total expected downtime:** <30s if all 3 nodes are prepared in
advance and started within seconds of each other.

---

## Scaling beyond 3

- Add nodes 173, 174 etc. as **client-only** (server=false).
- Never exceed 5 server nodes (Raft performance degrades). 3 servers +
  N clients is the recommended pattern.
- Update retry_join on existing servers to include new server IPs if
  adding more servers.
