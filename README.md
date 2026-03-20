# IND Appointments Tracker

Track available IND (Immigration & Naturalisation Service) appointments across the Netherlands in real-time. Get notified instantly when a slot opens at your preferred location.

**What makes this different:** It monitors both official IND offices (11 locations) *and* international expat centers (The Hague, Rotterdam) -- the only tool that covers all three sources.

---

## Quick Start (Docker)

```bash
git clone https://github.com/your-org/ind-appointments.git
cd ind-appointments

cp .env.example .env
# Edit .env: set JWT_SECRET, SMTP credentials, and BASE_URL

docker compose up -d
docker compose exec app node scripts/init-db.js
docker compose exec app node scripts/create-admin.js
```

Open **http://localhost:3000**. That's it.

> For production deployment with SSL, backups, and monitoring, see the [Deployment Guide](docs/DEPLOYMENT.md).

---

## Features

### Appointment Tracking

- **13 locations**: 11 IND offices + The Hague International Centre + Rotterdam International Center
- **6 appointment types**: Document Collection, Biometrics, Residence Sticker, Return Visa, Ukraine Residency, Family Reunification
- **Intelligent scraping**: high-demand types checked every 5 minutes, others every 15
- **DigiD integration**: tracks DigiD-based appointment slots

### Notifications

- **Email** via any SMTP provider (Gmail, SendGrid, etc.)
- **Pushover** for mobile push notifications
- **Telegram** bot messages
- **Webhooks** for custom integrations
- **WebSocket** for real-time in-browser updates

### User Preferences

- Filter by appointment type, location(s), and number of persons
- Set a monitoring window (e.g., "next 90 days only")
- Do Not Disturb hours (with midnight-spanning support)
- Minimum interval between notifications (no spam)
- Per-channel toggles (email on, push off, etc.)

### Dashboard & Tools

- Filter and browse all available appointments
- Bookmark appointments for quick access
- Export to CSV or iCalendar
- Step-by-step booking guides with direct links
- Dark mode, mobile-responsive design

### Admin Panel

- User management (view, edit, delete, bulk operations)
- Real-time scraper statistics and health monitoring
- Manual scraper triggers
- Notification testing
- Content zone management (4 monetization zones)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript |
| Database | SQLite (better-sqlite3) -- embedded, zero-config |
| Styling | Tailwind CSS 4 |
| Auth | JWT + bcryptjs |
| Email | Nodemailer (SMTP) |
| Real-time | WebSocket (custom Node.js server) |
| Scraping | Playwright, Puppeteer |
| Scheduling | node-cron |
| Testing | Vitest |

---

## Documentation

| Document | Description |
|----------|-------------|
| **[Deployment Guide](docs/DEPLOYMENT.md)** | Docker, Docker + Nginx/SSL, bare-metal/systemd, backups, monitoring, upgrading |
| **[Architecture](docs/ARCHITECTURE.md)** | System design, component overview, data flow, security model |
| **[API Reference](docs/API.md)** | All 35+ endpoints with request/response examples |
| **[Contributing](CONTRIBUTING.md)** | Development setup, workflow, code style, how to add features |
| **[Environment Variables](.env.example)** | Complete list with descriptions |

---

## Installation (Without Docker)

### Prerequisites

- Node.js 20+
- An SMTP email account (Gmail, SendGrid, Mailgun, etc.)

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values (JWT_SECRET, SMTP_*, BASE_URL)

# Initialize database
npm run db:init

# Create admin account
node scripts/create-admin.js

# Development
npm run dev

