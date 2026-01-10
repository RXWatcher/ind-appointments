-- Migration: Add DigiD video call appointment support
-- DigiD video calls allow Dutch citizens abroad to activate their DigiD via video call
-- Appointments are released every Friday at 9:00 and 14:00 Amsterdam time

-- Add 'DGD' to appointment_type CHECK constraint
-- Add 'DIGID' to source CHECK constraint
-- Note: SQLite doesn't support modifying CHECK constraints with ALTER TABLE
-- So we create a new table and migrate data

-- Step 1: Create new ind_appointments table with updated constraints
CREATE TABLE IF NOT EXISTS ind_appointments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_key TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  appointment_type TEXT NOT NULL CHECK(appointment_type IN ('BIO', 'DOC', 'VAA', 'TKV', 'UKR', 'FAM', 'DGD')),
  location TEXT NOT NULL,
  location_name TEXT NOT NULL,
  appointment_type_name TEXT NOT NULL,
  persons INTEGER DEFAULT 1,
  parts INTEGER DEFAULT 1,
  source TEXT DEFAULT 'IND' CHECK(source IN ('IND', 'THE_HAGUE_IC', 'ROTTERDAM_IC', 'DIGID')),
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_available INTEGER DEFAULT 1
);

-- Step 2: Copy existing data
INSERT INTO ind_appointments_new
SELECT * FROM ind_appointments;

-- Step 3: Drop old table
DROP TABLE IF EXISTS ind_appointments;

-- Step 4: Rename new table
ALTER TABLE ind_appointments_new RENAME TO ind_appointments;

-- Step 5: Recreate all indexes
CREATE INDEX IF NOT EXISTS idx_appointments_date ON ind_appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON ind_appointments(appointment_type);
CREATE INDEX IF NOT EXISTS idx_appointments_location ON ind_appointments(location);
CREATE INDEX IF NOT EXISTS idx_appointments_available ON ind_appointments(is_available);
CREATE INDEX IF NOT EXISTS idx_appointments_key ON ind_appointments(appointment_key);
CREATE INDEX IF NOT EXISTS idx_appointments_composite ON ind_appointments(appointment_type, location, date, is_available);
CREATE INDEX IF NOT EXISTS idx_appointments_source ON ind_appointments(source);

-- Step 6: Recreate the trigger
DROP TRIGGER IF EXISTS update_appointments_timestamp;
CREATE TRIGGER IF NOT EXISTS update_appointments_timestamp
AFTER UPDATE ON ind_appointments
FOR EACH ROW
BEGIN
  UPDATE ind_appointments SET last_seen_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Step 7: Update notification_preferences to support DGD appointment type
-- Create new table with updated constraint
CREATE TABLE IF NOT EXISTS notification_preferences_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  appointment_type TEXT NOT NULL CHECK(appointment_type IN ('BIO', 'DOC', 'VAA', 'TKV', 'UKR', 'FAM', 'DGD')),
  location TEXT NOT NULL,
  persons INTEGER DEFAULT 1,
  days_ahead INTEGER DEFAULT 30,
  email_enabled INTEGER DEFAULT 1,
  push_enabled INTEGER DEFAULT 0,
  whatsapp_enabled INTEGER DEFAULT 0,
  telegram_enabled INTEGER DEFAULT 0,
  webhook_enabled INTEGER DEFAULT 0,
  notification_interval INTEGER DEFAULT 15,
  dnd_start_time TEXT DEFAULT '22:00',
  dnd_end_time TEXT DEFAULT '08:00',
  last_notification_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing preferences
INSERT INTO notification_preferences_new
SELECT * FROM notification_preferences;

-- Drop old table
DROP TABLE IF EXISTS notification_preferences;

-- Rename new table
ALTER TABLE notification_preferences_new RENAME TO notification_preferences;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_active ON notification_preferences(is_active);

-- Recreate trigger
DROP TRIGGER IF EXISTS update_preferences_timestamp;
CREATE TRIGGER IF NOT EXISTS update_preferences_timestamp
AFTER UPDATE ON notification_preferences
FOR EACH ROW
BEGIN
  UPDATE notification_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Step 8: Drop and recreate the view (it references the old tables)
DROP VIEW IF EXISTS active_appointments_with_preferences;
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
