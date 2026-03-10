-- Migration: Add Telegram and Webhook support
-- Run with: sqlite3 data/ind-appointments.db < scripts/migrations/add-telegram-webhook.sql

-- Add new columns to user_notification_credentials (ignore errors if columns exist)
ALTER TABLE user_notification_credentials ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE user_notification_credentials ADD COLUMN telegram_username TEXT;
ALTER TABLE user_notification_credentials ADD COLUMN webhook_url TEXT;

-- Add new columns to notification_preferences (ignore errors if columns exist)
ALTER TABLE notification_preferences ADD COLUMN telegram_enabled INTEGER DEFAULT 0;
ALTER TABLE notification_preferences ADD COLUMN webhook_enabled INTEGER DEFAULT 0;

-- Create table for Telegram account linking tokens
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_user_id ON telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_token ON telegram_link_tokens(token);

-- Add Telegram bot token to system settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
('telegram_bot_token', '', 'Telegram Bot API token from @BotFather'),
('telegram_bot_username', '', 'Telegram Bot username (without @)');
