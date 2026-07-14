# fail2ban en bizshore-01

Estado: **listo para instalar** — sin decisiones pendientes, a diferencia
de restic. `jail.local` en este directorio es la fuente de verdad; el
server solo necesita el paquete instalado y este archivo copiado.

## Instalación

```bash
sudo apt update && sudo apt install fail2ban
sudo install -m 644 ops/host/fail2ban/jail.local /etc/fail2ban/jail.local
sudo systemctl enable --now fail2ban
```

## Validar

```bash
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

El segundo comando debe mostrar el jail `sshd` activo, con contadores de
intentos fallados/baneados en cero si es recién instalado.

## Después de cada cambio a `jail.local` en este repo

```bash
sudo install -m 644 ops/host/fail2ban/jail.local /etc/fail2ban/jail.local
sudo systemctl reload fail2ban
```

## Desbanear una IP a mano (si te bloqueás a vos mismo)

```bash
sudo fail2ban-client set sshd unbanip <IP>
```

## Nota sobre Tailscale

Las 4 llaves de CI (`ci-deploy`) solo llegan por Tailscale (`tag:ci`), no
por la IP pública — fail2ban no las afecta en el flujo normal. Este jail
protege específicamente contra escaneos/fuerza bruta sobre el puerto 22
expuesto a internet para la llave interactiva (`ja95aricapa`). Si en
algún momento se decide cerrar el puerto 22 público por completo y
forzar todo el acceso SSH vía Tailscale, fail2ban deja de ser necesario
para SSH — pero es una decisión aparte, no bloqueante para instalar esto
ahora.
