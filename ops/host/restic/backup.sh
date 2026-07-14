#!/usr/bin/env bash
# Backup script for bizshore-01 — NOT wired to run yet. Destination
# (Backblaze B2 / another host via SFTP / local disk) is undecided as of
# 2026-07-14; this script is deliberately parameterized via env vars so
# whichever destination gets chosen later only requires setting
# RESTIC_REPOSITORY + RESTIC_PASSWORD_FILE (+ B2_ACCOUNT_ID/B2_ACCOUNT_KEY
# if the destination ends up being B2) in /etc/restic/env, not editing
# this file. See ops/host/restic/README.md for the three options and
# exact setup steps for each.
#
# What gets backed up: /data (static sites, ops/platform config, and any
# app-specific volumes bind-mounted under /data) plus named Docker
# volumes via `docker run --rm -v <volume>:/vol ... tar` snapshots — NOT
# implemented in this first cut, only bind-mounted /data is covered.
# Extend the `restic backup` targets below once named-volume backup is
# needed (e.g. uptime_kuma_data, caddy_data).
#
# Explicitly NOT backed up: anything under /data/applications/*/.env* or
# .env.production — those are already the single copy of a secret with
# no upstream source of truth (unlike code, which lives in git), so they
# arguably SHOULD be backed up too. Decide deliberately once the
# destination is chosen: an encrypted restic repo protects secrets at
# rest reasonably well, but this is a call worth making on purpose, not
# by default inclusion.

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
