#!/usr/bin/env bash
# Sync de ops/caddy/ hacia bizshore-server y reload de Caddy.
#
# Es el flujo manual documentado en ops/DEPLOY.md §4, empaquetado en un
# solo comando. Corre desde la raiz del repo, despues de editar archivos
# bajo ops/caddy/. El formato (caddy fmt) debe estar aplicado en local
# antes de correr este script; el contenedor de Caddy monta /etc/caddy
# read-only y no se puede formatear ahi.
#
# Requisitos:
#   - Acceso SSH al server (default: bizshore-server; override con
#     env var BIZSHORE_SERVER). Con llave con passphrase, cargarla antes
#     con `ssh-add ~/.ssh/bizshore-server-hp-01`.
#   - `docker compose` disponible en el server bajo
#     /data/applications/platform/.
#
# Cuando este flujo se vuelva frecuente, migrar a un paso de CI dentro de
# .github/workflows/deploy.yml con una llave SSH separada restringida a
# `caddy reload`. Ver ops/caddy/README.md "Mejora futura".

set -euo pipefail

SERVER="${BIZSHORE_SERVER:-bizshore-server}"
REMOTE_DIR="/data/applications/platform"

echo "→ rsync ops/caddy/ -> ${SERVER}:${REMOTE_DIR}/caddy/"
rsync -az ops/caddy/ "${SERVER}:${REMOTE_DIR}/caddy/"

echo "→ caddy validate en ${SERVER}"
ssh "${SERVER}" "cd ${REMOTE_DIR} && docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile"

echo "→ caddy reload en ${SERVER}"
ssh "${SERVER}" "cd ${REMOTE_DIR} && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"

cat <<'EOF'

OK. Smoke test recomendado:

    curl -sI https://www.bizshore.net/
    curl -sI https://www.bizshore.net/servicios
    curl -sI https://www.bizshore.net/contactenos
    curl -sI https://www.bizshore.net/landing/diagnostico-software
EOF
