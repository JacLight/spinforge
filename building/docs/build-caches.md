# Shared build caches

Runners in SpinBuild are ephemeral by design — every dispatched job gets a fresh
container, workspace is unpacked, build runs, artifacts are shipped off, the
container dies. Without shared caches, *every* build is a cold build: npm
re-resolves the registry, Gradle re-downloads the Android SDK deps, pip
re-fetches wheels. That makes the first 60-120 seconds of every build wasted
I/O against upstream registries.

Shared caches fix this. They live on Ceph (which the runners already mount as
`/data`), so any runner on any Nomad client sees the same warm cache.

## Why bother

- **npm/pnpm/yarn:** 20-60s → 2-5s for a typical workspace after first warm.
- **Gradle:** ~10x speedup on Android builds. The Android SDK + support libs
  alone are ~400MB; downloading per-build is brutal.
- **Maven:** similar to Gradle for JVM projects.
- **pip:** wheel cache saves compile time on native extensions.
- **CocoaPods:** iOS pod specs + downloaded pods. Big on Mac runners.
- **sccache:** C/C++/Rust compiler output cache. Keyed by preprocessed source
  hash, so it survives across commits unless the code actually changed.
- **xcode-derived-data:** Xcode's DerivedData folder. Per-project, not shared
  across projects (Xcode state doesn't survive cross-project reuse).

## Layout on Ceph

All paths below are `/mnt/cephfs/spinforge/hosting/data/cache/...` on the host,
which the runner sees as `/data/cache/...`:

```
/data/cache/
├── npm/                 shared npm registry cache
├── pnpm/                shared pnpm store (content-addressable, safe to share)
├── yarn/                shared yarn v1 cache
├── gradle/              ~/.gradle — wrapper dists, dep cache, build cache
├── maven/               ~/.m2/repository — Maven local repo
├── pip/                 pip wheel + http cache
├── cocoapods/           ~/.cocoapods — pod specs + downloaded pods
├── sccache/             sccache local cache
└── xcode-derived-data/  per-customer per-project Xcode DerivedData
    └── <customerId>/<projectId>/
```

Everything is mode 0777 so whatever uid the runner image uses can read+write.
Ceph enforces no per-user permissions inside the volume; we're treating it like
scratch space shared by trusted jobs.

## How runners consume them

The runner image should set these env vars before the build script runs:

```
NPM_CONFIG_CACHE=/data/cache/npm
YARN_CACHE_FOLDER=/data/cache/yarn
PIP_CACHE_DIR=/data/cache/pip
GRADLE_USER_HOME=/data/cache/gradle
MAVEN_OPTS=-Dmaven.repo.local=/data/cache/maven
COCOAPODS_CACHE_DIR=/data/cache/cocoapods
SCCACHE_DIR=/data/cache/sccache
```

For pnpm, set the store dir via `.npmrc` or a CLI flag:

```
pnpm config set store-dir /data/cache/pnpm
# or: pnpm install --store-dir /data/cache/pnpm
```

For Xcode (Mac runners only), set DerivedData per-project:

```
DERIVED_DATA=/data/cache/xcode-derived-data/<customerId>/<projectId>
mkdir -p "$DERIVED_DATA"
xcodebuild ... -derivedDataPath "$DERIVED_DATA"
```

Runner should `mkdir -p` the xcode subdir before the build — the parent is
0777 but the subdirs need to exist.

## Retention

No automatic pruning yet. Expect caches to grow over time and eventually
crowd the Ceph volume. The stopgap is `scripts/prune-caches.sh`, which deletes
anything not accessed (`atime`) in the last 30 days. Run it weekly.

TODO (tracked by task 131): wire this into a Nomad periodic batch job so it
runs nightly on one client without human intervention.

## Concurrency

- **Ceph:** multi-writer is fine at the filesystem level. No concerns.
- **npm/pnpm/yarn:** package managers lock their own cache entries internally.
  Concurrent installs of the *same* package race at worst; losers redo a
  byte-identical fetch.
- **pip:** same story — lockfile per cache entry.
- **Gradle:** the dependency cache is safe for parallel reads. Parallel writes
  to the same artifact are rare but possible during first warm; Gradle retries.
  If we start seeing `Could not acquire lock on ...` in the logs, split Gradle's
  cache per-customer or switch to read-only shared + per-job write overlay.
- **sccache:** designed for concurrent access. No tuning needed.
- **CocoaPods:** concurrent writes to the same podspec cache directory can
  corrupt. On Mac runners we should scope CocoaPods cache per-customer if we
  hit issues.

First pass is "one big shared cache per tool." Promote to per-customer
namespacing only when we see actual collisions.

## Sizing expectations

First few weeks after launch, all caches combined should stay under 20GB. Ceph
has 2.2TB free so the ceiling is not close. sccache and Gradle will grow
fastest; watch those.
