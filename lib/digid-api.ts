/**
 * DigiD Video Call Appointments API Service
 *
 * Scrapes the DigiD video call appointment system at:
 * https://digidafspraak.nederlandwereldwijd.nl/
 *
 * Appointments are released every Friday at 9:00 and 14:00 Amsterdam time.
 * This service provides smart scheduling to poll aggressively during release windows.
 */

import { DIGID } from '@/lib/constants';
import { INDAppointment, INDAppointmentWithMetadata } from '@/lib/ind-api';

// =============================================================================
// TYPES
// =============================================================================

export interface DigiDAppointment extends INDAppointment {
  // Inherits: key, date, startTime, endTime, parts
}

export interface DigiDAppointmentWithMetadata extends INDAppointmentWithMetadata {
  // Inherits all INDAppointmentWithMetadata fields
  // appointmentType will be 'DGD'
  // location will be 'DIGID_VC'
}

export interface DigiDTimeSlot {
  date: string;      // DD-MM-YYYY format from API
  time: string;      // HH:mm format
  available: boolean;
}

export interface DigiDEstablishment {
  id: string;
  name: string;
  available: boolean;
}

// =============================================================================
// RELEASE WINDOW DETECTION
// =============================================================================

/**
 * Gets the current time in Amsterdam timezone
 */
export function getAmsterdamTime(): Date {
  const now = new Date();
  // Convert to Amsterdam timezone
  const amsterdamTime = new Date(now.toLocaleString('en-US', { timeZone: DIGID.TIMEZONE }));
  return amsterdamTime;
}

/**
 * Checks if we're currently in a release window
 * Release windows are 30 minutes after 9:00 and 14:00 on Fridays
 */
export function isInReleaseWindow(): boolean {
  const amsterdamTime = getAmsterdamTime();
  const dayOfWeek = amsterdamTime.getDay();
  const hour = amsterdamTime.getHours();
  const minute = amsterdamTime.getMinutes();

  // Check if it's Friday
  if (dayOfWeek !== DIGID.RELEASE_DAY_OF_WEEK) {
    return false;
  }

  // Check if we're within any release window
  for (const window of DIGID.RELEASE_WINDOWS) {
    const windowStart = window.hour * 60 + window.minute;
    const windowEnd = windowStart + DIGID.AGGRESSIVE_POLL_DURATION_MINUTES;
    const currentMinutes = hour * 60 + minute;

    if (currentMinutes >= windowStart && currentMinutes < windowEnd) {
      return true;
    }
  }

  return false;
}

/**
 * Gets minutes until the next release window
 * Returns 0 if currently in a window
 */
export function getMinutesUntilNextRelease(): number {
  if (isInReleaseWindow()) {
    return 0;
  }

  const amsterdamTime = getAmsterdamTime();
  const dayOfWeek = amsterdamTime.getDay();
  const hour = amsterdamTime.getHours();
  const minute = amsterdamTime.getMinutes();
  const currentMinutes = hour * 60 + minute;

  // Days until Friday
  let daysUntilFriday = (DIGID.RELEASE_DAY_OF_WEEK - dayOfWeek + 7) % 7;
  if (daysUntilFriday === 0) {
    // It's Friday, check if windows have passed
    const lastWindow = DIGID.RELEASE_WINDOWS[DIGID.RELEASE_WINDOWS.length - 1];
    const lastWindowEnd = lastWindow.hour * 60 + lastWindow.minute + DIGID.AGGRESSIVE_POLL_DURATION_MINUTES;

    if (currentMinutes >= lastWindowEnd) {
      // All windows passed, wait for next Friday
      daysUntilFriday = 7;
    }
  }

  if (daysUntilFriday === 0) {
    // It's Friday and windows haven't all passed yet
    // Find the next window
    for (const window of DIGID.RELEASE_WINDOWS) {
      const windowStart = window.hour * 60 + window.minute;
      if (currentMinutes < windowStart) {
        return windowStart - currentMinutes;
      }
    }
  }

  // Calculate minutes until first window on the target Friday
  const firstWindow = DIGID.RELEASE_WINDOWS[0];
  const minutesInDay = 24 * 60;
  const minutesUntilMidnight = minutesInDay - currentMinutes;
  const minutesFromMidnightToWindow = firstWindow.hour * 60 + firstWindow.minute;

  return minutesUntilMidnight + ((daysUntilFriday - 1) * minutesInDay) + minutesFromMidnightToWindow;
}

/**
 * Gets a human-readable string for the next release window
 */
