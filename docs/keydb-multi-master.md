# KeyDB multi-master setup

SpinForge uses KeyDB (Redis-protocol fork) as the shared state bus.
In single-node mode it's standalone. In multi-node mode, every node
runs its own KeyDB instance configured as an active multi-master
replica — writes go to any node and propagate to all others.

## How it works

KeyDB's `active-replica` + `multi-master` flags let every instance
accept both reads AND writes while replicating to peers. This is
different from Redis Sentinel (one master, N read-only replicas).

```
Node A  KeyDB-A  ←→  replicates  ←→  KeyDB-B  Node B
                 ←→  replicates  ←→  KeyDB-C  Node C
```

Every node's api + openresty talks to its LOCAL KeyDB. Replication
latency is sub-millisecond on the same LAN. Conflict resolution is
last-writer-wins (standard Redis semantics) — fine for SpinForge
because writes are admin-initiated, low-frequency, and serialized by
cluster locks where it matters.

## Activation (per node)

### 1. Set KEYDB_PEERS in `.env`

On each node, add the OTHER nodes' IPs. Example for a 3-node cluster:

**Node A (192.168.88.170):**
```
KEYDB_PEERS=192.168.88.171:16378,192.168.88.172:16378
```

**Node B (192.168.88.171):**
```
KEYDB_PEERS=192.168.88.170:16378,192.168.88.172:16378
```

**Node C (192.168.88.172):**
```
KEYDB_PEERS=192.168.88.170:16378,192.168.88.171:16378
```

### 2. Restart KeyDB

```bash
docker compose up -d --force-recreate keydb
```

Logs should show:
```
[keydb-entrypoint] multi-master peer: 192.168.88.171:16378
[keydb-entrypoint] multi-master peer: 192.168.88.172:16378
[keydb-entrypoint] starting: keydb-server --port 16378 --appendonly yes ...
  --active-replica yes --multi-master yes
  --replicaof 192.168.88.171 16378
  --replicaof 192.168.88.172 16378
```

### 3. Verify replication

```bash
# On any node
docker exec spinforge-keydb keydb-cli -p 16378 INFO replication
```

Look for `role:master` (every node is master in multi-master) and
`connected_slaves` (should list the other nodes).

Write a key on one node, read it on another:
```bash
# Node A
docker exec spinforge-keydb keydb-cli -p 16378 SET test:multi-master "hello from A"

# Node B (within 1s)
docker exec spinforge-keydb keydb-cli -p 16378 GET test:multi-master
# → "hello from A"

# Cleanup
docker exec spinforge-keydb keydb-cli -p 16378 DEL test:multi-master
```

### 4. App connects to local KeyDB

Each node's api + openresty already connects to `172.18.0.10` (the
KeyDB container's static IP on the docker network). Since every node
runs its own KeyDB at that IP, no app config change is needed. The
api reads/writes locally; replication handles cross-node sync.

## Deactivation (back to single-node)

Remove `KEYDB_PEERS` from `.env` (or set to empty), restart KeyDB:
```bash
KEYDB_PEERS= docker compose up -d --force-recreate keydb
```

Logs show: `single-node mode (no KEYDB_PEERS)`. Data is preserved.

## Failure scenarios

| Scenario | Impact | Auto-recovery |
|---|---|---|
| One node dies | Other nodes keep serving. Writes replicate among survivors. Dead node catches up on rejoin. | Yes — KeyDB reconnects automatically. |
| Network partition (node isolated) | Isolated node keeps serving locally. When partition heals, changes merge (last-writer-wins on conflicting keys). | Yes — reconverges. |
| All nodes die except one | Sole survivor has all data. Others catch up on rejoin. | Yes. |
| All nodes die | Restore from appendonly file (AOF) or RDB dump on the first node to boot. Others replicate from it. | Manual — start one node first. |

## When NOT to use multi-master

- **Strong consistency requirements** (e.g. distributed locks where two
  nodes must never both believe they hold the lock). SpinForge's cluster
  locks use `SET NX EX` which is safe per-node but could theoretically
  grant two locks during a partition. In practice: partitions are rare
  on a LAN, and the lock TTL + watchdog handle it.
- **Very high write volume on the same keys.** Last-writer-wins means
  rapid concurrent writes to the same key on different nodes can lose
  intermediate values. SpinForge's write patterns (admin actions, cert
  renewals, site creates) are low-frequency and typically serialized.
