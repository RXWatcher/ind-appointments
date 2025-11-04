# IND Appointments Tracker

A comprehensive Next.js application that tracks available IND (Immigration and Naturalisation Service) appointments in the Netherlands **and international expat centers**, providing real-time notifications when appointments matching user preferences become available.

## 🚀 Features

### Core Functionality
- **Multi-Source Appointment Tracking**: Monitors both official IND offices AND international expat centers
  - 11 IND locations nationwide
  - The Hague International Centre (THIC)
  - Rotterdam International Center
- **Intelligent Tiered Scraping**:
  - High-priority types (DOC, BIO): Every 5 minutes
  - Low-priority types (VAA, TKV, UKR, FAM): Every 15 minutes
  - Comprehensive coverage of ALL valid combinations
- **Multi-Channel Notifications**:
  - Email notifications via SMTP
  - Pushover push notifications
  - Real-time WebSocket updates
- **Booking Automation Helpers**: Step-by-step visual guides for booking appointments
- **Content Zone System**: Monetization-ready widget/ad placement system

### User Experience
- **Smart Notification Preferences**:
  - Multiple locations per preference (e.g., "AM,DH,ZW" or "ALL")
  - Customizable days-ahead monitoring
  - Do Not Disturb hours (respects quiet time)
  - Minimum notification interval (prevents spam)
  - Individual email/push toggles
- **User Dashboard**: View and filter all available appointments
- **Account Management**: Email verification, password reset, timezone settings
- **Dark Mode Support**: System-integrated theme switching
- **Mobile Responsive**: Fully optimized for iPhone SE to desktop

### Administration
- **Admin Dashboard** with real-time statistics
- **User Management**: View, edit, delete users and their preferences
- **Manual Scraper Triggers**: Force immediate appointment checks
- **Content Zone Management**: Configure ads/widgets across 4 zones
- **Notification Testing**: Send test notifications
- **Health Monitoring**: Automated system health checks

## 📋 Appointment Types (6 Types)

- **DOC** - Document Collection (Pickup)
- **BIO** - Biometric Residence Permit
- **VAA** - Residence Endorsement Sticker (Return Visa)
- **TKV** - Return Visa
- **UKR** - Ukraine Proof of Residency
- **FAM** - Family Reunification

## 📍 Locations (13 Total)

### IND Offices (11)
- **AM** - Amsterdam
- **DH** - Den Haag
- **ZW** - Zwolle
- **DEN** - Den Bosch
- **UT** - Utrecht
- **HRL** - Haarlem
- **ROT** - Rotterdam
- **ZVH** - Zaventem
- **GRO** - Groningen
- **EIN** - Eindhoven
- **THE** - The Hague

### International/Expat Centers (2)
- **THIC** - The Hague International Centre
- **RIC** - Rotterdam International Center

## 🛠 Tech Stack

### Frontend
- **Next.js 15** with App Router
- **React 19** with Server Components
- **TailwindCSS 4** for styling
- **next-themes** for dark mode
- **WebSocket** for real-time updates

### Backend
- **Next.js API Routes** (40+ endpoints)
- **Custom Node.js Server** (server.js) for WebSocket support
- **Better-SQLite3** database (NOT MySQL - fully embedded)
- **node-cron** for scheduled tasks
- **Playwright & Puppeteer** for booking automation

### Services
- **Nodemailer** - SMTP email delivery
- **Pushover API** - Push notifications
- **JWT** - Authentication (with bcryptjs)
- **Rate Limiting** - Built-in API protection

## 📦 Installation

### Prerequisites

- **Node.js 20+**
- **SMTP email account** (Gmail, SendGrid, Mailgun, etc.)
- **Optional**: Pushover account for push notifications

### Setup Steps

1. **Clone and navigate to the project**
   ```bash
   cd /opt/ind-appointments
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   nano .env
   ```

   Add the following configuration:
   ```env
   # Security (REQUIRED - generate strong random strings!)
   JWT_SECRET=your-super-secure-jwt-secret-min-32-characters-long

   # Email (REQUIRED - SMTP settings)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   FROM_EMAIL=noreply@yourdomain.com
   FROM_NAME=IND Appointments

   # Application (REQUIRED)
   BASE_URL=http://localhost:3000
   PORT=3000

   # Push Notifications (OPTIONAL - for Pushover)
   PUSHOVER_API_TOKEN=your-pushover-api-token

   # Admin (OPTIONAL - for monitoring alerts)
   ADMIN_EMAIL=admin@yourdomain.com
   ```