# Production
npm run build
npm start
```

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and set the required values.

### Required

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Auth signing key (32+ characters). Generate with `openssl rand -hex 32` |
| `BASE_URL` | Public URL (e.g., `https://appointments.example.com`) |
| `SMTP_HOST` | SMTP server (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (typically `587`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password or [Gmail App Password](https://support.google.com/accounts/answer/185833) |
| `FROM_EMAIL` | Sender email address |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `TELEGRAM_BOT_TOKEN` | -- | Telegram bot token (from @BotFather) |
| `PUSHOVER_API_TOKEN` | -- | Pushover app API token |
| `ADMIN_EMAIL` | -- | Receives system alerts on failures |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug` |

See [`.env.example`](.env.example) for the complete list.

---

## Locations

### IND Offices

| Code | City |
|------|------|
| AM | Amsterdam |
| DH | Den Haag |
| ZW | Zwolle |
| DEN | Den Bosch |
| UT | Utrecht |
| HRL | Haarlem |
| ROT | Rotterdam |
| ZVH | Zaventem |
| GRO | Groningen |
| EIN | Eindhoven |
| THE | The Hague |

### Expat Centers

| Code | Center |
|------|--------|
| THIC | The Hague International Centre |
| RIC | Rotterdam International Center |

---

## How It Works

1. **Scrapers** poll the IND API, THIC, and Rotterdam IC on a cron schedule
2. New appointments are stored in SQLite and diffed against the previous state
3. New slots are matched against each user's notification preferences
4. Notifications are dispatched via the user's enabled channels (email, Pushover, Telegram, webhook)
5. WebSocket clients receive real-time updates in the browser

```
IND API ──┐
THIC API ─┤──→ Appointment Checker ──→ SQLite ──→ Notification Engine ──→ Users
RIC API ──┘                                        (email/push/telegram/ws)
```

---

## Docker Details

### Build Variants

```bash
# Standard (lean, ~150MB)
docker compose up -d

# With Chromium for booking automation (~550MB)
INSTALL_BROWSERS=true docker compose up -d --build
```

### Compose Profiles

```bash
# App only (default)
docker compose up -d

# App + Nginx reverse proxy with SSL
docker compose --profile proxy up -d

# App + daily database backups (14-day retention)
docker compose --profile backup up -d

# All services
docker compose --profile proxy --profile backup up -d
```

### Volumes

| Volume | Purpose |
|--------|---------|
| `app-data` | SQLite database (persistent) |
| `app-logs` | Application logs |
| `app-backups` | Database backups (when backup profile is active) |

---

## Scripts

```bash
npm run dev              # Start development server
npm run build            # Production build
npm start                # Production server
npm run lint             # ESLint with auto-fix
npm run type-check       # TypeScript validation
npm run test             # Vitest (watch mode)
npm run test:run         # Vitest (single run)
npm run test:coverage    # Coverage report
npm run db:init          # Initialize database
npm run db:reset         # Reset database (deletes all data!)
npm run db:migrate       # Run pending migrations
```

### Utility Scripts

```bash
node scripts/create-admin.js       # Create an admin user
node scripts/backup-database.js    # Manual database backup
node scripts/restore-database.js   # Restore from backup
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:3000/api/health
```

### Admin Dashboard

Log in with an admin account and visit `/admin` for real-time statistics, user management, scraper logs, and system health.

### Logs

```bash
# Docker
docker compose logs -f app

# systemd
journalctl -u ind-appointments -f
```

---

## Project Structure

```
app/                    Next.js pages and API routes
├── api/                35+ API endpoints
├── admin/              Admin dashboard
├── login/              Authentication
├── preferences/        User notification settings
└── page.tsx            Main appointment dashboard

lib/                    Core business logic
├── ind-api.ts          IND appointment scraper
├── expat-centers.ts    THIC + Rotterdam scrapers
├── digid-api.ts        DigiD appointment scraper
├── appointment-checker.ts  Orchestrator (scrape → diff → notify)
├── notifications.ts    Multi-channel notification dispatch
├── database.ts         SQLite wrapper
├── security.ts         Auth, rate limiting, validation
└── cron/scheduler.ts   Cron job management

components/             React UI components
database/               SQL schema and migrations
scripts/                CLI tools (init, backup, admin)
server.js               Custom Node.js server (HTTP + WebSocket)
nginx/                  Nginx reverse proxy config
docs/                   Extended documentation
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, workflow, and code style guidelines.

---

## Security

- JWT authentication with bcrypt password hashing
- Input validation via Zod at all API boundaries
- SQL injection protection (prepared statements)
- Rate limiting on all API endpoints
- Security headers (CSP, HSTS, X-Frame-Options)
- Non-root Docker container
- Email verification required for account activation

Report security issues privately via email (do not open public issues).

---

## License

[MIT](LICENSE)

---

## Disclaimer

This is an **unofficial tool** for monitoring IND appointment availability. It is not affiliated with or endorsed by IND (Immigratie- en Naturalisatiedienst), The Hague International Centre, or Rotterdam International Center. Users are responsible for following all applicable rules and regulations when booking appointments.
