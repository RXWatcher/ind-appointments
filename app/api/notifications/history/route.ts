import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get notification history for the user
    const notifications = await db.query(`
      SELECT
        nl.id,
        nl.notification_type,
        nl.sent_at,
        nl.success,
        nl.error_message,
        nl.appointment_count,
        ia.date as appointment_date,
        ia.start_time,
        ia.end_time,
        ia.appointment_type,
        ia.location,
        ia.location_name,
        ia.appointment_type_name
      FROM notification_log nl
      LEFT JOIN ind_appointments ia ON nl.appointment_id = ia.id
      WHERE nl.user_id = ?
      ORDER BY nl.sent_at DESC
      LIMIT ? OFFSET ?
    `, [user.id, limit, offset]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM notification_log
      WHERE user_id = ?
    `, [user.id]);

    const total = (countResult[0] as any)?.total || 0;

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get notification history error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
