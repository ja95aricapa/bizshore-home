# Caddyfile modular para bizshore-server

Configuracion de Caddy versionada en este repo. La fuente de verdad
operativa vive en `/data/applications/platform/caddy/Caddyfile` dentro del
servidor; este directorio es la "receta" que se sincroniza a el.

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

## DNS

Hasta confirmar el wildcard `*.bizshore.net` en Cloudflare, cada
subdominio nuevo requiere crear un registro DNS explicito (CNAME al apex
o A a la IP publica del server). No activar vhosts sin DNS resuelto
porque Caddy fallara al solicitar el certificado ACME.

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
6. Asegurar que el DNS del subdominio resuelve a la IP publica del
   server (o al CNAME del apex).
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