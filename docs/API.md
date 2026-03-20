# API Reference

All endpoints are served from the application root (default `http://localhost:3000`).

Authentication is via JWT Bearer tokens. Include the header:
```
Authorization: Bearer <token>
```

---

## Table of Contents

- [Public Endpoints](#public-endpoints)
- [Authentication](#authentication)
- [User Endpoints](#user-endpoints)
- [Notification Preferences](#notification-preferences)
- [Appointments](#appointments)
- [Admin Endpoints](#admin-endpoints)
- [Booking Automation](#booking-automation)
- [Error Responses](#error-responses)

---

## Public Endpoints

### `GET /api/health`

Health check. Returns system status.

```json
{
  "status": "ok",
  "uptime": 3600,
  "database": "connected",
  "lastScrape": "2025-01-15T10:30:00Z"
}
```

### `GET /api/appointments`

List available appointments. Supports query filters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by type: `DOC`, `BIO`, `VAA`, `TKV`, `UKR`, `FAM` |
| `location` | string | Filter by location code(s), comma-separated |
| `persons` | number | Number of persons (1-6) |
| `days` | number | Only show appointments within N days |

```bash
curl "http://localhost:3000/api/appointments?type=DOC&location=AM,DH&persons=1"
```

### `GET /api/widget`

Fetch content zone settings for ad/widget display.

---

## Authentication

### `POST /api/auth/login`

Authenticate and receive a JWT token.

```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "user"
  }
}
```

### `POST /api/auth/signup`

Register a new account. Sends a verification email.

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

### `POST /api/auth/verify-email`

Verify email address with the token from the verification email.

```json
{
  "token": "verification-token-from-email"
}
```

### `POST /api/auth/forgot-password`

Request a password reset email.

```json
{
  "email": "user@example.com"
}
```

### `POST /api/auth/reset-password`

Reset password using the token from the reset email.

```json
{
  "token": "reset-token-from-email",
  "password": "newpassword123"
}
```

### `POST /api/auth/resend-verification`

Resend the email verification link.

```json
{
  "email": "user@example.com"
}
```

---

## User Endpoints

All require authentication.

### `POST /api/user/change-password`

```json
{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

### `POST /api/user/change-email`

Request an email change. Sends verification to the new address.

```json
{
  "newEmail": "new@example.com",
  "password": "currentpassword"
}
```

### `POST /api/user/timezone`

Update user timezone.

```json
{
  "timezone": "Europe/Amsterdam"
}
```

### `POST /api/user/notification-credentials`

Set notification channel credentials.

```json
{
  "pushover_user_key": "uXXXXXXXXXXXXXXXXXXXXXX",
  "telegram_chat_id": "123456789",
  "webhook_url": "https://example.com/webhook"
}
```

### `GET /api/user/settings`

Get current user settings and credentials.

---

## Notification Preferences

All require authentication. Users can have multiple preferences (e.g., one for DOC in Amsterdam, another for BIO in all locations).

### `GET /api/preferences`

List all notification preferences for the authenticated user.

### `POST /api/preferences`

Create a new notification preference.

```json
{
  "appointment_type": "DOC",
  "locations": "AM,DH,UT",
  "num_persons": 1,
  "days_ahead": 90,
  "email_enabled": true,
  "push_enabled": false,
  "telegram_enabled": true,
  "dnd_start": "23:00",
  "dnd_end": "08:00",
  "min_interval_minutes": 60
}
```

| Field | Type | Description |
|-------|------|-------------|
| `appointment_type` | string | `DOC`, `BIO`, `VAA`, `TKV`, `UKR`, `FAM` |
| `locations` | string | Comma-separated codes or `ALL` |
| `num_persons` | number | 1-6 |
| `days_ahead` | number | Monitor appointments within N days |
| `email_enabled` | boolean | Send email notifications |
| `push_enabled` | boolean | Send Pushover notifications |
| `telegram_enabled` | boolean | Send Telegram messages |
| `dnd_start` | string | Do Not Disturb start time (HH:MM) |
| `dnd_end` | string | Do Not Disturb end time (HH:MM) |
| `min_interval_minutes` | number | Minimum minutes between notifications |

### `PUT /api/preferences`

Update an existing preference.

```json
{
  "id": 1,
  "days_ahead": 60,
  "email_enabled": false
}
```

### `DELETE /api/preferences?id=1`

Delete a preference by ID.

### `POST /api/preferences/unsubscribe`

One-click unsubscribe from all email notifications.

```json
{
  "token": "unsubscribe-token-from-email"
}
```

---

## Appointments

### `GET /api/appointments/export`

Export appointments as CSV. Supports the same filters as `GET /api/appointments`.

```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/appointments/export?type=DOC" > appointments.csv
```

### `GET /api/appointments/ical`

Export appointments as iCalendar (.ics) format.

### `GET /api/notifications/history`

Get notification history for the authenticated user.

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default 50) |
| `offset` | number | Pagination offset |

---

## Admin Endpoints

All require admin role.

### `GET /api/admin/stats`

Dashboard statistics: user counts, appointment counts, scraper status, notification delivery rates.

### `GET /api/admin/users`

List all users with pagination.

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Users per page |
| `search` | string | Search by email |

### `GET /api/admin/users/:id`

Get detailed user information.

### `PUT /api/admin/users/:id`

Update user (role, verification status, etc.).

```json
{
  "role": "admin",
  "email_verified": true
}
```

### `DELETE /api/admin/users/:id`

Delete a user and all their data.

### `POST /api/admin/users/bulk`

Bulk operations on users.

```json
{
  "action": "delete",
  "userIds": [1, 2, 3]
}
```

### `GET /api/admin/users/:id/preferences`

Get all notification preferences for a specific user.

### `POST /api/appointments`

Manually trigger the appointment scraper. Admin only.

```bash
curl -X POST -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3000/api/appointments
```

### `GET /api/admin/widget`

Get content zone configuration.

### `PUT /api/admin/widget`

Update content zone configuration.

```json
{
  "zone": "header",
  "enabled": true,
  "content": "<div>Ad content here</div>",
  "display_mode": "both"
}
```

### `GET /api/admin/notifications/settings`

Get system notification configuration.

### `POST /api/admin/notifications/test`

Send a test notification.

```json
{
  "channel": "email",
  "recipient": "test@example.com"
}
```

### `GET /api/admin/health`

Detailed system health check (database size, memory, scraper history, error counts).

---

## Booking Automation

### `POST /api/automate-booking`

Trigger automated booking flow (requires Chromium).

```json
{
  "appointment_type": "DOC",
  "location": "AM",
  "date": "2025-02-15",
  "persons": 1
}
```

---

## Telegram Integration

### `POST /api/telegram/link`

Generate a one-time token for linking a Telegram account.

### `POST /api/telegram/webhook`

Telegram bot webhook endpoint (configured with @BotFather).

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| `400` | Bad request (validation error) |
| `401` | Not authenticated |
| `403` | Not authorized (wrong role) |
| `404` | Resource not found |
| `429` | Rate limited |
| `500` | Internal server error |

### Rate Limiting

API endpoints are rate-limited to 100 requests per 15-minute window per IP. When exceeded, responses include:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 300
```
