# Deploy de bizshore-home a bizshore-server

> Mapa completo de infraestructura (todas las apps, credenciales, y qué vive
> dónde en el server): `ops/INFRAESTRUCTURA.md`.

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
echo 'command="/usr/bin/rrsync -wo /data/static-sites/bizshore-home",no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA...(pública aquí)... github-actions-bizshore-home' >> ~/.ssh/authorized_keys
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

> El tráfico llega al server vía **Cloudflare Tunnel**, no por IP
> pública directa — agregar un vhost nuevo en Caddy no alcanza, también
> hay que publicar el hostname en el dashboard de Cloudflare (Zero
> Trust → Tunnels). Ver la sección "Arquitectura de red: Cloudflare
> Tunnel" en `ops/caddy/README.md` antes de dar de alta un subdominio.

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
> bloques `:80 {}` duplicados** que referenciaban `/srv/static/main` para
> cualquier hostname. Se confirmó en el server que ese directorio no
> existe (contenido fantasma, nunca montado), así que la estructura
> modular lo reemplaza sin sustituto, solo con el vhost explícito
> `apps/bizshore-home.caddy`. Ver `ops/caddy/README.md` antes de aplicar.

### Mejora futura

Cuando el server tenga varios vhosts y los cambios al Caddyfile sean
frecuentes, conviene automatizar el rsync y el reload dentro de
`.github/workflows/deploy.yml` con una llave SSH separada restringida a
`caddy reload`. Por ahora la sincronización es manual.

## 5. Primer deploy

Push a `main` dispara `.github/workflows/deploy.yml`: build con Vite y
`rsync --delete` del `dist/` hacia `/data/static-sites/bizshore-home/`.

## 6. Deploy automatizado de `ops/` (Caddyfile + compose.yaml del stack platform)

Esta sección documenta cómo se pasó del flujo manual (`./ops/caddy/sync.sh`)
al automatizado (`.github/workflows/deploy-ops.yml`). Es **one-time setup**
en el servidor más el alta de nuevos secrets en GH.

### 6.1 Por qué dos llaves SSH separadas

`ops/caddy/` y `ops/platform/` se despliegan con dos operaciones distintas
que requieren restricciones distintas, y `authorized_keys` no admite
mezclar patrones:

- **rsync de archivos** → llave restringida vía `rrsync` (la herramienta
  incluye en el paquete `rsync`). El servidor corre `rrsync -wo <path>`
  como shell forzado para esa llave: puede escribir en un único path y
  nada más. Patrón ya usado por la llave de SPA (`DEPLOY_SSH_KEY`).
  Nota: la reescritura en Python de `rrsync` (rsync 3.2.x+) usa `-wo`
  (write-only) en minúscula, no `-W` — confirmar con `rrsync --help`
  en el server antes de copiar este patrón, la sintaxis cambia entre
  versiones.
- **cargar la nueva config** → llave restringida vía `command="..."` que
  apunta al wrapper `/usr/local/bin/ci-deploy-shell` (versionado en este
  repo bajo `ops/ci-deploy-shell.sh`). El wrapper valida el subcomando
  contra un allowlist (`caddy-reload`, `platform-up`, `autotrade-up`,
  `rsync-ok`) y rechaza todo lo demás con exit 64.

Mezclar las dos restricciones en una sola llave no funciona: `rrsync`
necesita una shell normal para correr rsync remoto; `command="..."`
reemplaza la shell entera. Por eso son dos llaves distintas y por eso
el workflow las inyecta por separado (la de rsync vía
`webfactory/ssh-agent`, la de shell directamente a `~/.ssh/`).

### 6.2 Crear las dos llaves

