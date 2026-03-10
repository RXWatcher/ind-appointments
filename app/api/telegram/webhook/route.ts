import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { security } from '@/lib/security';
import { fetchWithRetry } from '@/lib/retry';
import type { TelegramUpdate, SystemSettingRow, UserNotificationCredentialsRow, UserRow } from '@/lib/types';

// Rate limiting for webhook to prevent abuse
// Track requests per IP address
const webhookRateLimit = new Map<string, { count: number; resetAt: number }>();
const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const WEBHOOK_MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per IP
const WEBHOOK_CLEANUP_INTERVAL_MS = 300000; // 5 minutes

// Cleanup old rate limit entries periodically
let lastCleanup = Date.now();
function cleanupRateLimits() {
  const now = Date.now();
  if (now - lastCleanup < WEBHOOK_CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  for (const [ip, entry] of webhookRateLimit.entries()) {
    if (now > entry.resetAt) {
      webhookRateLimit.delete(ip);
    }
  }
}

/**
 * Check rate limit for webhook requests
 */
function checkWebhookRateLimit(ip: string): boolean {
  cleanupRateLimits();

  const now = Date.now();
  const entry = webhookRateLimit.get(ip);

  if (!entry || now > entry.resetAt) {
    webhookRateLimit.set(ip, {
      count: 1,
      resetAt: now + WEBHOOK_RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  entry.count++;
  return entry.count <= WEBHOOK_MAX_REQUESTS_PER_WINDOW;
}

/**
 * POST /api/telegram/webhook
 * Handle incoming Telegram webhook updates
 * This endpoint must be publicly accessible for Telegram to send updates
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent abuse
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    if (!checkWebhookRateLimit(clientIP)) {
      console.warn(`[TELEGRAM] Rate limit exceeded for IP: ${clientIP}`);
      // Return 200 to prevent Telegram from retrying, but ignore the request
      return NextResponse.json({ ok: true });
    }

    // Verify the request is from Telegram using secret token header
    // Set up via setWebhook with secret_token parameter
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secretToken !== expectedSecret) {
      console.warn('[TELEGRAM] Invalid webhook secret token');
      // Return 200 to prevent Telegram from retrying
      return NextResponse.json({ ok: true });
    }

    const update: TelegramUpdate = await request.json();

    if (!update.message?.text) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id.toString();
    const username = message.from.username || '';
    const text = (message.text || '').trim();

    // Get bot token
    const settingsResult = db.queryOne<SystemSettingRow>(`
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'telegram_bot_token'
    `);

    if (!settingsResult?.setting_value) {
      console.error('[TELEGRAM] Bot token not configured');
      return NextResponse.json({ ok: true });
    }

    const botToken = settingsResult.setting_value;

    // Handle /start command with link token
    if (text.startsWith('/start ')) {
      const linkToken = text.substring(7).trim();

      if (linkToken) {
        // Hash the received token and compare with stored hash
        const tokenHash = security.hashToken(linkToken);

        const linkResult = db.queryOne<{ user_id: number }>(`
          SELECT user_id FROM telegram_link_tokens
          WHERE token_hash = ? AND expires_at > datetime('now')
        `, [tokenHash]);

        if (linkResult) {
          const userId = linkResult.user_id;

          // Update user's notification credentials with Telegram info
          db.run(`
            INSERT INTO user_notification_credentials (user_id, telegram_chat_id, telegram_username)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              telegram_chat_id = excluded.telegram_chat_id,
              telegram_username = excluded.telegram_username,
              updated_at = CURRENT_TIMESTAMP
          `, [userId, chatId, username]);

          // Delete the used token (one-time use)
          db.run(`DELETE FROM telegram_link_tokens WHERE token_hash = ?`, [tokenHash]);

          // Send success message (no PII)
          await sendTelegramMessage(
            botToken,
            chatId,
            '✅ <b>Account Linked Successfully!</b>\n\n' +
              'You will now receive IND appointment notifications via Telegram.\n\n' +
              'You can manage your preferences in your dashboard.'
          );
        } else {
          await sendTelegramMessage(
            botToken,
            chatId,
            '❌ <b>Invalid or Expired Link</b>\n\n' +
              'This link token is invalid or has expired. Please generate a new link from your dashboard settings.'
          );
        }
      }
    }
    // Handle /start command without token
    else if (text === '/start') {
      await sendTelegramMessage(
        botToken,
        chatId,
        '👋 <b>Welcome to IND Appointments Tracker Bot!</b>\n\n' +
          'To link your account, please go to your dashboard settings and click "Link Telegram Account".\n\n' +
          'You will receive a link that will connect this chat to your account.'
      );
    }
    // Handle /status command - NO PII EXPOSED
    else if (text === '/status') {
      // Check if this chat is linked to an account
      const credResult = db.queryOne<UserNotificationCredentialsRow>(`
        SELECT user_id
        FROM user_notification_credentials
        WHERE telegram_chat_id = ?
      `, [chatId]);

      if (credResult) {
        // Only confirm linked status, don't reveal email or other PII
        await sendTelegramMessage(
          botToken,
          chatId,
          '✅ <b>Account Linked</b>\n\n' +
            'This Telegram account is linked to your IND Appointments Tracker account.\n\n' +
            'You will receive notifications for appointments matching your preferences.'
        );
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          '❌ <b>Not Linked</b>\n\n' +
            'This Telegram account is not linked to any IND Appointments Tracker account.\n\n' +
            'Go to your dashboard settings to link your account.'
        );
      }
    }
    // Handle /unlink command
    else if (text === '/unlink') {
      const result = db.run(`
        UPDATE user_notification_credentials
        SET telegram_chat_id = NULL, telegram_username = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE telegram_chat_id = ?
      `, [chatId]);

      if (result.changes > 0) {
        await sendTelegramMessage(
          botToken,
          chatId,
          '✅ <b>Account Unlinked</b>\n\n' +
            'Your Telegram account has been unlinked from IND Appointments Tracker.\n\n' +
            'You will no longer receive notifications here.'
        );
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          'ℹ️ <b>Not Linked</b>\n\n' +
            'This Telegram account was not linked to any account.'
        );
      }
    }
    // Handle /help command
    else if (text === '/help') {
      await sendTelegramMessage(
        botToken,
        chatId,
        '📖 <b>Available Commands</b>\n\n' +
          '/start - Start the bot and see welcome message\n' +
          '/status - Check if your account is linked\n' +
          '/unlink - Unlink your Telegram from your account\n' +
          '/help - Show this help message\n\n' +
          '🔗 To link your account, go to your IND Appointments Tracker settings.'
      );
    }

    // Always return 200 to Telegram to acknowledge receipt
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TELEGRAM] Webhook error:', error);
    // Always return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}

/**
 * Send a message via Telegram Bot API with retry logic
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  try {
    await fetchWithRetry(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
        }),
      },
      {
        maxAttempts: 3,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        onRetry: (attempt, error) => {
          console.warn(`[TELEGRAM] Retry ${attempt} sending message:`, error);
        },
      }
    );
  } catch (error) {
    console.error('[TELEGRAM] Error sending message after retries:', error);
    // Don't throw - we don't want to fail the webhook handling
  }
}
