import { db } from '@/lib/database';

interface PushoverNotification {
  userId: number;
  title: string;
  message: string;
  url?: string;
}

/**
 * Send a push notification via Pushover
 */
export async function sendPushoverNotification(data: PushoverNotification): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get admin's Pushover API token (app-wide)
    const settingsQuery = await db.query(`
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'pushover_api_token'
    `);

    if (!settingsQuery || settingsQuery.length === 0) {
      return { success: false, error: 'Pushover API token not configured by admin' };
    }

    const apiToken = (settingsQuery[0] as any).setting_value;

    if (!apiToken) {
      return { success: false, error: 'Pushover API token not configured by admin' };
    }

    // Get user's Pushover user key
    const credentialsQuery = await db.query(`
      SELECT pushover_user_key
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [data.userId]);

    if (!credentialsQuery || credentialsQuery.length === 0) {
      return { success: false, error: 'User has not configured Pushover credentials' };
    }

    const userKey = (credentialsQuery[0] as any).pushover_user_key;

    if (!userKey) {
      return { success: false, error: 'User has not configured Pushover user key' };
    }

    // Send push notification via Pushover API
    const response = await fetch('https://api.pushover.net/1/messages.json', {
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
      }),
    });

    const result = await response.json();

    if (response.ok && result.status === 1) {
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
 */
export async function sendWhatsAppNotification(data: WhatsAppNotification): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get admin's WhatsApp API credentials
    const settingsQuery = await db.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN ('whatsapp_access_token', 'whatsapp_phone_number_id')
    `);

    if (!settingsQuery || settingsQuery.length === 0) {
      return { success: false, error: 'WhatsApp API not configured by admin' };
    }

    const settings: Record<string, string> = {};
    for (const row of settingsQuery as any[]) {
      settings[row.setting_key] = row.setting_value;
    }

    const accessToken = settings.whatsapp_access_token;
    const phoneNumberId = settings.whatsapp_phone_number_id;

    if (!accessToken || !phoneNumberId) {
      return { success: false, error: 'WhatsApp API credentials not fully configured' };
    }

    // Get user's WhatsApp phone number
    const credentialsQuery = await db.query(`
      SELECT whatsapp_phone_number
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [data.userId]);

    if (!credentialsQuery || credentialsQuery.length === 0) {
      return { success: false, error: 'User has not configured WhatsApp phone number' };
    }

    const userPhone = (credentialsQuery[0] as any).whatsapp_phone_number;

    if (!userPhone) {
      return { success: false, error: 'User has not configured WhatsApp phone number' };
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = userPhone.replace(/[^\d+]/g, '');

    // Send message via WhatsApp Cloud API
    const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const response = await fetch(apiUrl, {
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
    });

    const result = await response.json();

    if (response.ok && result.messages) {
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
