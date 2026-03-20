# Contributing to IND Appointments Tracker

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Git

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/ind-appointments.git
cd ind-appointments

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your SMTP credentials and a JWT secret

# Initialize the database
npm run db:init

# Create an admin account
node scripts/create-admin.js

# Start the development server
npm run dev
```

The app will be available at http://localhost:3000.

## Development Workflow

### Branch Naming

- `feature/short-description` -- new features
- `fix/short-description` -- bug fixes
- `docs/short-description` -- documentation changes

### Before Submitting

```bash
# Lint your code
npm run lint

# Check types
npm run type-check

# Run tests
npm run test:run
```

### Commit Messages

Use clear, descriptive commit messages:

```
Add Telegram notification channel
Fix WebSocket reconnection on auth timeout
Update deployment docs for Docker setup
```

## Project Structure

```
app/            Next.js pages and API routes
lib/            Core business logic (scrapers, notifications, auth)
components/     React UI components
database/       SQL schema and migrations
scripts/        CLI utilities (db init, admin creation, backups)
server.js       Custom Node.js server (Next.js + WebSocket)
```

### Key Architectural Decisions

- **SQLite** (better-sqlite3) -- embedded, zero-config, good enough for the expected load
- **Custom server.js** -- required for WebSocket support alongside Next.js
- **Tiered scraping** -- high-priority types (DOC, BIO) every 5 min, others every 15 min
- **Multi-channel notifications** -- email, Pushover, Telegram, webhooks

## Adding a New Notification Channel

1. Add the channel logic in `lib/notifications.ts`
2. Add user credential fields via a database migration in `database/migrations/`
3. Add a UI for credential input in `app/settings/`
4. Add an API route in `app/api/user/` for saving credentials
5. Update the notification preferences UI if needed

## Adding a New Appointment Source

1. Create a scraper module in `lib/` (see `lib/ind-api.ts` or `lib/expat-centers.ts` for examples)
2. Register it in `lib/appointment-checker.ts`
3. Add the source to the cron scheduler in `lib/cron/scheduler.ts`
4. Update location constants in `lib/appointment-data.ts`

## Database Migrations

Add a new numbered SQL file in `database/migrations/`:

```
database/migrations/004_your_migration.sql
```

Run it with:

```bash
npm run db:migrate
```

## Code Style

- TypeScript strict mode is enabled
- Use Zod for runtime validation of external data (`lib/validation.ts`)
- Use prepared statements for all SQL queries (default with better-sqlite3)
- Prefer server components; use `'use client'` only when needed

## Reporting Issues

When reporting a bug, include:

1. Steps to reproduce
2. Expected vs actual behavior
3. Node.js version (`node --version`)
4. Relevant log output

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
