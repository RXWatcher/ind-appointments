import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';
import crypto from 'crypto';

/**
 * Generate a Telegram account linking token
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
    const settingsQuery = await db.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN ('telegram_bot_token', 'telegram_bot_username')
    `);

    const settings: Record<string, string> = {};
    for (const row of settingsQuery as any[]) {
      settings[row.setting_key] = row.setting_value;
    }

    if (!settings.telegram_bot_token) {
      return NextResponse.json(
        { success: false, message: 'Telegram integration is not configured by admin' },
        { status: 400 }
      );
    }

    // Generate a unique token
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete any existing tokens for this user
    await db.query(`DELETE FROM telegram_link_tokens WHERE user_id = ?`, [auth.id]);

    // Insert new token
    await db.query(`
      INSERT INTO telegram_link_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `, [auth.id, token, expiresAt.toISOString()]);

    // Generate the Telegram deep link
    const botUsername = settings.telegram_bot_username || 'INDAppointmentsBot';
    const telegramLink = `https://t.me/${botUsername}?start=${token}`;

    return NextResponse.json({
      success: true,
      data: {
        link: telegramLink,
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: 15
      }
    });
  } catch (error) {
    console.error('Error generating Telegram link:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get current Telegram link status
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
    const credResult = await db.query(`
      SELECT telegram_chat_id, telegram_username
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [auth.id]);

    const isLinked = credResult && credResult.length > 0 &&
      (credResult[0] as any).telegram_chat_id != null;

    // Check if Telegram is configured by admin
    const settingsQuery = await db.query(`
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'telegram_bot_token'
    `);

    const isConfigured = settingsQuery && settingsQuery.length > 0 &&
      (settingsQuery[0] as any).setting_value;

    return NextResponse.json({
      success: true,
      data: {
        isConfigured: !!isConfigured,
        isLinked,
        username: isLinked ? (credResult[0] as any).telegram_username : null
      }
    });
  } catch (error) {
    console.error('Error checking Telegram status:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Unlink Telegram account
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
    await db.query(`
      UPDATE user_notification_credentials
      SET telegram_chat_id = NULL, telegram_username = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, [auth.id]);

    return NextResponse.json({
      success: true,
      message: 'Telegram account unlinked successfully'
    });
  } catch (error) {
    console.error('Error unlinking Telegram:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