4. **Initialize the database**
   ```bash
   npm run db:init
   ```

   Or manually:
   ```bash
   node scripts/init-db.js
   ```

5. **Create an admin user**
   ```bash
   node scripts/create-admin.js
   ```

   Follow the prompts to create your admin account.

6. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at **http://localhost:3000**

## 🚀 Production Deployment

### 1. Build the application
```bash
npm run build
```

### 2. Set up as a systemd service

Create the service file:
```bash
sudo nano /etc/systemd/system/ind-appointments.service
```

Add the following configuration:
```ini
[Unit]
Description=IND Appointments Tracker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ind-appointments
ExecStart=/usr/bin/node /opt/ind-appointments/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="PORT=3000"

[Install]
WantedBy=multi-user.target
```

### 3. Start and enable the service
```bash
sudo systemctl daemon-reload
sudo systemctl start ind-appointments
sudo systemctl enable ind-appointments
sudo systemctl status ind-appointments
```

### 4. View logs
```bash
# Follow live logs
journalctl -u ind-appointments -f

# View recent logs
journalctl -u ind-appointments -n 100
```

## 📖 Usage

### For Users

1. **Sign up** at `/signup` and verify your email
2. **Set notification preferences** at `/preferences`:
   - Choose appointment type (DOC, BIO, VAA, etc.)
   - Select locations:
     - Single: `AM` (Amsterdam only)
     - Multiple: `AM,DH,UT` (Amsterdam, Den Haag, Utrecht)
     - All: `ALL` (all locations)
   - Set number of persons (1-6)
   - Define days ahead to monitor (e.g., 90 days)
   - Configure Do Not Disturb hours (e.g., 23:00 - 08:00)
   - Set minimum notification interval (e.g., 60 minutes)
3. **Receive notifications** when matching appointments appear
4. **Use booking helpers** at `/autobook` or `/book-helper` for booking assistance

### For Administrators

1. **Access admin dashboard** at `/admin`
2. **Manage users** at `/admin/users`
3. **Configure notifications** at `/admin/notifications`
4. **Manage content zones** at `/admin/content-zones` (ad placements)
5. **Manually trigger scraper**:
   ```bash
   curl -X POST http://localhost:3000/api/appointments \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

## 🔌 API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/appointments` - List available appointments (with filters)
- `GET /api/widget` - Fetch content zone settings
- `POST /api/login` - User authentication
- `POST /api/signup` - User registration
- `POST /api/verify-email` - Email verification
- `POST /api/forgot-password` - Password reset request
- `POST /api/reset-password` - Password reset confirmation
- `POST /api/resend-verification` - Resend verification email

### Protected Endpoints (Authenticated Users)
- `GET /api/preferences` - Get user notification preferences
- `POST /api/preferences` - Create notification preference
- `PUT /api/preferences` - Update notification preference
- `DELETE /api/preferences?id=X` - Delete preference
- `POST /api/preferences/unsubscribe` - Unsubscribe from emails
- `GET /api/notifications/history` - Notification log
- `POST /api/user/notification-credentials` - Set Pushover keys
- `POST /api/user/timezone` - Update timezone
- `POST /api/user/change-password` - Change password
- `POST /api/user/change-email` - Request email change
- `POST /api/verify-email-change` - Confirm email change

### Admin Endpoints (Admin Role Required)
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/bulk` - Bulk user operations
- `GET /api/admin/users/:id/preferences` - User's preferences
- `POST /api/appointments` - Manual scraper trigger
- `GET /api/admin/widget` - Get content zones
- `PUT /api/admin/widget` - Update content zones
- `GET /api/admin/notifications/settings` - Notification config
- `POST /api/admin/notifications/test` - Send test notification
- `GET /api/admin/health` - System health check

### Booking Automation (Internal)
- `POST /api/book` - Booking page handler
- `POST /api/autobook` - Autobook page handler
- `POST /api/book-helper` - Booking helper handler
- `POST /api/automate-booking` - Automated booking flow

## 🗄 Database Schema (SQLite)

The application uses **Better-SQLite3** (embedded database, no MySQL server needed):

### Main Tables

- **`users`** - User accounts with roles and verification status
- **`ind_appointments`** - All appointments with source tracking (IND/THIC/RIC)
- **`notification_preferences`** - User alert settings (multiple per user)
- **`notification_log`** - Complete notification history
- **`user_notification_credentials`** - Pushover keys, WhatsApp numbers
- **`user_saved_appointments`** - Bookmarked appointments
- **`system_settings`** - System-wide configuration
- **`cron_job_log`** - Scraper execution history

### Database Location
- **Development**: `./data/ind_appointments.db`
- **SQLite files**: Automatically managed (includes `-shm` and `-wal` files)

### Database Scripts
```bash
npm run db:init      # Initialize database
npm run db:reset     # Reset database (WARNING: deletes all data)
node scripts/init-db.js   # Manual initialization
```

## ⚙️ How It Works

### 1. Tiered Scraping System
```javascript
High Priority (every 5 minutes):
  - DOC (Document Collection)
  - BIO (Biometric)

