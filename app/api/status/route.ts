import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import type { CronJobLogRow, AppointmentRow } from '@/lib/types';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: CheckResult;
    lastScrape: CheckResult;
    appointments: CheckResult;
  };
  // Note: uptime removed to avoid leaking server restart timing info
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  // Note: specific values removed from public responses to avoid leaking operational details
}

/**
 * GET /api/status
 * Public health check endpoint
 * Does not expose sensitive information
 */
export async function GET() {
  const checks: HealthStatus['checks'] = {
    database: { status: 'fail', message: 'Not checked' },
    lastScrape: { status: 'fail', message: 'Not checked' },
    appointments: { status: 'fail', message: 'Not checked' },
  };

  let overallStatus: HealthStatus['status'] = 'healthy';

  // Check database connectivity
  try {
    const result = db.queryOne<{ test: number }>('SELECT 1 as test');
    if (result?.test === 1) {
      checks.database = { status: 'pass', message: 'Connected' };
    } else {
      checks.database = { status: 'fail', message: 'Query returned unexpected result' };
      overallStatus = 'unhealthy';
    }
  } catch (error) {
    checks.database = {
      status: 'fail',
      message: 'Connection failed',
    };
    overallStatus = 'unhealthy';
  }

  // Check last successful scrape
  try {
    const lastCheck = db.queryOne<CronJobLogRow>(`
      SELECT
        started_at,
        completed_at,
        status
      FROM cron_job_log
      WHERE job_name LIKE '%appointment%'
        AND status = 'completed'
      ORDER BY started_at DESC
      LIMIT 1
    `);

    if (lastCheck) {
      const lastCheckTime = lastCheck.completed_at || lastCheck.started_at;
      const lastCheckDate = new Date(lastCheckTime);
      const minutesAgo = Math.floor((Date.now() - lastCheckDate.getTime()) / (1000 * 60));

      // Don't expose exact timing - just indicate status
      if (minutesAgo < 30) {
        checks.lastScrape = {
          status: 'pass',
          message: 'Recent check completed',
        };
      } else if (minutesAgo < 60) {
        checks.lastScrape = {
          status: 'warn',
          message: 'Check delayed',
        };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.lastScrape = {
          status: 'fail',
          message: 'Check stale',
        };
        overallStatus = 'unhealthy';
      }
    } else {
      checks.lastScrape = {
        status: 'warn',
        message: 'No scrape history found',
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (error) {
    checks.lastScrape = {
      status: 'fail',
      message: 'Failed to check scrape status',
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // Check available appointments count
  try {
    const countResult = db.queryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM ind_appointments
      WHERE is_available = 1
        AND (
          date > date('now', 'localtime')
          OR (date = date('now', 'localtime') AND start_time > time('now', 'localtime'))
        )
    `);

    const total = countResult?.total || 0;
    // Don't expose exact count - just indicate if appointments are available
    checks.appointments = {
      status: 'pass',
      message: total > 0 ? 'Appointments available' : 'No appointments currently available',
    };
  } catch (error) {
    checks.appointments = {
      status: 'fail',
      message: 'Failed to count appointments',
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };

  // Return appropriate status code based on health
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(response, { status: statusCode });
}
