// Expat Centers API Services - Scrapers for international/expat centers
import { INDAppointment, INDAppointmentWithMetadata } from '@/lib/ind-api';

// Source identifiers
export const APPOINTMENT_SOURCES = {
  IND: 'IND',
  THE_HAGUE_IC: 'THE_HAGUE_IC',
  ROTTERDAM_IC: 'ROTTERDAM_IC',
  DIGID: 'DIGID'
} as const;

export type AppointmentSource = keyof typeof APPOINTMENT_SOURCES;

// Extended appointment types for expat centers
export const EXPAT_CENTER_APPOINTMENT_TYPES = {
  // The Hague International Centre types
  THIC_BIO: 'Biometrics',
  THIC_DOC: 'Document Collection',
  THIC_BSN: 'BSN Registration',
  THIC_CERT: 'Certificate Registration',

  // Rotterdam International Center types
  RIC_BIO: 'Biometrics',
  RIC_DOC: 'Residence Permit Collection',
  RIC_BSN: 'BSN Registration',
  RIC_BSN_IND: 'BSN + IND Combined'
} as const;

export const EXPAT_CENTER_LOCATIONS = {
  THIC: 'The Hague International Centre',
  RIC: 'Rotterdam International Center'
} as const;

export type ExpatCenterAppointmentType = keyof typeof EXPAT_CENTER_APPOINTMENT_TYPES;
export type ExpatCenterLocation = keyof typeof EXPAT_CENTER_LOCATIONS;

/**
 * Fetches appointments from The Hague International Centre
 * API: /timepicker endpoint returns HTML with availability
 */
export async function fetchTheHagueICAppointments(
  appointmentType: 'pickup' | 'combined' | 'certificate' | 'municipal',
  personCount: number = 1,
  certificateCount: number = 1,
  weeksAhead: number = 6
): Promise<INDAppointment[]> {
  try {
    console.log(`[THE HAGUE IC] Fetching appointments: ${appointmentType} for ${personCount} person(s), ${weeksAhead} weeks ahead`);

    const allAppointments: INDAppointment[] = [];
    const now = Date.now();

    // Fetch appointments for multiple weeks ahead
    for (let week = 0; week < weeksAhead; week++) {
      const weekOffset = week * 7 * 24 * 60 * 60 * 1000; // milliseconds per week
      const startDate = Math.floor((now + weekOffset) / 1000); // Convert to seconds
      const combinedParam = appointmentType === 'combined' ? 'true' : 'false';
      const url = `https://appointment.thehagueinternationalcentre.nl/timepicker?personCount=${personCount}&startDate=${startDate}&combined=${combinedParam}&type=${appointmentType}&certificateCount=${certificateCount}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
          },
        });

        if (!response.ok) {
          console.error(`[THE HAGUE IC] HTTP error for week ${week}! status: ${response.status}`);
          continue;
        }

        const html = await response.text();
        const appointments = parseTheHagueICHTML(html, appointmentType, personCount);
        allAppointments.push(...appointments);

        console.log(`[THE HAGUE IC] Week ${week}: Found ${appointments.length} appointments`);

        // Rate limiting: wait 500ms between requests
        if (week < weeksAhead - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (weekError) {
        console.error(`[THE HAGUE IC] Error fetching week ${week}:`, weekError);
      }
    }

    console.log(`[THE HAGUE IC] Total found: ${allAppointments.length} appointments across ${weeksAhead} weeks`);
    return allAppointments;
  } catch (error) {
    console.error(`[THE HAGUE IC] Error fetching appointments:`, error);
    return [];
  }
}

/**
 * Parse The Hague IC HTML response to extract appointments
 * HTML contains buttons with data-start timestamps: <button data-start="1762329600" aria-label="Select Wednesday 5th November at 9 00 am">
 */
function parseTheHagueICHTML(html: string, appointmentType: string, personCount: number = 1): INDAppointment[] {
  const appointments: INDAppointment[] = [];

  try {
    // Extract all appointment buttons with data-start timestamps
    // Pattern: <button ...data-start="timestamp"...aria-label="Select DayOfWeek Date Month at Time">
    const buttonRegex = /<button[^>]*data-start="(\d+)"[^>]*aria-label="Select[^"]*?(\d+)(?:st|nd|rd|th)\s+(\w+)\s+at\s+(\d+)\s+(\d+)\s*(\w+)"[^>]*>/g;
    let match;
    const seenKeys = new Set<string>();

    while ((match = buttonRegex.exec(html)) !== null) {
      const timestamp = parseInt(match[1], 10);
      const day = match[2];
      const month = match[3];
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      const period = match[6]; // am/pm

      // Convert timestamp to date
      const date = new Date(timestamp * 1000);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      // Convert 12-hour to 24-hour format
      let hour24 = hour;
      if (period.toLowerCase() === 'pm' && hour !== 12) {
        hour24 = hour + 12;
      } else if (period.toLowerCase() === 'am' && hour === 12) {
        hour24 = 0;
      }

      const startTime = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      // Assume 10-minute slots based on the calendar layout
      const endMinute = minute + 10;
      const endHour24 = endMinute >= 60 ? hour24 + 1 : hour24;
      const endTime = `${String(endHour24).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`;

      const key = `THIC_${dateStr}_${startTime}_${appointmentType}_P${personCount}`;

      // Avoid duplicates (buttons appear twice in HTML for mobile/desktop)
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        appointments.push({
          key,
          date: dateStr,
          startTime,
          endTime,
          parts: 1
        });
      }
    }

    return appointments;
  } catch (error) {
    console.error('[THE HAGUE IC] Error parsing HTML:', error);
    return [];
  }
}

/**
 * Fetches appointments from Rotterdam International Center (TIMEBLOCKR API)
 */
export async function fetchRotterdamICAppointments(
  productId: string = process.env.TIMEBLOCKR_PRODUCT_ID || '' // IND: Providing biometrics
): Promise<INDAppointment[]> {
  try {
    console.log(`[ROTTERDAM IC] Fetching appointments for product: ${productId}`);

    const apiKey = process.env.TIMEBLOCKR_API_KEY || '';
    const apiBase = process.env.TIMEBLOCKR_API_BASE || 'https://10338.api.timeblockr.cloud/v2';

    if (!apiKey) {
      console.warn('[ROTTERDAM IC] TIMEBLOCKR_API_KEY not set, skipping');
      return [];
    }

    // Step 1: Get available resource items (IND service providers)
    const resourcesUrl = `${apiBase}/resourceitems?locationfilter=${productId}&attendanceType=1&full=false`;
    const resourcesResponse = await fetch(resourcesUrl, {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      }
    });

    if (!resourcesResponse.ok) {
      console.error(`[ROTTERDAM IC] HTTP error! status: ${resourcesResponse.status}`);
      return [];
    }

    const resources = await resourcesResponse.json();

    // Step 2: For each resource, fetch available time slots
    // Get slots for the next 60 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 60);

    const appointments: INDAppointment[] = [];

    // Get IND resource items
    const indResources = resources.filter((r: any) =>
      r.ResourceItemTypes.some((t: any) => t.Name.includes('IND'))
    );

    console.log(`[ROTTERDAM IC] Found ${indResources.length} IND service providers`);

    for (const resource of indResources) {
      try {
        // Fetch slots for this resource
        const slotsUrl = `${apiBase}/slots/${resource.Guid}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        const slotsResponse = await fetch(slotsUrl, {
          headers: {
            'api-key': apiKey,
            'Accept': 'application/json',
          }
        });

        if (slotsResponse.ok) {
          const slots = await slotsResponse.json();

          if (Array.isArray(slots)) {
            for (const slot of slots) {
              if (slot.Available) {
                const startDateTime = new Date(slot.Start);
                const endDateTime = new Date(slot.End);

                const date = startDateTime.toISOString().split('T')[0];
                const startTime = startDateTime.toTimeString().substring(0, 5);
                const endTime = endDateTime.toTimeString().substring(0, 5);

                appointments.push({
                  key: `RIC_${date}_${startTime}_${resource.Name}`,
                  date,
                  startTime,
                  endTime,
                  parts: 1
                });
              }
            }
          }
        }

        // Rate limiting - don't overwhelm the API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[ROTTERDAM IC] Error fetching slots for resource ${resource.Name}:`, error);
      }
    }

    console.log(`[ROTTERDAM IC] Found ${appointments.length} appointments`);
    return appointments;
  } catch (error) {
    console.error(`[ROTTERDAM IC] Error fetching appointments:`, error);
    return [];
  }
}