Low Priority (every 15 minutes):
  - VAA (Residence Sticker)
  - TKV (Return Visa)
  - UKR (Ukraine)
  - FAM (Family Reunification)
```

### 2. Multi-Source Scraping
- **IND API**: 11 locations, 6 appointment types, 1-6 persons
- **THIC API**: The Hague International Centre
- **Rotterdam IC**: Uses TIMEBLOCKR system
- **Comprehensive**: Scrapes ALL valid combinations regardless of user preferences

### 3. Smart Notification Service
- Checks new appointments against user preferences
- Respects Do Not Disturb hours (with midnight-spanning support)
- Enforces minimum notification intervals
- Batches multiple appointments into single notifications
- Logs all notification attempts
- Supports email and push channels

### 4. Booking Automation
- Opens IND booking page with pre-filled parameters
- Provides step-by-step visual instructions
- Supports both IND and expat center URLs
- Copy-to-clipboard functionality
- Mobile-friendly interface

### 5. Content Zone System
- 4 placement zones: Header, Sidebar, Footer, Between Appointments
- Admin-configurable HTML content
- Display mode control (desktop/mobile/both)
- Ad-blocker evasion with obfuscated classes
- Global and per-zone enable/disable

### 6. Automated Maintenance
- **Account Cleanup**: Deletes unverified accounts after 30 days
- **Old Data Removal**: Cleans up old appointments and logs
- **Health Monitoring**: Hourly system health checks
- **Error Alerting**: Emails admin on critical failures

## 📧 Email Notifications

Users receive HTML-formatted emails containing:
- Number of new appointments found
- Details of up to 10 appointments (date, time, location, persons)
- Direct booking links (specific to appointment source)
- Preference management link
- One-click unsubscribe option

## 📊 Monitoring & Logging

### Check Logs
```bash
# Application logs
journalctl -u ind-appointments -f

# Database logs (SQLite query logs in console during dev)
npm run dev  # Shows DB queries in development
```

### Database Queries
```sql
-- Check recent scraper runs
SELECT * FROM cron_job_log ORDER BY started_at DESC LIMIT 10;

-- View recent notifications
SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT 20;

-- Count appointments by source
SELECT source, COUNT(*) FROM ind_appointments GROUP BY source;

-- Active users with preferences
SELECT u.email, COUNT(np.id) as prefs
FROM users u
JOIN notification_preferences np ON u.id = np.user_id
WHERE u.email_verified = 1
GROUP BY u.id;
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

## 🐛 Troubleshooting

### Database Issues
```bash
# Check database file exists
ls -lh data/ind_appointments.db*

# Reset database (WARNING: deletes all data)
npm run db:reset

# Initialize fresh database
npm run db:init
```

