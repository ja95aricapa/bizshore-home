# Deploy de bizshore-home a bizshore-server

## 1. Directorio en el servidor

```bash
ssh bizshore-server "mkdir -p /data/static-sites/bizshore-home"
```

## 2. Llave SSH dedicada para GitHub Actions (no reusar tu llave personal)

En tu máquina local:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/bizshore-home-deploy -N "" -C "github-actions-bizshore-home"
```

En el servidor, agregar la **pública** a `authorized_keys` restringida solo a rsync
sobre esa carpeta (usa `rrsync`, incluido con el paquete `rsync`):

```bash
ssh bizshore-server
find / -name rrsync 2>/dev/null   # confirmar dónde quedó tras instalar rsync
echo 'command="/usr/bin/rrsync -W /data/static-sites/bizshore-home",no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA...(pública aquí)... github-actions-bizshore-home' >> ~/.ssh/authorized_keys
```

Esto evita que la llave de CI pueda hacer nada más que escribir en esa carpeta puntual.

## 3. Tailscale efímero para el runner de GitHub Actions

El runner de `ubuntu-latest` no está en tu tailnet, y abrir el puerto 22 a
internet para que cualquier runner de GitHub pueda tocarlo no es buena idea
(la IP pública 186.113.173.184 la comparten todos los jobs de GitHub Actions
del mundo, no es reservable). El workflow ya usa `tailscale/github-action`
para unirse al tailnet solo durante el job y desconectarse al terminar —
así el SSH sigue expuesto únicamente dentro de tu red Tailscale, como hoy.

Pasos en el admin de Tailscale (https://login.tailscale.com/admin/settings/oauth):

1. Crear un **OAuth client** con scope `devices:write` y el tag `tag:ci`.
2. En `Access Controls`, autorizar `tag:ci` a alcanzar el puerto 22 de
   `bizshore-01` (o del tag que tenga tu server ahí).

## 4. Secrets en GitHub (repo Settings → Secrets and variables → Actions)

| Secret | Valor |
| --- | --- |
| `TS_OAUTH_CLIENT_ID` | client id del OAuth client de Tailscale |
| `TS_OAUTH_SECRET` | secret del OAuth client de Tailscale |
| `DEPLOY_SSH_KEY` | contenido de `~/.ssh/bizshore-home-deploy` (la privada) |
| `DEPLOY_SSH_HOST` | `100.127.85.94` (IP de Tailscale del server, ahora sí alcanzable) |
| `DEPLOY_SSH_USER` | `ja95aricapa` |
| `DEPLOY_SSH_PATH` | `/data/static-sites/bizshore-home` |

## 4. Aplicar el Caddyfile (una sola vez)

Ver `ops/caddy/Caddyfile.snippet` en este repo — reemplaza los dos bloques
`:80 {}` duplicados en `/data/applications/platform/caddy/Caddyfile` por
bloques con dominio explícito, y recarga Caddy sin downtime:

```bash
cd /data/applications/platform && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## 5. Primer deploy

Push a `main` dispara `.github/workflows/deploy.yml`: build con Vite y
`rsync --delete` del `dist/` hacia `/data/static-sites/bizshore-home/`.
