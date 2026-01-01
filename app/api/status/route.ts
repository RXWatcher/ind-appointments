import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    // Get last successful check
    const lastCheck = await db.query(`
      SELECT
        started_at,
        completed_at,
        status
      FROM cron_job_log
      WHERE job_name LIKE '%appointment%'
        AND status = 'success'
      ORDER BY started_at DESC
      LIMIT 1
    `) as any[];

    // Get total available appointments count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM ind_appointments
      WHERE is_available = 1
        AND (
          date > date('now', 'localtime')
          OR (date = date('now', 'localtime') AND start_time > time('now', 'localtime'))
        )
    `) as any[];

    const lastCheckTime = lastCheck.length > 0 ? lastCheck[0].completed_at || lastCheck[0].started_at : null;
    const totalAppointments = countResult.length > 0 ? countResult[0].total : 0;

    return NextResponse.json({
      success: true,
      data: {
        lastCheck: lastCheckTime,
        totalAppointments,
        status: 'ok'
      }
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
