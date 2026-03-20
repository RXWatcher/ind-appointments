import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/database';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// GET - Fetch all content settings
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }

    // Fetch all ad-related settings from system_settings
    const query = await db.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key LIKE 'ad_%'
    `);

    const contentSettings: Record<string, string> = {};
    for (const row of query as any[]) {
      contentSettings[row.setting_key] = row.setting_value;
    }

    return NextResponse.json({
      success: true,
      data: contentSettings
    });
  } catch (error: any) {
    console.error('Error fetching content settings:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch settings'
    }, { status: 500 });
  }
}

// POST - Update content settings
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validate that only ad-related keys are being updated
    const allowedKeys = [
      'ad_header_html',
      'ad_sidebar_html',
      'ad_footer_html',
      'ad_between_appointments_html',
      'ad_enabled',
      'ad_header_enabled',
      'ad_sidebar_enabled',
      'ad_footer_enabled',
      'ad_between_appointments_enabled',
      'ad_header_display',
      'ad_footer_display'
    ];

    for (const key of Object.keys(body)) {
      if (!allowedKeys.includes(key)) {
        return NextResponse.json({
          success: false,
          message: `Invalid setting key: ${key}`
        }, { status: 400 });
      }
    }

    // Update or insert settings
    for (const [key, value] of Object.entries(body)) {
      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
      `, [key, value]);
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating content settings:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to update settings'
    }, { status: 500 });
  }
}
