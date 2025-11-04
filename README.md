# IND Appointments Tracker

A Next.js application that tracks available IND (Immigration and Naturalisation Service) appointments in the Netherlands and sends notifications to users when new appointments become available.

## Features

- **Real-time Appointment Tracking**: Automatically checks the IND API every 15 minutes for new appointments
- **Email Notifications**: Users receive email alerts when appointments matching their preferences become available
- **User Dashboard**: View all available appointments with filtering by type, location, and date
- **Customizable Preferences**: Set up notifications for specific appointment types, locations, and timeframes
- **User Authentication**: Secure JWT-based authentication system
- **Admin Panel**: Trigger manual appointment checks
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: MySQL/MariaDB
- **Email**: Nodemailer with SMTP
- **Scheduling**: node-cron
- **Authentication**: JWT, bcrypt

## Installation

### Prerequisites

- Node.js 20+
- MySQL or MariaDB
- SMTP email account (Gmail, SendGrid, etc.)

### Setup Steps

1. **Clone and navigate to the project**
   ```bash
   cd /opt/ind/ind-appointments
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update the following variables:
   ```env
   # Database
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=ind_appointments

   # Security (generate secure random strings!)
   JWT_SECRET=your-super-secure-jwt-secret-min-32-characters
   SESSION_SECRET=your-super-secure-session-secret

   # Email (SMTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   FROM_EMAIL=noreply@yourapp.com
   FROM_NAME=IND Appointments

   # Application
   BASE_URL=http://localhost:3000
   PORT=3000

   # IND API
   IND_CHECK_INTERVAL_MINUTES=15
   ```

4. **Set up the database**
   ```bash
   chmod +x scripts/setup-database.sh
   ./scripts/setup-database.sh
   ```

   Or manually:
   ```bash
   mysql -u your_user -p < database/schema.sql
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at http://localhost:3000

## Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set up as a systemd service**
   ```bash
   sudo nano /etc/systemd/system/ind-appointments.service
   ```

   Add the following:
   ```ini
   [Unit]
   Description=IND Appointments Tracker
   After=network.target mysql.service

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/opt/ind/ind-appointments
   ExecStart=/usr/bin/node /opt/ind/ind-appointments/server.js
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal
   Environment="NODE_ENV=production"
   Environment="PORT=3000"

   [Install]
   WantedBy=multi-user.target
   ```

3. **Start the service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start ind-appointments
   sudo systemctl enable ind-appointments
   sudo systemctl status ind-appointments
   ```

## Usage

### For Users

1. **Sign up** for an account
2. **Set up notification preferences**:
   - Choose appointment type (Biometric, Document Pickup, etc.)
   - Select location (Amsterdam, Den Haag, etc.)
   - Set number of persons
   - Define how many days ahead to monitor
3. **Receive email notifications** when new appointments become available

### For Administrators

- Manually trigger appointment checks via the API:
  ```bash
  curl -X POST http://localhost:3000/api/appointments \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
  ```

## API Endpoints

### Public Endpoints
- `GET /api/appointments` - List available appointments
- `GET /api/health` - Health check
- `POST /api/login` - User login
- `POST /api/signup` - User registration

### Protected Endpoints (require authentication)
- `GET /api/preferences` - Get user notification preferences
- `POST /api/preferences` - Add/update notification preference
- `DELETE /api/preferences?id=X` - Delete notification preference

### Admin Endpoints (require admin role)
- `POST /api/appointments` - Manually trigger appointment check

## Database Schema

The application uses the following main tables:

- `users` - User accounts
- `ind_appointments` - Stored appointments from IND API
- `notification_preferences` - User notification settings
- `notification_log` - History of sent notifications
- `cron_job_log` - Cron job execution history

## Appointment Types

- **BIO** - Biometric appointments
- **DOC** - Document pickup
- **VAA** - Visa application

## Locations

- **AM** - Amsterdam
- **DH** - Den Haag
- **ZW** - Zwolle
- **DEN** - Den Bosch
- **UT** - Utrecht

## How It Works

1. **Cron Scheduler**: Runs every 15 minutes (configurable)
2. **Appointment Checker**:
   - Queries the IND API for each unique preference configuration
   - Stores new appointments in the database
   - Compares with existing appointments to find new ones
3. **Notification Service**:
   - Finds users who should be notified based on their preferences
   - Sends email notifications with appointment details
   - Logs all notification attempts
4. **Cleanup Job**: Runs daily at 3 AM to remove old data

## Email Notifications

Users receive beautifully formatted HTML emails containing:
- Number of new appointments found
- Details of the first 10 appointments (date, time, location)
- Direct link to the IND booking website
- Link to manage notification preferences

## Monitoring

- Check cron job logs: `SELECT * FROM cron_job_log ORDER BY started_at DESC LIMIT 10;`
- View notification history: `SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT 20;`
- Check application logs: `journalctl -u ind-appointments -f`

## Troubleshooting

### Database Connection Issues
```bash
# Test database connection
mysql -h localhost -u your_user -p ind_appointments

# Check if tables exist
SHOW TABLES;
```

### Email Not Sending
- Verify SMTP credentials in `.env`
- For Gmail: Use an [App Password](https://support.google.com/accounts/answer/185833)
- Check notification logs: `SELECT * FROM notification_log WHERE success = FALSE;`

### Cron Jobs Not Running
- Check application logs
- Verify `IND_CHECK_INTERVAL_MINUTES` in `.env`
- Restart the application

## Development

### Running Tests
```bash
npm run type-check
npm run lint
```

### Manual Appointment Check
```bash
# In development, you can trigger a check manually:
curl -X POST http://localhost:3000/api/appointments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Security Notes

- Always use strong, unique secrets for `JWT_SECRET` and `SESSION_SECRET`
- Use HTTPS in production
- Regularly update dependencies
- Monitor logs for suspicious activity
- Keep database credentials secure

## License

This is an unofficial tool to help track IND appointment availability. Not affiliated with IND.

## Support

For issues and questions:
1. Check the logs: `journalctl -u ind-appointments -f`
2. Verify database connectivity
3. Check SMTP settings
4. Review the API health endpoint: `http://localhost:3000/api/health`

## Future Enhancements

- Push notifications (web-push)
- SMS notifications
- Telegram/WhatsApp integration
- Mobile app
- More locations and appointment types
- Appointment booking automation (requires IND API authentication)
