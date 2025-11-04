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

    // Get total users
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = (userCount[0] as any).count;

    // Get total appointments
    const apptCount = await db.query('SELECT COUNT(*) as count FROM ind_appointments WHERE is_available = 1');
    const totalAppointments = (apptCount[0] as any).count;

    // Get total active preferences
    const prefCount = await db.query('SELECT COUNT(*) as count FROM notification_preferences WHERE is_active = 1');
    const totalPreferences = (prefCount[0] as any).count;

    // Get recent users (last 10)
    const recentUsers = await db.query(`
      SELECT username, email, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Get recent cron jobs (last 10)
    const recentJobs = await db.query(`
      SELECT job_name, status, started_at, duration_ms, appointments_found
      FROM cron_job_log
      ORDER BY started_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        totalAppointments,
        totalPreferences,
        recentUsers,
        recentJobs
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
