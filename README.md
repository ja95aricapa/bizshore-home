# BizShore Home Site

Sitio web corporativo informativo para BizShore Solutions SAS, desarrollado con React y Vite.

## Requisitos

- Node.js 20+
- npm 10+

## Ejecutar localmente

1. Instala dependencias:

   npm install

2. Crea archivo de entorno local a partir de la plantilla:

   cp .env.example .env.local

3. Ejecuta en desarrollo:

   npm run dev

## Variables de entorno

- VITE_SITE_URL: URL publica del sitio (ejemplo: <https://www.bizshore.net>)
- VITE_FORMSPREE_ENDPOINT: endpoint de Formspree para el formulario de contacto

Si VITE_FORMSPREE_ENDPOINT no existe, el formulario mostrara aviso y ofrecera envio por correo directo.

## Calidad

- Lint: npm run lint
- Build: npm run build

## Despliegue

Bizshore Home publica únicamente el bundle estático `dist/`. La compilación
y creación del release se ejecutan localmente. El workflow actual todavía
sincroniza el artefacto desde GitHub Actions; es una ruta de transición que se
reemplazará por el deploy local de `bizshore-platform` después de probar
transferencia atómica y rollback. No añadir nuevos secretos ni ampliar ese
workflow. El procedimiento vigente y el corte pendiente están en
[DEPLOY.md](DEPLOY.md) y en el backlog de la plataforma. La configuración
compartida de Caddy, Cloudflare Tunnel y demás aplicaciones pertenece a
`bizshore-platform`.

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
