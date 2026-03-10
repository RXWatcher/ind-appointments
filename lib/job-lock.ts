// Job lock mechanism to prevent overlapping cron jobs
// Uses DATABASE-BASED locking to work across multiple server instances

import { db } from './database';
import { CRON } from './constants';
import logger from './logger';
import crypto from 'crypto';
import os from 'os';

interface LockInfo {
  acquiredAt: number;
  expiresAt: number;
  holder: string;
}

interface JobLockRow {
  id: number;
  job_name: string;
  holder: string;
  acquired_at: string;
  expires_at: string;
}

// Generate a unique holder ID for this process instance
const PROCESS_HOLDER_ID = `${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

class JobLockManager {
  private static instance: JobLockManager;
  private initialized: boolean = false;

  private constructor() {
    this.ensureTableExists();
  }

  public static getInstance(): JobLockManager {
    if (!JobLockManager.instance) {
      JobLockManager.instance = new JobLockManager();
    }
    return JobLockManager.instance;
  }

  /**
   * Ensure the job_locks table exists
   */
  private ensureTableExists(): void {
    if (this.initialized) return;

    try {
      db.run(`
        CREATE TABLE IF NOT EXISTS job_locks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_name TEXT NOT NULL UNIQUE,
          holder TEXT NOT NULL,
          acquired_at DATETIME NOT NULL,
          expires_at DATETIME NOT NULL
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_job_locks_name ON job_locks(job_name)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_job_locks_expires ON job_locks(expires_at)`);
      this.initialized = true;
    } catch (error) {
      logger.error('[JOB LOCK] Failed to create job_locks table:', { error });
    }
  }

  /**
   * Attempt to acquire a lock for a job using database
   * Uses atomic INSERT OR REPLACE with expiry check for distributed safety
   * @param jobName - Name of the job
   * @param holder - Identifier for who is acquiring the lock
   * @param timeoutMs - Lock timeout in milliseconds
   * @returns true if lock was acquired, false otherwise
   */
  public acquire(
    jobName: string,
    holder: string = PROCESS_HOLDER_ID,
    timeoutMs: number = CRON.JOB_LOCK_TIMEOUT_MS
  ): boolean {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutMs);

    try {
      // Use a transaction for atomicity
      let acquired = false;

      db.transaction(() => {
        // First, try to delete any expired lock for this job
        db.run(`
          DELETE FROM job_locks
          WHERE job_name = ? AND expires_at <= datetime('now')
        `, [jobName]);

        // Check if there's an existing valid lock
        const existingLock = db.queryOne<JobLockRow>(`
          SELECT * FROM job_locks
          WHERE job_name = ? AND expires_at > datetime('now')
        `, [jobName]);

        if (existingLock) {
          // Lock exists and is valid
          logger.warn(`[JOB LOCK] Job "${jobName}" is already locked by "${existingLock.holder}"`, {
            acquiredAt: existingLock.acquired_at,
            expiresAt: existingLock.expires_at,
            holder: existingLock.holder,
          });
          acquired = false;
        } else {
          // No valid lock exists, acquire it
          db.run(`
            INSERT INTO job_locks (job_name, holder, acquired_at, expires_at)
            VALUES (?, ?, ?, ?)
          `, [jobName, holder, now.toISOString(), expiresAt.toISOString()]);

          logger.info(`[JOB LOCK] Lock acquired for "${jobName}" by "${holder}"`);
          acquired = true;
        }
      });

      return acquired;
    } catch (error) {
      logger.error(`[JOB LOCK] Error acquiring lock for "${jobName}":`, { error });
      return false;
    }
  }

  /**
   * Release a lock for a job
   * @param jobName - Name of the job
   * @param holder - Identifier for who is releasing the lock (must match acquirer)
   * @returns true if lock was released, false if lock didn't exist or holder didn't match
   */
  public release(jobName: string, holder: string = PROCESS_HOLDER_ID): boolean {
    try {
      const result = db.run(`
        DELETE FROM job_locks
        WHERE job_name = ? AND holder = ?
      `, [jobName, holder]);

      if (result.changes > 0) {
        logger.info(`[JOB LOCK] Lock released for "${jobName}" by "${holder}"`);
        return true;
      } else {
        logger.warn(`[JOB LOCK] No lock found to release for "${jobName}" by "${holder}"`);
        return false;
      }
    } catch (error) {
      logger.error(`[JOB LOCK] Error releasing lock for "${jobName}":`, { error });
      return false;
    }
  }

  /**
   * Check if a job is currently locked
   */
  public isLocked(jobName: string): boolean {
    try {
      const lock = db.queryOne<JobLockRow>(`
        SELECT * FROM job_locks
        WHERE job_name = ? AND expires_at > datetime('now')
      `, [jobName]);
      return lock !== undefined;
    } catch (error) {
      logger.error(`[JOB LOCK] Error checking lock for "${jobName}":`, { error });
      return false;
    }
  }

  /**
   * Get lock info for a job
   */
  public getLockInfo(jobName: string): LockInfo | null {
    try {
      const lock = db.queryOne<JobLockRow>(`
        SELECT * FROM job_locks
        WHERE job_name = ? AND expires_at > datetime('now')
      `, [jobName]);

      if (!lock) return null;

      return {
        acquiredAt: new Date(lock.acquired_at).getTime(),
        expiresAt: new Date(lock.expires_at).getTime(),
        holder: lock.holder,
      };
    } catch (error) {
      logger.error(`[JOB LOCK] Error getting lock info for "${jobName}":`, { error });
      return null;
    }
  }

  /**
   * Force release a lock (admin use only)
   */
  public forceRelease(jobName: string): boolean {
    try {
      const result = db.run(`DELETE FROM job_locks WHERE job_name = ?`, [jobName]);
      if (result.changes > 0) {
        logger.warn(`[JOB LOCK] Lock force-released for "${jobName}"`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`[JOB LOCK] Error force-releasing lock for "${jobName}":`, { error });
      return false;
    }
  }

  /**
   * Cleanup expired locks (call periodically or before operations)
   */
  public cleanupExpiredLocks(): number {
    try {
      const result = db.run(`
        DELETE FROM job_locks
        WHERE expires_at <= datetime('now')
      `);

      if (result.changes > 0) {
        logger.info(`[JOB LOCK] Cleaned up ${result.changes} expired locks`);
      }

      return result.changes;
    } catch (error) {
      logger.error('[JOB LOCK] Error cleaning up expired locks:', { error });
      return 0;
    }
  }

  /**
   * Get all active locks (for monitoring)
   */
  public getActiveLocks(): Map<string, LockInfo> {
    const active = new Map<string, LockInfo>();

    try {
      const locks = db.query<JobLockRow>(`
        SELECT * FROM job_locks
        WHERE expires_at > datetime('now')
      `);

      for (const lock of locks) {
        active.set(lock.job_name, {
          acquiredAt: new Date(lock.acquired_at).getTime(),
          expiresAt: new Date(lock.expires_at).getTime(),
          holder: lock.holder,
        });
      }
    } catch (error) {
      logger.error('[JOB LOCK] Error getting active locks:', { error });
    }

    return active;
  }

  /**
   * Get the process holder ID (useful for debugging)
   */
  public getProcessHolderId(): string {
    return PROCESS_HOLDER_ID;
  }
}

/**
 * Execute a function with a job lock
 * Automatically acquires and releases the lock
 */
export async function withJobLock<T>(
  jobName: string,
  fn: () => Promise<T>,
  options: {
    holder?: string;
    timeoutMs?: number;
    onLockFailed?: () => void;
  } = {}
): Promise<T | null> {
  const { holder = 'default', timeoutMs = CRON.JOB_LOCK_TIMEOUT_MS, onLockFailed } = options;
  const lockManager = JobLockManager.getInstance();

  // Try to acquire lock
  if (!lockManager.acquire(jobName, holder, timeoutMs)) {
    onLockFailed?.();
    return null;
  }

  try {
    // Execute the function
    return await fn();
  } finally {
    // Always release the lock
    lockManager.release(jobName, holder);
  }
}

export const jobLockManager = JobLockManager.getInstance();
export default jobLockManager;
