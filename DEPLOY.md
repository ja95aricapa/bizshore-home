# Publicar Bizshore Home

Este repositorio publica solo el sitio estático. No despliega contenedores ni
modifica Autotrade, MediaCortex, Caddy o Cloudflare Tunnel. La configuración
compartida del host vive en el repositorio privado `bizshore-platform`.

## Flujo de publicación

El CI del sitio corre en el PC. Desde `main`, actualizado al mismo commit que
`origin/main` y con un árbol limpio, ejecuta:

```bash
scripts/publish-release.sh --dry-run
scripts/publish-release.sh
```

El script instala dependencias con `npm ci`, ejecuta lint y build, empaqueta
`dist/` con metadatos reproducibles y publica un GitHub Release llamado
`home-<12 caracteres del SHA>`. `--dry-run` valida el paquete sin crear un
release.

La publicación activa `.github/workflows/deploy.yml`. Actions no compila el
sitio: descarga el bundle del release, verifica SHA-256 y el commit de origen,
comprueba el archivo y sincroniza únicamente el directorio estático
`/data/static-sites/bizshore-home/` con `rsync`. La llave del workflow está
restringida en el servidor a ese destino.

Para restaurar una versión, ejecuta `workflow_dispatch` en `Deploy`, indica un
tag `home-<12 caracteres SHA>` ya publicado y vuelve a desplegar ese bundle.

## Configuración de Actions

El repositorio requiere los siguientes secrets en Settings → Secrets and
variables → Actions. No guardar sus valores en este archivo.

- `TS_OAUTH_CLIENT_ID` y `TS_OAUTH_SECRET`: conexión efímera al tailnet.
- `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY` y `DEPLOY_SSH_PATH`:
  conexión restringida al directorio estático del sitio.

Los cambios a rutas, vhosts, Tunnel, servicios compartidos o despliegue de
otras aplicaciones deben hacerse en `bizshore-platform`, no aquí.
