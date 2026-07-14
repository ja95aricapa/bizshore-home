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

Pasos en el admin de Tailscale (<https://login.tailscale.com/admin/settings/oauth>):

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

El Caddyfile del server ahora sigue una **estructura modular** versionada
en este repo bajo `ops/caddy/`. Ver `ops/caddy/README.md` para la
estructura completa, la convención de subdominios y los pasos para
agregar un nuevo vhost.

Para una primera instalación, sincronizar todo el directorio y recargar
Caddy. El helper `ops/caddy/sync.sh` automatiza el flujo (rsync +
`caddy validate` + `caddy reload`):

```bash
./ops/caddy/sync.sh
```

Si preferís correr los pasos a mano, equivale a:

```bash
rsync -az ops/caddy/ bizshore-server:/data/applications/platform/caddy/
ssh bizshore-server "cd /data/applications/platform && docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile"
ssh bizshore-server "cd /data/applications/platform && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
```

> Migración desde el Caddyfile viejo: el archivo anterior tenía **dos
> bloques `:80 {}` duplicados** que servían `/srv/static/main` para
> cualquier hostname. La estructura modular los reemplaza por vhosts
> explícitos (`apps/bizshore-home.caddy` para el sitio corporativo,
> `apps/_legacy-main.caddy` como placeholder transitorio del contenido
> legacy). Ver `ops/caddy/README.md` antes de aplicar.

### Mejora futura

Cuando el server tenga varios vhosts y los cambios al Caddyfile sean
frecuentes, conviene automatizar el rsync y el reload dentro de
`.github/workflows/deploy.yml` con una llave SSH separada restringida a
`caddy reload`. Por ahora la sincronización es manual.

## 5. Primer deploy

Push a `main` dispara `.github/workflows/deploy.yml`: build con Vite y
`rsync --delete` del `dist/` hacia `/data/static-sites/bizshore-home/`.
