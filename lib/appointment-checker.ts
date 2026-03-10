// Appointment Checker Service - Core logic for checking and notifying about new appointments

import { db } from '@/lib/database';
import logger from '@/lib/logger';
import { withJobLock } from '@/lib/job-lock';
import { SCRAPING, NOTIFICATIONS } from '@/lib/constants';
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
import {
  fetchAllDigiDAppointments,
  type DigiDAppointmentWithMetadata
} from '@/lib/digid-api';
import { sendNewAppointmentsEmail } from '@/lib/email';
import { sendPushoverNotification } from '@/lib/notifications';

/**
 * Broadcast new appointments to connected WebSocket clients
 */
function broadcastNewAppointments(appointments: INDAppointmentWithMetadata[], source: string = 'IND'): void {
  try {
    // Check if wsBroadcast is available (only in custom server)
    if (typeof global !== 'undefined' && (global as any).wsBroadcast) {
      (global as any).wsBroadcast({
        type: 'NEW_APPOINTMENTS',
        data: {
          count: appointments.length,
          source,
          appointments: appointments.map(a => ({
            id: a.key,
            date: a.date,
            startTime: a.startTime,
            endTime: a.endTime,
            appointmentType: a.appointmentType,
            appointmentTypeName: a.appointmentTypeName,
            location: a.location,
            locationName: a.locationName,
            persons: a.persons
          }))
        },
        timestamp: Date.now()
      });
    }
  } catch (error) {
    logger.error('[WS BROADCAST] Error broadcasting new appointments:', error);
  }
}

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
  user_timezone: string;
}

/**
 * Main function to check for new appointments and send notifications
 * Uses job lock to prevent overlapping executions
 * @param filterTypes - Optional array of appointment types to check (e.g., ['DOC', 'BIO'])
 */
export async function checkAndNotifyNewAppointments(filterTypes?: string[]): Promise<{
  success: boolean;
  appointmentsFound: number;
  newAppointments: number;
  notificationsSent: number;
  errors: string[];
}> {
  const jobName = filterTypes ? `appointment-checker-${filterTypes.join('-')}` : 'appointment-checker';

  // Use job lock to prevent overlapping executions
  const result = await withJobLock(
    jobName,
    async () => doCheckAndNotify(filterTypes),
    {
      onLockFailed: () => {
        logger.info(`[APPOINTMENT CHECKER] Job "${jobName}" already running, skipping`);
      }
    }
  );

  // If lock wasn't acquired, return empty result
  if (result === null) {
    return {
      success: true,
      appointmentsFound: 0,
      newAppointments: 0,
      notificationsSent: 0,
      errors: ['Job already running']
    };
  }

  return result;
}

/**
 * Check and notify about new DigiD video call appointments
 * Separate from main checker for aggressive polling during release windows
 */
export async function checkDigiDAppointments(): Promise<{
  success: boolean;
  appointmentsFound: number;
  newAppointments: number;
  notificationsSent: number;
  errors: string[];
}> {
  const jobName = 'digid-checker';

  // Use job lock to prevent overlapping executions
  const result = await withJobLock(
    jobName,
    async () => doCheckDigiD(),
    {
      onLockFailed: () => {
        logger.info('[DIGID CHECKER] Job already running, skipping');
      }
    }
  );

  // If lock wasn't acquired, return empty result
  if (result === null) {
    return {
      success: true,
      appointmentsFound: 0,
      newAppointments: 0,
      notificationsSent: 0,
      errors: ['Job already running']
    };
  }

  return result;
}

/**
 * Internal function that does the DigiD checking (called with job lock held)
 */
