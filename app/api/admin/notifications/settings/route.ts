import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all notification settings
    const settings = await db.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key LIKE 'smtp_%'
         OR setting_key LIKE 'pushover_%'
         OR setting_key LIKE 'whatsapp_%'
    `);

    // Convert to object
    const settingsObj: any = {};
    for (const row of settings as any[]) {
      settingsObj[row.setting_key] = row.setting_value;
    }

    return NextResponse.json({
      success: true,
      data: settingsObj
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const settings = await request.json();

    // Allowed setting keys
    const allowedKeys = [
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure',
      'pushover_user_key', 'pushover_api_token',
      'whatsapp_access_token', 'whatsapp_phone_number_id', 'whatsapp_business_account_id'
    ];

    // Save each setting using UPSERT (INSERT OR REPLACE)
    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.includes(key)) continue;

      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value = excluded.setting_value,
          updated_at = CURRENT_TIMESTAMP
      `, [key, value || '']);
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving notification settings:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
