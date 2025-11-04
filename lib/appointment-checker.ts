// Appointment Checker Service - Core logic for checking and notifying about new appointments

import { db } from '@/lib/database';
import {
  fetchINDAppointments,
  enrichAppointments,
  filterAppointmentsByDaysAhead,
  getAllValidCombinations,
  type INDAppointmentWithMetadata,
  type AppointmentType,
  type Location,
  APPOINTMENT_TYPES,
  LOCATIONS
} from '@/lib/ind-api';
import {
  fetchTheHagueICAppointments,
  fetchRotterdamICAppointments,
  enrichExpatCenterAppointments,
  APPOINTMENT_SOURCES,
  type AppointmentSource
} from '@/lib/expat-centers';
import { sendNewAppointmentsEmail } from '@/lib/email';
import { sendPushoverNotification } from '@/lib/notifications';

interface PreferenceConfig {
  id: number;
  user_id: number;
  appointment_type: AppointmentType;
  location: Location;
  persons: number;
  days_ahead: number;
  email_enabled: boolean;
  push_enabled: boolean;
  notification_interval: number;
  dnd_start_time: string;
  dnd_end_time: string;
  last_notification_at: string | null;
  user_email: string;
  username: string;
  full_name: string;
}

/**
 * Main function to check for new appointments and send notifications
 * @param filterTypes - Optional array of appointment types to check (e.g., ['DOC', 'BIO'])
 */