En tu máquina local:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/bizshore-home-ops-rsync  -N "" -C "github-actions-bizshore-home-ops-rsync"
ssh-keygen -t ed25519 -f ~/.ssh/bizshore-home-ops-shell  -N "" -C "github-actions-bizshore-home-ops-shell"
```

### 6.3 Crear el usuario `ci-deploy` en el server

```bash
ssh bizshore-server
sudo useradd -m -s /bin/bash ci-deploy       # shell=/bin/bash para que command= funcione; no le damos password.
sudo install -m 700 -d /home/ci-deploy/.ssh
```

El usuario existe solo para hospedar las llaves de CI; ningún login
interactivo es posible (no tiene password y el único método de auth es
la llave restringida). No agregarlo a `docker` group — sus privilegios
sobre docker se otorgan vía sudoers abajo.

### 6.4 Instalar el wrapper restringido

El wrapper vive en este repo bajo `ops/ci-deploy-shell.sh` y se copia
tal cual al server:

```bash
ssh bizshore-server
sudo install -m 755 ops/ci-deploy-shell.sh /usr/local/bin/ci-deploy-shell
sudo chown root:root /usr/local/bin/ci-deploy-shell
```

Después de **cada cambio** al archivo en este repo, repetir el `install`
para mantener el server sincronizado. Tratar `/usr/local/bin/ci-deploy-shell`
como config — no editarlo directo en el server.

### 6.5 Wirear las llaves en `authorized_keys`

Reemplazar las públicas que correspondan y los paths reales:

```bash
ssh bizshore-server
sudo tee -a /home/ci-deploy/.ssh/authorized_keys > /dev/null <<EOF
command="/usr/bin/rrsync -wo /data/applications/platform",no-agent-forwarding,no-X11-forwarding,no-pty $(cat ~/.ssh/bizshore-home-ops-rsync.pub)
command="/usr/local/bin/ci-deploy-shell",no-agent-forwarding,no-X11-forwarding,no-pty $(cat ~/.ssh/bizshore-home-ops-shell.pub)
EOF
sudo chown -R ci-deploy:ci-deploy /home/ci-deploy/.ssh
sudo chmod 600 /home/ci-deploy/.ssh/authorized_keys
```

### 6.6 `/etc/sudoers.d/ci-deploy` (alcance mínimo)

El wrapper hace `sudo docker compose ...`, así que `ci-deploy` necesita
sudo **sin password** pero solo para los comandos exactos que el wrapper
corre. Nada más:

```bash
ssh bizshore-server
sudo tee /etc/sudoers.d/ci-deploy > /dev/null <<'EOF'
ci-deploy ALL=(root) NOPASSWD: /usr/bin/docker compose -f /data/applications/platform/compose.yaml *
ci-deploy ALL=(root) NOPASSWD: /usr/bin/docker compose -f /data/applications/autotrade/docker-compose.yml *
ci-deploy ALL=(root) NOPASSWD: /usr/bin/docker compose -f /data/applications/autotrade/docker-compose.yml -f /data/applications/autotrade/docker-compose.bizshore01.yml *
EOF
sudo chmod 440 /etc/sudoers.d/ci-deploy
sudo visudo -c -f /etc/sudoers.d/ci-deploy   # validar sintaxis
```

Cualquier `sudo docker ...` que el wrapper intente correr fuera de esa
allowlist va a fallar con "password required" → el wrapper falla con
exit 1 → el job de GH Actions falla ruidosamente. Esa es la red de
seguridad primaria: aunque alguien comprometido edite el wrapper en el
server (que NO debería pasar — siempre se edita acá), no puede escalar
más allá de `docker compose` sobre esas dos rutas exactas.

### 6.7 Crear el archivo de auditoría

El wrapper hace `tee -a /var/log/ci-deploy.log`. Asegurarse de que
existe y es escribible:

```bash
ssh bizshore-server
sudo touch /var/log/ci-deploy.log
sudo chown syslog:adm /var/log/ci-deploy.log   # o root:adm; rotar con logrotate cuando crezca
sudo chmod 664 /var/log/ci-deploy.log
```

### 6.8 Secrets adicionales en GitHub

A los seis ya listados en §4, sumar estos cinco:

| Secret | Valor |
| --- | --- |
| `DEPLOY_OPS_SSH_KEY` | contenido de `~/.ssh/bizshore-home-ops-rsync` (la privada) |
| `DEPLOY_OPS_SSH_KEY_SHELL` | contenido de `~/.ssh/bizshore-home-ops-shell` (la privada) |
| `DEPLOY_OPS_SSH_HOST` | `100.127.85.94` (IP Tailscale del server, igual que `DEPLOY_SSH_HOST`) |
| `DEPLOY_OPS_SSH_USER` | `ci-deploy` |
| (no nuevos) | `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` / `TS_OAUTH_SECRET` se reusan; ya autorizan `tag:ci` a SSH al server desde §3. |

### 6.9 Qué dispara el workflow y qué hace

`.github/workflows/deploy-ops.yml` corre en push a `main` cuando cambian
archivos bajo `ops/caddy/` o `ops/platform/` (filtrado vía
`dorny/paths-filter`):

- `ops/caddy/**` cambia solo → rsync + `caddy reload` (sin restart de
  containers). Rápido, cero downtime.
- `ops/platform/**` cambia solo → rsync de compose.yaml + `docker compose
  pull && up -d`. Recrea containers — incluido el propio Caddy y/o
  cloudflared — por lo que puede afectar in-flight requests unos segundos.
- Ambos cambian → `platform-up` primero (recrea containers ya redifinidos
  por `ops/caddy/`) + un `caddy-reload` final como pasada de validación.

El wrapper agrega cada invocación a `/var/log/ci-deploy.log` con
timestamp, sea exitosa o rechazada. GH Actions también captura stdout
del job. En cualquier discrepancia, el log del server es la fuente de
verdad durable.

### 6.10 Rollback

Si un cambio a `ops/caddy/` rompe la config:

```bash
ssh bizshore-server "cd /data/applications/platform && git -C /data/applications/platform log --oneline ops/caddy/"
# identificar el commit previo bueno; el directorio es un clone del repo
ssh bizshore-server "git checkout HEAD~1 -- ops/caddy/"
# o desde acá, re-sync con el commit anterior:
git checkout HEAD~1 -- ops/caddy/
./ops/caddy/sync.sh   # o push al main y dejar que el workflow corra
```

> Importante: `/data/applications/platform/` no es hoy un worktree de
> git en el server — es solo un directorio sincronizado por rsync.
> Para hacer `git checkout` desde el server como en el primer ejemplo,
> hay que inicializarlo como worktree: `git clone --bare . /var/repos/bizshore-home.git && git --git-dir=/var/repos/bizshore-home.git --work-tree=/data/applications/platform checkout -f main`. **No hacerlo todavía** — los rollbacks hoy son desde la máquina local (segundo bloque de comandos) y vuelven a deployarse por CI.

## 7. Endurecimiento del host: monitoreo, backups y SSH

Herramientas que no son específicas de ningún proyecto — protegen y dan
visibilidad sobre el server entero. Versionadas en `ops/host/`, cada una
con su propio README con los pasos exactos:

- **`ops/host/fail2ban/`** — rate-limiting de intentos SSH fallidos.
  Listo para instalar, sin decisiones pendientes.
- **`ops/host/restic/`** — backups cifrados e incrementales de `/data`.
  Preparado pero no activado — falta elegir destino (Backblaze B2, otro
  host propio por SFTP, o solo local). Ver el README para las 3
  opciones con costos y trade-offs.
- **Uptime Kuma** — no vive en `ops/host/` porque sí es un container
  (`uptime-kuma` en `ops/platform/compose.yaml`), pero es la pieza de
  monitoreo/alertas que le da sentido a fail2ban + restic — sin
  visibilidad, un ban o un backup roto pasan desapercibidos. Ver
  `ops/platform/README.md` → "Observabilidad: Uptime Kuma" para
  exponerlo vía Cloudflare Tunnel igual que cualquier otra app del
  patrón.

Ninguna de las tres depende de las otras — se pueden instalar en
cualquier orden, o solo una si por ahora alcanza con eso.