async function doCheckDigiD(): Promise<{
  success: boolean;
  appointmentsFound: number;
  newAppointments: number;
  notificationsSent: number;
  errors: string[];
}> {
  const jobId = await logJobStart('digid-checker');
  const errors: string[] = [];
  let totalAppointmentsFound = 0;
  let totalNewAppointments = 0;
  let totalNotificationsSent = 0;

  try {
    logger.info('[DIGID CHECKER] Starting DigiD video call check...');

    // Get all active user preferences for DGD appointments
    const preferences = await getActivePreferences();
    const digidPreferences = preferences.filter(p => p.appointment_type === 'DGD');
    logger.info(`[DIGID CHECKER] Found ${digidPreferences.length} active DigiD preferences`);

    // Fetch all DigiD appointments (all person counts)
    const allAppointments = await fetchAllDigiDAppointments();
    totalAppointmentsFound = allAppointments.length;

    if (allAppointments.length === 0) {
      logger.info('[DIGID CHECKER] No DigiD appointments found');
      await logJobComplete(jobId, totalAppointmentsFound, totalNewAppointments, totalNotificationsSent);
      return {
        success: true,
        appointmentsFound: 0,
        newAppointments: 0,
        notificationsSent: 0,
        errors: []
      };
    }

    logger.info(`[DIGID CHECKER] Found ${allAppointments.length} DigiD appointments`);

    // Store appointments and get new ones
    const newAppointments = await storeAppointmentsWithSource(
      allAppointments as INDAppointmentWithMetadata[],
      'DIGID'
    );
    totalNewAppointments = newAppointments.length;

    if (newAppointments.length > 0) {
      logger.info(`[DIGID CHECKER] ${newAppointments.length} NEW DigiD appointments!`);

      // Broadcast to connected WebSocket clients
      broadcastNewAppointments(newAppointments, 'DIGID');

      // Group appointments by person count for notification matching
      const appointmentsByPersons = new Map<number, INDAppointmentWithMetadata[]>();
      for (const appt of newAppointments) {
        const persons = appt.persons || 1;
        if (!appointmentsByPersons.has(persons)) {
          appointmentsByPersons.set(persons, []);
        }
        appointmentsByPersons.get(persons)!.push(appt);
      }

      // Process notifications for each user with DigiD preferences
      for (const pref of digidPreferences) {
        try {
          // Get appointments matching this user's person count
          const matchingAppointments = appointmentsByPersons.get(pref.persons) || [];
          if (matchingAppointments.length === 0) {
            continue;
          }

          // Filter by days ahead
          const userAppointments = filterAppointmentsByDaysAhead(matchingAppointments, pref.days_ahead);
          if (userAppointments.length === 0) {
            continue;
          }

          // Check DND hours
          if (isWithinDNDHours(pref.dnd_start_time, pref.dnd_end_time, pref.user_timezone)) {
            logger.info(`[DIGID CHECKER] Skipping notification for user ${pref.user_id} - within DND hours`);
            continue;
          }

          // Check throttling (use expedited throttling for DigiD since slots go fast)
          const throttleResult = smartThrottleCheck(pref.last_notification_at, pref.notification_interval, userAppointments);
          if (!throttleResult.shouldSend) {
            logger.info(`[DIGID CHECKER] Skipping notification for user ${pref.user_id} - interval not reached`);
            continue;
          }

          logger.info(`[DIGID CHECKER] Sending notification to user ${pref.user_id} with ${userAppointments.length} appointments`);

          // Send email notification
          if (pref.email_enabled) {
            const result = await sendNewAppointmentsEmail({
              userEmail: pref.user_email,
              userName: pref.full_name || pref.username,
              appointments: userAppointments.map(a => ({
                date: a.date,
                startTime: a.startTime,
                endTime: a.endTime,
                appointmentType: a.appointmentTypeName,
                location: a.locationName
              })),
              appointmentType: 'DigiD Video Call',
              location: 'Online (Video Call)',
              preferenceId: pref.id
            });

            if (result.success) {
              totalNotificationsSent++;
              await logNotification(pref.user_id, userAppointments[0].key, 'email', true, userAppointments.length);
            } else {
              errors.push(`Failed to send email to ${pref.user_email}: ${result.error}`);
              await logNotification(pref.user_id, userAppointments[0].key, 'email', false, userAppointments.length, result.error);
            }
          }

          // Send push notification if enabled
          if (pref.push_enabled) {
            const pushMessage = `${userAppointments.length} NEW DigiD video call slot${userAppointments.length > 1 ? 's' : ''} available! Book now before they're gone.`;

            const pushResult = await sendPushoverNotification({
              userId: pref.user_id,
              title: 'DigiD Video Call Slots Available!',
              message: pushMessage,
              url: 'https://digidafspraak.nederlandwereldwijd.nl/',
              priority: 1, // High priority for time-sensitive DigiD slots
            });

            if (pushResult.success) {
              totalNotificationsSent++;
              await logNotification(pref.user_id, userAppointments[0].key, 'push', true, userAppointments.length);
            } else {
              logger.info(`[DIGID CHECKER] Push notification skipped for user ${pref.user_id}: ${pushResult.error}`);
              await logNotification(pref.user_id, userAppointments[0].key, 'push', false, userAppointments.length, pushResult.error);
            }
          }

          // Update last notification timestamp
          await updateLastNotificationTime(pref.id);

        } catch (error) {
          const errorMsg = `Error notifying user ${pref.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(`[DIGID CHECKER] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    await logJobComplete(jobId, totalAppointmentsFound, totalNewAppointments, totalNotificationsSent);

    logger.info('[DIGID CHECKER] Check completed', {
      appointmentsFound: totalAppointmentsFound,
      newAppointments: totalNewAppointments,
      notificationsSent: totalNotificationsSent
    });

    return {
      success: errors.length === 0,
      appointmentsFound: totalAppointmentsFound,
      newAppointments: totalNewAppointments,
      notificationsSent: totalNotificationsSent,
      errors
    };
  } catch (error) {
    const errorMsg = `Fatal error in DigiD checker: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error(`[DIGID CHECKER] ${errorMsg}`);
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
 * Internal function that does the actual checking (called with job lock held)
 */
async function doCheckAndNotify(filterTypes?: string[]): Promise<{
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
    logger.info(`[APPOINTMENT CHECKER] Starting appointment check${typeFilter}...`);

    // Get all active user preferences for notifications
    const preferences = await getActivePreferences();
    logger.info(`[APPOINTMENT CHECKER] Found ${preferences.length} active preferences for notifications`);

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

    logger.info(`[APPOINTMENT CHECKER] Scraping ${allCombinations.length} valid combinations${typeFilter}`);

    // Fetch appointments for ALL combinations with rate limiting
    for (let i = 0; i < allCombinations.length; i++) {
      const config = allCombinations[i];

      try {
        // Add delay every 10 requests to avoid overwhelming the API and reduce memory pressure
        if (i > 0 && i % 10 === 0) {
          logger.info(`[APPOINTMENT CHECKER] Processed ${i}/${allCombinations.length} combinations, pausing...`);
          await new Promise(resolve => setTimeout(resolve, SCRAPING.IND_API_DELAY_MS));
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

        logger.info(`[APPOINTMENT CHECKER] Found ${appointments.length} appointments for ${config.appointmentType} at ${config.location} (${config.persons} persons)`);

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
          logger.info(`[APPOINTMENT CHECKER] ${newAppointments.length} NEW appointments for ${config.appointmentType} at ${config.location}`);

          // Broadcast to connected WebSocket clients
          broadcastNewAppointments(newAppointments, 'IND');

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
        logger.error(`[APPOINTMENT CHECKER] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // EXPAT CENTERS SCRAPING - Scrape The Hague and Rotterdam International Centers
    logger.info('[APPOINTMENT CHECKER] Starting expat centers scraping...');

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
              logger.info(`[THE HAGUE IC] ${newAppointments.length} NEW appointments for ${type}, ${persons} person(s)`);

              // Broadcast to connected WebSocket clients
              broadcastNewAppointments(newAppointments, 'THE_HAGUE_IC');

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
          await new Promise(resolve => setTimeout(resolve, SCRAPING.EXPAT_CENTER_DELAY_MS));
        }
      }
    } catch (error) {
      logger.error('[THE HAGUE IC] Error scraping:', error);
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
          logger.info(`[ROTTERDAM IC] ${newAppointments.length} NEW appointments`);

          // Broadcast to connected WebSocket clients
          broadcastNewAppointments(newAppointments, 'ROTTERDAM_IC');

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
      logger.error('[ROTTERDAM IC] Error scraping:', error);
      errors.push(`Rotterdam IC scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Send grouped notifications for all users who have pending appointments
    logger.info(`[APPOINTMENT CHECKER] Processing ${pendingNotifications.size} users with pending notifications...`);

    for (const [preferenceId, { user, appointments }] of pendingNotifications.entries()) {
      try {
        // Check if we're in Do Not Disturb hours (using user's timezone)
        if (isWithinDNDHours(user.dnd_start_time, user.dnd_end_time, user.user_timezone)) {
          logger.info(`[APPOINTMENT CHECKER] Skipping notification for user ${user.user_id} - within DND hours (${user.dnd_start_time}-${user.dnd_end_time} ${user.user_timezone})`);
          continue;
        }

        // Check if enough time has passed since last notification (with smart throttling for urgent appointments)
        const throttleResult = smartThrottleCheck(user.last_notification_at, user.notification_interval, appointments);
        if (!throttleResult.shouldSend) {
          const minutesSinceLast = user.last_notification_at
            ? Math.floor((new Date().getTime() - new Date(user.last_notification_at).getTime()) / (1000 * 60))
            : 0;
          logger.info(`[APPOINTMENT CHECKER] Skipping notification for user ${user.user_id} - interval not reached (${minutesSinceLast}/${throttleResult.effectiveInterval} minutes)`);
          continue;
        }
        if (throttleResult.isUrgent) {
          logger.info(`[APPOINTMENT CHECKER] URGENT: User ${user.user_id} has appointments within 2 days - using expedited throttling`);
        }

        // Remove duplicates by appointment key
        const uniqueAppointments = Array.from(
          new Map(appointments.map(a => [a.key, a])).values()
        );

        logger.info(`[APPOINTMENT CHECKER] Sending grouped notification to user ${user.user_id} with ${uniqueAppointments.length} appointments`);

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
            logger.info(`[APPOINTMENT CHECKER] Push notification skipped for user ${user.user_id}: ${pushResult.error}`);
            await logNotification(user.user_id, uniqueAppointments[0].key, 'push', false, uniqueAppointments.length, pushResult.error);
          }
        }

        // Update last notification timestamp
        await updateLastNotificationTime(user.id);
      } catch (error) {
        const errorMsg = `Error notifying user ${user.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(`[APPOINTMENT CHECKER] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Mark old appointments as unavailable
    await markOldAppointmentsUnavailable();

    await logJobComplete(jobId, totalAppointmentsFound, totalNewAppointments, totalNotificationsSent);

    logger.info('[APPOINTMENT CHECKER] Check completed', {
      appointmentsFound: totalAppointmentsFound,
      newAppointments: totalNewAppointments,
      notificationsSent: totalNotificationsSent,
      errors: errors.length
    });

    return {
      success: errors.length === 0,
      appointmentsFound: totalAppointmentsFound,
      newAppointments: totalNewAppointments,
      notificationsSent: totalNotificationsSent,
      errors
    };
  } catch (error) {
    const errorMsg = `Fatal error in appointment checker: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error(`[APPOINTMENT CHECKER] ${errorMsg}`);
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

// Set of valid IANA timezone names (cached for performance)
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

/**
 * Validate a timezone string
 * Returns the timezone if valid, or default if invalid/empty
 */
function validateTimezone(timezone: string | null | undefined): string {
  const DEFAULT_TIMEZONE = 'Europe/Amsterdam';

  if (!timezone || typeof timezone !== 'string' || timezone.trim() === '') {
    return DEFAULT_TIMEZONE;
  }

  const normalized = timezone.trim();

  // Check against known valid timezones
  if (VALID_TIMEZONES.has(normalized)) {
    return normalized;
  }

  logger.warn(`[DND] Invalid timezone "${timezone}", using default ${DEFAULT_TIMEZONE}`);
  return DEFAULT_TIMEZONE;
}

/**
 * Check if current time is within Do Not Disturb hours
 * Uses the user's timezone to correctly determine DND status
 */
function isWithinDNDHours(dndStartTime: string, dndEndTime: string, userTimezone: string = 'Europe/Amsterdam'): boolean {
  // Validate timezone before using
  const validTimezone = validateTimezone(userTimezone);

  // Get current time in user's timezone
  let currentTime: string;

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: validTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    currentTime = formatter.format(new Date());
  } catch (error) {
    // Fallback to server time if formatting fails (shouldn't happen with validated timezone)
    const now = new Date();
    currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    logger.warn(`[DND] Timezone formatting failed for "${validTimezone}", using server time:`, error);
  }

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
 * Smart throttling: Check if we should send notification based on appointment urgency
 * Urgent appointments (within 2 days) bypass normal throttling
 * Returns { shouldSend: boolean, isUrgent: boolean, effectiveInterval: number }
 */
function smartThrottleCheck(
  lastNotificationAt: string | null,
  intervalMinutes: number,
  appointments: INDAppointmentWithMetadata[]
): { shouldSend: boolean; isUrgent: boolean; effectiveInterval: number } {
  const now = new Date();
  const urgentThresholdMs = NOTIFICATIONS.URGENT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const urgentDeadline = new Date(now.getTime() + urgentThresholdMs);

  // Check if any appointments are urgent (within threshold days)
  const hasUrgentAppointment = appointments.some(appt => {
    const appointmentDate = new Date(appt.date);
    return appointmentDate <= urgentDeadline;
  });

  if (hasUrgentAppointment) {
    // For urgent appointments, use a reduced interval
    const urgentInterval = Math.min(intervalMinutes, NOTIFICATIONS.URGENT_MIN_INTERVAL_MINUTES);
    return {
      shouldSend: hasIntervalPassed(lastNotificationAt, urgentInterval),
      isUrgent: true,
      effectiveInterval: urgentInterval
    };
  }

  // Normal throttling for non-urgent appointments
  return {
    shouldSend: hasIntervalPassed(lastNotificationAt, intervalMinutes),
    isUrgent: false,
    effectiveInterval: intervalMinutes
  };
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
      u.full_name,
      u.timezone as user_timezone
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
 * Uses INSERT OR IGNORE to handle race conditions safely
 * Uses transactions for atomicity
 */
async function storeAppointmentsWithSource(appointments: INDAppointmentWithMetadata[], source: AppointmentSource): Promise<INDAppointmentWithMetadata[]> {
  if (appointments.length === 0) {
    return [];
  }

  const newAppointments: INDAppointmentWithMetadata[] = [];

  try {
    // Use transaction for atomicity
    db.transaction(() => {
      // Use INSERT OR IGNORE to handle race conditions
      // This prevents constraint violations if another job inserts the same appointment
      const insertQuery = `
        INSERT OR IGNORE INTO ind_appointments (
          appointment_key, date, start_time, end_time,
          appointment_type, location, location_name, appointment_type_name,
          persons, parts, source, is_available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;

      const updateQuery = `
        UPDATE ind_appointments
        SET last_seen_at = CURRENT_TIMESTAMP, is_available = 1
        WHERE appointment_key = ?
      `;

      for (const appt of appointments) {
        const result = db.run(insertQuery, [
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
          source
        ]);

        if (result.changes > 0) {
          // Row was inserted (new appointment)
          newAppointments.push(appt);
        } else {
          // Row already exists, update last_seen_at
          db.run(updateQuery, [appt.key]);
        }
      }
    });

    if (newAppointments.length > 0) {
      logger.info(`[APPOINTMENT CHECKER] Inserted ${newAppointments.length} new ${source} appointments`);
    }

    return newAppointments;
  } catch (error) {
    logger.error(`[APPOINTMENT CHECKER] Error storing ${source} appointments:`, error);
    return [];
  }
}

/**
 * Store appointments in database and return only new ones
 * Uses INSERT OR IGNORE to handle race conditions safely
 * Uses transactions for atomicity
 */
async function storeAppointments(appointments: INDAppointmentWithMetadata[]): Promise<INDAppointmentWithMetadata[]> {
  if (appointments.length === 0) {
    return [];
  }

  const newAppointments: INDAppointmentWithMetadata[] = [];

  try {
    // Use transaction for atomicity
    db.transaction(() => {
      // Use INSERT OR IGNORE to handle race conditions
      // This prevents constraint violations if another job inserts the same appointment
      const insertQuery = `
        INSERT OR IGNORE INTO ind_appointments (
          appointment_key, date, start_time, end_time,
          appointment_type, location, location_name, appointment_type_name,
          persons, parts, source, is_available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;

      const updateQuery = `
        UPDATE ind_appointments
        SET last_seen_at = CURRENT_TIMESTAMP, is_available = 1
        WHERE appointment_key = ?
      `;

      for (const appt of appointments) {
        const result = db.run(insertQuery, [
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

        if (result.changes > 0) {
          // Row was inserted (new appointment)
          newAppointments.push(appt);
        } else {
          // Row already exists, update last_seen_at
          db.run(updateQuery, [appt.key]);
        }
      }
    });

    if (newAppointments.length > 0) {
      logger.info(`[APPOINTMENT CHECKER] Inserted ${newAppointments.length} new appointments`);
    }

    return newAppointments;
  } catch (error) {
    logger.error('[APPOINTMENT CHECKER] Error in store:', error);
    return [];
  }
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
    logger.error('[APPOINTMENT CHECKER] Error logging notification:', { error });
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
  logger.debug('[DEBUG] Insert result:', { runResult });
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
