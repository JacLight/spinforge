#!/usr/bin/env bash
# run_openvscode_env.sh
# Starts an OpenVSCode dev container for {ORG_ID}_{DEV_ENVIRONMENT}
# Behavior:
#   - HARD FAIL if CephFS root not mounted
#   - CREATE env folders if missing (BASE/WS/LP), set owner/perm once
#   - HARD FAIL if ownership mismatches expected UID:GID (no silent chown)
# Usage:
#   ORG_ID=acme DEV_ENVIRONMENT=dev IMAGE=jaclight/platform:openvscode-nodejs-0.0.2 ./run_openvscode_env.sh
set -euo pipefail

# -------- Required inputs --------
: "${ORG_ID:?set ORG_ID}"
: "${DEV_ENVIRONMENT:?set DEV_ENVIRONMENT}"

# -------- Config (override via env if needed) --------
IMAGE="${IMAGE:-jaclight/platform:openvscode-nodejs-0.0.2}"   # or your flutter tag
NAME="${NAME:-openvscode-${ORG_ID}_${DEV_ENVIRONMENT}}"

CEPH_ROOT="${CEPH_ROOT:-/mnt/cephfs}"                # CephFS mount root
HOST_BASE="${HOST_BASE:-${CEPH_ROOT}/volumes/users}" # parent dir for all envs

CONTAINER_UID="${CONTAINER_UID:-1001}"
CONTAINER_GID="${CONTAINER_GID:-1001}"

INIT_TIMEOUT="${INIT_TIMEOUT:-60}"
INIT_STRICT="${INIT_STRICT:-1}"
INIT_VERBOSE="${INIT_VERBOSE:-1}"

MAX_SEATS="${MAX_SEATS:-}"  # optional cap across all openvscode-* containers

# -------- Derived paths --------
IDENT="${ORG_ID}_${DEV_ENVIRONMENT}"
BASE="${HOST_BASE}/${IDENT}"
WS="${BASE}/vscodeworkspace"
LP="${BASE}/liveproject"

die(){ echo "ERR: $*" >&2; exit "${2:-1}"; }

# 1) Verify CephFS is mounted (HARD FAIL)
if ! mountpoint -q "${CEPH_ROOT}"; then
  die "CephFS not mounted at ${CEPH_ROOT}. Mount it and retry." 50
fi
if command -v findmnt >/dev/null 2>&1; then
  FSTYPE="$(findmnt -n -o FSTYPE "${CEPH_ROOT}" || true)"
  [ "${FSTYPE}" = "ceph" ] || die "${CEPH_ROOT} is mounted but fstype='${FSTYPE}' (expected 'ceph')." 51
fi

# 2) Create env folders if missing (auto-create ONCE; otherwise don't touch)
created="no"
if [[ ! -d "${WS}" || ! -d "${LP}" ]]; then
  echo "INFO: Creating environment folders for ${IDENT}…"
  sudo mkdir -p "${WS}" "${LP}"
  sudo chown "${CONTAINER_UID}:${CONTAINER_GID}" "${BASE}" "${WS}" "${LP}"
  sudo chmod 700 "${BASE}" "${WS}" "${LP}"
  created="yes"
fi

# 3) Verify ownership (HARD FAIL if mismatched; we DO NOT fix existing envs)
check_owner() {
  local p="$1" uid gid
  uid="$(stat -c '%u' "$p")" || return 1
  gid="$(stat -c '%g' "$p")" || return 1
  [[ "$uid" = "${CONTAINER_UID}" && "$gid" = "${CONTAINER_GID}" ]]
}

if [[ "${created}" = "no" ]]; then
  check_owner "${WS}" || die "Ownership mismatch on ${WS}. Found $(stat -c '%u:%g' "${WS}"), expected ${CONTAINER_UID}:${CONTAINER_GID}."
  check_owner "${LP}" || die "Ownership mismatch on ${LP}. Found $(stat -c '%u:%g' "${LP}"), expected ${CONTAINER_UID}:${CONTAINER_GID}."
fi

# 4) Seat cap (optional)
if [[ -n "${MAX_SEATS}" ]]; then
  RUNNING="$(docker ps --filter "name=^openvscode-" --format '{{.Names}}' | wc -l | tr -d ' ')"
  (( RUNNING < MAX_SEATS )) || die "All seats in use (${RUNNING}/${MAX_SEATS})." 48
fi

# 5) Container guards
if docker ps --format '{{.Names}}' | grep -qx "${NAME}"; then
  echo "Already running: ${NAME}"
  exit 0
fi
if docker ps -a --format '{{.Names}}' | grep -qx "${NAME}"; then
  docker rm -f "${NAME}" >/dev/null
fi

# 6) Run hardened container
exec docker run -d \
  --name "${NAME}" \
  --restart unless-stopped \
  --user "${CONTAINER_UID}:${CONTAINER_GID}" \
  --read-only \
  --tmpfs /tmp:rw,exec \
  --tmpfs /home/devuser/.cache:rw \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -e ORG_ID="${ORG_ID}" \
  -e DEV_ENVIRONMENT="${DEV_ENVIRONMENT}" \
  -e INIT_TIMEOUT="${INIT_TIMEOUT}" \
  -e INIT_STRICT="${INIT_STRICT}" \
  -e INIT_VERBOSE="${INIT_VERBOSE}" \
  -v "${WS}:/workspace:rw" \
  -v "${LP}:/liveproject:rw" \
  "${IMAGE}"
