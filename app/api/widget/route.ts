import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// GET - Fetch all content settings (public endpoint, no auth required)
export async function GET(request: NextRequest) {
  try {
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
