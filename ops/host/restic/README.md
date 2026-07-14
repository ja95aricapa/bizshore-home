# Backups de bizshore-01 con restic

Estado: **preparado, no activado**. El destino de los backups (dónde
viven las copias) todavía no está decidido — sin eso, activar el timer
solo produciría un `restic-backup.service` fallando en loop.

## Por qué restic

- Backups incrementales y deduplicados — solo sube lo que cambió.
- Cifrado en el cliente antes de subir — el destino nunca ve el contenido
  en claro, ni siquiera si es un bucket de terceros.
- Un solo binario estático, sin dependencias, footprint casi nulo cuando
  no está corriendo (importante dado que el server es limitado).
- Soporta local, SFTP, S3-compatible (incluye Backblaze B2, que es el
  más barato del mercado para este volumen de datos) y varios más.

## Paso 0 — elegir destino (pendiente, tu decisión)

### Opción A — Backblaze B2 (recomendado si no tenés otra máquina)

Costo real para este caso: probablemente **$0/mes** — B2 tiene un plan
gratis de 10GB, y `/data/static-sites` + `ops/caddy` + config de autotrade
seguramente no lo superen. Pasos:

1. Crear cuenta en <https://www.backblaze.com/b2/sign-up.html>.
2. Crear un bucket privado, ej. `bizshore01-backups`.
3. Crear una **Application Key** con permiso restringido a ese bucket
   únicamente (no la master key) — `Backblaze B2` → `App Keys` → `Add a
   New Application Key`, scope: solo ese bucket, capacidades solo
   `listFiles`, `readFiles`, `writeFiles`, `deleteFiles` (no `listBuckets`
   a nivel cuenta).
4. En el server:
   ```bash
   sudo mkdir -p /etc/restic
   sudo tee /etc/restic/env > /dev/null <<'EOF'
   export RESTIC_REPOSITORY="b2:bizshore01-backups:bizshore-01"
   export RESTIC_PASSWORD_FILE="/etc/restic/password"
   export B2_ACCOUNT_ID="<applicationKeyId>"
   export B2_ACCOUNT_KEY="<applicationKey>"
   EOF
   sudo chmod 600 /etc/restic/env
   ```

### Opción B — otra máquina tuya (SFTP)

Si tenés otro host alcanzable por SSH (la HP física, un NAS, etc.), sin
costo adicional:

```bash
sudo mkdir -p /etc/restic
sudo tee /etc/restic/env > /dev/null <<'EOF'
export RESTIC_REPOSITORY="sftp:usuario@otro-host:/ruta/a/backups/bizshore-01"
export RESTIC_PASSWORD_FILE="/etc/restic/password"
EOF
sudo chmod 600 /etc/restic/env
```

Requiere que el usuario `root` (el backup corre como root, ver
`restic-backup.service`) tenga una llave SSH propia con acceso a ese
otro host — generarla y wirearla es un paso adicional no cubierto acá.

### Opción C — solo local (gratis, pero sin protección ante falla del server)

```bash
sudo mkdir -p /etc/restic /data/backups-local
sudo tee /etc/restic/env > /dev/null <<'EOF'
export RESTIC_REPOSITORY="/data/backups-local"
export RESTIC_PASSWORD_FILE="/etc/restic/password"
EOF
sudo chmod 600 /etc/restic/env
```

**Advertencia**: si el disco o la VM completa del server fallan, este
backup se pierde junto con todo lo demás. Sirve solo contra borrados
accidentales o corrupción de un archivo puntual, no contra desastre.

## Paso 1 — generar la contraseña de cifrado del repo (para cualquier opción)

```bash
sudo sh -c 'openssl rand -base64 32 > /etc/restic/password'
sudo chmod 600 /etc/restic/password
```

**Guardar una copia de esta contraseña fuera del server** (password
manager, etc.) — sin ella, los backups son irrecuperables incluso
teniendo el repositorio completo. Perder esta contraseña es
funcionalmente idéntico a no tener backup.

## Paso 2 — instalar restic + inicializar el repo

```bash
sudo apt install restic
source /etc/restic/env
sudo -E restic init
```

## Paso 3 — instalar el script y los units de systemd

```bash
sudo install -m 755 ops/host/restic/backup.sh /usr/local/bin/restic-backup.sh
sudo install -m 644 ops/host/restic/restic-backup.service /etc/systemd/system/
sudo install -m 644 ops/host/restic/restic-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now restic-backup.timer
```

## Paso 4 — validar

```bash
sudo systemctl start restic-backup.service   # corre un backup ahora, sin esperar al timer
sudo journalctl -u restic-backup.service -n 50 --no-pager
source /etc/restic/env && sudo -E restic snapshots
```

## Restaurar (cuando haga falta)

```bash
source /etc/restic/env
sudo -E restic snapshots                       # listar
sudo -E restic restore <snapshot-id> --target /tmp/restore-test   # a un path de prueba primero
```

No restaurar directo sobre `/data` en producción sin probar antes en un
path separado — confirmar que el snapshot tiene lo esperado.