export async function checkAndNotifyNewAppointments(filterTypes?: string[]): Promise<{
  success: boolean;
  appointmentsFound: number;
  newAppointments: number;
  notificationsSent: number;
  errors: string[];
}> {
  const jobId = await logJobStart(filterTypes ? `appointment-checker-${filterTypes.join('-')}` : 'appointment-checker');
  const errors: string[] = [];
  let totalAppointmentsFound = 0;
  let totalNewAppointments = 0;
  let totalNotificationsSent = 0;

  try {
    const typeFilter = filterTypes ? ` (${filterTypes.join(', ')})` : '';
    console.log(`[APPOINTMENT CHECKER] Starting appointment check${typeFilter}...`);

    // Get all active user preferences for notifications
    const preferences = await getActivePreferences();
    console.log(`[APPOINTMENT CHECKER] Found ${preferences.length} active preferences for notifications`);

    // Map to collect pending notifications for each user preference
    const pendingNotifications = new Map<number, { user: PreferenceConfig; appointments: INDAppointmentWithMetadata[] }>();

    // COMPREHENSIVE SCRAPING: Check ALL VALID combinations regardless of user preferences
    // This allows users to search/filter by any combination
    // Only scrapes combinations that are actually supported by IND (not all locations support all types)
    let allCombinations = getAllValidCombinations();

    // Filter by appointment types if specified (for tiered scraping)
    if (filterTypes && filterTypes.length > 0) {
      allCombinations = allCombinations.filter(combo =>
        filterTypes.includes(combo.appointmentType)
      );
    }

    console.log(`[APPOINTMENT CHECKER] Scraping ${allCombinations.length} valid combinations${typeFilter}`);

    // Fetch appointments for ALL combinations with rate limiting
    for (let i = 0; i < allCombinations.length; i++) {
      const config = allCombinations[i];

      try {
        // Add delay every 10 requests to avoid overwhelming the API and reduce memory pressure
        if (i > 0 && i % 10 === 0) {
          console.log(`[APPOINTMENT CHECKER] Processed ${i}/${allCombinations.length} combinations, pausing...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second pause
        }

        const appointments = await fetchINDAppointments(
          config.appointmentType,
          config.location,
          config.persons
        );

        totalAppointmentsFound += appointments.length;

        if (appointments.length === 0) {
          // Reduced logging for empty results
          continue;
        }

        console.log(`[APPOINTMENT CHECKER] Found ${appointments.length} appointments for ${config.appointmentType} at ${config.location} (${config.persons} persons)`);

        // Enrich appointments with metadata
        const enriched = enrichAppointments(
          appointments,
          config.appointmentType,
          config.location,
          config.persons
        );

        // Store appointments in database and get new ones
        const newAppointments = await storeAppointments(enriched);
        totalNewAppointments += newAppointments.length;

        if (newAppointments.length > 0) {
          console.log(`[APPOINTMENT CHECKER] ${newAppointments.length} NEW appointments for ${config.appointmentType} at ${config.location}`);

          // Find users who should be notified
          // Match users who have: same type AND (location matches OR "ALL" locations) AND same persons
          const usersToNotify = preferences.filter(p => {
            if (p.appointment_type !== config.appointmentType || p.persons !== config.persons) {
              return false;
            }

            // Check if user's location preference matches
            const userLocations = p.location.split(',').map(l => l.trim());
            return userLocations.includes('ALL') || userLocations.includes(config.location);
          });

          // Add new appointments to each user's pending queue
          for (const user of usersToNotify) {
            // Filter appointments based on user's days_ahead preference
            const userAppointments = filterAppointmentsByDaysAhead(newAppointments, user.days_ahead);

            if (userAppointments.length === 0) {
              continue;
            }

            // Track these appointments for this user (will be sent later if interval passed)
            if (!pendingNotifications.has(user.id)) {
              pendingNotifications.set(user.id, { user, appointments: [] });
            }
            pendingNotifications.get(user.id)!.appointments.push(...userAppointments);
          }
        }
      } catch (error) {
        const errorMsg = `Error checking ${config.appointmentType} at ${config.location}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[APPOINTMENT CHECKER] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // EXPAT CENTERS SCRAPING - Scrape The Hague and Rotterdam International Centers
    console.log('[APPOINTMENT CHECKER] Starting expat centers scraping...');

    // The Hague International Centre - Scrape biometrics/document pickup for 1-6 persons
    try {
      const thicTypes = ['pickup'] as const;
      const personCounts = [1, 2, 3, 4, 5, 6];

      for (const type of thicTypes) {
        for (const persons of personCounts) {
          const thicAppointments = await fetchTheHagueICAppointments(type, persons, 1);
          if (thicAppointments.length > 0) {
            const enriched = enrichExpatCenterAppointments(
              thicAppointments,
              'THE_HAGUE_IC',
              'Document Collection',
              'The Hague International Centre',
              persons
            );
            const newAppointments = await storeAppointmentsWithSource(enriched, 'THE_HAGUE_IC');
            totalAppointmentsFound += thicAppointments.length;
            totalNewAppointments += newAppointments.length;

            if (newAppointments.length > 0) {
              console.log(`[THE HAGUE IC] ${newAppointments.length} NEW appointments for ${type}, ${persons} person(s)`);

              // Find users who should be notified (match on appointment type BIO/DOC and persons count)
              const usersToNotify = preferences.filter(p => {
                const enrichedType = enriched[0]?.appointmentType;
                return enrichedType && p.appointment_type === enrichedType && p.persons === persons;
              });

              // Add to pending notifications
              for (const user of usersToNotify) {
                const userAppointments = filterAppointmentsByDaysAhead(newAppointments, user.days_ahead);
                if (userAppointments.length > 0) {
                  if (!pendingNotifications.has(user.id)) {
                    pendingNotifications.set(user.id, { user, appointments: [] });
                  }
                  pendingNotifications.get(user.id)!.appointments.push(...userAppointments);
                }
              }
            }
          }
          // Rate limiting between requests - wait 500ms
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('[THE HAGUE IC] Error scraping:', error);
      errors.push(`The Hague IC scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Rotterdam International Center - Scrape IND appointments
    try {
      const ricAppointments = await fetchRotterdamICAppointments();
      if (ricAppointments.length > 0) {
        const enriched = enrichExpatCenterAppointments(
          ricAppointments,
          'ROTTERDAM_IC',
          'Biometrics / Document Collection',
          'Rotterdam International Center'
        );
        const newAppointments = await storeAppointmentsWithSource(enriched, 'ROTTERDAM_IC');
        totalAppointmentsFound += ricAppointments.length;
        totalNewAppointments += newAppointments.length;

        if (newAppointments.length > 0) {
          console.log(`[ROTTERDAM IC] ${newAppointments.length} NEW appointments`);

          // Find users who should be notified
          const usersToNotify = preferences.filter(p => {
            const enrichedType = enriched[0]?.appointmentType;
            return enrichedType && (p.appointment_type === enrichedType || p.appointment_type === 'DOC');
          });

          // Add to pending notifications
          for (const user of usersToNotify) {
            const userAppointments = filterAppointmentsByDaysAhead(newAppointments, user.days_ahead);
            if (userAppointments.length > 0) {
              if (!pendingNotifications.has(user.id)) {
                pendingNotifications.set(user.id, { user, appointments: [] });
              }
              pendingNotifications.get(user.id)!.appointments.push(...userAppointments);
            }
          }
        }
      }
    } catch (error) {
      console.error('[ROTTERDAM IC] Error scraping:', error);
      errors.push(`Rotterdam IC scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Send grouped notifications for all users who have pending appointments
    console.log(`[APPOINTMENT CHECKER] Processing ${pendingNotifications.size} users with pending notifications...`);

    for (const [preferenceId, { user, appointments }] of pendingNotifications.entries()) {
      try {
        // Check if we're in Do Not Disturb hours
        if (isWithinDNDHours(user.dnd_start_time, user.dnd_end_time)) {
          console.log(`[APPOINTMENT CHECKER] Skipping notification for user ${user.user_id} - within DND hours (${user.dnd_start_time}-${user.dnd_end_time})`);
          continue;
        }

        // Check if enough time has passed since last notification
        if (!hasIntervalPassed(user.last_notification_at, user.notification_interval)) {
          const minutesSinceLast = user.last_notification_at
            ? Math.floor((new Date().getTime() - new Date(user.last_notification_at).getTime()) / (1000 * 60))
            : 0;
          console.log(`[APPOINTMENT CHECKER] Skipping notification for user ${user.user_id} - interval not reached (${minutesSinceLast}/${user.notification_interval} minutes)`);
          continue;
        }

        // Remove duplicates by appointment key
        const uniqueAppointments = Array.from(
          new Map(appointments.map(a => [a.key, a])).values()
        );

        console.log(`[APPOINTMENT CHECKER] Sending grouped notification to user ${user.user_id} with ${uniqueAppointments.length} appointments`);

        // Send email notification
        if (user.email_enabled) {
          const result = await sendNewAppointmentsEmail({
            userEmail: user.user_email,
            userName: user.full_name || user.username,
            appointments: uniqueAppointments.map(a => ({
              date: a.date,
              startTime: a.startTime,
              endTime: a.endTime,
              appointmentType: a.appointmentTypeName,
              location: a.locationName
            })),
            appointmentType: APPOINTMENT_TYPES[user.appointment_type],
            location: user.location.includes('ALL') ? 'All Locations' : LOCATIONS[user.location] || user.location,
            preferenceId: user.id
          });

          if (result.success) {
            totalNotificationsSent++;
            await logNotification(user.user_id, uniqueAppointments[0].key, 'email', true, uniqueAppointments.length);
          } else {
            errors.push(`Failed to send email to ${user.user_email}: ${result.error}`);
            await logNotification(user.user_id, uniqueAppointments[0].key, 'email', false, uniqueAppointments.length, result.error);
          }
        }

        // Send push notification if enabled
        if (user.push_enabled) {
          const pushMessage = `Found ${uniqueAppointments.length} new appointment${uniqueAppointments.length > 1 ? 's' : ''} matching your preferences`;

          const pushResult = await sendPushoverNotification({
            userId: user.user_id,
            title: 'New IND Appointments Available!',
            message: pushMessage,
            url: `${process.env.BASE_URL || 'http://localhost:3000'}/appointments`,
          });

          if (pushResult.success) {
            totalNotificationsSent++;
            await logNotification(user.user_id, uniqueAppointments[0].key, 'push', true, uniqueAppointments.length);
          } else {
            console.log(`[APPOINTMENT CHECKER] Push notification skipped for user ${user.user_id}: ${pushResult.error}`);
            await logNotification(user.user_id, uniqueAppointments[0].key, 'push', false, uniqueAppointments.length, pushResult.error);
          }
        }

        // Update last notification timestamp
        await updateLastNotificationTime(user.id);
      } catch (error) {
        const errorMsg = `Error notifying user ${user.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[APPOINTMENT CHECKER] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Mark old appointments as unavailable
    await markOldAppointmentsUnavailable();

    await logJobComplete(jobId, totalAppointmentsFound, totalNewAppointments, totalNotificationsSent);

    console.log('[APPOINTMENT CHECKER] Check completed');
    console.log(`  - Appointments found: ${totalAppointmentsFound}`);
    console.log(`  - New appointments: ${totalNewAppointments}`);
    console.log(`  - Notifications sent: ${totalNotificationsSent}`);
    console.log(`  - Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      appointmentsFound: totalAppointmentsFound,
      newAppointments: totalNewAppointments,
      notificationsSent: totalNotificationsSent,
      errors
    };
  } catch (error) {
    const errorMsg = `Fatal error in appointment checker: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`[APPOINTMENT CHECKER] ${errorMsg}`);
    await logJobFailed(jobId, errorMsg);
    return {
      success: false,
      appointmentsFound: totalAppointmentsFound,
      newAppointments: totalNewAppointments,
      notificationsSent: totalNotificationsSent,
      errors: [...errors, errorMsg]
    };
  }
}

/**
 * Check if current time is within Do Not Disturb hours
 */
function isWithinDNDHours(dndStartTime: string, dndEndTime: string): boolean {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // If start time is later than end time, DND spans midnight
  if (dndStartTime > dndEndTime) {
    // DND is active if current time >= start OR current time < end
    return currentTime >= dndStartTime || currentTime < dndEndTime;
  } else {
    // DND is active if current time is between start and end
    return currentTime >= dndStartTime && currentTime < dndEndTime;
  }
}

/**
 * Check if enough time has passed since last notification
 */
function hasIntervalPassed(lastNotificationAt: string | null, intervalMinutes: number): boolean {
  if (!lastNotificationAt) {
    return true; // Never sent a notification before
  }

  const lastNotification = new Date(lastNotificationAt);
  const now = new Date();
  const minutesSinceLastNotification = (now.getTime() - lastNotification.getTime()) / (1000 * 60);

  return minutesSinceLastNotification >= intervalMinutes;
}

/**
 * Update the last notification timestamp for a preference
 */
async function updateLastNotificationTime(preferenceId: number): Promise<void> {
  const query = `
    UPDATE notification_preferences
    SET last_notification_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  await db.query(query, [preferenceId]);
}

/**
 * Get all active user preferences
 */
async function getActivePreferences(): Promise<PreferenceConfig[]> {
  const query = `
    SELECT
      np.id,
      np.user_id,
      np.appointment_type,
      np.location,
      np.persons,
      np.days_ahead,
      np.email_enabled,
      np.push_enabled,
      np.notification_interval,
      np.dnd_start_time,
      np.dnd_end_time,
      np.last_notification_at,
      u.email as user_email,
      u.username,
      u.full_name
    FROM notification_preferences np
    JOIN users u ON np.user_id = u.id
    WHERE np.is_active = 1
      AND u.email_verified = 1
  `;

  const rows = await db.query(query);
  return rows as PreferenceConfig[];
}


/**
 * Store appointments with source information
 */
async function storeAppointmentsWithSource(appointments: INDAppointmentWithMetadata[], source: AppointmentSource): Promise<INDAppointmentWithMetadata[]> {
  if (appointments.length === 0) {
    return [];
  }

  try {
    const keys = appointments.map(a => a.key);
    const placeholders = keys.map(() => '?').join(',');
    const existingQuery = `SELECT appointment_key FROM ind_appointments WHERE appointment_key IN (${placeholders})`;
    const existingRows = await db.query(existingQuery, keys);
    const existingKeys = new Set(existingRows.map((row: any) => row.appointment_key));

    const newAppointments = appointments.filter(a => !existingKeys.has(a.key));
    const existingAppointments = appointments.filter(a => existingKeys.has(a.key));

    // Batch INSERT new appointments WITH SOURCE
    if (newAppointments.length > 0) {
      const valueRows = newAppointments.map(appt =>
        `('${appt.key}', '${appt.date}', '${appt.startTime}', '${appt.endTime}', '${appt.appointmentType}', '${appt.location}', '${appt.locationName.replace(/'/g, "''")}', '${appt.appointmentTypeName.replace(/'/g, "''")}', ${appt.persons}, ${appt.parts}, '${source}', 1)`
      ).join(',\n');

      const insertQuery = `
        INSERT INTO ind_appointments (
          appointment_key, date, start_time, end_time,
          appointment_type, location, location_name, appointment_type_name,
          persons, parts, source, is_available
        ) VALUES ${valueRows}
      `;

      await db.query(insertQuery);
      console.log(`[APPOINTMENT CHECKER] Batch inserted ${newAppointments.length} new ${source} appointments`);
    }

    // Batch UPDATE existing appointments
    if (existingAppointments.length > 0) {
      const existingKeys = existingAppointments.map(a => a.key);
      const updatePlaceholders = existingKeys.map(() => '?').join(',');
      const updateQuery = `
        UPDATE ind_appointments
        SET last_seen_at = CURRENT_TIMESTAMP,
            is_available = 1
        WHERE appointment_key IN (${updatePlaceholders})
      `;

      await db.query(updateQuery, existingKeys);
      console.log(`[APPOINTMENT CHECKER] Batch updated ${existingAppointments.length} existing ${source} appointments`);
    }

    return newAppointments;
  } catch (error) {
    console.error(`[APPOINTMENT CHECKER] Error storing ${source} appointments:`, error);
    return [];
  }
}

/**
 * Store appointments in database and return only new ones
 * OPTIMIZED: Uses batch operations instead of individual queries
 */
async function storeAppointments(appointments: INDAppointmentWithMetadata[]): Promise<INDAppointmentWithMetadata[]> {
  if (appointments.length === 0) {
    return [];
  }

  try {
    // Step 1: Get all existing appointment keys in ONE query
    const keys = appointments.map(a => a.key);
    const placeholders = keys.map(() => '?').join(',');
    const existingQuery = `SELECT appointment_key FROM ind_appointments WHERE appointment_key IN (${placeholders})`;
    const existingRows = await db.query(existingQuery, keys);
    const existingKeys = new Set(existingRows.map((row: any) => row.appointment_key));

    // Step 2: Separate new vs existing appointments in memory
    const newAppointments = appointments.filter(a => !existingKeys.has(a.key));
    const existingAppointments = appointments.filter(a => existingKeys.has(a.key));

    // Step 3: Batch INSERT all new appointments
    if (newAppointments.length > 0) {
      const valueRows = newAppointments.map(appt =>
        `('${appt.key}', '${appt.date}', '${appt.startTime}', '${appt.endTime}', '${appt.appointmentType}', '${appt.location}', '${appt.locationName.replace(/'/g, "''")}', '${appt.appointmentTypeName.replace(/'/g, "''")}', ${appt.persons}, ${appt.parts}, 'IND', 1)`
      ).join(',\n');

      const insertQuery = `
        INSERT INTO ind_appointments (
          appointment_key, date, start_time, end_time,
          appointment_type, location, location_name, appointment_type_name,
          persons, parts, source, is_available
        ) VALUES ${valueRows}
      `;

      await db.query(insertQuery);
      console.log(`[APPOINTMENT CHECKER] Batch inserted ${newAppointments.length} new appointments`);
    }

    // Step 4: Batch UPDATE existing appointments
    if (existingAppointments.length > 0) {
      const existingKeys = existingAppointments.map(a => a.key);
      const updatePlaceholders = existingKeys.map(() => '?').join(',');
      const updateQuery = `
        UPDATE ind_appointments
        SET last_seen_at = CURRENT_TIMESTAMP,
            is_available = 1
        WHERE appointment_key IN (${updatePlaceholders})
      `;

      await db.query(updateQuery, existingKeys);
      console.log(`[APPOINTMENT CHECKER] Batch updated ${existingAppointments.length} existing appointments`);
    }

    return newAppointments;
  } catch (error) {
    console.error(`[APPOINTMENT CHECKER] Error in batch store:`, error);
    // Fallback to individual inserts if batch fails
    console.log(`[APPOINTMENT CHECKER] Falling back to individual inserts...`);
    return await storeAppointmentsIndividually(appointments);
  }
}

/**
 * Fallback function for individual appointment storage (in case batch fails)
 */
async function storeAppointmentsIndividually(appointments: INDAppointmentWithMetadata[]): Promise<INDAppointmentWithMetadata[]> {
  const newAppointments: INDAppointmentWithMetadata[] = [];

  for (const appt of appointments) {
    try {
      const existingQuery = 'SELECT id FROM ind_appointments WHERE appointment_key = ?';
      const existing = await db.query(existingQuery, [appt.key]);

      if (existing.length === 0) {
        const insertQuery = `
          INSERT INTO ind_appointments (
            appointment_key, date, start_time, end_time,
            appointment_type, location, location_name, appointment_type_name,
            persons, parts, source, is_available
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;

        await db.query(insertQuery, [
          appt.key,
          appt.date,
          appt.startTime,
          appt.endTime,
          appt.appointmentType,
          appt.location,
          appt.locationName,
          appt.appointmentTypeName,
          appt.persons,
          appt.parts,
          'IND'
        ]);

        newAppointments.push(appt);
      } else {
        const updateQuery = `
          UPDATE ind_appointments
          SET last_seen_at = CURRENT_TIMESTAMP,
              is_available = 1
          WHERE appointment_key = ?
        `;

        await db.query(updateQuery, [appt.key]);
      }
    } catch (error) {
      console.error(`[APPOINTMENT CHECKER] Error storing appointment ${appt.key}:`, error);
    }
  }

  return newAppointments;
}

/**
 * Mark appointments that haven't been seen recently as unavailable
 */
async function markOldAppointmentsUnavailable(): Promise<void> {
  const query = `
    UPDATE ind_appointments
    SET is_available = 0
    WHERE is_available = 1
      AND last_seen_at < datetime('now', '-1 hour')
  `;

  await db.query(query);
}

/**
 * Log notification attempt
 */
async function logNotification(
  userId: number,
  appointmentKey: string,
  notificationType: 'email' | 'push',
  success: boolean,
  appointmentCount: number,
  errorMessage?: string
): Promise<void> {
  try {
    // Get appointment ID
    const apptQuery = 'SELECT id FROM ind_appointments WHERE appointment_key = ? LIMIT 1';
    const apptResult = await db.query(apptQuery, [appointmentKey]);
    const appointmentId = apptResult.length > 0 ? (apptResult[0] as any).id : null;

    const query = `
      INSERT INTO notification_log (user_id, appointment_id, notification_type, success, error_message, appointment_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.query(query, [userId, appointmentId, notificationType, success, errorMessage || null, appointmentCount]);
  } catch (error) {
    console.error('[APPOINTMENT CHECKER] Error logging notification:', error);
  }
}

/**
 * Log job start
 */
async function logJobStart(jobName: string): Promise<number> {
  const query = 'INSERT INTO cron_job_log (job_name, status) VALUES (?, ?)';
  const result = await db.query(query, [jobName, 'running']);
  // SQLite better-sqlite3 returns RunResult with lastInsertRowid
  const runResult = result[0] as any;
  console.log('[DEBUG] Insert result:', runResult);
  return runResult.lastInsertRowid || runResult.lastID;
}

/**
 * Log job completion
 */
async function logJobComplete(jobId: number, appointmentsFound: number, newAppointments: number, notificationsSent: number): Promise<void> {
  const query = `
    UPDATE cron_job_log
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        appointments_found = ?,
        new_appointments = ?,
        notifications_sent = ?,
        duration_ms = (JULIANDAY(CURRENT_TIMESTAMP) - JULIANDAY(started_at)) * 86400000
    WHERE id = ?
  `;

  await db.query(query, [appointmentsFound, newAppointments, notificationsSent, jobId]);
}

/**
 * Log job failure
 */
async function logJobFailed(jobId: number, errorMessage: string): Promise<void> {
  const query = `
    UPDATE cron_job_log
    SET status = 'failed',
        completed_at = CURRENT_TIMESTAMP,
        error_message = ?,
        duration_ms = (JULIANDAY(CURRENT_TIMESTAMP) - JULIANDAY(started_at)) * 86400000
    WHERE id = ?
  `;

  await db.query(query, [errorMessage, jobId]);
}
