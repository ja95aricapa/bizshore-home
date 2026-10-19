# Backups de bizshore-01 con restic

Estado documentado: Google Drive personal, vía el backend `rclone:` de restic.
El repo inicializado es `rclone:gdrive:backups/bizshore-01`. El estado activo,
la salud reciente, la cobertura y la restauración deben verificarse en el host;
la documentación por sí sola no demuestra que el backup diario esté sano.

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
# client_id / client_secret → usar el client_id propio creado abajo
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

### A.1.1 — Crear un OAuth client propio para rclone

El journal de producción confirmó `403 rateLimitExceeded` con causa
`RATE_LIMIT_EXCEEDED` en Google Drive API. El remote se configuró sin
`client_id` propio, por lo que usa el OAuth client compartido de rclone.
Rclone informa que ese client compartido se retira durante 2026 y recomienda
crear uno propio; esta es la corrección prioritaria. No se debe pedir aumento
de cuota ni activar facturación para este procedimiento.

1. En [Google Cloud Console](https://console.cloud.google.com/), crea o elige
   un proyecto dedicado a este backup y habilita **Google Drive API**.
2. Configura la pantalla de consentimiento OAuth como **External**, agrega tu
   propia cuenta como usuario de prueba y crea un OAuth Client ID de tipo
   **Desktop app**. Usa el modo de publicación que evite que el permiso expire
   cada siete días; acepta la advertencia de aplicación no verificada durante
   el inicio de sesión personal si Google la presenta. No habilites billing.
3. En la Acer, respalda el archivo de configuración con permisos privados y
   ejecuta `rclone config`. Edita el remote `gdrive`, introduce el client ID y
   client secret propios, conserva la cuenta/alcance de Drive actual y vuelve
   a autorizarlo en el navegador. No pegues esos valores en el chat ni en Git.
4. Confirma que `rclone lsd gdrive:` funciona desde la Acer y que lista la
   cuenta esperada. Copia de forma segura el nuevo `rclone.conf` al servidor
   como `/etc/restic/rclone.conf`, propiedad `root:root`, modo `600`; conserva
   el archivo anterior fuera de la ruta activa hasta validar el nuevo.
5. Verifica en el servidor únicamente el acceso (sin mostrar la configuración):
   `sudo rclone --config /etc/restic/rclone.conf lsd gdrive:`.

El log también muestra que el servicio fue terminado manualmente con SIGTERM;
eso explica su estado `failed` actual. Mantén detenido el timer hasta validar
el OAuth client propio, comprobar la ausencia de procesos activos, correr un
backup único y confirmar un snapshot nuevo. Aún falta restaurar una muestra
para considerar probado el respaldo.

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
```

**No habilitar todavía el timer.** La ejecución de producción observada el
2026-10-17 fue terminada manualmente después de más de 15 horas; el journal
registró `403 RATE_LIMIT_EXCEEDED` de Google Drive API. El espacio disponible
no era el problema. Primero configura un OAuth client propio, verifica acceso,
ejecuta una copia manual completa y restaura una muestra en un directorio
aislado. Solo después de completar esa prueba se debe ejecutar
`sudo systemctl enable --now restic-backup.timer`.

La unidad establece `TimeoutStartSec=2h`: en un servicio `Type=oneshot` el
timeout de inicio está desactivado por defecto. El límite evita que otro
proceso retenido por errores de Drive ocupe la unidad durante horas; no
demuestra por sí mismo que el backup terminó. No hay reinicio automático del
mismo job: systemd marca el fallo y el siguiente intento sería el del timer,
cuando se habilite. Confirma el fallo y el estado del repositorio antes de
iniciar otro intento manual o ejecutar `restic unlock`.

## Paso 4 — validar antes de habilitar el timer

Haz estos pasos después de confirmar que el OAuth client propio funciona y que
no quedan procesos `restic` o `rclone` de la ejecución anterior:

```bash
sudo rclone --config /etc/restic/rclone.conf lsd gdrive:
sudo systemctl reset-failed restic-backup.service
sudo systemctl start restic-backup.service  # espera hasta completar o alcanzar el límite de dos horas
sudo systemctl show restic-backup.service --property=ActiveState,SubState,Result,MainPID,ExecMainStatus --no-pager
sudo journalctl -u restic-backup.service -n 50 --no-pager
sudo bash -c 'source /etc/restic/env && restic snapshots'
sudo bash -c 'source /etc/restic/env && restic restore latest --target /tmp/restic-restore-test'
```

Comprueba que hay un snapshot nuevo, `Result=success`, y los archivos de la
muestra restaurada. Borra la muestra solo después de confirmar el resultado.
Si cualquier paso falla o agota el timeout, deja el timer inactivo e
investiga antes de volver a ejecutar `restic backup`.

## Restaurar (cuando haga falta)

```bash
sudo bash -c 'source /etc/restic/env && restic snapshots'                                  # listar
sudo bash -c 'source /etc/restic/env && restic restore latest --target /tmp/restore-test'  # a un path de prueba primero
sudo ls -laR /tmp/restore-test   # el restore corre como root; sudo también para leer el resultado
```

No restaurar directo sobre `/data` en producción sin probar antes en un
path separado — confirmar que el snapshot tiene lo esperado.
