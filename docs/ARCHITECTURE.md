# Architecture

Technical overview of the IND Appointments Tracker for developers and contributors.

---

## System Overview

```
                    ┌─────────────────────────────────────────────┐
                    │              External APIs                   │
                    │  IND API  ·  THIC API  ·  Rotterdam (TBKR)  │
                    └──────┬──────────┬──────────────┬────────────┘
                           │          │              │
                    ┌──────▼──────────▼──────────────▼────────────┐
                    │           Cron Scheduler                     │
                    │   High-priority: 5 min  ·  Low: 15 min      │
                    │   lib/cron/scheduler.ts                      │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         Appointment Checker                  │
                    │   Deduplicate → Store → Diff → Notify        │
                    │   lib/appointment-checker.ts                 │
                    └──────┬──────────────────────┬───────────────┘
                           │                      │
              ┌────────────▼───────┐    ┌────────▼────────────┐
              │   SQLite Database   │    │  Notification Engine │
              │   better-sqlite3    │    │  Email · Pushover    │
              │   data/*.db         │    │  Telegram · Webhook  │
              └────────────────────┘    │  WebSocket (live)    │
                                         │  lib/notifications.ts│
                                         └─────────────────────┘

                    ┌─────────────────────────────────────────────┐
                    │              Next.js Application             │
                    │                                              │
                    │  ┌──────────┐  ┌───────────┐  ┌──────────┐ │
                    │  │  Pages   │  │ API Routes│  │Components│ │
                    │  │  app/*   │  │ app/api/* │  │components│ │
                    │  └──────────┘  └───────────┘  └──────────┘ │
                    │                                              │
                    │         Custom Server (server.js)            │
                    │         HTTP + WebSocket on port 3000        │
                    └─────────────────────────────────────────────┘
```

---

## Core Components

### 1. Scrapers

Three independent scraper modules fetch appointment data from different sources:

| Module | Source | Method | File |
|--------|--------|--------|------|
| IND API | Official IND appointment system | REST API | `lib/ind-api.ts` |
| THIC | The Hague International Centre | REST API | `lib/expat-centers.ts` |
| Rotterdam IC | Rotterdam International Center | TIMEBLOCKR system | `lib/expat-centers.ts` |
| DigiD | DigiD-based appointments | REST API | `lib/digid-api.ts` |

Each scraper returns a normalized appointment object with: date, time, location, type, persons, and source.

### 2. Appointment Checker (`lib/appointment-checker.ts`)

The central orchestrator:

1. Calls all scrapers
2. Deduplicates results
3. Stores new appointments in SQLite
4. Diffs against the previous state
5. Matches new appointments against user preferences
6. Dispatches notifications

### 3. Cron Scheduler (`lib/cron/scheduler.ts`)

Manages recurring tasks:

- **High-priority scraping** (DOC, BIO): every 5 minutes
- **Low-priority scraping** (VAA, TKV, UKR, FAM): every 15 minutes
- **Account cleanup**: daily, removes unverified accounts older than 30 days
- **Old data cleanup**: daily, removes stale appointments and logs
- **Health check**: hourly

### 4. Notification Engine (`lib/notifications.ts`)

Multi-channel delivery:

- **Email** -- HTML-formatted via Nodemailer/SMTP
- **Pushover** -- push notifications to mobile
- **Telegram** -- bot messages via Telegram API
- **Webhook** -- POST to user-configured URLs
- **WebSocket** -- real-time browser push

Respects user preferences: location filters, appointment types, Do Not Disturb hours, minimum notification intervals, and per-channel toggles.

### 5. Custom Server (`server.js`)

A Node.js HTTP server that:

- Hosts the Next.js application
- Runs a WebSocket server on the same port
- Handles JWT-authenticated WebSocket connections
- Provides `global.wsBroadcast()` and `global.wsBroadcastToUser()` for push messages
- Implements heartbeat monitoring, rate limiting, and graceful shutdown

### 6. Database (`lib/database.ts`)

SQLite via better-sqlite3 (synchronous, embedded):

