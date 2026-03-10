-- Migration: Add Telegram link tokens table with hashed tokens
-- Run with: sqlite3 data/ind_appointments.db < database/migrations/002_add_telegram_tokens.sql

-- Create table for Telegram account linking tokens
-- Stores HASHED tokens, not plaintext
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of token, NOT plaintext
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_user_id ON telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_token_hash ON telegram_link_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_telegram_link_expires ON telegram_link_tokens(expires_at);

-- Add columns to user_notification_credentials if they don't exist
-- The migration runner handles "duplicate column name" errors gracefully
ALTER TABLE user_notification_credentials ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE user_notification_credentials ADD COLUMN telegram_username TEXT;
ALTER TABLE user_notification_credentials ADD COLUMN webhook_url TEXT;

-- Add Telegram settings to system_settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
('telegram_bot_token', '', 'Telegram Bot API token from @BotFather'),
('telegram_bot_username', '', 'Telegram Bot username (without @)');

-- Cleanup job for expired tokens (will be handled by cron, but we add a trigger too)
-- This trigger runs when we try to insert a new token, cleaning old ones first
CREATE TRIGGER IF NOT EXISTS cleanup_expired_telegram_tokens
BEFORE INSERT ON telegram_link_tokens
BEGIN
  DELETE FROM telegram_link_tokens WHERE expires_at < datetime('now');
END;
