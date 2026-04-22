# Android runner

Docker image: `spinforge/builder-android:latest`

Handles `platform=android`. Android SDK 34 + JDK 17 on Node 22 base.

## Build

```
docker build -t spinforge/builder-android:latest building/runners/android
```

Image is ~1.5 GB. Preload on every Nomad client node that should serve
Android builds, or host on a local registry.

## Env (injected by DispatchService)

Everything the linux runner takes, plus:

| Var | Default | Purpose |
|---|---|---|
| `BUILD_COMMAND` | `chmod +x ./gradlew && ./gradlew assembleRelease bundleRelease` | Shell for the build phase |
| `OUTPUT_DIR` | `app/build/outputs` | Where to search for artifacts |
| `ARTIFACT_PATTERNS` | `**/*.apk,**/*.aab` | Comma-separated globs; matched files are copied flat into `ARTIFACTS_DIR` |

## Signing

This runner does **unsigned** builds only. Signed AAB/APK flow arrives
in M4 (Vault) + M5 (fastlane) — the signing material lives in Vault and
gets checked out per-job by a wrapper in `building/api`.
