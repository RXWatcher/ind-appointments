import { db } from '@/lib/database';
import { fetchWithRetry } from '@/lib/retry';
import type { SystemSettingRow, UserNotificationCredentialsRow } from '@/lib/types';

interface TelegramNotification {
  userId: number;
  message: string;
  parseMode?: 'HTML' | 'Markdown';
}

/**
 * Send a Telegram notification via Bot API
 * Includes retry logic for transient failures
 */
export async function sendTelegramNotification(data: TelegramNotification): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get admin's Telegram Bot token
    const settingsResult = db.queryOne<SystemSettingRow>(`
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'telegram_bot_token'
    `);

    if (!settingsResult?.setting_value) {
      return { success: false, error: 'Telegram Bot token not configured by admin' };
    }

    const botToken = settingsResult.setting_value;

    // Get user's Telegram chat ID
    const credentialsResult = db.queryOne<UserNotificationCredentialsRow>(`
      SELECT telegram_chat_id
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [data.userId]);

    if (!credentialsResult?.telegram_chat_id) {
      return { success: false, error: 'User has not linked their Telegram account' };
    }

    const chatId = credentialsResult.telegram_chat_id;

    // Send message via Telegram Bot API with retry logic
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetchWithRetry(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: data.message,
          parse_mode: data.parseMode || 'HTML',
          disable_web_page_preview: false,
        }),
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        onRetry: (attempt, error) => {
          console.warn(`[TELEGRAM] Retry ${attempt}:`, error);
        },
      }
    );

    const result = await response.json();

    if (result.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        error: result.description || 'Unknown error from Telegram API',
      };
    }
  } catch (error) {
    console.error('[TELEGRAM] Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface WebhookNotification {
  userId: number;
  payload: object;
}

/**
 * Send a webhook notification to user's configured URL
 * Includes retry logic for transient failures
 */
export async function sendWebhookNotification(data: WebhookNotification): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get user's webhook URL
    const credentialsResult = db.queryOne<UserNotificationCredentialsRow>(`
      SELECT webhook_url
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [data.userId]);

    if (!credentialsResult?.webhook_url) {
      return { success: false, error: 'User has not configured a webhook URL' };
    }

    const webhookUrl = credentialsResult.webhook_url;

    // Validate URL
    try {
      new URL(webhookUrl);
    } catch {
      return { success: false, error: 'Invalid webhook URL' };
    }

    // Send webhook with retry logic
    await fetchWithRetry(
      webhookUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IND-Appointments-Tracker/1.0',
        },
        body: JSON.stringify({
          ...data.payload,
          timestamp: new Date().toISOString(),
        }),
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        onRetry: (attempt, error) => {
          console.warn(`[WEBHOOK] Retry ${attempt}:`, error);
        },
      }
    );

    return { success: true };
  } catch (error) {
    console.error('[WEBHOOK] Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface PushoverNotification {
  userId: number;
  title: string;
  message: string;
  url?: string;
  priority?: number; // -2 to 2 (lowest to emergency)
}

/**
 * Send a push notification via Pushover
 * Includes retry logic for transient failures
 */
export async function sendPushoverNotification(data: PushoverNotification): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get admin's Pushover API token (app-wide)
    const settingsResult = db.queryOne<SystemSettingRow>(`
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'pushover_api_token'
    `);

    if (!settingsResult?.setting_value) {
      return { success: false, error: 'Pushover API token not configured by admin' };
    }

    const apiToken = settingsResult.setting_value;

    // Get user's Pushover user key
    const credentialsResult = db.queryOne<UserNotificationCredentialsRow>(`
      SELECT pushover_user_key
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [data.userId]);

    if (!credentialsResult?.pushover_user_key) {
      return { success: false, error: 'User has not configured Pushover user key' };
    }

    const userKey = credentialsResult.pushover_user_key;

    // Send push notification via Pushover API with retry
    const response = await fetchWithRetry(
      'https://api.pushover.net/1/messages.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: apiToken,
          user: userKey,
          message: data.message,
          title: data.title,
          url: data.url,
          url_title: 'View Appointments',
          ...(data.priority !== undefined && { priority: data.priority }),
        }),
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        onRetry: (attempt, error) => {
          console.warn(`[PUSHOVER] Retry ${attempt}:`, error);
        },
      }
    );

    const result = await response.json();

    if (result.status === 1) {
      return { success: true };
    } else {
      return {
        success: false,
        error: result.errors ? result.errors.join(', ') : 'Unknown error from Pushover',
      };
    }
  } catch (error) {
    console.error('[PUSHOVER] Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface WhatsAppNotification {
  userId: number;
  message: string;
}

/**
 * Send a WhatsApp notification via WhatsApp Business Cloud API
 * Includes retry logic for transient failures
 */
export async function sendWhatsAppNotification(data: WhatsAppNotification): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get admin's WhatsApp API credentials
    const settingsRows = db.query<SystemSettingRow>(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN ('whatsapp_access_token', 'whatsapp_phone_number_id')
    `);

    const settings: Record<string, string> = {};
    for (const row of settingsRows) {
      if (row.setting_value) {
        settings[row.setting_key] = row.setting_value;
      }
    }

    const accessToken = settings.whatsapp_access_token;
    const phoneNumberId = settings.whatsapp_phone_number_id;

    if (!accessToken || !phoneNumberId) {
      return { success: false, error: 'WhatsApp API credentials not fully configured' };
    }

    // Get user's WhatsApp phone number
    const credentialsResult = db.queryOne<UserNotificationCredentialsRow>(`
      SELECT whatsapp_phone_number
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [data.userId]);

    if (!credentialsResult?.whatsapp_phone_number) {
      return { success: false, error: 'User has not configured WhatsApp phone number' };
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = credentialsResult.whatsapp_phone_number.replace(/[^\d+]/g, '');

    // Send message via WhatsApp Cloud API with retry
    const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const response = await fetchWithRetry(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: {
            body: data.message
          }
        }),
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        onRetry: (attempt, error) => {
          console.warn(`[WHATSAPP] Retry ${attempt}:`, error);
        },
      }
    );

    const result = await response.json();

    if (result.messages) {
      return { success: true };
    } else {
      return {
        success: false,
        error: result.error?.message || 'Unknown error from WhatsApp API',
      };
    }
  } catch (error) {
    console.error('[WHATSAPP] Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
