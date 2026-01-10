// IND API Service - TypeScript version of the Python scraper

export interface INDAppointment {
  key: string;
  date: string;
  startTime: string;
  endTime: string;
  parts: number;
}

export interface INDAppointmentWithMetadata extends INDAppointment {
  appointmentType: string;
  location: string;
  locationName: string;
  appointmentTypeName: string;
  persons: number;
}

// Appointment type configurations with their available locations
export const APPOINTMENT_TYPE_CONFIG = {
  DOC: {
    name: 'Document Collection',
    fullName: 'Document collection - residence document or registration card or original document',
    availableLocations: ['AM', 'DH', 'DEN_L14', 'ZW', 'MAA', 'GO']
  },
  BIO: {
    name: 'Biometrics',
    fullName: 'Biometric information (passport photo, fingerprints and signature)',
    availableLocations: ['AM', 'DH', 'HAA', 'DEN_M222', 'ZW', 'EXP_EN', 'EXP_UT', 'MAA', 'GO']
  },
  VAA: {
    name: 'Residence Endorsement Sticker',
    fullName: 'Residence endorsement sticker',
    availableLocations: ['AM', 'DH', 'DEN_L14', 'ZW', 'EXP_UT', 'MAA', 'GO']
  },
  TKV: {
    name: 'Return Visa',
    fullName: 'Return visa (TKV)',
    availableLocations: ['AM', 'DH', 'DEN_L14', 'ZW', 'EXP_UT', 'MAA', 'GO']
  },
  UKR: {
    name: 'Ukraine Proof of Residency',
    fullName: 'Ukraine: appointment proof of residency',
    availableLocations: ['AM_UKR']
  },
  FAM: {
    name: 'Family Reunification',
    fullName: 'Family Reunification Asylum',
    availableLocations: ['AM', 'DH', 'DEN_L14', 'DEN_M222', 'ZW']
  },
  DGD: {
    name: 'DigiD Video Call',
    fullName: 'DigiD Video Call Activation',
    availableLocations: ['DIGID_VC']
  }
} as const;

export const APPOINTMENT_TYPES = {
  DOC: 'Document Collection',
  BIO: 'Biometrics',
  VAA: 'Residence Endorsement Sticker',
  TKV: 'Return Visa',
  UKR: 'Ukraine Proof of Residency',
  FAM: 'Family Reunification',
  DGD: 'DigiD Video Call'
} as const;

export const LOCATIONS = {
  AM: 'Amsterdam',
  DH: 'Den Haag',
  HAA: 'Haarlem',
  DEN_L14: 's-Hertogenbosch (L14)',
  DEN_M222: 's-Hertogenbosch (M222)',
  ZW: 'Zwolle',
  EXP_EN: 'Enschede',
  EXP_UT: 'Utrecht',
  MAA: 'Maastricht',
  GO: 'Goes',
  AM_UKR: 'Amsterdam (Ukraine)'
} as const;

export type AppointmentType = keyof typeof APPOINTMENT_TYPES;
export type Location = keyof typeof LOCATIONS;

/**
 * Fetches appointments from the IND API
 * @param appointmentType - The type of appointment (BIO, DOC, VAA)
 * @param location - The location code (AM, DH, ZW, etc.)
 * @param persons - Number of persons (default: 1)
 * @returns Array of appointments
 */
export async function fetchINDAppointments(
  appointmentType: AppointmentType,
  location: Location,
  persons: number = 1
): Promise<INDAppointment[]> {
  const baseUrl = process.env.IND_API_BASE_URL || 'https://oap.ind.nl/oap/api';
  const url = `${baseUrl}/desks/${location}/slots?productKey=${appointmentType}&persons=${persons}`;

  try {
    console.log(`[IND API] Fetching appointments: ${appointmentType} at ${location} for ${persons} person(s)`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[IND API] HTTP error! status: ${response.status}`);
      return [];
    }

    const text = await response.text();

    // The IND API returns data with a security prefix ")]}'"
    // We need to remove it before parsing
    const jsonText = text.startsWith(')]}\'') ? text.substring(5) : text;

    const data = JSON.parse(jsonText);

    if (data && Array.isArray(data.data)) {
      console.log(`[IND API] Found ${data.data.length} appointments`);
      return data.data.map((appt: any) => ({
        key: appt.key,
        date: appt.date,
        startTime: appt.startTime,
        endTime: appt.endTime,
        parts: appt.parts || 1
      }));
    }

    console.log('[IND API] No appointments found in response');
    return [];
  } catch (error) {
    console.error(`[IND API] Error fetching appointments:`, error);
    return [];
  }
}

/**
 * Adds metadata to appointments
 */
export function enrichAppointments(
  appointments: INDAppointment[],
  appointmentType: AppointmentType,
  location: Location,
  persons: number
): INDAppointmentWithMetadata[] {
  return appointments.map(appt => ({
    ...appt,
    appointmentType,
    location,
    locationName: LOCATIONS[location],
    appointmentTypeName: APPOINTMENT_TYPES[appointmentType],
    persons
  }));
}

/**
 * Filters appointments to only include those within the next N days
 */
export function filterAppointmentsByDaysAhead(
  appointments: INDAppointmentWithMetadata[],
  daysAhead: number
): INDAppointmentWithMetadata[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return appointments.filter(appt => {
    const apptDate = new Date(appt.date);
    apptDate.setHours(0, 0, 0, 0);
    return apptDate >= now && apptDate <= futureDate;
  });
}

/**
 * Checks if an appointment already exists in the database
 */
export function isNewAppointment(
  appointment: INDAppointmentWithMetadata,
  existingAppointments: INDAppointmentWithMetadata[]
): boolean {
  return !existingAppointments.some(existing => existing.key === appointment.key);
}

/**
 * Generates a unique key for an appointment
 */
export function generateAppointmentKey(
  date: string,
  startTime: string,
  location: string,
  appointmentType: string
): string {
  return `${date}_${startTime}_${location}_${appointmentType}`;
}

/**
 * Get all valid appointment type and location combinations
 * Only returns combinations that are actually supported by IND
 */
export function getAllValidCombinations(): { appointmentType: AppointmentType; location: Location; persons: number }[] {
  const combinations: { appointmentType: AppointmentType; location: Location; persons: number }[] = [];
  const personCounts = [1, 2, 3, 4, 5, 6];

  // Iterate through each appointment type
  for (const [typeKey, config] of Object.entries(APPOINTMENT_TYPE_CONFIG)) {
    const appointmentType = typeKey as AppointmentType;

    // For each available location for this appointment type
    for (const location of config.availableLocations) {
      // For each person count
      for (const persons of personCounts) {
        combinations.push({
          appointmentType,
          location: location as Location,
          persons
        });
      }
    }
  }

  return combinations;
}

/**
 * Check if a combination is valid according to IND rules
 */
export function isValidCombination(appointmentType: AppointmentType, location: Location): boolean {
  const config = APPOINTMENT_TYPE_CONFIG[appointmentType];
  return config && (config.availableLocations as readonly string[]).includes(location);
}
