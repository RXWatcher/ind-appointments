-- IND Appointments Database Schema (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  email_verified INTEGER DEFAULT 0,
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

-- IND Appointments table
CREATE TABLE IF NOT EXISTS ind_appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_key TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  appointment_type TEXT NOT NULL CHECK(appointment_type IN ('BIO', 'DOC', 'VAA', 'TKV', 'UKR', 'FAM')),
  location TEXT NOT NULL,
  location_name TEXT NOT NULL,
  appointment_type_name TEXT NOT NULL,
  persons INTEGER DEFAULT 1,
  parts INTEGER DEFAULT 1,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_available INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON ind_appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON ind_appointments(appointment_type);
CREATE INDEX IF NOT EXISTS idx_appointments_location ON ind_appointments(location);
CREATE INDEX IF NOT EXISTS idx_appointments_available ON ind_appointments(is_available);
CREATE INDEX IF NOT EXISTS idx_appointments_key ON ind_appointments(appointment_key);
CREATE INDEX IF NOT EXISTS idx_appointments_composite ON ind_appointments(appointment_type, location, date, is_available);

-- Notification Preferences table
-- location can be:
--   - 'ALL' for all locations
--   - Single location code (e.g., 'AM')
--   - Comma-separated location codes (e.g., 'AM,DH,ZW')
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  appointment_type TEXT NOT NULL CHECK(appointment_type IN ('BIO', 'DOC', 'VAA', 'TKV', 'UKR', 'FAM')),
  location TEXT NOT NULL,
  persons INTEGER DEFAULT 1,
  days_ahead INTEGER DEFAULT 30,
  email_enabled INTEGER DEFAULT 1,
  push_enabled INTEGER DEFAULT 0,
  whatsapp_enabled INTEGER DEFAULT 0,
  notification_interval INTEGER DEFAULT 15,
  dnd_start_time TEXT DEFAULT '22:00',
  dnd_end_time TEXT DEFAULT '08:00',
  last_notification_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  -- Removed UNIQUE constraint to allow multiple preferences with different location combinations
);

CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_active ON notification_preferences(is_active);

-- Notification Log table
CREATE TABLE IF NOT EXISTS notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  appointment_id INTEGER,
  notification_type TEXT NOT NULL CHECK(notification_type IN ('email', 'push')),
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  appointment_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES ind_appointments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_log_user_id ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_sent_at ON notification_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_notif_log_success ON notification_log(success);

-- System Settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON system_settings(setting_key);

-- User Notification Credentials table (for Pushover, WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS user_notification_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  pushover_user_key TEXT,
  whatsapp_phone_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_notif_creds_user_id ON user_notification_credentials(user_id);

-- Cron Job Log table
CREATE TABLE IF NOT EXISTS cron_job_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  status TEXT DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed')),
  appointments_found INTEGER DEFAULT 0,
  new_appointments INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cron_job_name ON cron_job_log(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_started_at ON cron_job_log(started_at);
CREATE INDEX IF NOT EXISTS idx_cron_status ON cron_job_log(status);

-- User Saved Appointments table
CREATE TABLE IF NOT EXISTS user_saved_appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  appointment_id INTEGER NOT NULL,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES ind_appointments(id) ON DELETE CASCADE,
  UNIQUE(user_id, appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user_id ON user_saved_appointments(user_id);

-- Insert default system settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
('check_interval_minutes', '15', 'How often to check for new appointments (in minutes)'),
('max_notifications_per_day', '10', 'Maximum number of notifications to send per user per day'),
('cleanup_old_appointments_days', '7', 'Remove appointments older than X days'),
('maintenance_mode', 'false', 'Enable/disable maintenance mode');

-- Create view for active appointments with preferences
CREATE VIEW IF NOT EXISTS active_appointments_with_preferences AS
SELECT
  a.id,
  a.appointment_key,
  a.date,
  a.start_time,
  a.end_time,
  a.appointment_type,
  a.location,
  a.location_name,
  a.appointment_type_name,
  a.persons,
  a.first_seen_at,
  np.user_id,
  np.email_enabled,
  np.push_enabled,
  u.email,
  u.username,
  u.full_name
FROM ind_appointments a
JOIN notification_preferences np ON
  a.appointment_type = np.appointment_type
  AND a.location = np.location
  AND a.persons = np.persons
  AND np.is_active = 1
JOIN users u ON np.user_id = u.id
WHERE a.is_available = 1
  AND a.date >= DATE('now')
  AND CAST((JULIANDAY(a.date) - JULIANDAY('now')) AS INTEGER) <= np.days_ahead;

-- Triggers to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_preferences_timestamp
AFTER UPDATE ON notification_preferences
FOR EACH ROW
BEGIN
  UPDATE notification_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_appointments_timestamp
AFTER UPDATE ON ind_appointments
FOR EACH ROW
BEGIN
  UPDATE ind_appointments SET last_seen_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
AFTER UPDATE ON system_settings
FOR EACH ROW
BEGIN
  UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
