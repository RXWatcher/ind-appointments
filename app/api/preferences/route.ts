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

    const query = `
      SELECT
        id,
        appointment_type,
        location,
        persons,
        days_ahead,
        email_enabled,
        push_enabled,
        whatsapp_enabled,
        notification_interval,
        dnd_start_time,
        dnd_end_time,
        is_active,
        created_at,
        updated_at
      FROM notification_preferences
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;

    const preferences = await db.query(query, [auth.id]);

    return NextResponse.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    console.log('[PREFERENCES] Auth result:', auth);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if email is verified before allowing notification creation
    const userQuery = 'SELECT email_verified FROM users WHERE id = ?';
    const users = await db.query(userQuery, [auth.id]);

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0] as any;
    if (!user.email_verified) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please verify your email address before creating notification preferences. Check your inbox for the verification link.',
          requiresVerification: true
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log('[PREFERENCES] Request body:', body);
    const {
      appointmentType,
      location,
      persons = 1,
      daysAhead = 30,
      emailEnabled = true,
      pushEnabled = false,
      whatsappEnabled = false,
      notificationInterval = 15,
      dndStartTime = '22:00',
      dndEndTime = '08:00'
    } = body;

    if (!appointmentType || !location) {
      return NextResponse.json(
        { success: false, message: 'Appointment type and location are required' },
        { status: 400 }
      );
    }

    // Parse locations - could be "ALL" or comma-separated locations like "AM,DH,ZW"
    const locations = location === 'ALL'
      ? ['ALL']
      : location.split(',').filter((l: string) => l.trim());

    // Insert a preference for each location
    const query = `
      INSERT INTO notification_preferences (
        user_id, appointment_type, location, persons, days_ahead,
        email_enabled, push_enabled, whatsapp_enabled, notification_interval, dnd_start_time, dnd_end_time, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    for (const loc of locations) {
      await db.query(query, [
        auth.id,
        appointmentType,
        loc.trim(),
        persons,
        daysAhead,
        emailEnabled ? 1 : 0,
        pushEnabled ? 1 : 0,
        whatsappEnabled ? 1 : 0,
        notificationInterval,
        dndStartTime,
        dndEndTime
      ]);
    }

    return NextResponse.json({
      success: true,
      message: `Preference${locations.length > 1 ? 's' : ''} saved successfully`
    });
  } catch (error) {
    console.error('Error saving preference:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Preference ID is required' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM notification_preferences WHERE id = ? AND user_id = ?';
    await db.query(query, [id, auth.id]);

    return NextResponse.json({
      success: true,
      message: 'Preference deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting preference:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
