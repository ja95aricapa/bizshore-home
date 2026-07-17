#!/usr/bin/env bash
# ci-deploy-shell — restricted login shell for the bizshore-01 CI deploy keys.
#
# When this script is set as the `command="..."` in `authorized_keys` for
# a CI-only SSH key, every SSH session opened by that key runs *only* this
# script — regardless of what the client types after the hostname. The
# client passes the subcommand (and, for the generic `app-*` subcommands,
# a project name) as positional arguments; the wrapper validates both
# against allowlists and bails on anything else.
#
# Subcommands (allowlist):
#   caddy-reload      Validate + reload the platform Caddy container.
#   platform-up       Alias for `app-up platform`.
#   app-up   <proj>   docker compose pull + up -d for a registered project.
#   app-down <proj>   docker compose down for a registered project.
#   app-sync <proj>   Read a tar stream from stdin containing EXACTLY the
#                      project's declared SYNC_FILES and atomically
#                      replace those files under the project's directory.
#                      No sudo needed — ci-deploy owns every project
#                      directory under /data/applications outright.
#   autotrade-up/-down/-sync
#                      Back-compat aliases for `app-{up,down,sync} autotrade`
#                      — kept so the existing deploy-bizshore01.yml workflow
#                      and the existing sudoers rule (scoped to autotrade's
#                      exact compose paths) keep working unchanged. New
#                      projects should use the generic `app-*` form.
#   rsync-ok          No-op smoke test for SSH reachability + sudo wiring.
#
# Onboarding a new project == one new file (see ops/projects/_TEMPLATE.conf)
# plus one new sudoers line — no edits to this script. See "Onboarding a
# new project" below for the exact steps; `ops/new-project.sh` in this
# repo generates the conf file + prints the sudoers line + the Caddy vhost
# + the GitHub Actions workflow skeleton in one shot.
#
# Project registry: each file in /etc/ci-deploy/projects/<name>.conf
# declares plain bash variables — PROJECT_DIR, COMPOSE_FILES,
# COMPOSE_PROFILES (optional), ENV_FILES (optional), SYNC_FILES (optional,
# omit entirely for a project that never needs `app-sync`, e.g. one
# deployed by rsyncing full source instead of just compose files). These
# files live OUTSIDE the repo (root-owned, ci-deploy has no write access)
# so a compromised CI key can never add or edit a project registry entry
# to point `app-up`/`app-sync` at an arbitrary path — only root can. The
# canonical copies are versioned in THIS repo at ops/projects/*.conf;
# install/update them at /etc/ci-deploy/projects/ the same way this
# script itself is installed to /usr/local/bin/ci-deploy-shell (see
# "Out of scope" below).
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
#     Each NEW project needs its own line here, scoped to its own compose
#     path(s) — `ops/new-project.sh` prints the exact line to add.
#   - Copy this script to /usr/local/bin/ci-deploy-shell (chmod 755,
#     root:root). The version in this repo is the source of truth; sync
#     to /usr/local/bin/ci-deploy-shell after every change here.
#   - Copy ops/projects/*.conf to /etc/ci-deploy/projects/ (chmod 644,
#     root:root) — same sync discipline as the wrapper script itself.
#
# Audit log: every invocation appends to /var/log/ci-deploy.log via tee,
# regardless of subcommand. GitHub Actions also captures the live stdout
# for the workflow run; the local log is the durable record for server-
# side correlation.

set -euo pipefail

DOCKER=/usr/bin/docker
PROJECTS_DIR="/etc/ci-deploy/projects"

log_file="/var/log/ci-deploy.log"
exec &> >(tee -a "${log_file}")

ts() { date -Iseconds; }
log() { printf '[%s] %s\n' "$(ts)" "$*"; }

# --- generic project registry + compose helpers -----------------------

