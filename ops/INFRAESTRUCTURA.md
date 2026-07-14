# Mapa de infraestructura BizShore

Vista de conjunto de cómo `bizshore-home` y `autotrade_bot_app` se despliegan, qué
vive dónde, y qué credenciales están en juego. Este documento es el punto de
partida — cada sección enlaza al README con el detalle operativo real.

## Máquinas involucradas

| Máquina | Rol | Acceso |
| --- | --- | --- |
| Acer (local, dev) | Donde se edita código y se corren los `git push` / comandos manuales de deploy | Terminal directa |
| `bizshore-01` (HP, VM Ubuntu 26.04) | Server compartido. IP Tailscale `100.127.85.94`, alias SSH `bizshore-server` | SSH interactivo (llave personal) + Tailscale |
| GitHub Actions (`ubuntu-latest` runners) | Compila y despliega en CI, efímero | Sin acceso persistente — se une al tailnet o usa AWS SSM solo durante el job |
| AWS (EC2 + ALB + Secrets Manager, `autotrade_bot_app`) | Deploy productivo actual del bot de trading | IAM via GitHub OIDC/keys, sin SSH |
| Cloudflare | DNS + Tunnel + edge TLS para `bizshore.net`, y Terraform-managed VPS opcional para `autotrade_bot_app` | Dashboard + API token |

No hay IP pública expuesta en `bizshore-01`. Todo el tráfico entra por el
Cloudflare Tunnel — ver `ops/platform/README.md`.

## `bizshore-home` — sitio estático

```
Acer (git push a main)
  → GitHub Actions: npm ci && npm run build
  → Tailscale efímero (tag:ci) se une al tailnet
  → rsync --delete dist/ vía llave rrsync restringida
  → bizshore-01:/data/static-sites/bizshore-home/  (SOLO el build, sin git/repo)
```

El repo **nunca vive clonado en el server** — la CI compila y transporta
únicamente el `dist/`, con una llave que solo puede escribir en esa carpeta
(`command="/usr/bin/rrsync -W ..."` en `authorized_keys`). Detalle completo:
`ops/DEPLOY.md`.

Los archivos que sí exigen edición manual del server (`ops/caddy/`,
`ops/platform/`) se versionan en este repo pero se aplican a mano desde el
Acer (`ops/caddy/sync.sh`, o `rsync` + `docker compose up -d` para
`ops/platform/`). Ver `ops/caddy/README.md` y `ops/platform/README.md`.

**GitHub Secrets usados** (repo `bizshore-home`): `TS_OAUTH_CLIENT_ID`,
`TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`,
`DEPLOY_SSH_PATH`.

## `autotrade_bot_app` — plataforma de trading

Tres rutas de deploy conviven, cada una con su propio modelo de confianza:

### 1. AWS (activa, vía Terraform + SSM, sin SSH)

```
GitHub Actions → tests + lint + terraform apply (EC2 + ALB + Secrets Manager)
  → build/push imágenes a GHCR
  → AWS SSM Run Command (sin SSH, rol IAM scoped a esa instancia)
    → bootstrap del repo, materializar secretos desde Secrets Manager/SSM,
      pinnear imágenes, `docker compose up`
  → smoke test /health
```

La más segura de las tres: ninguna llave SSH viaja a la instancia. Detalle:
`autotrade_bot_app/.github/workflows/reusable-deploy.yml`,
`autotrade_bot_app/infra/README.md`.

**GitHub Secrets**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

### 2. Cloudflare / VPS dedicado (Terraform, opcional, no activa hoy)

```
GitHub Actions → terraform apply (Hetzner/Vultr VPS + tunel Cloudflare PROPIO,
    dedicado, via network_mode: host — no es el patron de tunel compartido
    de bizshore-01)
  → build/push imágenes a GHCR
  → SSH directo (appleboy/ssh-action) como root
    → docker compose pull && up -d
```

**GitHub Secrets**: `CLOUDFLARE_API_TOKEN`, `VPS_SSH_PRIVATE_KEY`,
`VPS_SSH_USER`. Esta es la ruta con el modelo de confianza más débil de las
tres (llave SSH root persistente en un secret de GitHub). Ver punto abierto
en "Pendientes de seguridad" abajo.

### 3. `bizshore-01` — patrón de red compartida (manual, verificado, sin CI)

