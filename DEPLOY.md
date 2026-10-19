# Publicar Bizshore Home

Este repositorio administra solo el sitio informativo estático. No despliega
contenedores ni modifica Autotrade, MediaCortex, Caddy o Cloudflare Tunnel. La
configuración compartida del host pertenece al repositorio privado
`bizshore-platform`.

## Publicación

GitHub conserva el código y el historial; un `git push` no despliega el sitio.
Desde el PC, con los repositorios actualizados, limpios y en `main`, ejecuta en
`bizshore-platform`:

```bash
./scripts/bizshore status
./scripts/bizshore ci home
./scripts/bizshore deploy home
```

El CLI exige que el SHA local coincida con `origin/main`, corre lint/build,
empaqueta el `dist/` validado y lo envía por la clave SSH restringida. El helper
del host valida el contenido y cambia el symlink `current` atómicamente,
conservando releases anteriores. Este flujo no reinicia los contenedores de
Autotrade ni MediaCortex.

Después de publicar, verifica `https://bizshore.net` y
`https://www.bizshore.net`. El estado publicado puede consultarse con:

```bash
ssh -i "$HOME/.ssh/bizshore01-deploy-shell" -o IdentitiesOnly=yes \
  -o BatchMode=yes ci-deploy@bizshore-server home-state
```

## Reversión

Usa el comando local con el SHA completo de una release que ya exista en el
host:

```bash
./scripts/bizshore rollback home <SHA_COMPLETO>
```

Comprueba el estado con `home-state` y vuelve a verificar ambos dominios. La
reversión cambia únicamente el symlink del sitio.

Los cambios a dominios, vhosts, Tunnel, almacenamiento o servicios compartidos
se gestionan en `bizshore-platform`. No hay workflows de GitHub Actions ni
GitHub Releases en el flujo de publicación.