# Populates PROJECT_DIR / COMPOSE_FILES / COMPOSE_PROFILES / ENV_FILES /
# SYNC_FILES from /etc/ci-deploy/projects/<project>.conf. The project
# name is validated BEFORE it ever touches a filesystem path — no `/`,
# no `..`, no leading dot, lowercase alnum/dash/underscore only — so
# there is no path-traversal surface even though the name comes straight
# from $SSH_ORIGINAL_COMMAND.
_load_project() {
  local project="$1"
  if [[ ! "${project}" =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
    log "REFUSED: invalid project name '${project}'"
    exit 65 # EX_DATAERR
  fi
  local conf="${PROJECTS_DIR}/${project}.conf"
  if [[ ! -f "${conf}" ]]; then
    log "REFUSED: unknown project '${project}' (no ${conf})"
    exit 65
  fi
  PROJECT_DIR=""
  COMPOSE_FILES=()
  COMPOSE_PROFILES=()
  ENV_FILES=()
  SYNC_FILES=()
  # shellcheck disable=SC1090
  source "${conf}"
  : "${PROJECT_DIR:?${conf} must set PROJECT_DIR}"
  [ "${#COMPOSE_FILES[@]}" -gt 0 ] || {
    log "REFUSED: ${conf} declares no COMPOSE_FILES"
    exit 65
  }
}

# Builds the COMPOSE_ARGS array (-f/--profile/--env-file flags) from the
# variables _load_project just populated. Every loop is guarded by an
# explicit length check (`${#arr[@]} -gt 0`) instead of the more common
# `for x in "${arr[@]:-}"` idiom — under `set -e`, a bare `[ -n "$x" ] &&
# foo` statement in a loop body that runs exactly once with an empty
# string (which is what `${arr[@]:-}` produces for a truly empty array)
# evaluates to the `[ -n "" ]` failure's exit status, and `set -e` treats
# that top-level non-zero status as a reason to abort the WHOLE script,
# silently, with no error message — confirmed by hand against a project
# with empty COMPOSE_PROFILES/ENV_FILES before landing this version.
_build_compose_args() {
  COMPOSE_ARGS=()
  local f p e
  for f in "${COMPOSE_FILES[@]}"; do
    COMPOSE_ARGS+=(-f "${PROJECT_DIR}/${f}")
  done
  if [ "${#COMPOSE_PROFILES[@]}" -gt 0 ]; then
    for p in "${COMPOSE_PROFILES[@]}"; do
      COMPOSE_ARGS+=(--profile "${p}")
    done
  fi
  if [ "${#ENV_FILES[@]}" -gt 0 ]; then
    for e in "${ENV_FILES[@]}"; do
      COMPOSE_ARGS+=(--env-file "${PROJECT_DIR}/${e}")
    done
  fi
}

app_up() {
  local project="$1"
  _load_project "${project}"
  _build_compose_args
  log "subcommand=app-up project=${project} start"
  sudo "${DOCKER}" compose "${COMPOSE_ARGS[@]}" pull
  sudo "${DOCKER}" compose "${COMPOSE_ARGS[@]}" up -d
  log "subcommand=app-up project=${project} OK"
}

app_down() {
  local project="$1"
  _load_project "${project}"
  _build_compose_args
  log "subcommand=app-down project=${project} start"
  sudo "${DOCKER}" compose "${COMPOSE_ARGS[@]}" down
  log "subcommand=app-down project=${project} OK"
}

# Reads a gzipped tar from stdin (the client pipes it over the same
# channel sshd already opened for the forced command) containing EXACTLY
# the project's declared SYNC_FILES. Buffered to disk once (stdin can't
# be re-read), then the member list is validated against an exact
# allowlist BEFORE anything is extracted into PROJECT_DIR — this blocks
# path traversal (`../`, absolute paths), symlink entries, and any file
# outside the declared set. Extraction lands in a scratch dir first and
# files are moved into place one at a time so a mid-extract failure
# never leaves PROJECT_DIR with a half-written compose file. The scratch
# dir is created UNDER PROJECT_DIR (not /tmp) so the final `mv` lands on
# the same filesystem and is a real atomic rename, not a cross-
# filesystem copy+delete.
app_sync() {
  local project="$1"
  _load_project "${project}"
  if [ "${#SYNC_FILES[@]}" -eq 0 ]; then
    log "REFUSED app-sync: project '${project}' declares no SYNC_FILES"
    exit 65
  fi

  log "subcommand=app-sync project=${project} start"
  local tmp_dir
  tmp_dir="$(mktemp -d "${PROJECT_DIR}/.sync-tmp.XXXXXX")"
  trap 'rm -rf "${tmp_dir}"' EXIT
  local archive="${tmp_dir}/payload.tar.gz"
  cat >"${archive}"

  local members expected
  members="$(tar -tzf "${archive}" 2>/dev/null | sort || true)"
  expected="$(printf '%s\n' "${SYNC_FILES[@]}" | sort)"
  if [ "${members}" != "${expected}" ]; then
    log "REFUSED app-sync: unexpected archive contents for ${project}: ${members}"
    exit 65
  fi

  local extract_dir="${tmp_dir}/extracted"
  mkdir -p "${extract_dir}"
  tar -xzf "${archive}" -C "${extract_dir}" \
    --no-same-owner --no-same-permissions

  local f
  for f in "${SYNC_FILES[@]}"; do
    [ -f "${extract_dir}/${f}" ] || {
      log "REFUSED app-sync: ${f} missing after extraction for ${project}"
      exit 65
    }
    chmod 644 "${extract_dir}/${f}"
    mv -f "${extract_dir}/${f}" "${PROJECT_DIR}/${f}"
  done
  log "subcommand=app-sync project=${project} OK (${SYNC_FILES[*]})"

  # Explicit cleanup + clear the trap on the success path: `tmp_dir` is
  # `local` to this function, so once it returns to the caller the
  # variable no longer exists — a lingering `trap ... EXIT` set above
  # would then fire at the SCRIPT's eventual exit (after this function
  # already returned) referencing an out-of-scope variable, which
  # `set -u` treats as a hard error ("tmp_dir: unbound variable").
  # Confirmed by hand before landing this version. The early-exit paths
  # above (`exit 65`) don't need this: `exit` fires the trap immediately,
  # while still inside this function's dynamic scope, so `tmp_dir` is
  # still live there.
  rm -rf "${tmp_dir}"
  trap - EXIT
}

# --- dispatch -----------------------------------------------------------

# sshd invokes this script directly (no args) when it's set as a forced
# `command="..."` in authorized_keys — the client's requested command lands
# in $SSH_ORIGINAL_COMMAND, not in $1. Subcommands here are bare words
# (plus an optional project-name second word), so plain word-splitting
# into positional params is safe.
set -- ${SSH_ORIGINAL_COMMAND:-}

case "${1:-}" in
  caddy-reload)
    log "subcommand=caddy-reload start"
    _load_project platform
    sudo "${DOCKER}" compose -f "${PROJECT_DIR}/compose.yaml" \
      exec caddy caddy validate --config /etc/caddy/Caddyfile
    sudo "${DOCKER}" compose -f "${PROJECT_DIR}/compose.yaml" \
      exec caddy caddy reload --config /etc/caddy/Caddyfile
    log "subcommand=caddy-reload OK"
    ;;

  platform-up)
    log "subcommand=platform-up (alias for 'app-up platform')"
    app_up platform
    ;;

  app-up)
    [ -n "${2:-}" ] || {
      log "REFUSED app-up: missing project name"
      exit 64 # EX_USAGE
    }
    app_up "$2"
    ;;

  app-down)
    [ -n "${2:-}" ] || {
      log "REFUSED app-down: missing project name"
      exit 64
    }
    app_down "$2"
    ;;

  app-sync)
    [ -n "${2:-}" ] || {
      log "REFUSED app-sync: missing project name"
      exit 64
    }
    app_sync "$2"
    ;;

  autotrade-up)
    log "subcommand=autotrade-up (alias for 'app-up autotrade')"
    app_up autotrade
    ;;

  autotrade-down)
    log "subcommand=autotrade-down (alias for 'app-down autotrade')"
    app_down autotrade
    ;;

  autotrade-sync)
    log "subcommand=autotrade-sync (alias for 'app-sync autotrade')"
    app_sync autotrade
    ;;

  rsync-ok)
    # Connection smoke test: confirms the key + wrapper + sudo all
    # resolve end-to-end. Cheap (no docker invocations) and idempotent.
    log "subcommand=rsync-ok (handshake probe)"
    echo "ci-deploy-shell OK $(ts)"
    ;;

  *)
    log "REFUSED subcommand: '${1:-<empty>}' from ${SSH_CLIENT:-<no-ssh>}"
    cat >&2 <<EOF
Allowed subcommands:
  caddy-reload        Validate + reload platform Caddy
  platform-up         docker compose pull + up -d for the platform stack
  app-up   <project>  docker compose pull + up -d for a registered project
  app-down <project>  docker compose down for a registered project
  app-sync <project>  Sync a project's compose/env files (tar.gz over stdin)
  autotrade-up/-down/-sync   Back-compat aliases for 'app-* autotrade'
  rsync-ok            Smoke test for SSH reachability
EOF
    exit 64
    ;;
esac
