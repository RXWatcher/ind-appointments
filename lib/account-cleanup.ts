import { db } from '@/lib/database';

/**
 * Cleanup unverified accounts older than the specified days
 * @param daysOld - Number of days after which to delete unverified accounts (default: 30)
 */
export async function cleanupUnverifiedAccounts(daysOld: number = 30) {
  try {
    console.log(`[ACCOUNT CLEANUP] Starting cleanup of unverified accounts older than ${daysOld} days...`);

    // Delete unverified accounts older than X days
    const result = await db.query(`
      DELETE FROM users
      WHERE email_verified = 0
      AND datetime(created_at) <= datetime('now', '-${daysOld} days')
    `);

    const deletedCount = (result as any).changes || 0;

    if (deletedCount > 0) {
      console.log(`[ACCOUNT CLEANUP] Deleted ${deletedCount} unverified account(s) older than ${daysOld} days`);
    } else {
      console.log(`[ACCOUNT CLEANUP] No unverified accounts to clean up`);
    }

    return {
      success: true,
      deletedCount
    };
  } catch (error) {
    console.error('[ACCOUNT CLEANUP] Error during cleanup:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get statistics about unverified accounts
 */
export async function getUnverifiedAccountStats() {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_unverified,
        SUM(CASE WHEN datetime(created_at) <= datetime('now', '-7 days') THEN 1 ELSE 0 END) as older_than_7_days,
        SUM(CASE WHEN datetime(created_at) <= datetime('now', '-30 days') THEN 1 ELSE 0 END) as older_than_30_days
      FROM users
      WHERE email_verified = 0
    `);

    return (stats as any[])[0];
  } catch (error) {
    console.error('[ACCOUNT CLEANUP] Error getting stats:', error);
    return {
      total_unverified: 0,
      older_than_7_days: 0,
      older_than_30_days: 0
    };
  }
}
