-- Migration: Add TKV, UKR, FAM appointment types to database
-- Run this to update the schema to support all 6 IND appointment types

BEGIN TRANSACTION;

-- 1. Drop dependent objects first
DROP VIEW IF EXISTS active_appointments_with_preferences;
DROP TRIGGER IF EXISTS update_appointments_timestamp;
DROP TRIGGER IF EXISTS update_preferences_timestamp;

-- 2. Create new appointments table with updated CHECK constraint
CREATE TABLE ind_appointments_new (
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

-- 3. Copy existing data
INSERT INTO ind_appointments_new
SELECT * FROM ind_appointments;

-- 4. Drop old table
DROP TABLE ind_appointments;

-- 5. Rename new table
ALTER TABLE ind_appointments_new RENAME TO ind_appointments;

-- 6. Recreate indexes for appointments
CREATE INDEX idx_appointments_date ON ind_appointments(date);
CREATE INDEX idx_appointments_type ON ind_appointments(appointment_type);
CREATE INDEX idx_appointments_location ON ind_appointments(location);
CREATE INDEX idx_appointments_available ON ind_appointments(is_available);
CREATE INDEX idx_appointments_key ON ind_appointments(appointment_key);
CREATE INDEX idx_appointments_composite ON ind_appointments(appointment_type, location, date, is_available);

-- 7. Create new notification_preferences table with updated CHECK constraint
CREATE TABLE notification_preferences_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  appointment_type TEXT NOT NULL CHECK(appointment_type IN ('BIO', 'DOC', 'VAA', 'TKV', 'UKR', 'FAM')),
  location TEXT NOT NULL,
  persons INTEGER DEFAULT 1,
  days_ahead INTEGER DEFAULT 30,
  email_enabled INTEGER DEFAULT 1,
  push_enabled INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, appointment_type, location, persons)
);

-- 8. Copy existing notification preferences
INSERT INTO notification_preferences_new
SELECT * FROM notification_preferences;

-- 9. Drop old table
DROP TABLE notification_preferences;

-- 10. Rename new table
ALTER TABLE notification_preferences_new RENAME TO notification_preferences;

-- 11. Recreate indexes for preferences
CREATE INDEX idx_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_preferences_active ON notification_preferences(is_active);

-- 12. Recreate triggers
CREATE TRIGGER update_appointments_timestamp
AFTER UPDATE ON ind_appointments
FOR EACH ROW
BEGIN
  UPDATE ind_appointments SET last_seen_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_preferences_timestamp
AFTER UPDATE ON notification_preferences
FOR EACH ROW
BEGIN
  UPDATE notification_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 13. Recreate view
CREATE VIEW active_appointments_with_preferences AS
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

COMMIT;
