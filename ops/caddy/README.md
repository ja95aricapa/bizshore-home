# Caddyfile modular para bizshore-server

Configuracion de Caddy versionada en este repo. La fuente de verdad
operativa vive en `/data/applications/platform/caddy/Caddyfile` dentro del
servidor; este directorio es la "receta" que se sincroniza a el.

> Este Caddy corre dentro del stack `ops/platform/` (junto al `cloudflared`
> que sostiene el Cloudflare Tunnel). Ver `ops/platform/README.md` para la
> receta generica de como publicar **cualquier app nueva** en este host —
> no solo `bizshore-home`.

## Estructura

```
ops/caddy/
├── Caddyfile                  # Agregador raiz; importa un archivo por app
├── README.md                  # Este archivo
└── apps/
    ├── bizshore-home.caddy    # Vhost www.bizshore.net (sitio corporativo)
    └── _TEMPLATE.caddy        # Plantilla copiable para nuevas apps
```

### Convenciones

- **`Caddyfile`**: unico archivo que Caddy parsea. Contiene opciones
  globales (email ACME) y una linea `import apps/<nombre>.caddy` por cada
  app activa. Agregar/descomentar una linea por vhost nuevo; comentar la
  linea para desactivar el vhost sin borrar el archivo.
- **`apps/<nombre>.caddy`**: un site block por archivo. Sin opciones
  globales, sin imports. El nombre del archivo es el nombre canonico de
  la app.
- **`apps/_*.caddy`**: archivos que empiezan con guion bajo son
  referencia/transitorios. No se importan desde `Caddyfile`. Borrarlos o
  promoverlos a archivos normales cuando corresponda.
- **Subdominios** (conveccion vigente):

  | Host | App | Repo | Estado |
  | --- | --- | --- | --- |
  | `www.bizshore.net` (apex `bizshore.net`) | Sitio corporativo | `bizshore-home` (este repo) | Activo |
  | `landing.bizshore.net` | Landing de campana `/landing/diagnostico-software` | `bizshore-home` (mismo SPA) | Pendiente — crear vhost explicito cuando se active el subdominio |
  | `trade.bizshore.net` (futuro) | Plataforma autotrade | `autotrade_bot_app` | Pendiente — requiere mover el stack al mismo host o a una VM accesible por Tailscale |

  Nota: el SPA actual de `bizshore-home` ya responde la ruta
  `/landing/diagnostico-software` (ver `src/pages/LandingPage.jsx`), asi
  que `landing.bizshore.net` puede ser un vhost sirviendo el mismo
  `bizshore-home` con un `rewrite` o un alias, o directamente un CNAME a
  `www.bizshore.net` en DNS.

## Arquitectura de red: Cloudflare Tunnel

El trafico **no** llega al server por IP publica directa. `bizshore-01`
corre un container `cloudflared` (Cloudflare Tunnel, ver servicio
`cloudflared` en `compose.yaml`) que expone Caddy al mundo sin abrir
puertos. Esto cambia dos cosas respecto a un setup con Caddy expuesto
directo:

- **DNS**: lo administra el tunel automaticamente (CNAME al tunel, no un
  registro A a la IP publica). No hace falta crear registros DNS a mano
  para un hostname nuevo — se crean solos al agregar la ruta en el paso
  siguiente.
- **Origen del tunel**: cada hostname publicado necesita una entrada en
  el dashboard de Cloudflare, **Zero Trust → Networks → Tunnels →
  `bizshore-home-server` → Published application routes**. Cada entrada
  define a que `Service` interno del container `caddy` se reenvia el
  trafico.

### Bug resuelto: loop de redirects + 502

Las rutas publicadas apuntaban a `http://caddy:80`. Caddy ve esa
peticion HTTP y, como tiene `auto_https` activado, responde con un
redirect 308 a HTTPS — pero ese redirect vuelve a pasar por el mismo
tunel HTTP, generando un **loop infinito** (`https://www.bizshore.net/`
redirigiendo a si mismo). Cambiar el modo SSL/TLS del dashboard
(Flexible/Full/Full strict) **no afecta esto**, porque esa configuracion
es para trafico DNS-proxied clasico, no para el tunel.

