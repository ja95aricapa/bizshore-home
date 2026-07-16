#!/usr/bin/env bash
# ci-deploy-shell — restricted login shell for the bizshore-01 CI deploy keys.
#
# When this script is set as the `command="..."` in `authorized_keys` for
# a CI-only SSH key, every SSH session opened by that key runs *only* this
# script — regardless of what the client types after the hostname. The
# client passes the subcommand as the first positional argument; the
# wrapper validates it against an allowlist and bails on anything else.
#
# Subcommands (allowlist):
#   caddy-reload    Validate + reload the platform Caddy container.
#   platform-up     docker compose pull + up -d for the platform stack.
#   autotrade-up    docker compose pull + up -d for the autotrade stack
#                   (uses docker-compose.bizshore01.yml override).
#   autotrade-down  docker compose down for the autotrade stack (full
#                   stop, used for rollback / destructive recreate).
#   rsync-ok        No-op smoke test for SSH reachability + sudo wiring.
#
# Out of scope here (must be done elsewhere on the server, see
# ops/DEPLOY.md §6):
#   - Create a dedicated user `ci-deploy` (no password, shell=/bin/bash
#     but login only possible via the restricted key — no interactive
#     password auth).
#   - Add each CI public key to /home/ci-deploy/.ssh/authorized_keys with
#     `command="/usr/local/bin/ci-deploy-shell"` plus
#     `no-agent-forwarding,no-X11-forwarding,no-pty`.
#   - /etc/sudoers.d/ci-deploy grants passwordless sudo for ONLY:
#       /usr/bin/docker compose -f /data/applications/platform/compose.yaml *
#       /usr/bin/docker compose -f /data/applications/autotrade/docker-compose.yml *
#       /usr/bin/docker compose -f /data/applications/autotrade/docker-compose.yml -f /data/applications/autotrade/docker-compose.bizshore01.yml *
#   - Copy this script to /usr/local/bin/ci-deploy-shell (chmod 755,
#     root:root). The version in this repo is the source of truth; sync
#     to /usr/local/bin/ci-deploy-shell after every change here.
#
# Audit log: every invocation appends to /var/log/ci-deploy.log via tee,
# regardless of subcommand. GitHub Actions also captures the live stdout
# for the workflow run; the local log is the durable record for server-
# side correlation.

set -euo pipefail

PLATFORM_DIR="/data/applications/platform"
AUTOTRADE_DIR="/data/applications/autotrade"
DOCKER=/usr/bin/docker

log_file="/var/log/ci-deploy.log"
exec &> >(tee -a "${log_file}")

ts() { date -Iseconds; }
log() { printf '[%s] %s\n' "$(ts)" "$*"; }

# sshd invokes this script directly (no args) when it's set as a forced
# `command="..."` in authorized_keys — the client's requested command lands
# in $SSH_ORIGINAL_COMMAND, not in $1. Subcommands here are single bare
# words, so plain word-splitting into positional params is safe.
set -- ${SSH_ORIGINAL_COMMAND:-}

case "${1:-}" in
  caddy-reload)
    log "subcommand=caddy-reload start"
    sudo "${DOCKER}" compose -f "${PLATFORM_DIR}/compose.yaml" \
      exec caddy caddy validate --config /etc/caddy/Caddyfile
    sudo "${DOCKER}" compose -f "${PLATFORM_DIR}/compose.yaml" \
      exec caddy caddy reload --config /etc/caddy/Caddyfile
    log "subcommand=caddy-reload OK"
    ;;

  platform-up)
    log "subcommand=platform-up start"
    sudo "${DOCKER}" compose -f "${PLATFORM_DIR}/compose.yaml" pull
    sudo "${DOCKER}" compose -f "${PLATFORM_DIR}/compose.yaml" up -d
    log "subcommand=platform-up OK"
    ;;

  autotrade-up)
    log "subcommand=autotrade-up start"
    # The override file MUST be passed explicitly with -f (Compose does
    # NOT auto-load it). --env-file REPLACES the .env autoload, so the
    # .env.production file on the server must be passed explicitly too
    # alongside bizshore01.env. The deploy workflow's secrets must NOT
    # include either file — they live on the server only.
    sudo "${DOCKER}" compose \
      -f "${AUTOTRADE_DIR}/docker-compose.yml" \
      -f "${AUTOTRADE_DIR}/docker-compose.bizshore01.yml" \
      --profile auth \
      --env-file "${AUTOTRADE_DIR}/.env.production" \
      --env-file "${AUTOTRADE_DIR}/bizshore01.env" \
      pull
    sudo "${DOCKER}" compose \
      -f "${AUTOTRADE_DIR}/docker-compose.yml" \
      -f "${AUTOTRADE_DIR}/docker-compose.bizshore01.yml" \
      --profile auth \
      --env-file "${AUTOTRADE_DIR}/.env.production" \
      --env-file "${AUTOTRADE_DIR}/bizshore01.env" \
      up -d
    log "subcommand=autotrade-up OK"
    ;;

  autotrade-down)
    log "subcommand=autotrade-down start"
    # Full stop. Volumes are preserved by default (no -v). Used for
    # rollback when a new release is unbootable and the operator wants
    # to bring the bot completely down before manual recovery.
    sudo "${DOCKER}" compose \
      -f "${AUTOTRADE_DIR}/docker-compose.yml" \
      -f "${AUTOTRADE_DIR}/docker-compose.bizshore01.yml" \
      --env-file "${AUTOTRADE_DIR}/.env.production" \
      --env-file "${AUTOTRADE_DIR}/bizshore01.env" \
      down
    log "subcommand=autotrade-down OK"
    ;;

  rsync-ok)
    # Connection smoke test: confirms the key + wrapper + sudoers all
    # resolve end-to-end. Cheap (no docker invocations) and idempotent.
    log "subcommand=rsync-ok (handshake probe)"
    echo "ci-deploy-shell OK $(ts)"
    ;;

  *)
    log "REFUSED subcommand: '${1:-<empty>}' from ${SSH_CLIENT:-<no-ssh>}"
    cat >&2 <<EOF
Allowed subcommands:
  caddy-reload    Validate + reload platform Caddy
  platform-up     docker compose pull + up -d for the platform stack
  autotrade-up    docker compose pull + up -d for autotrade (bizshore01 override)
  autotrade-down  docker compose down for autotrade
  rsync-ok        Smoke test for SSH reachability
EOF
    exit 64  # EX_USAGE
    ;;
esac