```
Acer: rsync manual de docker-compose.yml + docker-compose.bizshore01.yml +
  bizshore01.env + .env → bizshore-01:/data/applications/autotrade_bot_app/
  → ssh: docker compose --env-file .env --env-file bizshore01.env
      -f docker-compose.yml -f docker-compose.bizshore01.yml up -d --no-deps reverse-proxy
  → reverse-proxy se une a la red compartida `platform_edge`
  → Cloudflare Tunnel (el mismo que usa bizshore-home) rutea
      trade.bizshore.net y trade-api.bizshore.net directo por HTTP interno
```

Verificado en vivo el 2026-07-14: el `reverse-proxy` corre inerte (sin
backend/DB/workers, sin secretos productivos), las dos rutas del túnel
responden `502` limpio (sin loop de redirects). **No hay CI/CD para esta
ruta** — es deliberadamente manual, sin secretos reales, hasta que se
decida (en otra sesión) migrar el stack completo aquí. Detalle:
`ops/platform/README.md`, `autotrade_bot_app/docker-compose.bizshore01.yml`.

## Mapa del filesystem en `bizshore-01`

```
/data/
├── static-sites/
│   └── bizshore-home/          # dist/ compilado, sin git — repo bizshore-home
├── applications/
│   ├── platform/                # Caddy de borde + cloudflared — repo bizshore-home (ops/platform/)
│   │   ├── compose.yaml
│   │   └── caddy/                # Caddyfile modular — repo bizshore-home (ops/caddy/)
│   └── autotrade_bot_app/       # reverse-proxy de prueba — repo autotrade_bot_app
│       ├── docker-compose.yml
│       ├── docker-compose.bizshore01.yml
│       ├── bizshore01.env
│       ├── .env                 # copiado a mano, NUNCA versionado
│       └── ops/caddy/Caddyfile
```

Ningún directorio bajo `/data/applications/` es un `git clone` — todo llega
por `rsync` desde el Acer. Si algo se edita directo en el server con `vim`,
se pierde en el próximo sync y además diverge de lo que dice el repo (ya
pasó una vez esta semana con `ops/platform/compose.yaml`, antes de
versionarlo).

## Red y TLS

- Cloudflare Tunnel (`cloudflared`, container `cloudflared-tunnel`) es el
  único punto de entrada — no hay puerto público abierto en `bizshore-01`.
- Red Docker compartida: `platform_edge` (nombre real, resuelto del project
  name `platform` + red `edge` declarada en `ops/platform/compose.yaml`).
  Cualquier app nueva se une a esta red para ser alcanzable por el túnel.
- Cloudflare emite certificados gratis (Universal SSL) solo para el apex
  (`bizshore.net`) y un nivel de wildcard (`*.bizshore.net`). Subdominios de
  **dos niveles** (ej. `api.trade.bizshore.net`) no quedan cubiertos sin
  Advanced Certificate Manager (pago) — por eso `trade-api.bizshore.net` y
  no `api.trade.bizshore.net`. Verificado en vivo con un fallo real de
  handshake TLS antes del fix.
- Dos patrones de vhost conviven a propósito:
  - `bizshore-home`: `auto_https` activo + certs ACME reales + SNI
    configurado por ruta en el túnel (más trabajo, defensa en profundidad).
  - `autotrade_bot_app`: `auto_https off` + HTTP plano interno (TLS ya
    terminado en el túnel, mismo modelo que su ALB de AWS). Más simple, es
    el patrón recomendado para apps nuevas — ver "Cómo publicar una app
    nueva" en `ops/platform/README.md`.

## Pendientes de seguridad (a revisar, no resueltos todavía)

1. **Higiene de llaves SSH/secrets entre Acer y `bizshore-01`**: confirmar
   qué llave se usa para qué (interactiva vs CI), que ninguna se reutilice
   fuera de su alcance previsto, y si conviene restringir la llave
   interactiva del Acer de alguna forma.
2. **Ruta SSH root de `autotrade_bot_app` (Cloudflare/VPS)**: `VPS_SSH_PRIVATE_KEY`
   con usuario `root` persistente en un secret de GitHub es el eslabón más
   débil de las tres rutas de deploy. Evaluar migrar al patrón SSM (sin SSH,
   como el path de AWS) o al menos restringir a un usuario no-root con sudo
   scoped.
3. **CI/CD para la ruta `bizshore-01`**: hoy es 100% manual. Si se decide
   poner `autotrade_bot_app` en vivo ahí, necesita el mismo rigor que la
   ruta AWS (gestión de secretos real, no `.env` copiado a mano por rsync).
