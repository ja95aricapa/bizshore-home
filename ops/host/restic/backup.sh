#!/usr/bin/env bash
# Backup script for bizshore-01. Destination: Google Drive via rclone —
# see ops/host/restic/README.md ("Estado: activo") for the full setup.
# Parameterized via env vars so a future destination change only touches
# /etc/restic/env, not this file.
#
# What gets backed up: /data (static sites, ops/platform config, app
# source tree + .env.production under /data/applications/autotrade — see
# "Secrets" note below) PLUS the `autotrade_backups` Docker named volume,
# resolved dynamically below via `docker volume inspect`. That volume
# holds autotrade's own `backup-runner` worker's `pg_dump` output — its
# real host path lives under Docker's relocated data-root
# (/data/docker/volumes/..., confirmed via `docker info --format
# '{{.DockerRootDir}}'`), which is NOT one of the plain BACKUP_PATHS
# entries above and was silently never captured before this fix. Other
# named volumes (pg_data, redis_data, caddy_data, ...) are deliberately
# NOT added here: a raw file-level snapshot of a *live* Postgres data
# directory is not crash-consistent without WAL archiving or stopping
# the DB first — `backup-runner`'s pg_dump output (a proper logical,
# transaction-consistent snapshot) is the correct thing to back up, and
# this script now captures exactly that.
#
# Secrets: `.env.production` sits inside `/data/applications/autotrade`
# (a full BACKUP_PATHS entry) with no --exclude flag below, so it IS
# backed up — restic encrypts client-side before it ever leaves the
# host, so the destination (Google Drive) never sees it in plaintext.
# This is the deliberate choice: losing the only copy of every
# production secret in a disk failure is a worse outcome than an
# encrypted offsite copy of them.

set -euo pipefail

ENV_FILE="/etc/restic/env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. This script is not configured yet —" >&2
  echo "see ops/host/restic/README.md to pick a destination and set it up." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set in $ENV_FILE}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE must be set in $ENV_FILE}"

BACKUP_PATHS=(
  /data/static-sites
  /data/applications/platform/caddy
  /data/applications/autotrade
)

log() { printf '[%s] %s\n' "$(date -Iseconds)" "$*"; }

# Resolve the autotrade backups volume's real host path dynamically —
# never hardcode a /data/docker/volumes/... path, it depends on Docker's
# configured data-root (`docker info --format '{{.DockerRootDir}}'`) and
# on the Compose project name (volume name prefix), both of which could
# change. Missing volume is a warning, not a hard failure: a fresh host
# before autotrade's first deploy shouldn't block the rest of the backup.
autotrade_backups_mount="$(docker volume inspect autotrade_backups --format '{{.Mountpoint}}' 2>/dev/null || true)"
if [ -n "${autotrade_backups_mount}" ] && [ -d "${autotrade_backups_mount}" ]; then
  BACKUP_PATHS+=("${autotrade_backups_mount}")
  log "including autotrade_backups volume: ${autotrade_backups_mount}"
else
  log "WARNING: autotrade_backups Docker volume not found — skipping (DB dumps will NOT be backed up this run)"
fi

log "restic backup start"
restic backup "${BACKUP_PATHS[@]}" \
  --exclude-caches \
  --tag bizshore-01 \
  --tag "$(date +%Y-%m)"
log "restic backup done"

# Keep 7 daily, 4 weekly, 6 monthly snapshots — prunes anything older.
# Adjust once real backup size/frequency is known; these are reasonable
# defaults for a low-change config + small app-data footprint.
log "restic forget/prune start"
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
log "restic forget/prune done"

log "restic check (read-data-subset, cheap integrity spot-check)"
restic check --read-data-subset=5%
log "restic check done"
