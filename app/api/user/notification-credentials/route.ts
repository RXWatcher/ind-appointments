import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's notification credentials
    const credentials = await db.query(`
      SELECT pushover_user_key, whatsapp_phone_number
      FROM user_notification_credentials
      WHERE user_id = ?
    `, [auth.id]);

    return NextResponse.json({
      success: true,
      data: credentials.length > 0 ? credentials[0] : {}
    });
  } catch (error) {
    console.error('Error fetching notification credentials:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { pushover_user_key, whatsapp_phone_number } = await request.json();

    // Upsert user notification credentials
    await db.query(`
      INSERT INTO user_notification_credentials (user_id, pushover_user_key, whatsapp_phone_number)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        pushover_user_key = excluded.pushover_user_key,
        whatsapp_phone_number = excluded.whatsapp_phone_number,
        updated_at = CURRENT_TIMESTAMP
    `, [auth.id, pushover_user_key || '', whatsapp_phone_number || '']);

    return NextResponse.json({
      success: true,
      message: 'Notification credentials saved successfully'
    });
  } catch (error) {
    console.error('Error saving notification credentials:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