El fix correcto, aplicado en cada ruta publicada:

1. **Service** → `https://caddy:443` (no `http://caddy:80`).
2. Eso solo no alcanza: sin indicar el hostname, Caddy no sabe que
   certificado/vhost presentar en el handshake TLS y el tunel responde
   `502 Bad Gateway`. Hay que abrir **Origin request and connection
   settings → TLS → Origin Server Name** y poner ahi el mismo hostname
   de la ruta (ej. `bizshore.net` en la ruta de `bizshore.net`,
   `www.bizshore.net` en la de `www.bizshore.net`). Dejar **No TLS
   Verify** en `Off` — Caddy ya tiene un certificado real de Let's
   Encrypt, no hace falta saltarse la verificacion.

Con `Service = https://caddy:443` + `Origin Server Name` correcto,
Caddy recibe el SNI esperado, sirve el vhost correcto con su
certificado, y el tunel valida ese certificado sin problema.

### SSL/TLS mode en el dashboard

Con certificados reales en el origen, dejar **Full (strict)** en
`SSL/TLS → Overview`. No usar `Flexible` (fuerza HTTP al origen,
mismo bug del loop si algun dia el trafico deja de pasar por el
tunel) ni `Automatic` (puede degradar a Flexible sin avisar).

## Agregar una nueva app

1. Copiar `apps/_TEMPLATE.caddy` a `apps/<nombre-app>.caddy`.
2. Elegir variante A (estatica) o B (reverse proxy), borrar la otra.
3. Reemplazar `{{...}}` por valores reales.
4. Validar localmente:
   ```bash
   docker run --rm -v "$PWD/ops/caddy:/etc/caddy" \
     caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
   ```
5. Agregar `import apps/<nombre-app>.caddy` en el `Caddyfile` raiz.
6. Publicar el hostname en el tunel de Cloudflare (Zero Trust →
   Networks → Tunnels → `bizshore-home-server` → Published application
   routes → Add a published application route):
   - **Service**: `https://caddy:443` (siempre, sin importar el puerto
     que use la app internamente — Caddy es el unico que escucha ahi).
   - **Origin Server Name**: el mismo hostname de la ruta.
   - El DNS se crea automaticamente al guardar.
7. Sincronizar al server y recargar Caddy. El helper `ops/caddy/sync.sh`
   automatiza el rsync + `caddy validate` + `caddy reload`:
   ```bash
   ./ops/caddy/sync.sh
   ```
   Equivale a:
   ```bash
   rsync -az ops/caddy/ bizshore-server:/data/applications/platform/caddy/
   ssh bizshore-server \
     "cd /data/applications/platform && docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile"
   ssh bizshore-server \
     "cd /data/applications/platform && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
   ```
   El alias SSH default es `bizshore-server`; override con la env var
   `BIZSHORE_SERVER`. Si la llave tiene passphrase, cargarla antes con
   `ssh-add ~/.ssh/bizshore-server-hp-01`.

## Sincronizacion con el server (estado actual)

Por ahora la sincronizacion es **manual** (vía `sync.sh`). Cuando el
server tenga varios vhosts y el cambio sea frecuente, considerar
automatizar el rsync y el reload dentro de
`.github/workflows/deploy.yml` (con una llave SSH separada restringida
a `caddy reload`). Eso queda como mejora futura.

## Bug conocido resuelto

El Caddyfile viejo del server tenia DOS bloques `:80 {}` duplicados que
referenciaban `/srv/static/main` para cualquier hostname. Se confirmo en
el server (`ls /srv/static/main`) que ese directorio **no existe** —
contenido fantasma, nunca montado. Eso se reemplazo por:

- Vhost explicito `bizshore.net, www.bizshore.net` en
  `apps/bizshore-home.caddy`.
- Sin bloques `:80 {}` genericos: cada request debe matchear un vhost
  por hostname.