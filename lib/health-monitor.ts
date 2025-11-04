import { db } from '@/lib/database';
import { getSmtpSettings } from '@/lib/email';
import nodemailer from 'nodemailer';

export interface HealthCheckResult {
  healthy: boolean;
  checks: {
    database: { status: 'ok' | 'error'; message?: string };
    lastCheck: { status: 'ok' | 'warning' | 'error'; message?: string };
    email: { status: 'ok' | 'error'; message?: string };
  };
  timestamp: string;
}

/**
 * Check if the database is accessible
 */
export async function checkDatabase(): Promise<{ status: 'ok' | 'error'; message?: string }> {
  try {
    await db.query('SELECT 1');
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
}

/**
 * Check if the last appointment check was recent and successful
 */
export async function checkLastAppointmentCheck(): Promise<{ status: 'ok' | 'warning' | 'error'; message?: string }> {
  try {
    const result = await db.query(`
      SELECT
        started_at,
        completed_at,
        status,
        error_message
      FROM cron_job_log
      WHERE job_name LIKE '%appointment%'
      ORDER BY started_at DESC
      LIMIT 1
    `);

    if (!result || result.length === 0) {
      return {
        status: 'warning',
        message: 'No appointment checks have been run yet'
      };
    }

    const lastCheck = result[0] as any;
    const lastCheckTime = new Date(lastCheck.started_at).getTime();
    const now = Date.now();
    const hoursSinceLastCheck = (now - lastCheckTime) / (1000 * 60 * 60);

    // If last check was more than 1 hour ago, that's a problem
    if (hoursSinceLastCheck > 1) {
      return {
        status: 'error',
        message: `Last check was ${Math.floor(hoursSinceLastCheck)} hours ago`
      };
    }

    // If last check failed
    if (lastCheck.status === 'failed') {
      return {
        status: 'error',
        message: `Last check failed: ${lastCheck.error_message || 'Unknown error'}`
      };
    }

    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to check appointment logs'
    };
  }
}

/**
 * Check if email service is configured
 */
export async function checkEmailService(): Promise<{ status: 'ok' | 'error'; message?: string }> {
  try {
    const settings = await getSmtpSettings();

    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password) {
      return {
        status: 'error',
        message: 'Email service not configured'
      };
    }

    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Email service check failed'
    };
  }
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthCheckResult> {
  const [databaseCheck, lastCheckResult, emailCheck] = await Promise.all([
    checkDatabase(),
    checkLastAppointmentCheck(),
    checkEmailService()
  ]);

  const healthy =
    databaseCheck.status === 'ok' &&
    lastCheckResult.status !== 'error' &&
    emailCheck.status === 'ok';

  return {
    healthy,
    checks: {
      database: databaseCheck,
      lastCheck: lastCheckResult,
      email: emailCheck
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Send alert email to admin if health checks fail
 */
export async function sendHealthAlert(healthResult: HealthCheckResult): Promise<void> {
  if (healthResult.healthy) {
    return; // No need to alert if everything is healthy
  }

  try {
    const settings = await getSmtpSettings();

    // Get admin email from environment or settings
    const adminEmail = process.env.ADMIN_EMAIL || settings.from_email;

    if (!adminEmail) {
      console.error('[HEALTH] No admin email configured for alerts');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password
      }
    });

    const failedChecks = Object.entries(healthResult.checks)
      .filter(([_, check]) => check.status === 'error')
      .map(([name, check]) => `<li><strong>${name}</strong>: ${check.message}</li>`)
      .join('');

    const warningChecks = Object.entries(healthResult.checks)
      .filter(([_, check]) => check.status === 'warning')
      .map(([name, check]) => `<li><strong>${name}</strong>: ${check.message}</li>`)
      .join('');

    const html = `
      <h2>IND Appointments Health Check Alert</h2>
      <p>The system health check has detected issues:</p>

      ${failedChecks ? `<h3 style="color: #dc2626;">Failed Checks:</h3><ul>${failedChecks}</ul>` : ''}
      ${warningChecks ? `<h3 style="color: #f59e0b;">Warnings:</h3><ul>${warningChecks}</ul>` : ''}

      <p><strong>Timestamp:</strong> ${new Date(healthResult.timestamp).toLocaleString()}</p>
      <p>Please check the system logs for more details.</p>
    `;

    await transporter.sendMail({
      from: `${settings.from_name} <${settings.from_email}>`,
      to: adminEmail,
      subject: '[ALERT] IND Appointments System Health Issue',
      html
    });

    console.log(`[HEALTH] Alert email sent to ${adminEmail}`);
  } catch (error) {
    console.error('[HEALTH] Failed to send alert email:', error);
  }
}