/**
 * Map expat center appointments to enriched format
 */
export function enrichExpatCenterAppointments(
  appointments: INDAppointment[],
  source: AppointmentSource,
  appointmentTypeName: string,
  locationName: string,
  persons: number = 1
): INDAppointmentWithMetadata[] {
  // Map to IND-compatible appointment type for consistency
  let indType = 'BIO'; // Default to biometrics

  if (appointmentTypeName.includes('Document') || appointmentTypeName.includes('Permit')) {
    indType = 'DOC';
  }

  // Map to IND-compatible location code
  const locationCode = source === 'THE_HAGUE_IC' ? 'THIC' : 'RIC';

  return appointments.map(appt => ({
    ...appt,
    appointmentType: indType,
    location: locationCode,
    locationName: locationName,
    appointmentTypeName: appointmentTypeName,
    persons: persons
  }));
}

/**
 * Generate book now URLs for expat centers
 */
export function generateBookNowURL(
  source: AppointmentSource,
  appointmentType: string,
  date: string,
  startTime: string
): string {
  if (source === 'THE_HAGUE_IC') {
    // The Hague IC booking URL
    return 'https://appointment.thehagueinternationalcentre.nl/';
  } else if (source === 'ROTTERDAM_IC') {
    // Rotterdam IC booking URL
    return 'https://www.rotterdam.info/en/internationals/appointment';
  } else if (source === 'DIGID') {
    // DigiD video call booking URL
    return 'https://digidafspraak.nederlandwereldwijd.nl/';
  }

  // Default IND booking
  return `https://oap.ind.nl/oap/en/#/${appointmentType.toLowerCase()}`;
}
