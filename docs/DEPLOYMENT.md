# Deployment Guide

This guide covers every way to deploy the IND Appointments Tracker, from a quick `docker compose up` to a hardened production setup behind Nginx with SSL.

---

## Table of Contents

- [Quick Start (Docker)](#quick-start-docker)
- [Docker with Nginx + SSL](#docker-with-nginx--ssl)
- [Docker with Booking Automation](#docker-with-booking-automation)
- [Bare-Metal / VPS (systemd)](#bare-metal--vps-systemd)
- [Environment Variables Reference](#environment-variables-reference)
- [Database Management](#database-management)
- [Backups](#backups)
- [Monitoring](#monitoring)
- [Upgrading](#upgrading)
- [Reverse Proxy (manual Nginx)](#reverse-proxy-manual-nginx)
- [Troubleshooting](#troubleshooting)

---

## Quick Start (Docker)

The fastest path from zero to running.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ind-appointments.git
cd ind-appointments

# 2. Create your environment file
cp .env.example .env
# Edit .env -- at minimum set JWT_SECRET, SMTP_*, and BASE_URL

# 3. Start
docker compose up -d

# 4. Watch logs until healthy
docker compose logs -f

# 5. Initialize the database and create an admin user
docker compose exec app node scripts/init-db.js
docker compose exec app node scripts/create-admin.js
```

The app is now running at **http://localhost:3000**.

### Verify

```bash
curl http://localhost:3000/api/health
# → {"status":"ok", ...}
```

---

## Docker with Nginx + SSL

For production, run behind Nginx with TLS termination.

### 1. Obtain SSL Certificates

Use Let's Encrypt via Certbot, or provide your own:

```bash
mkdir -p nginx/ssl

# Option A: Copy existing certificates
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# Option B: Self-signed (for testing only)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj '/CN=localhost'
```

### 2. Update Environment

In your `.env`:

```env
BASE_URL=https://yourdomain.com
```

### 3. Start with the Proxy Profile

```bash
docker compose --profile proxy up -d
```

This starts both the app and Nginx. HTTP requests on port 80 are redirected to HTTPS on port 443.

### 4. Certificate Renewal

If using Let's Encrypt, add a cron job:

```bash
0 3 * * * certbot renew --quiet && docker compose restart nginx
```

---

## Docker with Booking Automation

The booking automation feature uses Playwright/Puppeteer and requires Chromium. This increases the image size by ~400MB.

```bash
INSTALL_BROWSERS=true docker compose up -d --build
```

Without this flag, the app runs normally but booking automation endpoints will not function.

---

## Bare-Metal / VPS (systemd)

For running directly on a Linux server without Docker.

### 1. Install Dependencies

```bash
# Node.js 20+ (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Build tools for better-sqlite3
sudo apt-get install -y python3 make g++
```

### 2. Set Up the Application

```bash
cd /opt/ind-appointments
npm ci --production
cp .env.example .env
# Edit .env with your values

npm run db:init
node scripts/create-admin.js
npm run build
```

### 3. Create systemd Service

```bash
sudo tee /etc/systemd/system/ind-appointments.service > /dev/null << 'EOF'
[Unit]
Description=IND Appointments Tracker
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/ind-appointments
ExecStart=/usr/bin/node /opt/ind-appointments/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="PORT=3000"
EnvironmentFile=/opt/ind-appointments/.env

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/ind-appointments/data /opt/ind-appointments/logs

[Install]
WantedBy=multi-user.target
EOF
```

### 4. Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ind-appointments

# Verify
sudo systemctl status ind-appointments
journalctl -u ind-appointments -f
```

---

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Auth token signing key (32+ chars) | `openssl rand -hex 32` |
| `BASE_URL` | Public URL of the app | `https://appointments.example.com` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `you@gmail.com` |
| `SMTP_PASSWORD` | SMTP password or app password | `abcd efgh ijkl mnop` |
| `FROM_EMAIL` | Sender email address | `noreply@example.com` |
| `FROM_NAME` | Sender display name | `IND Appointments` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./data/ind_appointments.db` | SQLite database path |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug` |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `TELEGRAM_BOT_TOKEN` | -- | Telegram bot token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | -- | Secret for verifying Telegram webhooks |
| `PUSHOVER_API_TOKEN` | -- | Pushover application API token |
| `ADMIN_EMAIL` | -- | Email for system alerts |
| `RATE_LIMIT_REQUESTS` | `100` | Max API requests per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `IND_API_DELAY_MS` | `2000` | Delay between IND API requests |
| `EXPAT_CENTER_DELAY_MS` | `500` | Delay between expat center requests |

---

## Database Management

The app uses SQLite, stored at `data/ind_appointments.db`.

### Initialize

```bash
# Docker
docker compose exec app node scripts/init-db.js

# Bare metal
npm run db:init
```

### Run Migrations

```bash
# Docker
docker compose exec app node scripts/run-migrations.js

# Bare metal
npm run db:migrate
```

### Reset (destroys all data)

```bash
# Docker
docker compose exec app sh -c "rm -f /app/data/ind_appointments.db && node scripts/init-db.js"

# Bare metal
npm run db:reset
```

---

## Backups

### Automated (Docker)

Enable the backup profile to run daily backups with 14-day retention:

```bash
docker compose --profile backup up -d
```

Backups are stored in the `app-backups` Docker volume.

### Manual

```bash
# Docker
docker compose exec app node scripts/backup-database.js

# Bare metal
node scripts/backup-database.js

# Or simply copy the file
cp data/ind_appointments.db "backups/ind_appointments_$(date +%Y%m%d).db"
```

### Restore

```bash
# Docker
docker compose exec app node scripts/restore-database.js /app/data/backup.db

# Bare metal
node scripts/restore-database.js backups/ind_appointments_20250101.db
```

---

## Monitoring

### Health Check

```bash
curl -s http://localhost:3000/api/health | jq .
```

Returns database status, scraper last-run time, uptime, and memory usage.

### Admin Health Dashboard

Navigate to `/admin` after logging in with an admin account for real-time statistics: active users, scraper runs, notification delivery rates, system health.

### Logs

```bash
# Docker
docker compose logs -f app
docker compose logs --tail 100 app

# systemd
journalctl -u ind-appointments -f
journalctl -u ind-appointments --since "1 hour ago"
```

### Alerts

Set `ADMIN_EMAIL` in `.env` to receive email alerts on critical failures (scraper errors, database issues).

---

## Upgrading

### Docker

```bash
git pull
docker compose down
docker compose up -d --build
docker compose exec app node scripts/run-migrations.js
```

### Bare Metal

```bash
git pull
npm ci --production
npm run build
npm run db:migrate
sudo systemctl restart ind-appointments
```

---

## Reverse Proxy (Manual Nginx)

If you prefer to manage Nginx outside Docker, here is a minimal config:

```nginx
server {
    listen 443 ssl http2;
    server_name appointments.example.com;

    ssl_certificate     /etc/letsencrypt/live/appointments.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/appointments.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

---

## Troubleshooting

### Container won't start

```bash
docker compose logs app
# Check for missing environment variables or port conflicts
```

### Database locked errors

SQLite allows only one writer at a time. If you see `SQLITE_BUSY`:
- Ensure only one instance of the app is running
- Check for zombie processes: `docker compose ps`

### Email not sending

1. Verify SMTP credentials in `.env`
2. For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833)
3. Check notification logs: visit `/admin/notifications` or query the database

### WebSocket not connecting

- Ensure `BASE_URL` matches the actual URL (including `https://` if behind SSL)
- If behind a reverse proxy, verify the WebSocket upgrade headers are forwarded
- Check browser console for connection errors

### High memory usage

The app typically uses 100-200MB. If higher:
- Check `LOG_LEVEL` isn't set to `debug` in production
- Review cron job frequency in `lib/cron/scheduler.ts`

### Permission denied on data directory

```bash
# Docker
docker compose exec -u root app chown -R nextjs:nodejs /app/data

# Bare metal
sudo chown -R www-data:www-data data/ logs/
```