### Email Not Sending
- Verify SMTP credentials in `.env`
- For Gmail: Use an [App Password](https://support.google.com/accounts/answer/185833)
- Check notification logs:
  ```sql
  SELECT * FROM notification_log WHERE success = 0 ORDER BY sent_at DESC;
  ```
- Test email manually via admin panel: `/admin/notifications`

### Scraper Not Running
- Check application logs: `journalctl -u ind-appointments -f`
- Verify service is running: `systemctl status ind-appointments`
- Check cron job logs:
  ```sql
  SELECT * FROM cron_job_log ORDER BY started_at DESC LIMIT 5;
  ```
- Manually trigger: `POST /api/appointments` (admin token required)

### WebSocket Connection Issues
- Ensure `server.js` is being used (not just Next.js dev server)
- Check firewall allows WebSocket connections
- Verify `BASE_URL` in `.env` is correct

### Pushover Notifications Not Working
- Verify `PUSHOVER_API_TOKEN` in `.env`
- Check user has added their Pushover user key in `/settings`
- Test via admin panel: `/admin/notifications`

## 🔒 Security Notes

- **JWT Secret**: Use a strong random string (32+ characters)
- **HTTPS**: Always use HTTPS in production
- **Rate Limiting**: Built-in API rate limiting (adjust in `lib/rate-limit.ts`)
- **SQL Injection**: Better-SQLite3 uses prepared statements (safe by default)
- **XSS Protection**: Content zones are admin-only, but sanitize if allowing user HTML
- **CORS**: Configured for same-origin by default
- **Password Hashing**: bcryptjs with 10 rounds
- **Email Verification**: Required for account activation
- **Environment Variables**: Never commit `.env` files

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Development server (with WebSocket)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run type-check   # TypeScript validation
npm run db:init      # Initialize database
npm run db:reset     # Reset database (deletes all data)
```

### Project Structure
```
/opt/ind-appointments/
├── app/                  # Next.js App Router pages
│   ├── api/             # API routes (40+ endpoints)
│   ├── admin/           # Admin dashboard pages
│   ├── page.tsx         # Homepage (appointment viewer)
│   ├── login/           # Authentication pages
│   └── preferences/     # User settings
├── lib/                 # Core business logic
│   ├── ind-api.ts       # IND API scraper
│   ├── expat-centers.ts # THIC/Rotterdam scrapers
│   ├── notifications.ts # Multi-channel notifications
│   ├── booking-automation.ts # Playwright automation
│   ├── database.ts      # SQLite wrapper
│   └── cron/            # Scheduled tasks
├── components/          # React components
├── database/            # SQL schemas and migrations
├── scripts/             # Setup and maintenance scripts
├── data/                # SQLite database files (gitignored)
├── server.js            # Custom Node server (WebSocket)
└── .env                 # Environment configuration (gitignored)
```

### Testing Scrapers
```bash
# Test all appointment types
node test-all-thic-types.js

# Test expat center scrapers
node test-expat-scrapers.js

# Test IND API
node test-api.js

# Test booking automation
node test-automation.js
```

## 📱 Mobile Optimization

- Fully responsive design (320px to 1920px+)
- Touch-friendly buttons and forms
- Optimized for iPhone SE, iPhone 12, and tablets
- Dark mode support
- Fast loading with Next.js optimizations

## 🎯 Unique Features

1. **Only app that tracks both IND AND expat centers** (THIC, Rotterdam IC)
2. **Tiered scraping** prioritizes high-demand appointment types
3. **Multi-location preferences** (select multiple or ALL locations)
4. **Do Not Disturb hours** with midnight-spanning support
5. **WebSocket real-time updates** for instant appointment alerts
6. **Booking automation helpers** with visual step-by-step guides
7. **Content zone monetization** system with 4 placement zones
8. **Pushover integration** for mobile push notifications
9. **Source tracking** (know if appointment is from IND, THIC, or RIC)
10. **Comprehensive logging** of every scrape, notification, and system event

## 🚧 Roadmap / Future Enhancements

- [ ] SMS notifications via Twilio
- [ ] Telegram bot integration
- [ ] WhatsApp notifications
- [ ] Progressive Web App (PWA)
- [ ] Native mobile apps (iOS/Android)
- [ ] Appointment availability predictions (ML)
- [ ] More expat center integrations
- [ ] Webhook support for custom integrations
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Multi-language support (NL/EN)

## 📄 License

This is an **unofficial tool** to help track IND appointment availability. Not affiliated with or endorsed by IND (Immigratie- en Naturalisatiedienst) or any expat centers.

## 🆘 Support

For issues and questions:
1. Check the logs: `journalctl -u ind-appointments -f`
2. Review the health endpoint: `http://localhost:3000/api/health`
3. Check database: `ls -lh data/ind_appointments.db*`
4. Verify environment variables in `.env`
5. Test SMTP settings via admin panel

## 🙏 Acknowledgments

- Built with Next.js 15 and React 19
- Uses Better-SQLite3 for embedded database
- Booking automation powered by Playwright
- Push notifications via Pushover
- Email delivery via Nodemailer

---

**⚠️ Disclaimer**: This tool is for monitoring appointment availability only. Users are responsible for following all IND rules and regulations when booking appointments. The developers are not responsible for any booking issues or immigration-related matters.
