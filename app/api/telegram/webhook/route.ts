import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import crypto from 'crypto';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

/**
 * Handle incoming Telegram webhook updates
 */
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    if (!update.message || !update.message.text) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id.toString();
    const username = message.from.username || '';
    const text = (message.text || '').trim();

    // Get bot token
    const settingsQuery = await db.query(`
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'telegram_bot_token'
    `);

    if (!settingsQuery || settingsQuery.length === 0) {
      console.error('[TELEGRAM] Bot token not configured');
      return NextResponse.json({ ok: true });
    }

    const botToken = (settingsQuery[0] as any).setting_value;

    // Handle /start command with link token
    if (text.startsWith('/start ')) {
      const linkToken = text.substring(7).trim();

      if (linkToken) {
        // Verify and link the account
        const linkResult = await db.query(`
          SELECT user_id FROM telegram_link_tokens
          WHERE token = ? AND expires_at > datetime('now')
        `, [linkToken]);

        if (linkResult && linkResult.length > 0) {
          const userId = (linkResult[0] as any).user_id;

          // Update user's notification credentials with Telegram info
          await db.query(`
            INSERT INTO user_notification_credentials (user_id, telegram_chat_id, telegram_username)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              telegram_chat_id = excluded.telegram_chat_id,
              telegram_username = excluded.telegram_username,
              updated_at = CURRENT_TIMESTAMP
          `, [userId, chatId, username]);

          // Delete the used token
          await db.query(`DELETE FROM telegram_link_tokens WHERE token = ?`, [linkToken]);

          // Send success message
          await sendTelegramMessage(botToken, chatId,
            '✅ <b>Account Linked Successfully!</b>\n\n' +
            'You will now receive IND appointment notifications via Telegram.\n\n' +
            'You can manage your preferences at your IND Appointments Tracker dashboard.'
          );
        } else {
          await sendTelegramMessage(botToken, chatId,
            '❌ <b>Invalid or Expired Link</b>\n\n' +
            'This link token is invalid or has expired. Please generate a new link from your IND Appointments Tracker settings.'
          );
        }
      }
    }
    // Handle /start command without token
    else if (text === '/start') {
      await sendTelegramMessage(botToken, chatId,
        '👋 <b>Welcome to IND Appointments Tracker Bot!</b>\n\n' +
        'To link your account, please go to your IND Appointments Tracker settings and click "Link Telegram Account".\n\n' +
        'You will receive a link that will connect this chat to your account.'
      );
    }
    // Handle /status command
    else if (text === '/status') {
      // Check if this chat is linked to an account
      const credResult = await db.query(`
        SELECT unc.user_id, u.email, u.username
        FROM user_notification_credentials unc
        JOIN users u ON unc.user_id = u.id
        WHERE unc.telegram_chat_id = ?
      `, [chatId]);

      if (credResult && credResult.length > 0) {
        const user = credResult[0] as any;
        await sendTelegramMessage(botToken, chatId,
          `✅ <b>Account Linked</b>\n\n` +
          `Connected to: ${user.username}\n` +
          `Email: ${user.email}`
        );
      } else {
        await sendTelegramMessage(botToken, chatId,
          '❌ <b>Not Linked</b>\n\n' +
          'This Telegram account is not linked to any IND Appointments Tracker account.\n\n' +
          'Go to your dashboard settings to link your account.'
        );
      }
    }
    // Handle /unlink command
    else if (text === '/unlink') {
      await db.query(`
        UPDATE user_notification_credentials
        SET telegram_chat_id = NULL, telegram_username = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE telegram_chat_id = ?
      `, [chatId]);

      await sendTelegramMessage(botToken, chatId,
        '✅ <b>Account Unlinked</b>\n\n' +
        'Your Telegram account has been unlinked from IND Appointments Tracker.\n\n' +
        'You will no longer receive notifications here.'
      );
    }
    // Handle /help command
    else if (text === '/help') {
      await sendTelegramMessage(botToken, chatId,
        '📖 <b>Available Commands</b>\n\n' +
        '/start - Start the bot and see welcome message\n' +
        '/status - Check if your account is linked\n' +
        '/unlink - Unlink your Telegram from your account\n' +
        '/help - Show this help message\n\n' +
        '🔗 To link your account, go to your IND Appointments Tracker settings.'
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TELEGRAM] Webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('[TELEGRAM] Error sending message:', error);
  }
}
