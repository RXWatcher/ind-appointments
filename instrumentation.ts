// Instrumentation file - runs once when the Next.js server starts
// Used to initialize cron jobs

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[INSTRUMENTATION] Initializing IND Appointments application...');

    // Start cron scheduler
    const { scheduler } = await import('./lib/cron/scheduler');
    scheduler.start();

    console.log('[INSTRUMENTATION] Application initialized successfully');
  }
}
