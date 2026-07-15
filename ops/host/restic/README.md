# Backups de bizshore-01 con restic

Estado: **activo**. Destino: Google Drive personal, vía el backend `rclone:`
de restic. Repo inicializado en `rclone:gdrive:backups/bizshore-01`, timer
diario corriendo (`restic-backup.timer`), backup + `restic check` + restore
de prueba ya verificados en producción.

## Por qué restic

- Backups incrementales y deduplicados — solo sube lo que cambió.
- Cifrado en el cliente antes de subir — el destino nunca ve el contenido
  en claro, ni siquiera si es un bucket/Drive de terceros.
- Un solo binario estático, sin dependencias, footprint casi nulo cuando
  no está corriendo (importante dado que el server es limitado).
- Soporta local, SFTP, S3-compatible (Backblaze B2), y — vía `rclone:` —
  cualquier backend de rclone: Google Drive, OneDrive, Dropbox, etc.

## Destino elegido — Opción A: Google Drive (vía rclone)

Se prefirió sobre OneDrive por auth más estable (menos cambios de flujo
OAuth) y cuota diaria más permisiva. Se prefirió sobre Backblaze B2/SFTP
porque reutiliza una cuenta que ya existía, sin crear cuenta nueva ni
depender de que otra máquina (ej. la HP física) esté encendida y en la
tailnet cuando corre el timer.

### A.1 — Configurar el remote de rclone (una vez, en una máquina CON browser)

El server no tiene browser para completar el OAuth interactivo, así que
este paso se hace en la Acer y se copia el resultado:

```bash
# instalar rclone en la Acer si no está
curl https://rclone.org/install.sh | sudo bash

rclone config
# n) New remote → name: gdrive
# Storage → Google Drive (número visible en el menú, cambia entre versiones)
# client_id / client_secret → dejar vacío (ver nota de rate-limit abajo)
# scope → 1 (Full access all files, excluding Application Data Folder)
# service_account_file → dejar vacío
# Edit advanced config? → n
# Use web browser to automatically authenticate? → y (abre el browser, loguearse con la cuenta de Drive a usar, Allow)
# Configure this as a Shared Drive (Team Drive)? → n (es Drive personal)
# Keep this "gdrive" remote? → y
```

Verificar:

```bash
rclone lsd gdrive:
```

### A.2 — Copiar el config al server

```bash
scp ~/.config/rclone/rclone.conf bizshore-server:/tmp/rclone.conf
ssh bizshore-server
sudo mkdir -p /etc/restic
sudo install -m 600 -o root -g root /tmp/rclone.conf /etc/restic/rclone.conf
rm /tmp/rclone.conf
```

`rclone.conf` contiene el token OAuth — por eso `600 root:root`, igual que
`/etc/restic/password` y `/etc/restic/env`.

### A.3 — `/etc/restic/env`

```bash
sudo tee /etc/restic/env > /dev/null <<'EOF'
export RESTIC_REPOSITORY="rclone:gdrive:backups/bizshore-01"
export RESTIC_PASSWORD_FILE="/etc/restic/password"
export RCLONE_CONFIG="/etc/restic/rclone.conf"
EOF
sudo chmod 600 /etc/restic/env
```

### Nota — rate limit del client_id compartido

Dejar `client_id`/`client_secret` vacíos en `rclone config` usa la
credencial interna de rclone, **compartida por todos los usuarios de
rclone del mundo**. Con eso, un `restic init` con este volumen de datos
ya disparó un `403 Quota exceeded (Queries per minute)` una vez — rclone
reintentó solo y se recuperó, pero si en algún momento un backup falla
duro por esto (no un retry transitorio, sino error persistente), la
solución es generar un client_id propio en Google Cloud Console (gratis,
~5 min) y volver a correr `rclone config` para setearlo en el remote.

## Otras opciones (no elegidas, documentadas por si el destino cambia)

### Opción B — Backblaze B2

Costo real para este volumen: probablemente **$0/mes** (plan gratis de
10GB). Pasos:

1. Crear cuenta en <https://www.backblaze.com/b2/sign-up.html>.
2. Crear un bucket privado, ej. `bizshore01-backups`.
3. Crear una **Application Key** con permiso restringido a ese bucket
   únicamente (no la master key) — `Backblaze B2` → `App Keys` → `Add a
   New Application Key`, scope: solo ese bucket, capacidades solo
   `listFiles`, `readFiles`, `writeFiles`, `deleteFiles` (no `listBuckets`
   a nivel cuenta).
