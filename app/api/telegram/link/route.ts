import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth, security } from '@/lib/security';
import { SECURITY } from '@/lib/constants';
import type { SystemSettingRow, UserNotificationCredentialsRow } from '@/lib/types';

/**
 * POST /api/telegram/link
 * Generate a Telegram account linking token
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get bot username from settings
    const settingsRows = db.query<SystemSettingRow>(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN ('telegram_bot_token', 'telegram_bot_username')
    `);

    const settings: Record<string, string> = {};
    for (const row of settingsRows) {
      if (row.setting_value) {
        settings[row.setting_key] = row.setting_value;
      }
    }

    if (!settings.telegram_bot_token) {
      return NextResponse.json(
        { success: false, message: 'Telegram integration is not configured by admin' },
        { status: 400 }
      );
    }

    if (!settings.telegram_bot_username) {
      return NextResponse.json(
        { success: false, message: 'Telegram bot username is not configured by admin' },
        { status: 400 }
      );
    }

    // Generate a secure token (32 bytes = 64 hex chars)
    const token = security.generateSecureToken(SECURITY.TOKEN_BYTES);
    // Hash the token for storage (never store plaintext)
    const tokenHash = security.hashToken(token);

    const expiresAt = new Date(Date.now() + SECURITY.TELEGRAM_LINK_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Use transaction to prevent race condition when user clicks multiple times
    // This ensures only one token exists per user at a time
    db.transaction(() => {
      // Delete any existing tokens for this user
      db.run(`DELETE FROM telegram_link_tokens WHERE user_id = ?`, [auth.id]);

      // Insert new token (store hash, not plaintext)
      db.run(`
        INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `, [auth.id, tokenHash, expiresAt.toISOString()]);
    });

    // Generate the Telegram deep link (token is in URL, but it's one-time use)
    const botUsername = settings.telegram_bot_username;
    const telegramLink = `https://t.me/${botUsername}?start=${token}`;

    return NextResponse.json({
      success: true,
      data: {
        link: telegramLink,
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: SECURITY.TELEGRAM_LINK_TOKEN_EXPIRY_MINUTES,
      },
    });
  } catch (error) {
    console.error('[TELEGRAM LINK] Error generating link:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telegram/link
 * Get current Telegram link status
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has linked Telegram
    const credResult = db.queryOne<UserNotificationCredentialsRow>(`
      SELECT telegram_chat_id, telegram_username
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [auth.id]);

    const isLinked = credResult?.telegram_chat_id != null;

    // Check if Telegram is configured by admin
    const settingsResult = db.queryOne<SystemSettingRow>(`
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'telegram_bot_token'
    `);

    const isConfigured = !!settingsResult?.setting_value;

    return NextResponse.json({
      success: true,
      data: {
        isConfigured,
        isLinked,
        // Only return username, not the full chat ID (privacy)
        username: isLinked ? credResult?.telegram_username : null,
      },
    });
  } catch (error) {
    console.error('[TELEGRAM LINK] Error checking status:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/telegram/link
 * Unlink Telegram account
 * Requires authentication
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Remove Telegram credentials
    db.run(`
      UPDATE user_notification_credentials
      SET telegram_chat_id = NULL, telegram_username = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, [auth.id]);

    return NextResponse.json({
      success: true,
      message: 'Telegram account unlinked successfully',
    });
  } catch (error) {
    console.error('[TELEGRAM LINK] Error unlinking:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
