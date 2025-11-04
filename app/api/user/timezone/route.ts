import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { timezone } = body;

    if (!timezone) {
      return NextResponse.json(
        { success: false, message: 'Timezone is required' },
        { status: 400 }
      );
    }

    // Validate timezone (basic check)
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid timezone' },
        { status: 400 }
      );
    }

    // Check if timezone column exists, if not we need to add it
    // For now, we'll store it in user_notification_credentials table or add to users table
    // Let's add a timezone field to the users table if it doesn't exist

    try {
      // Try to update timezone - if column doesn't exist, this will fail
      await db.query(
        'UPDATE users SET timezone = ? WHERE id = ?',
        [timezone, auth.id]
      );
    } catch (error) {
      // Column might not exist, try to add it
      try {
        await db.query('ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT \'Europe/Amsterdam\'');
        await db.query(
          'UPDATE users SET timezone = ? WHERE id = ?',
          [timezone, auth.id]
        );
      } catch (alterError) {
        console.error('Error adding timezone column:', alterError);
        return NextResponse.json(
          { success: false, message: 'Failed to update timezone' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Timezone updated successfully'
    });
  } catch (error) {
    console.error('Update timezone error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const users = await db.query(
      'SELECT timezone FROM users WHERE id = ?',
      [auth.id]
    );

    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        timezone: (users[0] as any).timezone || 'Europe/Amsterdam'
      }
    });
  } catch (error) {
    console.error('Get timezone error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