4. En el server:

   ```bash
   sudo tee /etc/restic/env > /dev/null <<'EOF'
   export RESTIC_REPOSITORY="b2:bizshore01-backups:bizshore-01"
   export RESTIC_PASSWORD_FILE="/etc/restic/password"
   export B2_ACCOUNT_ID="<applicationKeyId>"
   export B2_ACCOUNT_KEY="<applicationKey>"
   EOF
   sudo chmod 600 /etc/restic/env
   ```

### Opción C — otra máquina tuya (SFTP)

Si tenés otro host alcanzable por SSH (la HP física, un NAS, etc.), sin
costo adicional:

```bash
sudo tee /etc/restic/env > /dev/null <<'EOF'
export RESTIC_REPOSITORY="sftp:usuario@otro-host:/ruta/a/backups/bizshore-01"
export RESTIC_PASSWORD_FILE="/etc/restic/password"
EOF
sudo chmod 600 /etc/restic/env
```

Requiere que el usuario `root` (el backup corre como root, ver
`restic-backup.service`) tenga una llave SSH propia con acceso a ese
otro host, y que la máquina destino esté encendida y alcanzable cuando
corre el timer (03:15 todos los días) — el motivo por el que no se eligió
para la HP física.

### Opción D — solo local (gratis, pero sin protección ante falla del server)

```bash
sudo mkdir -p /data/backups-local
sudo tee /etc/restic/env > /dev/null <<'EOF'
export RESTIC_REPOSITORY="/data/backups-local"
export RESTIC_PASSWORD_FILE="/etc/restic/password"
EOF
sudo chmod 600 /etc/restic/env
```

**Advertencia**: si el disco o la VM completa del server fallan, este
backup se pierde junto con todo lo demás. Sirve solo contra borrados
accidentales o corrupción de un archivo puntual, no contra desastre.

## Paso 1 — generar la contraseña de cifrado del repo

```bash
sudo mkdir -p /etc/restic
sudo sh -c 'openssl rand -base64 32 > /etc/restic/password'
sudo chmod 600 /etc/restic/password
```

**Guardar una copia de esta contraseña fuera del server** (password
manager, etc.) — sin ella, los backups son irrecuperables incluso
teniendo el repositorio completo. Perder esta contraseña es
funcionalmente idéntico a no tener backup.

## Paso 2 — instalar restic + inicializar el repo

```bash
sudo apt install -y restic rclone   # rclone también, si el destino usa backend rclone:
```

Con destino Google Drive, crear la carpeta destino y el repo:

```bash
sudo rclone --config /etc/restic/rclone.conf mkdir gdrive:backups/bizshore-01
sudo bash -c 'source /etc/restic/env && restic init'
```

Con destino B2/SFTP/local, alcanza con:

```bash
sudo bash -c 'source /etc/restic/env && restic init'
```

**Importante**: usar siempre `sudo bash -c 'source /etc/restic/env && restic ...'`,
nunca `source /etc/restic/env && sudo -E restic ...` — `/etc/restic/env`
es `600 root:root`, y el `source` de la primera forma corre en tu shell
sin privilegios *antes* de que `sudo` entre en juego, así que falla con
`Permission denied` sin ni siquiera intentar el comando de restic. Este
fue un bug real la primera vez que se corrió esta guía.

## Paso 3 — instalar el script y los units de systemd

Estos archivos viven en este repo, no en el server — hay que sincronizarlos:

```bash
# desde la Acer, parado en el repo:
rsync -az ops/host/restic/ bizshore-server:/tmp/restic-ops/

# en el server:
sudo install -m 755 /tmp/restic-ops/backup.sh /usr/local/bin/restic-backup.sh
sudo install -m 644 /tmp/restic-ops/restic-backup.service /etc/systemd/system/
sudo install -m 644 /tmp/restic-ops/restic-backup.timer /etc/systemd/system/
rm -rf /tmp/restic-ops
sudo systemctl daemon-reload
sudo systemctl enable --now restic-backup.timer
```

## Paso 4 — validar

```bash
sudo systemctl start restic-backup.service   # corre un backup ahora, sin esperar al timer
sudo journalctl -u restic-backup.service -n 50 --no-pager
sudo bash -c 'source /etc/restic/env && restic snapshots'
```

## Restaurar (cuando haga falta)

```bash
sudo bash -c 'source /etc/restic/env && restic snapshots'                                  # listar
sudo bash -c 'source /etc/restic/env && restic restore latest --target /tmp/restore-test'  # a un path de prueba primero
sudo ls -laR /tmp/restore-test   # el restore corre como root; sudo también para leer el resultado
```

No restaurar directo sobre `/data` en producción sin probar antes en un
path separado — confirmar que el snapshot tiene lo esperado.
