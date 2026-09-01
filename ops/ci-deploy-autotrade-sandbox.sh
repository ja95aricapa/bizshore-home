#!/usr/bin/env bash
# Root-only bridge for the restricted ci-deploy shell.
#
# docker stack deploy has no --env-file option. This helper is deliberately
# separate from ci-deploy-shell: the latter must not read .env.production,
# which contains all application secrets.

set -euo pipefail

readonly APP_DIR="/data/applications/autotrade"
readonly STACK_FILE="${APP_DIR}/docker-stack.sandbox.yml"

[[ "$(id -u)" -eq 0 ]] || {
  echo "ci-deploy-autotrade-sandbox must run as root" >&2
  exit 1
}
[[ -r "${APP_DIR}/.env.production" ]] || {
  echo "missing readable ${APP_DIR}/.env.production" >&2
  exit 1
}
[[ -r "${APP_DIR}/bizshore01.env" ]] || {
  echo "missing readable ${APP_DIR}/bizshore01.env" >&2
  exit 1
}
[[ -r "${STACK_FILE}" ]] || {
  echo "missing readable ${STACK_FILE}" >&2
  exit 1
}

set -a
# shellcheck disable=SC1091
source "${APP_DIR}/.env.production"
# shellcheck disable=SC1091
source "${APP_DIR}/bizshore01.env"
set +a

exec /usr/bin/docker stack deploy \
  --with-registry-auth \
  -c "${STACK_FILE}" \
  autotrade_sandbox