export function getNextReleaseWindowString(): string {
  const minutes = getMinutesUntilNextRelease();

  if (minutes === 0) {
    return 'Release window is open NOW!';
  }

  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;

  if (days > 0) {
    return `${days}d ${remainingHours}h ${remainingMinutes}m until next release`;
  } else if (hours > 0) {
    return `${hours}h ${remainingMinutes}m until next release`;
  } else {
    return `${remainingMinutes}m until next release`;
  }
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetches available DigiD video call appointments
 *
 * @param persons - Number of persons for the appointment (1-6)
 * @param daysAhead - Number of days ahead to check (default from DIGID.DAYS_AHEAD)
 * @returns Array of available appointments
 */
export async function fetchDigiDAppointments(
  persons: number = 1,
  daysAhead: number = DIGID.DAYS_AHEAD
): Promise<DigiDAppointment[]> {
  const appointments: DigiDAppointment[] = [];

  try {
    const inReleaseWindow = isInReleaseWindow();
    console.log(`[DIGID API] Fetching appointments for ${persons} person(s), ${daysAhead} days ahead`);
    console.log(`[DIGID API] In release window: ${inReleaseWindow} (${getNextReleaseWindowString()})`);

    // Step 1: Initialize session by fetching the main page
    // This gets us cookies AND the __RequestVerificationToken needed for API calls
    const sessionResponse = await fetch(DIGID.BASE_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
      },
    });

    if (!sessionResponse.ok) {
      console.error(`[DIGID API] Failed to initialize session: ${sessionResponse.status}`);
      return [];
    }

    // Extract cookies from response for subsequent requests
    const cookies = sessionResponse.headers.get('set-cookie') || '';

    // Extract CSRF token from the page HTML
    const pageHtml = await sessionResponse.text();
    const tokenMatch = pageHtml.match(/__RequestVerificationToken.*?value="([^"]+)"/);
    const csrfToken = tokenMatch ? tokenMatch[1] : null;

    if (!csrfToken) {
      console.error('[DIGID API] Failed to extract CSRF token from page');
      return [];
    }

    console.log('[DIGID API] Session initialized, CSRF token obtained');

    // Step 2: Iterate through dates and fetch available time slots
    const now = new Date();
    const seenKeys = new Set<string>();

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + dayOffset);

      // Format date as DD-MM-YYYY (Dutch format expected by the API)
      const day = String(checkDate.getDate()).padStart(2, '0');
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      const year = checkDate.getFullYear();
      const dateStr = `${day}-${month}-${year}`;

      try {
        const timeSlotsUrl = `${DIGID.BASE_URL}/Appointment/GetTimeSlotsOnDate`;
        const formData = new URLSearchParams();
        formData.append('date', dateStr);
        formData.append('productCount', String(persons));
        formData.append('LanguageId', '1');
        formData.append('__RequestVerificationToken', csrfToken);

        const timeSlotsResponse = await fetch(timeSlotsUrl, {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies,
            'Referer': DIGID.BASE_URL,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: formData.toString(),
        });

        if (timeSlotsResponse.ok) {
          const responseText = await timeSlotsResponse.text();

          // Check if we got an error page (common when no slots available or session issues)
          if (responseText.includes('Foutmelding') || responseText.includes('error.png')) {
            // This is likely "no appointments" or a session issue, not a parsing error
            // Only log on first occurrence to avoid spam
            if (dayOffset === 0) {
              console.log(`[DIGID API] Received error page - likely no appointments available for ${persons} person(s)`);
            }
            continue;
          }

          // Parse the response - it could be JSON or HTML with time slots
          const slots = parseTimeSlotsResponse(responseText, checkDate);

          for (const slot of slots) {
            const key = `DIGID_${slot.date}_${slot.startTime}_P${persons}`;

            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              appointments.push({
                key,
                date: slot.date,
                startTime: slot.startTime,
                endTime: slot.endTime,
                parts: 1,
              });
            }
          }
        }

        // Rate limiting - don't overwhelm the API
        await new Promise(resolve => setTimeout(resolve, DIGID.API_DELAY_MS));

      } catch (dateError) {
        console.error(`[DIGID API] Error fetching date ${dateStr}:`, dateError);
      }
    }

    console.log(`[DIGID API] Found ${appointments.length} total appointments`);
    return appointments;

  } catch (error) {
    console.error('[DIGID API] Error fetching appointments:', error);
    return [];
  }
}

/**
 * Parse the time slots response from the API
 * The response can be HTML with available time slot buttons or JSON
 */
