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
    ssh ci-deploy@bizshore-01 autotrade-up →
    wrapper ci-deploy-shell → sudo docker compose ... pull && up -d
  → reverse-proxy (Caddy interno, auto_https off) se une a la red
    compartida platform_edge
  → Cloudflare Tunnel rutea trade.bizshore.net y trade-api.bizshore.net
    directo por HTTP interno (TLS terminado en el Tunnel, mismo rol que
    el ALB de AWS)
```

**Estado real (2026-07-15)**: el pipeline está completo y validado
end-to-end (`ssh` + wrapper + sudoers + `docker compose pull` contra
GHCR con auth real probada). Lo único pendiente es 100% deliberado y
manual: `.env.production` con secretos productivos reales en el server
(nunca se sube a GH) y el merge del código de negocio a `main`. A partir
de ese merge, cada push despliega solo. Detalle completo, incluido el
setup one-time del server: `autotrade_bot_app/ops/DEPLOY-BIZSHORE01.md`.

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
├── sudoers.d/ci-deploy           # versionado en ops/DEPLOY.md §6.6, aplicado a mano
└── fail2ban/jail.local           # versionado en ops/host/fail2ban/, aplicado a mano
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
| `~/.ssh/bizshore-home-ops-shell` | `command="/usr/local/bin/ci-deploy-shell"` (allowlist: `caddy-reload`, `platform-up`, `autotrade-up`, `autotrade-down`, `rsync-ok`) | `bizshore-home/.github/workflows/deploy-ops.yml`, secret `DEPLOY_OPS_SSH_KEY_SHELL` |
| `~/.ssh/bizshore01-deploy-shell` | `command="/usr/local/bin/ci-deploy-shell"` (mismo wrapper, mismo allowlist) | `autotrade_bot_app/.github/workflows/deploy-bizshore01.yml`, secret `BIZSHORE01_DEPLOY_SSH_KEY_SHELL` |

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
| **restic** | Backup diario cifrado (`03:15`, `restic-backup.timer`) de `/data/static-sites`, `/data/applications/platform/caddy`, `/data/applications/autotrade` (sin `.env*`) hacia Google Drive vía `rclone:` | Activo, backup + check + restore de prueba verificados |
| **Uptime Kuma** | Monitorea 4 hostnames (`www.bizshore.net`, `bizshore.net`, `trade.bizshore.net`, `trade-api.bizshore.net`) con alertas a Telegram | Activo, 4 monitors + notificaciones configuradas |

Detalle de cada uno: `ops/host/fail2ban/README.md`,
`ops/host/restic/README.md`, `ops/platform/README.md` →
"Observabilidad: Uptime Kuma".

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

### ⏳ Pendientes (no resueltos, no bloqueantes)

1. **Backup de `uptime_kuma_data`**: ver nota en el runbook de arriba —
   hoy fuera del alcance de restic.
2. **Retention/GC de imágenes en GHCR**: cada push a `main` que toque
   `app` en `autotrade_bot_app` agrega un tag `<sha>` nuevo sin borrar
   los previos — crece indefinidamente hasta configurar una política de
   retención en GitHub Packages.
3. **rclone client_id compartido**: el remote de Google Drive usa la
   credencial interna de rclone (compartida globalmente), lo que ya
   gatilló un `403 Quota exceeded` transitorio una vez. No bloqueante
   hoy (el retry automático de rclone lo resolvió), pero si se repite de
   forma persistente, generar un client_id propio en Google Cloud
   Console — ver `ops/host/restic/README.md`.
4. **Sync automático de `docker-compose*.yml`/`bizshore01.env` al
   server**: hoy manual (paso 1 de "Setup one-time" en
   `DEPLOY-BIZSHORE01.md`). Mejora natural si `bizshore-01` se vuelve el
   deploy primario de autotrade: extender el wrapper con un subcomando
   `autotrade-sync`, mismo patrón que `rsync-ok`.
