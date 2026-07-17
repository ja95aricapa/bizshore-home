# Mapa de infraestructura BizShore

Vista de conjunto de cómo `bizshore-home` y `autotrade_bot_app` se despliegan, qué
vive dónde, y qué credenciales están en juego. Este documento es el punto de
partida — cada sección enlaza al README con el detalle operativo real.

Última revisión completa: 2026-07-15.

## Máquinas involucradas

| Máquina | Rol | Acceso |
| --- | --- | --- |
| Acer (local, dev) | Donde se edita código y se corren los `git push` / comandos manuales de deploy | Terminal directa |
| `bizshore-01` (HP, VM Ubuntu 26.04) | Server compartido. IP Tailscale `100.127.85.94`, alias SSH `bizshore-server` | SSH interactivo (llave personal) + Tailscale |
| GitHub Actions (`ubuntu-latest` runners) | Compila y despliega en CI, efímero | Sin acceso persistente — se une al tailnet solo durante el job |
| AWS (EC2 + ALB + Secrets Manager, `autotrade_bot_app`) | Deploy productivo actual del bot de trading | IAM via GitHub OIDC/keys, sin SSH |
| Cloudflare | DNS + Tunnel + edge TLS para `bizshore.net` | Dashboard + API token |
| Google Drive (personal) | Destino de los backups cifrados de `bizshore-01` (vía rclone) | OAuth token en `/etc/restic/rclone.conf` del server |

No hay IP pública expuesta en `bizshore-01`. Todo el tráfico entra por el
Cloudflare Tunnel — ver `ops/platform/README.md`.

## `bizshore-home` — sitio estático

```text
Acer (git push a main)
  → GitHub Actions: npm ci && npm run build
  → Tailscale efímero (tag:ci) se une al tailnet
  → rsync --delete dist/ vía llave rrsync restringida
  → bizshore-01:/data/static-sites/bizshore-home/  (SOLO el build, sin git/repo)
```

El repo **nunca vive clonado en el server** — la CI compila y transporta
únicamente el `dist/`, con una llave que solo puede escribir en esa carpeta
(`command="/usr/bin/rrsync -wo ..."` en `authorized_keys`). Detalle completo:
`ops/DEPLOY.md` §1-5.

`ops/caddy/` y `ops/platform/` se despliegan solos vía
`.github/workflows/deploy-ops.yml` (push a `main` que toque esos paths) —
ver la sección "CI/CD de `ops/`" más abajo. Ver `ops/caddy/README.md` y
`ops/platform/README.md` para el detalle de cada uno.

**GitHub Secrets usados** (repo `bizshore-home`):
- `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` — deploy del sitio (`deploy.yml`)
- `DEPLOY_SSH_KEY`, `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_PATH` — deploy del sitio
- `DEPLOY_OPS_SSH_KEY`, `DEPLOY_OPS_SSH_KEY_SHELL`, `DEPLOY_OPS_SSH_HOST`, `DEPLOY_OPS_SSH_USER` — deploy de `ops/` (`deploy-ops.yml`)

## `autotrade_bot_app` — plataforma de trading

