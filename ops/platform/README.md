# Platform stack de bizshore-01 (Caddy + Cloudflare Tunnel)

Este directorio versiona `compose.yaml`, el stack base que corre en `bizshore-01`
(`/data/applications/platform/compose.yaml` en el server) y que le da entrada a
**todo** el tráfico del host: el Caddy de borde (`ops/caddy/`, ver ese README para el
Caddyfile modular) y el `cloudflared` que mantiene el Cloudflare Tunnel.

Hasta esta versión, este archivo solo existía a mano en el server, sin respaldo — así
se nos pasó por alto un bug real (el volumen `apps/` del Caddy no estaba montado)
durante varias sesiones. Se versiona acá por la misma razón que `ops/caddy/`: que un
cambio quede en un diff revisable en vez de un `vim` directo en producción.

## Cómo llega el tráfico

No hay IP pública expuesta. El flujo es:

```
visitante → Cloudflare edge (TLS) → Cloudflare Tunnel → cloudflared (container) →
  red Docker "edge" → <container de destino>
```

`cloudflared` no escucha ningún puerto del host — se conecta *saliente* a Cloudflare
con un token (`CLOUDFLARED_TOKEN`, vive en el `.env` del server, nunca en este repo) y
Cloudflare le asigna tráfico según las **Published application routes** configuradas
en el dashboard (Zero Trust → Networks → Tunnels → `bizshore-home-server`).

## Red Docker compartida

La red `edge` declarada en `compose.yaml` se resuelve, por convención de Docker
Compose (prefijo del *project name*, que es el nombre del directorio
`/data/applications/platform/`), al nombre real:

```
platform_edge
```

Ese es el nombre **estable** a partir de ahora para que cualquier proyecto futuro se
una a esta red. No se renombra (evita recrear `caddy`/`cloudflared` y el downtime que
eso implica) — se documenta tal cual.

## Cómo publicar una app nueva en este host

Cualquier repo que quiera exponerse en `bizshore-01` sigue esta receta genérica —
`bizshore-home` y `autotrade_bot_app` ya la aplican, cada uno a su manera:

1. **El proxy interno de la app corre sin redirect automático a HTTPS.** TLS ya se
   terminó en el Tunnel; si el proxy interno (Caddy, nginx, lo que sea) fuerza
   HTTP→HTTPS, el tráfico que le llega del túnel en HTTP plano entra en loop.
   - Con Caddy: `auto_https off` en el bloque global (patrón que ya usa
     `autotrade_bot_app`, pensado originalmente para su ALB de AWS — el Tunnel cumple
     el mismo rol).
   - Alternativa (la que usa `bizshore-home`, más trabajo pero certs reales
     end-to-end): dejar `auto_https` activo, publicar el `Service` como
     `https://<container>:<puerto>` y configurar el `Origin Server Name` (SNI) en la
     ruta del túnel. Ver `ops/caddy/README.md` → "Arquitectura de red: Cloudflare
     Tunnel" para el detalle de por qué hace falta el SNI en ese caso.
2. **No publica puertos del host** (`ports:` fuera o vaciado en un override) — solo
   necesita ser alcanzable dentro de la red Docker compartida.
3. **Se une a la red externa `platform_edge`.** En el `docker-compose.yml` del
   proyecto (o en un archivo de override si no querés tocar el compose base):
   ```yaml
   services:
     <servicio-proxy>:
       networks:
         - platform_edge   # además de las redes internas propias del proyecto

   networks:
     platform_edge:
       external: true
       name: platform_edge
   ```
4. **Se registra la ruta en Cloudflare** (Zero Trust → Networks → Tunnels →
   `bizshore-home-server` → Published application routes → Add a published
   application route): `Service = http://<container>:<puerto>` (o `https://` +
   Origin Server Name si el proxy interno usa el patrón 1-alternativa). El DNS del
   hostname se crea solo al guardar.
5. Verificar con `curl -I https://<hostname>/` — si el proxy interno todavía no tiene
   backend real corriendo, un `502` limpio (sin loop de redirects) ya confirma que el
   circuito Tunnel → red compartida → proxy funciona.

## Observabilidad: Uptime Kuma

`compose.yaml` incluye un servicio `uptime-kuma` — a diferencia de
`autotrade_bot_app` (un proyecto con su propio repo que se *une* a esta
red), Kuma vive directamente acá porque monitorea la plataforma entera,
no una sola app.

Se expone siguiendo la misma receta de arriba (punto 4): agregar una
ruta en Cloudflare a `http://uptime-kuma:3001`, sin TLS ni SNI (Kuma
sirve HTTP plano). El primer acceso al hostname pide crear usuario/clave
admin — hacerlo enseguida después de exponer la ruta, antes de que
cualquier otra persona la encuentre primero.

**Recomendado, no bloqueante**: poner ese hostname detrás de una
política de Cloudflare Access (Zero Trust → Access → Applications) como
capa extra sobre el login propio de Kuma — mismo criterio de defensa en
profundidad que ya se usa en el resto de esta arquitectura (SSH
restringido + sudoers acotado + esto).

Una vez con el usuario admin creado, configurar monitores HTTP(S) para
cada hostname publicado (`www.bizshore.net`, `trade.bizshore.net`, etc.)
y una notificación (Telegram, webhook, email) — sin eso, Kuma solo
acumula datos sin avisar de nada.

## Herramientas de host (fuera de Docker)

`ops/host/` versiona configuración para software que corre directo en
el SO del server, no en un container — `fail2ban` (protección SSH) y
`restic` (backups cifrados). Cada uno tiene su propio README con los
pasos de instalación exactos. No son parte de `compose.yaml` porque
operan a nivel de sistema operativo (fail2ban lee logs de auth del host;
restic necesita acceso de lectura a rutas fuera de lo que cualquier
container debería tener montado).

## Sincronización con el server

Igual que `ops/caddy/`: manual por ahora. Cambios a este `compose.yaml` requieren
`docker compose up -d` en el server (no alcanza con `caddy reload`, porque acá se
puede estar tocando el propio `caddy`/`cloudflared` o su red):

```bash
rsync -az ops/platform/compose.yaml bizshore-server:/data/applications/platform/compose.yaml
ssh bizshore-server "cd /data/applications/platform && docker compose up -d"
```

Después de aplicar, correr el smoke test de siempre para `bizshore-home`
(`curl -sIL https://www.bizshore.net/` + las rutas del SPA) para confirmar que no se
rompió nada — este compose es compartido por todo lo que corre en el host.