function parseTimeSlotsResponse(
  responseText: string,
  date: Date
): Array<{ date: string; startTime: string; endTime: string }> {
  const slots: Array<{ date: string; startTime: string; endTime: string }> = [];

  try {
    // Format date as YYYY-MM-DD for our internal format
    const dateStr = date.toISOString().split('T')[0];

    // Try parsing as JSON first
    try {
      const jsonData = JSON.parse(responseText);

      if (Array.isArray(jsonData)) {
        for (const slot of jsonData) {
          if (slot.available || slot.Available) {
            const time = slot.time || slot.Time || slot.startTime || slot.StartTime;
            if (time) {
              const startTime = normalizeTime(time);
              const endTime = calculateEndTime(startTime, 15); // Assume 15-minute slots

              slots.push({ date: dateStr, startTime, endTime });
            }
          }
        }
        return slots;
      }

      if (jsonData.slots || jsonData.Slots || jsonData.timeSlots) {
        const slotArray = jsonData.slots || jsonData.Slots || jsonData.timeSlots;
        for (const slot of slotArray) {
          const time = slot.time || slot.Time || slot.startTime || slot.StartTime;
          if (time && (slot.available !== false && slot.Available !== false)) {
            const startTime = normalizeTime(time);
            const endTime = calculateEndTime(startTime, 15);

            slots.push({ date: dateStr, startTime, endTime });
          }
        }
        return slots;
      }
    } catch {
      // Not valid JSON, try HTML parsing
    }

    // Parse as HTML - look for time slot elements
    // Common patterns: buttons with time, data attributes, select options

    // Pattern 1: Buttons or links with time in text content
    // Example: <button>09:00</button> or <a href="#">10:30</a>
    const timePattern = /(?:<button[^>]*>|<a[^>]*>|<option[^>]*>|<span[^>]*class="[^"]*time[^"]*"[^>]*>)\s*(\d{1,2})[:\.](\d{2})\s*(?:<\/button>|<\/a>|<\/option>|<\/span>)/gi;
    let match;

    while ((match = timePattern.exec(responseText)) !== null) {
      const hour = String(parseInt(match[1], 10)).padStart(2, '0');
      const minute = match[2];
      const startTime = `${hour}:${minute}`;
      const endTime = calculateEndTime(startTime, 15);

      slots.push({ date: dateStr, startTime, endTime });
    }

    // Pattern 2: Data attributes with times
    // Example: data-time="09:00" or data-start="1704715200"
    const dataTimePattern = /data-(?:time|start-time|slot)="(\d{1,2}:\d{2})"/gi;
    while ((match = dataTimePattern.exec(responseText)) !== null) {
      const startTime = normalizeTime(match[1]);
      const endTime = calculateEndTime(startTime, 15);

      slots.push({ date: dateStr, startTime, endTime });
    }

    // Pattern 3: Unix timestamps in data-start attributes
    const timestampPattern = /data-start="(\d{10,13})"/gi;
    while ((match = timestampPattern.exec(responseText)) !== null) {
      let timestamp = parseInt(match[1], 10);
      // Convert from milliseconds if necessary
      if (timestamp > 9999999999) {
        timestamp = Math.floor(timestamp / 1000);
      }

      const slotDate = new Date(timestamp * 1000);
      const slotDateStr = slotDate.toISOString().split('T')[0];

      // Only include if it matches the expected date
      if (slotDateStr === dateStr) {
        const startTime = `${String(slotDate.getHours()).padStart(2, '0')}:${String(slotDate.getMinutes()).padStart(2, '0')}`;
        const endTime = calculateEndTime(startTime, 15);

        slots.push({ date: dateStr, startTime, endTime });
      }
    }

    // Remove duplicates
    const uniqueSlots = new Map<string, typeof slots[0]>();
    for (const slot of slots) {
      const key = `${slot.date}_${slot.startTime}`;
      if (!uniqueSlots.has(key)) {
        uniqueSlots.set(key, slot);
      }
    }

    return Array.from(uniqueSlots.values());

  } catch (error) {
    console.error('[DIGID API] Error parsing time slots:', error);
    return [];
  }
}

/**
 * Normalize time string to HH:MM format
 */
function normalizeTime(time: string): string {
  const parts = time.replace('.', ':').split(':');
  const hour = String(parseInt(parts[0], 10)).padStart(2, '0');
  const minute = String(parseInt(parts[1] || '0', 10)).padStart(2, '0');
  return `${hour}:${minute}`;
}

/**
 * Calculate end time given start time and duration in minutes
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
}

// =============================================================================
// ENRICHMENT
// =============================================================================

/**
 * Enriches DigiD appointments with metadata for database storage
 */
export function enrichDigiDAppointments(
  appointments: DigiDAppointment[],
  persons: number
): DigiDAppointmentWithMetadata[] {
  return appointments.map(appt => ({
    ...appt,
    appointmentType: 'DGD',
    location: 'DIGID_VC',
    locationName: 'DigiD Video Call (Online)',
    appointmentTypeName: 'DigiD Video Call Activation',
    persons,
  }));
}

/**
 * Fetches and enriches DigiD appointments for all person counts
 */
export async function fetchAllDigiDAppointments(): Promise<DigiDAppointmentWithMetadata[]> {
  const allAppointments: DigiDAppointmentWithMetadata[] = [];

  for (let persons = 1; persons <= DIGID.MAX_PERSONS; persons++) {
    try {
      const appointments = await fetchDigiDAppointments(persons);
      const enriched = enrichDigiDAppointments(appointments, persons);
      allAppointments.push(...enriched);

      // Delay between person counts to avoid overwhelming the API
      if (persons < DIGID.MAX_PERSONS) {
        await new Promise(resolve => setTimeout(resolve, DIGID.API_DELAY_MS));
      }
    } catch (error) {
      console.error(`[DIGID API] Error fetching for ${persons} person(s):`, error);
    }
  }

  console.log(`[DIGID API] Total enriched appointments: ${allAppointments.length}`);
  return allAppointments;
}
