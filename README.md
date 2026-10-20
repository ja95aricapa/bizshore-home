# BizShore Home Site

Sitio web corporativo informativo para BizShore Solutions SAS, desarrollado con React y Vite.

## Requisitos

- Node.js 20+
- npm 10+

## Ejecutar localmente

1. Instala dependencias:

   npm install

2. Crea el archivo de entorno local ignorado por Git:

   cp .env.example .env

3. Ejecuta en desarrollo:

   npm run dev

## Variables de entorno

- VITE_SITE_URL: URL publica del sitio (ejemplo: <https://www.bizshore.net>)
- VITE_FORMSPREE_ENDPOINT: endpoint de Formspree para el formulario de contacto

Si VITE_FORMSPREE_ENDPOINT no existe, el formulario mostrara aviso y ofrecera envio por correo directo.
Estas variables son configuración pública de compilación, no secretos. El
despliegue publica solo el bundle estático; el servidor no lee un `.env` al
servirlo. La copia privada `/data/static-sites/bizshore-home/.env` conserva la
configuración aprobada junto al sitio para recuperación. Mantén los valores de
compilación de producción iguales en el `.env` local y en esa copia del host.

## Calidad

- Lint: npm run lint
- Build: npm run build

## Despliegue

Bizshore Home publica únicamente el bundle estático `dist/` mediante el CLI
local del repositorio `bizshore-platform`; un `git push` no despliega el sitio.
GitHub se conserva como remoto de código, sin Actions ni Releases en el flujo
de publicación. El procedimiento está en [DEPLOY.md](DEPLOY.md) y en el
backlog de la plataforma. La configuración compartida de Caddy, Cloudflare
Tunnel y demás aplicaciones pertenece a `bizshore-platform`.

## SEO e indexacion

El proyecto incluye:

- SEO por pagina (title, description, og, twitter, canonical, robots meta)
- Sitemap en public/sitemap.xml
- Robots en public/robots.txt
- Archivo para indexadores LLM en public/llms.txt
- Imagen OG por defecto en public/og-image.svg

## Rutas

- /
- /servicios
- /contactenos
- /landing/diagnostico-software (ruta publica no visible en menu)