- No external database server required
- WAL mode for concurrent read performance
- Prepared statements for query safety
- Schema defined in `database/schema.sql`
- Migrations in `database/migrations/`

---

## Request Flow

### Page Load

```
Browser → server.js → Next.js App Router → React Server Component → Response
```

### API Request

```
Browser → server.js → Next.js API Route → Auth middleware → Business logic → SQLite → JSON response
```

### WebSocket

```
Browser → server.js (WS upgrade) → JWT auth → Registered client
                                                    ↑
Cron job → Appointment Checker → New appointments → wsBroadcastToUser()
```

### Notification

```
Cron tick → Scheduler → Appointment Checker → Diff (new appointments)
    → Match against user preferences
    → For each matching user:
        → Check DND hours, min interval
        → Send via enabled channels (email/push/telegram/webhook)
        → Log result in notification_log
        → Broadcast via WebSocket
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Accounts (email, password hash, role, verification status) |
| `ind_appointments` | All tracked appointments with source metadata |
| `notification_preferences` | Per-user alert rules (type, locations, persons, schedule) |
| `notification_log` | Delivery history for every notification attempt |
| `user_notification_credentials` | Pushover, Telegram, WhatsApp, webhook credentials |
| `user_saved_appointments` | Bookmarked / saved appointments |
| `system_settings` | Key-value system configuration |
| `cron_job_log` | Scraper execution timestamps and results |
| `telegram_link_tokens` | One-time tokens for Telegram account linking |

### Relationships

```
users 1──* notification_preferences
users 1──1 user_notification_credentials
users 1──* user_saved_appointments
users 1──* notification_log
users 1──* telegram_link_tokens
```

---

## Security

| Layer | Implementation |
|-------|---------------|
| Authentication | JWT tokens with configurable expiry |
| Password storage | bcryptjs (configurable rounds) |
| Input validation | Zod schemas at API boundaries |
| SQL injection | Prepared statements (better-sqlite3 default) |
| Rate limiting | Per-IP sliding window (`lib/rate-limit.ts`) |
| Security headers | CSP, HSTS, X-Frame-Options via middleware |
| Authorization | Role-based (user/admin) checked per route |
| Email verification | Required for account activation |
| CSRF | Same-origin enforcement via headers |

---

## Directory Map

```
app/                    Next.js App Router
├── api/                API routes (35+ endpoints)
│   ├── admin/          Admin-only operations
│   ├── appointments/   Listing, export, iCal
│   ├── auth/           Login, signup, verify, reset
│   ├── preferences/    Notification preferences CRUD
│   ├── user/           Account settings
│   ├── notifications/  History and testing
│   └── telegram/       Webhook and linking
├── admin/              Admin dashboard pages
├── login/              Auth pages
├── preferences/        User settings pages
└── page.tsx            Main appointment dashboard

lib/                    Business logic
├── cron/               Scheduler
├── ind-api.ts          IND scraper
├── expat-centers.ts    THIC + Rotterdam scrapers
├── digid-api.ts        DigiD scraper
├── appointment-checker.ts  Orchestrator
├── notifications.ts    Multi-channel dispatch
├── database.ts         SQLite wrapper
├── security.ts         Auth utilities
├── validation.ts       Zod schemas
└── ...                 Rate limiting, logging, retry, health

components/             React components
database/               Schema and migrations
scripts/                CLI tools (init, admin, backup)
server.js               Custom HTTP + WebSocket server
```

---

## Technology Choices

| Choice | Rationale |
|--------|-----------|
| Next.js 16 + App Router | Server components reduce client JS; API routes colocated with pages |
| SQLite | Zero-ops database; single-file backup; sufficient for expected load |
| Custom server.js | Required for WebSocket alongside Next.js; gives full control over HTTP |
| Tiered cron | Prioritizes high-demand appointment types without overloading APIs |
| Multi-channel notifications | Users in NL use varied messaging platforms; flexibility is key |
| Playwright + Puppeteer | Required for booking automation on different appointment systems |
