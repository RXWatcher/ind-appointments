// Cron Scheduler - Manages scheduled tasks for the IND Appointments application

import cron, { ScheduledTask } from 'node-cron';
import { checkAndNotifyNewAppointments, checkDigiDAppointments } from '@/lib/appointment-checker';
import { isInReleaseWindow, getNextReleaseWindowString } from '@/lib/digid-api';
import { DIGID } from '@/lib/constants';

class CronScheduler {
  private jobs: Map<string, ScheduledTask> = new Map();
  private isRunning: boolean = false;
  private digidAggressiveInterval: NodeJS.Timeout | null = null;
  private digidAggressiveStopTimeout: NodeJS.Timeout | null = null;

  /**
   * Initialize and start all cron jobs
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[CRON] Scheduler already running');
      return;
    }

    console.log('[CRON] Starting scheduler...');
    console.log('[CRON] Using TIERED SCRAPING approach:');
    console.log('[CRON]   - High-priority (DOC, BIO): every 5 minutes');
    console.log('[CRON]   - Low-priority (VAA, TKV, UKR, FAM): every 15 minutes');

    // HIGH-PRIORITY: DOC and BIO appointments (most common) - every 5 minutes
    const highPriorityJob = cron.schedule(
      '*/5 * * * *',
      async () => {
        console.log('[CRON] Running HIGH-PRIORITY appointment checker (DOC, BIO)...');
        try {
          const result = await checkAndNotifyNewAppointments(['DOC', 'BIO']);
          if (result.success) {
            console.log('[CRON] High-priority checker completed successfully');
          } else {
            console.error('[CRON] High-priority checker completed with errors:', result.errors);
          }
        } catch (error) {
          console.error('[CRON] Error running high-priority checker:', error);
        }
      },
      {
        timezone: 'Europe/Amsterdam'
      }
    );

    this.jobs.set('appointment-checker-high-priority', highPriorityJob);

    // LOW-PRIORITY: Other appointment types - every 15 minutes
    const lowPriorityJob = cron.schedule(
      '*/15 * * * *',
      async () => {
        console.log('[CRON] Running LOW-PRIORITY appointment checker (VAA, TKV, UKR, FAM)...');
        try {
          const result = await checkAndNotifyNewAppointments(['VAA', 'TKV', 'UKR', 'FAM']);
          if (result.success) {
            console.log('[CRON] Low-priority checker completed successfully');
          } else {
            console.error('[CRON] Low-priority checker completed with errors:', result.errors);
          }
        } catch (error) {
          console.error('[CRON] Error running low-priority checker:', error);
        }
      },
      {
        timezone: 'Europe/Amsterdam'
      }
    );

    this.jobs.set('appointment-checker-low-priority', lowPriorityJob);

    // Schedule cleanup job (runs daily at 3 AM)
    const cleanupJob = cron.schedule(
      '0 3 * * *',
      async () => {
        console.log('[CRON] Running cleanup job...');
        try {
          await this.cleanupOldData();
        } catch (error) {
          console.error('[CRON] Error running cleanup job:', error);
        }
      },
      {
        timezone: 'Europe/Amsterdam'
      }
    );

    this.jobs.set('cleanup', cleanupJob);

    // Schedule health check job (runs every hour)
    const healthCheckJob = cron.schedule(
      '0 * * * *',
      async () => {
        console.log('[CRON] Running health check...');
        try {
          const { runHealthChecks, sendHealthAlert } = await import('@/lib/health-monitor');
          const healthResult = await runHealthChecks();

          if (!healthResult.healthy) {
            console.warn('[CRON] Health check failed:', healthResult);
            await sendHealthAlert(healthResult);
          } else {
            console.log('[CRON] Health check passed');
          }
        } catch (error) {
          console.error('[CRON] Error running health check:', error);
        }
      },
      {
        timezone: 'Europe/Amsterdam'
      }
    );

    this.jobs.set('health-check', healthCheckJob);

    // ==========================================================================
    // DIGID VIDEO CALL SCHEDULING
    // ==========================================================================
    console.log('[CRON] Setting up DigiD video call scheduling:');
    console.log('[CRON]   - Normal polling: every 30 minutes');
    console.log('[CRON]   - Aggressive polling: every 30 seconds during Friday release windows');
    console.log(`[CRON]   - ${getNextReleaseWindowString()}`);

    // DIGID Normal polling - every 30 minutes (skip during release windows)
    const digidNormalJob = cron.schedule(
      '*/30 * * * *',
      async () => {
        // Skip if we're in a release window (aggressive polling handles it)
        if (isInReleaseWindow()) {
          console.log('[CRON] Skipping normal DigiD check - release window active');
          return;
        }

        console.log('[CRON] Running DigiD normal polling...');
        try {
          const result = await checkDigiDAppointments();
          if (result.success) {
            console.log(`[CRON] DigiD check completed: ${result.newAppointments} new appointments`);
          } else {
            console.error('[CRON] DigiD check completed with errors:', result.errors);
          }
        } catch (error) {
          console.error('[CRON] Error running DigiD check:', error);
        }
      },
      {
        timezone: 'Europe/Amsterdam'
      }
    );

    this.jobs.set('digid-normal', digidNormalJob);

    // DIGID Friday 9:00 release window - start aggressive polling
    const digidMorningReleaseJob = cron.schedule(
      '0 9 * * 5', // Friday at 9:00
      () => {
        console.log('[CRON] Friday 9:00 release window - starting aggressive DigiD polling');
        this.startAggressiveDigiDPolling();
      },
      {
        timezone: 'Europe/Amsterdam'
      }
    );

    this.jobs.set('digid-morning-release', digidMorningReleaseJob);

    // DIGID Friday 14:00 release window - start aggressive polling
    const digidAfternoonReleaseJob = cron.schedule(
      '0 14 * * 5', // Friday at 14:00
      () => {
        console.log('[CRON] Friday 14:00 release window - starting aggressive DigiD polling');
        this.startAggressiveDigiDPolling();
      },
      {
        timezone: 'Europe/Amsterdam'
      }
    );

    this.jobs.set('digid-afternoon-release', digidAfternoonReleaseJob);

    this.isRunning = true;
    console.log('[CRON] Scheduler started successfully');
    console.log(`[CRON] Active jobs: ${Array.from(this.jobs.keys()).join(', ')}`);

    // Run both checkers immediately on startup
    console.log('[CRON] Running initial appointment checks...');
    Promise.all([
      checkAndNotifyNewAppointments(['DOC', 'BIO']).catch(error => {
        console.error('[CRON] Error in initial high-priority check:', error);
      }),
      checkAndNotifyNewAppointments(['VAA', 'TKV', 'UKR', 'FAM']).catch(error => {
        console.error('[CRON] Error in initial low-priority check:', error);
      }),
      checkDigiDAppointments().catch(error => {
        console.error('[CRON] Error in initial DigiD check:', error);
      })
    ]);

    // Check if we're currently in a release window on startup
    if (isInReleaseWindow()) {
      console.log('[CRON] Currently in DigiD release window - starting aggressive polling');
      this.startAggressiveDigiDPolling();
    }
  }

  /**
   * Start aggressive DigiD polling for release windows
   * Polls every 30 seconds for 30 minutes
   */
  private startAggressiveDigiDPolling(): void {
    // Don't start if already running
    if (this.digidAggressiveInterval) {
      console.log('[CRON] Aggressive DigiD polling already active');
      return;
    }

    console.log('[CRON] Starting aggressive DigiD polling (every 30 seconds)...');

    // Run immediately
    checkDigiDAppointments().catch(error => {
      console.error('[CRON] Error in aggressive DigiD check:', error);
    });

    // Then run every 30 seconds
    this.digidAggressiveInterval = setInterval(async () => {
      console.log('[CRON] Running aggressive DigiD check...');
      try {
        const result = await checkDigiDAppointments();
        if (result.success && result.newAppointments > 0) {
          console.log(`[CRON] AGGRESSIVE DigiD: Found ${result.newAppointments} NEW appointments!`);
        }
      } catch (error) {
        console.error('[CRON] Error in aggressive DigiD check:', error);
      }
    }, DIGID.AGGRESSIVE_POLL_INTERVAL_SECONDS * 1000);

    // Schedule stop after the aggressive polling duration
    this.digidAggressiveStopTimeout = setTimeout(() => {
      this.stopAggressiveDigiDPolling();
    }, DIGID.AGGRESSIVE_POLL_DURATION_MINUTES * 60 * 1000);
  }

  /**
   * Stop aggressive DigiD polling
   */
  private stopAggressiveDigiDPolling(): void {
    if (this.digidAggressiveInterval) {
      clearInterval(this.digidAggressiveInterval);
      this.digidAggressiveInterval = null;
      console.log('[CRON] Stopped aggressive DigiD polling');
    }

    if (this.digidAggressiveStopTimeout) {
      clearTimeout(this.digidAggressiveStopTimeout);
      this.digidAggressiveStopTimeout = null;
    }
  }

  /**
   * Stop all cron jobs
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('[CRON] Scheduler not running');
      return;
    }

    console.log('[CRON] Stopping scheduler...');

    // Stop aggressive DigiD polling if active
    this.stopAggressiveDigiDPolling();

    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`[CRON] Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.isRunning = false;
    console.log('[CRON] Scheduler stopped');
  }

  /**
   * Manually trigger the appointment checker
   */
  public async triggerAppointmentCheck(): Promise<any> {
    console.log('[CRON] Manually triggering appointment check...');
    return await checkAndNotifyNewAppointments();
  }

  /**
   * Manually trigger the DigiD appointment checker
   */
  public async triggerDigiDCheck(): Promise<any> {
    console.log('[CRON] Manually triggering DigiD check...');
    return await checkDigiDAppointments();
  }

  /**
   * Manually start aggressive DigiD polling (for testing)
   */
  public startAggressivePolling(): void {
    this.startAggressiveDigiDPolling();
  }

  /**
   * Check if aggressive DigiD polling is currently active
   */
  public isAggressivePollingActive(): boolean {
    return this.digidAggressiveInterval !== null;
  }

  /**
   * Cleanup old data from database
   */
  private async cleanupOldData(): Promise<void> {
    const { db } = await import('@/lib/database');
    const { cleanupUnverifiedAccounts } = await import('@/lib/account-cleanup');

    try {
      // Delete appointments older than 7 days that are not available
      const deleteOldAppointments = `
        DELETE FROM ind_appointments
        WHERE is_available = 0
          AND date < date('now', '-7 days')
      `;
      const result1 = await db.query(deleteOldAppointments);
      console.log(`[CRON CLEANUP] Deleted ${(result1[0] as any)?.changes || 0} old appointments`);

      // Delete old cron job logs (keep last 30 days)
      const deleteOldLogs = `
        DELETE FROM cron_job_log
        WHERE started_at < datetime('now', '-30 days')
      `;
      const result2 = await db.query(deleteOldLogs);
      console.log(`[CRON CLEANUP] Deleted ${(result2[0] as any)?.changes || 0} old job logs`);

      // Delete old notification logs (keep last 30 days)
      const deleteOldNotifications = `
        DELETE FROM notification_log
        WHERE sent_at < datetime('now', '-30 days')
      `;
      const result3 = await db.query(deleteOldNotifications);
      console.log(`[CRON CLEANUP] Deleted ${(result3[0] as any)?.changes || 0} old notification logs`);

      // Cleanup unverified accounts older than 30 days
      const cleanupResult = await cleanupUnverifiedAccounts(30);
      if (cleanupResult.success) {
        console.log(`[CRON CLEANUP] Account cleanup completed (${cleanupResult.deletedCount} accounts removed)`);
      }

      console.log('[CRON CLEANUP] Cleanup completed successfully');
    } catch (error) {
      console.error('[CRON CLEANUP] Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Get status of all jobs
   */
  public getStatus(): {
    isRunning: boolean;
    jobs: string[];
    digid: {
      aggressivePollingActive: boolean;
      inReleaseWindow: boolean;
      nextReleaseWindow: string;
    };
  } {
    return {
      isRunning: this.isRunning,
      jobs: Array.from(this.jobs.keys()),
      digid: {
        aggressivePollingActive: this.isAggressivePollingActive(),
        inReleaseWindow: isInReleaseWindow(),
        nextReleaseWindow: getNextReleaseWindowString(),
      }
    };
  }
}

// Create singleton instance
const scheduler = new CronScheduler();

export default scheduler;
export { scheduler };