Dos rutas de deploy activas, cada una con su propio modelo de confianza.
(Una tercera ruta, Cloudflare/VPS dedicado, se retiró — ver "Rutas
retiradas" abajo.)

### 1. AWS (activa, productiva, vía Terraform + SSM, sin SSH)

```text
GitHub Actions → tests + lint + terraform apply (EC2 + ALB + Secrets Manager)
  → build/push imágenes a GHCR
  → AWS SSM Run Command (sin SSH, rol IAM scoped a esa instancia)
    → bootstrap del repo, materializar secretos desde Secrets Manager/SSM,
      pinnear imágenes, `docker compose up`
  → smoke test /health
```

La más segura de las tres: ninguna llave SSH viaja a la instancia. Esta es
la ruta que corre el bot en vivo hoy. Detalle:
`autotrade_bot_app/.github/workflows/reusable-deploy.yml`,
`autotrade_bot_app/infra/README.md`.

**GitHub Secrets**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

### 2. `bizshore-01` — red compartida vía Cloudflare Tunnel (CI/CD completo, sin secretos productivos todavía)

```text
Push a main (backend/**, frontend/**, o compose)
  → GitHub Actions job build-and-push: build + push a
    ghcr.io/ja95aricapa/autotrade-{backend,frontend}
    tags: "bizshore01" (móvil) + "<sha>" (inmutable, rollback)
  → GitHub Actions job deploy: Tailscale efímero (tag:ci) →
    genera bizshore01.env pineado al SHA (o al tag móvil si el run no
    reconstruyó nada) → sincroniza compose+env vía `ssh ... app-sync
    autotrade` (tar.gz por stdin, validado server-side) →
    `ssh ci-deploy@bizshore-01 app-up autotrade` →
    wrapper ci-deploy-shell → sudo docker compose ... pull && up -d
    (--profile auth --profile observability)
  → reverse-proxy (Caddy interno, auto_https off) se une a la red
    compartida platform_edge
  → Cloudflare Tunnel rutea trade.bizshore.net y trade-api.bizshore.net
    directo por HTTP interno (TLS terminado en el Tunnel, mismo rol que
    el ALB de AWS)
```

**Estado real (2026-07-17)**: en producción, stack completo (auth, DB,
workers, observability). Cada push a `main` sincroniza y redeploya solo
— sin ningún paso manual (el sync de compose/env que antes era manual se
resolvió esta sesión, ver "Pendientes de seguridad" → "✅ Resueltos").
Rollback: `workflow_dispatch` con `image_tag` a cualquier SHA ya
publicado en GHCR. Detalle completo: `autotrade_bot_app/ops/DEPLOY-BIZSHORE01.md`.

Fuente de verdad del lado server (usuario `ci-deploy`, wrapper, sudoers,
audit log — compartido con `bizshore-home`): `ops/DEPLOY.md` §6.

**GitHub Secrets** (repo `autotrade_bot_app`): `BIZSHORE01_DEPLOY_SSH_KEY_SHELL`,
`BIZSHORE01_DEPLOY_SSH_HOST`, `BIZSHORE01_DEPLOY_SSH_USER`,
`BIZSHORE01_TS_OAUTH_CLIENT_ID`, `BIZSHORE01_TS_OAUTH_SECRET`.

### Rutas retiradas

**Cloudflare / VPS dedicado (Terraform)** — cerrada, código movido a
`infra/modules/cloudflare.disabled/` (commit `1a105a3`, 2026-07-14). No
existía VPS activo; los secrets `CLOUDFLARE_API_TOKEN` /
`VPS_SSH_PRIVATE_KEY` / `VPS_SSH_USER` deben rotarse/borrarse si siguen
en GitHub Settings — ya no los referencia ningún workflow.

## Mapa del filesystem en `bizshore-01`

```text
/data/
├── static-sites/
│   └── bizshore-home/            # dist/ compilado, sin git — repo bizshore-home
├── applications/
│   ├── platform/                 # Caddy de borde + cloudflared + Uptime Kuma — repo bizshore-home (ops/platform/)
│   │   ├── compose.yaml
│   │   └── caddy/                 # Caddyfile modular — repo bizshore-home (ops/caddy/)
│   └── autotrade/                # backend/frontend/reverse-proxy — repo autotrade_bot_app
│       ├── docker-compose.yml
│       ├── docker-compose.bizshore01.yml
│       ├── bizshore01.env
│       └── .env.production        # copiado a mano, NUNCA versionado, NUNCA en GH
/etc/
├── restic/                       # backups — NO es parte de ningún repo, ver ops/host/restic/
│   ├── env
│   ├── password
│   └── rclone.conf
├── sudoers.d/ci-deploy           # versionado en ops/DEPLOY.md §6.6, aplicado a mano — UNA línea por proyecto
├── fail2ban/jail.local           # versionado en ops/host/fail2ban/, aplicado a mano
└── ci-deploy/projects/           # registry de proyectos, versionado en ops/projects/*.conf, aplicado a mano
    ├── platform.conf
    ├── autotrade.conf
    └── <nuevo-proyecto>.conf     # uno por proyecto — ver "Onboarding" abajo
/var/log/ci-deploy.log            # audit log de cada invocación del wrapper
/home/ci-deploy/.ssh/authorized_keys   # 2 llaves restringidas por proyecto (rrsync + shell wrapper)
```

Ningún directorio bajo `/data/applications/` es un `git clone` — todo llega
por `rsync` (manual o vía CI) desde el Acer / GitHub Actions. Si algo se
edita directo en el server con `vim`, se pierde en el próximo sync y
además diverge de lo que dice el repo.

## Usuarios del sistema en `bizshore-01`

| Usuario | Propósito | Login |
| --- | --- | --- |
| `ja95aricapa` | Vos, interactivo, sudo completo | Llave personal (`~/.ssh/bizshore-server-hp-01` en la Acer) |
| `ci-deploy` | Hospeda las 4 llaves de CI (`bizshore-home` + `autotrade_bot_app`, cada una rsync + shell). Sin password, sin login interactivo posible | Solo las llaves restringidas de abajo |
| `root` | Dueño de `/etc/restic/*`, `/root/.docker/config.json` (auth de GHCR) | Solo vía `sudo` desde `ja95aricapa` o `ci-deploy` (sudoers acotado) |

## Llaves SSH — inventario completo

| Llave | Alcance server-side | Dónde se usa |
| --- | --- | --- |
| `~/.ssh/bizshore-server-hp-01` (Acer) | SSH interactivo, sin restricción, sudo completo | Solo sesiones manuales del Acer. **Nunca en CI.** |
| `~/.ssh/bizshore-home-deploy` | `command="rrsync -wo /data/static-sites/bizshore-home"` | `bizshore-home/.github/workflows/deploy.yml`, secret `DEPLOY_SSH_KEY` |
| `~/.ssh/bizshore-home-ops-rsync` | `command="rrsync -wo /data/applications/platform"` | `bizshore-home/.github/workflows/deploy-ops.yml`, secret `DEPLOY_OPS_SSH_KEY` |
| `~/.ssh/bizshore-home-ops-shell` | `command="/usr/local/bin/ci-deploy-shell"` (allowlist: `caddy-reload`, `platform-up`, `app-up`/`app-down`/`app-sync <proyecto>`, `autotrade-up`/`-down`/`-sync` alias, `rsync-ok`) | `bizshore-home/.github/workflows/deploy-ops.yml`, secret `DEPLOY_OPS_SSH_KEY_SHELL` |
| `~/.ssh/bizshore01-deploy-shell` | `command="/usr/local/bin/ci-deploy-shell"` (mismo wrapper, mismo allowlist) | `autotrade_bot_app/.github/workflows/deploy-bizshore01.yml`, secret `BIZSHORE01_DEPLOY_SSH_KEY_SHELL` |
| *(una por proyecto nuevo)* | Mismo wrapper — el aislamiento entre proyectos viene del registry (`/etc/ci-deploy/projects/<nombre>.conf`) + una línea de sudoers escopeada a ese proyecto, NO de una llave o usuario Unix distinto | Ver "Onboarding de un proyecto nuevo" abajo |

Todas las llaves de CI se unen al tailnet solo durante el job
(`tailscale/github-action` con OAuth client `tag:ci`) — el puerto 22 de
`bizshore-01` nunca queda expuesto a runners de GitHub por IP pública.

El wrapper `ci-deploy-shell` (versionado en `ops/ci-deploy-shell.sh`,
compartido por ambos repos) valida el subcomando contra un allowlist y
rechaza todo lo demás con exit 64; cada invocación queda en
`/var/log/ci-deploy.log` con timestamp. Detalle completo, incluidos los
5 bugs reales encontrados al wirear esto: `ops/DEPLOY.md` §6,
[memoria `bizshore01-ci-deploy-gotchas`].

## Red y TLS

- Cloudflare Tunnel (`cloudflared`) es el único punto de entrada — no hay
  puerto público abierto en `bizshore-01`.
- Red Docker compartida: `platform_edge` (nombre real, resuelto del
  project name `platform` + red `edge` en `ops/platform/compose.yaml`).
  Cualquier app nueva se une a esta red para ser alcanzable por el túnel.
- Cloudflare emite certificados gratis (Universal SSL) solo para el apex
  y un nivel de wildcard (`*.bizshore.net`). Subdominios de dos niveles
  (ej. `api.trade.bizshore.net`) no quedan cubiertos sin Advanced
  Certificate Manager — por eso `trade-api.bizshore.net`, no
  `api.trade.bizshore.net`.
- Dos patrones de vhost conviven a propósito:
  - `bizshore-home`: `auto_https` activo + certs ACME reales + SNI
    configurado por ruta en el túnel.
  - `autotrade_bot_app` / apps nuevas: `auto_https off` + HTTP plano
    interno (TLS ya terminado en el túnel). Patrón recomendado para
    apps nuevas — ver "Cómo publicar una app nueva" en
    `ops/platform/README.md`.
- Published application routes actuales: `bizshore.net`, `www.bizshore.net`
  → `caddy:443` (SNI); `trade.bizshore.net`, `trade-api.bizshore.net` →
  `autotrade-reverse-proxy:80`; `status.bizshore.net` → `uptime-kuma:3001`.

## Hardening del host (fuera de cualquier proyecto)

Estas tres piezas protegen `bizshore-01` en sí, no una app puntual —
viven en `ops/host/` (fail2ban, restic) y `ops/platform/compose.yaml`
(Kuma, porque es un container).

| Pieza | Qué hace | Estado |
| --- | --- | --- |
| **fail2ban** | Rate-limit de intentos SSH fallidos sobre el puerto 22 público (la llave interactiva, no las de CI que solo llegan por Tailscale) | Activo, validado |
| **restic** | Backup diario cifrado (`03:15`, `restic-backup.timer`) de `/data/static-sites`, `/data/applications/platform/caddy`, `/data/applications/autotrade` (código + `.env.production` — SÍ se backupea, cifrado client-side antes de salir del host, es preferible a perder el único secreto en un fallo de disco) + el volumen Docker `autotrade_backups` (resuelto dinámicamente, contiene los `pg_dump` de la DB real) hacia Google Drive vía `rclone:` | Activo, backup + check + restore de prueba verificados |
| **Uptime Kuma** | Monitorea 4 hostnames (`www.bizshore.net`, `bizshore.net`, `trade.bizshore.net`, `trade-api.bizshore.net`) con alertas a Telegram | Activo, 4 monitors + notificaciones configuradas |

Detalle de cada uno: `ops/host/fail2ban/README.md`,
`ops/host/restic/README.md`, `ops/platform/README.md` →
"Observabilidad: Uptime Kuma".

## Onboarding de un proyecto nuevo ("Fargate-lite", sin Kubernetes)

`bizshore-01` no corre Kubernetes a propósito — el objetivo es algo
parecido a un servicio autoadministrado de nube (Fargate/App Runner):
cada proyecto trae su propio `docker-compose.yml`, el host se encarga de
red compartida, TLS, deploy, backup y monitoreo. Antes de esta ronda de
auditoría, ese patrón existía pero solo funcionaba para los dos proyectos
ya wireados a mano (`autotrade`, `platform`); onboardear un tercero
significaba editar `ci-deploy-shell.sh` directamente. Ya no:

```bash
# En bizshore-home:
ops/new-project.sh <nombre> proxy <dominio> <upstream:puerto>
# Genera ops/projects/<nombre>.conf + ops/caddy/apps/<nombre>.caddy,
# imprime los 9 pasos manuales restantes (sudoers, llave SSH, ruta del
# Tunnel, Kuma, workflow de GitHub Actions basado en
# ops/templates/deploy-workflow.yml.template).
```

Ningún paso manual impreso por el script requiere editar código de
`ci-deploy-shell.sh` — el wrapper es genérico (`app-up`/`app-down`/
`app-sync <proyecto>`) y lee la config de cada proyecto desde su propio
archivo. El aislamiento entre proyectos viene de: (a) la línea de
sudoers escopeada al path exacto del compose de ESE proyecto — un
`app-up widgetco` no puede tocar los containers de `autotrade`, aunque
comparta el mismo usuario `ci-deploy` y el mismo wrapper; (b) una llave
SSH dedicada por proyecto, así que una llave filtrada compromete un solo
proyecto, no todos.

## Presupuesto de recursos del host

`bizshore-01`: 4 vCPU, 8.7GiB RAM, 393GB disco (`/data`). Medido en vivo
(2026-07-17):

| Recurso | Total | En uso hoy | Disponible |
| --- | --- | --- | --- |
| RAM | 8.7GiB | ~2.5GiB (autotrade completo + platform) | ~6.2GiB |
| Disco `/data` | 393GB | 2.1GB (1%) | 371GB |
| vCPU | 4 | sin saturación observada | — |
| Imágenes Docker | — | 41 (7.1GB), 960MB reclamable | — |

Margen real para 1-2 proyectos de tamaño similar a `autotrade` sin tocar
hardware. Antes de onboardear un proyecto grande (varios workers, su
propia DB, stack de observabilidad propio), correr
`ssh bizshore-server 'free -h && docker stats --no-stream'` para
confirmar que sigue habiendo margen — este cuadro es una foto, no se
actualiza sola.

Limpieza periódica recomendada (no automatizada todavía, correr a mano
cada tanto o agregar a un cron/systemd-timer futuro):
```bash
ssh bizshore-server 'docker system prune -af --filter "until=720h"'
# -a incluye imágenes sin tag; --filter until=720h (30 días) evita
# borrar algo que un rollback reciente todavía podría necesitar.
```

## Limpieza de cruft (hallazgos de la auditoría de arquitectura, sin aplicar — verificar antes de borrar)

- `/data/applications/autotrade_bot_app/` — directorio legacy (76K, solo
  un subdirectorio `caddy` residual), dueño `ja95aricapa`, sin `.git`,
  superado por `/data/applications/autotrade/` (dueño `ci-deploy`, el
  que realmente usa el wrapper). Candidato a borrar tras confirmar que
  nada lo referencia:
  `ssh bizshore-server "ls -la /data/applications/autotrade_bot_app/"`.
- Redes Docker `autotrade_bot_app_private_net` / `autotrade_bot_app_public_net`
  — residuo de un nombre de proyecto Compose viejo (antes de que el
  `docker-compose.bizshore01.yml` actual fijara el nombre a `autotrade`).
  Verificar que no tengan containers conectados antes de borrar:
  `ssh bizshore-server "docker network inspect autotrade_bot_app_private_net --format '{{len .Containers}}'"`
  (si imprime `0`, es seguro `docker network rm`).
- 3 `.env.production.bak.*` con dueños mezclados (`root` y `ci-deploy`) en
  `/data/applications/autotrade/` — residuo de ediciones manuales
  repetidas con `sudo -u ci-deploy nano` vs `sudo nano` directo. Revisar
  cuál es el más reciente y borrar el resto; considerar que futuras
  ediciones de `.env.production` siempre pasen por `sudo -u ci-deploy`
  (nunca `sudo` a secas) para no seguir generando esta deriva de dueños.

## Reconstruir `bizshore-01` desde cero

Runbook de disaster recovery — si la VM se pierde por completo (disco
corrupto, borrado accidental, etc.), esto es todo lo necesario para
recrear el server desde una VM Ubuntu limpia. Orden importa: cada paso
depende del anterior.

### 1. VM base

- Ubuntu 26.04 LTS, usuario `ja95aricapa` con sudo.
- Instalar Docker + Docker Compose plugin, Tailscale (unir a la tailnet
  con el mismo hostname `bizshore-01` si es posible — si no, actualizar
  la IP Tailscale en todos los secrets de GitHub de ambos repos).
- Instalar `rsync` (trae `rrsync` en `/usr/share/doc/rsync/support/` o
  `/usr/bin/rrsync` según distro — confirmar con
  `find / -name rrsync 2>/dev/null`).

### 2. Restaurar datos desde restic (antes de reconfigurar nada más)

Si el desastre destruyó `/data` pero no perdiste la contraseña de restic
(guardada fuera del server — ver `ops/host/restic/README.md`):

```bash
sudo apt install -y restic rclone
sudo mkdir -p /etc/restic
# recrear /etc/restic/password con la contraseña guardada externamente
# recrear /etc/restic/rclone.conf: repetir A.1/A.2 de ops/host/restic/README.md
# (requiere volver a autorizar OAuth con Google, el token viejo no sirve)
sudo tee /etc/restic/env > /dev/null <<'EOF'
export RESTIC_REPOSITORY="rclone:gdrive:backups/bizshore-01"
export RESTIC_PASSWORD_FILE="/etc/restic/password"
export RCLONE_CONFIG="/etc/restic/rclone.conf"
EOF
sudo chmod 600 /etc/restic/env
sudo bash -c 'source /etc/restic/env && restic restore latest --target /data'
```

Esto trae de vuelta `/data/static-sites`, `/data/applications/platform/caddy`,
`/data/applications/autotrade` — pero **no** `.env.production` de
autotrade (excluido a propósito del backup, ver nota de seguridad en
`ops/host/restic/backup.sh`) ni `bizshore01.env`/`docker-compose*.yml`
de autotrade (nunca se sincronizaron al server vía rsync, viven en el
repo). Esos se recrean en los pasos 5 y 6.

### 3. Plataforma base (Caddy + Cloudflare Tunnel + Kuma)

```bash
# desde la Acer, en el repo bizshore-home:
rsync -az ops/caddy/ bizshore-server:/data/applications/platform/caddy/
rsync -az ops/platform/compose.yaml bizshore-server:/data/applications/platform/compose.yaml
```

En el server, crear el `.env` de la plataforma con `CLOUDFLARED_TOKEN`
(nunca versionado — recuperar del dashboard de Cloudflare, Zero Trust →
Networks → Tunnels → `bizshore-home-server` → reusar el token existente
o generar uno nuevo si el túnel viejo se dio de baja):

```bash
ssh bizshore-server "cd /data/applications/platform && docker compose up -d"
```

Confirmar en Cloudflare que las Published application routes siguen
apuntando bien (deberían persistir del lado Cloudflare, no del server) —
ver la lista completa en "Red y TLS" arriba. Si el túnel es nuevo,
recrear las 5 rutas a mano.

### 4. Usuario `ci-deploy` + wrapper + sudoers

Seguir `ops/DEPLOY.md` §6.3 a §6.7 completo, en orden:
crear usuario → instalar wrapper → wirear `authorized_keys` con las 4
llaves (reusar las privadas si sobrevivieron en algún secret manager
propio, o generar 4 llaves nuevas y actualizar los 4 secrets
correspondientes en GitHub si no) → sudoers → audit log.

### 5. fail2ban

```bash
sudo apt install -y fail2ban
# desde la Acer: rsync ops/host/fail2ban/jail.local al server, o copiar a mano
sudo install -m 644 jail.local /etc/fail2ban/jail.local
sudo systemctl enable --now fail2ban
```

### 6. restic — script + timer (si no se hizo ya en el paso 2)

```bash
# desde la Acer: rsync ops/host/restic/ bizshore-server:/tmp/restic-ops/
sudo install -m 755 /tmp/restic-ops/backup.sh /usr/local/bin/restic-backup.sh
sudo install -m 644 /tmp/restic-ops/restic-backup.service /etc/systemd/system/
sudo install -m 644 /tmp/restic-ops/restic-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now restic-backup.timer
```

### 7. autotrade_bot_app (si va a correr en este server)

Seguir `autotrade_bot_app/ops/DEPLOY-BIZSHORE01.md` sección "Setup
one-time en el server" completa: copiar los 3 archivos de compose,
recrear `.env.production` con secretos reales (no viene del backup),
`docker login ghcr.io` en el server con un PAT `read:packages` nuevo (el
viejo no sobrevive si el desastre fue total y no estaba en un vault
externo).

### 8. Validación final

Repetir la sección "Validación final" del historial de esta migración:
smoke test de los 4 hostnames, `restic snapshots` mostrando historial
recuperado, Kuma con los 4 monitors reconfigurados (Kuma no tiene backup
propio hoy — sus datos viven en el volumen Docker `uptime_kuma_data`,
que si sobrevivió al desastre alcanza con `docker compose up -d` para
recuperar; si no, hay que rehacer monitors + notificaciones a mano).

**Nota de mejora futura no bloqueante**: hoy `uptime_kuma_data` no está
incluido en el backup de restic (solo se respaldan bind mounts de
`/data`, no volúmenes nombrados de Docker) — si la configuración de Kuma
importa preservarla ante desastre total, hay que sumar un
`docker run --rm -v uptime_kuma_data:/data -v /tmp:/backup alpine tar czf /backup/kuma.tar.gz /data`
al script de `ops/host/restic/backup.sh` antes de que restic corra.

## Pendientes de seguridad

### ✅ Resueltos

1. **Higiene de llaves SSH entre Acer y `bizshore-01`**: limpio, roles
   nunca se comparten — ver tabla "Llaves SSH" arriba.
2. **Ruta Cloudflare/VPS de `autotrade_bot_app`**: cerrada, código
   movido a `infra/modules/cloudflare.disabled/` (commit `1a105a3`,
   2026-07-14).
3. **CI/CD para la ruta `bizshore-01`**: **resuelto** (2026-07-15) —
   `deploy-bizshore01.yml` completo, validado end-to-end incluyendo
   auth real contra GHCR. Ya no es manual.

4. **Sync automático de `docker-compose*.yml`/`bizshore01.env` al
   server**: **resuelto** (auditoría de arquitectura/CI-CD, esta
   sesión) — `ci-deploy-shell.sh` ganó un subcomando genérico
   `app-sync <proyecto>` (reemplaza el antiguo `autotrade-sync`
   hardcodeado; ese nombre se mantiene como alias retrocompatible).
5. **Retention/GC de imágenes en GHCR**: **resuelto** para
   `autotrade_bot_app` — `.github/workflows/ghcr-retention.yml` corre
   semanal, conserva los últimos 20 SHAs + tags móviles. Replicar el
   mismo workflow (via `ops/templates/deploy-workflow.yml.template`)
   para cualquier proyecto nuevo que publique a GHCR.
6. **Backup de la base de datos real de `autotrade_bot_app`**:
   **resuelto** — se descubrió que `backup-runner` escribe sus
   `pg_dump` en un volumen Docker nombrado (`autotrade_backups`) que
   restic nunca cubría (solo `/data/applications/autotrade`, que es el
   árbol de código, no los volúmenes). `ops/host/restic/backup.sh`
   ahora resuelve el mountpoint real del volumen vía `docker volume
   inspect` y lo agrega a `BACKUP_PATHS` dinámicamente. **Antes de este
   fix, un fallo de disco se llevaba la DB de producción Y sus backups
   locales al mismo tiempo, sin ninguna copia offsite.**
7. **Wrapper `ci-deploy-shell` no genérico**: **resuelto** — ver
   "Onboarding de un proyecto nuevo" más abajo. `ops/new-project.sh`
   scaffolda el registry entry + vhost Caddy + imprime los pasos
   manuales restantes (sudoers, llave SSH, ruta del Tunnel, Kuma).

### ⏳ Pendientes (no resueltos, no bloqueantes)

1. **Backup de `uptime_kuma_data`**: ver nota en el runbook de arriba —
   hoy fuera del alcance de restic (mismo patrón que se usó para
   `autotrade_backups`, aplicarlo acá también si Kuma alguna vez guarda
   configuración que no sea trivial de recrear a mano).
2. **rclone client_id compartido**: el remote de Google Drive usa la
   credencial interna de rclone (compartida globalmente), lo que ya
   gatilló un `403 Quota exceeded` transitorio una vez. No bloqueante
   hoy (el retry automático de rclone lo resolvió), pero si se repite de
   forma persistente, generar un client_id propio en Google Cloud
   Console — ver `ops/host/restic/README.md`.
3. **`docker-socket-proxy` compartido con `POST` habilitado**: `backend`
   (solo necesita lectura para su dashboard operativo) y `worker-sandbox`
   (necesita `POST` para crear/arrancar containers sandbox) comparten la
   MISMA instancia del proxy en `autotrade_bot_app`. Separarlas en dos
   instancias (una read-only, una con `POST` solo para el worker)
   reduciría el blast-radius si `backend` fuera comprometido — cambio de
   topología no trivial de validar sin downtime, documentado pero no
   aplicado.
4. **Cruft huérfano en el filesystem/Docker del server**: directorio
   `/data/applications/autotrade_bot_app/` (legacy, sin uso, de un
   nombre de proyecto compose viejo) y redes Docker
   `autotrade_bot_app_private_net`/`_public_net` (mismo origen) — ver
   "Limpieza de cruft" más abajo para los comandos exactos de
   verificación antes de borrar nada.
