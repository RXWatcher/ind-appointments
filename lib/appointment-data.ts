/**
 * IND Appointment Types and Locations Data
 * Based on official IND website: https://ind.nl/en/service-contact/make-an-appointment-with-the-ind
 */

export interface AppointmentType {
  value: string;
  label: string;
  fullName: string;
  bookingUrl: string;
  description: string;
  availableLocations: string[];
}

export interface Location {
  value: string;
  label: string;
  fullName: string;
  address?: string;
}

export const APPOINTMENT_TYPES: AppointmentType[] = [
  {
    value: 'DOC',
    label: 'Document Collection',
    fullName: 'Document collection - residence document or registration card or original document',
    bookingUrl: 'https://oap.ind.nl/oap/en/#/doc',
    description: 'Collect your residence permit, original document, statelessness document (S-document) or EU registration card',
    availableLocations: ['AM', 'DH', 'DEN_L14', 'ZW', 'MAA', 'GO']
  },
  {
    value: 'BIO',
    label: 'Biometrics',
    fullName: 'Biometric information (passport photo, fingerprints and signature)',
    bookingUrl: 'https://oap.ind.nl/oap/en/#/bio',
    description: 'Have your photo, signature and fingerprints taken for your residence document',
    availableLocations: ['AM', 'DH', 'HAA', 'DEN_M222', 'ZW', 'EXP_EN', 'EXP_UT', 'MAA', 'GO']
  },
  {
    value: 'VAA',
    label: 'Residence Endorsement Sticker',
    fullName: 'Residence endorsement sticker',
    bookingUrl: 'https://oap.ind.nl/oap/en/#/vaa',
    description: 'Apply for a sticker as proof that you are allowed to await your procedure in the Netherlands',
    availableLocations: ['AM', 'DH', 'DEN_L14', 'ZW', 'EXP_UT', 'MAA', 'GO']
  },
  {
    value: 'TKV',
    label: 'Return Visa',
    fullName: 'Return visa (TKV)',
    bookingUrl: 'https://oap.ind.nl/oap/en/#/tkv',
    description: 'Apply for a return visa to return to the Netherlands when traveling abroad',
    availableLocations: ['AM', 'DH', 'DEN_L14', 'ZW', 'EXP_UT', 'MAA', 'GO']
  },
  {
    value: 'UKR',
    label: 'Ukraine Proof of Residency',
    fullName: 'Ukraine: appointment proof of residency',
    bookingUrl: 'https://oap.ind.nl/oap/en/#/ukr',
    description: 'For Ukrainian refugees: appointment for sticker or card',
    availableLocations: ['AM_UKR']
  },
  {
    value: 'FAM',
    label: 'Family Reunification',
    fullName: 'Family Reunification Asylum',
    bookingUrl: 'https://oap.ind.nl/oap/en/#/fam',
    description: 'Registration of traveling family member at the IND desk',
    availableLocations: ['AM', 'DH', 'DEN_L14', 'DEN_M222', 'ZW']
  }
];

export const LOCATIONS: Location[] = [
  {
    value: 'AM',
    label: 'Amsterdam',
    fullName: 'IND Amsterdam'
  },
  {
    value: 'DH',
    label: 'Den Haag',
    fullName: 'IND Den Haag'
  },
  {
    value: 'HAA',
    label: 'Haarlem',
    fullName: 'IND Haarlem'
  },
  {
    value: 'DEN_L14',
    label: 's-Hertogenbosch (L14)',
    fullName: "IND 's-Hertogenbosch Leeghwaterlaan 14"
  },
  {
    value: 'DEN_M222',
    label: 's-Hertogenbosch (M222)',
    fullName: "IND 's-Hertogenbosch Magistratenlaan 222"
  },
  {
    value: 'ZW',
    label: 'Zwolle',
    fullName: 'IND Zwolle'
  },
  {
    value: 'EXP_EN',
    label: 'Enschede',
    fullName: 'Expatcenter Enschede'
  },
  {
    value: 'EXP_UT',
    label: 'Utrecht',
    fullName: 'Expatcenter Utrecht'
  },
  {
    value: 'MAA',
    label: 'Maastricht',
    fullName: 'Expat Centre Maastricht',
    address: 'For residents of Limburg province'
  },
  {
    value: 'GO',
    label: 'Goes',
    fullName: 'IND Service Point Goes',
    address: 'For residents of Zeeland or Brabantse Wal'
  },
  {
    value: 'AM_UKR',
    label: 'Amsterdam (Ukraine)',
    fullName: 'IND Amsterdam Ukraine',
    address: 'Gatwickstraat 1, Amsterdam - Specifically for Ukrainian refugees'
  },
  {
    value: 'THIC',
    label: 'The Hague International Centre',
    fullName: 'The Hague International Centre',
    address: 'Appointments for biometrics, document collection, and BSN registration'
  },
  {
    value: 'RIC',
    label: 'Rotterdam International Center',
    fullName: 'Rotterdam International Center',
    address: 'Appointments for biometrics, document collection, and BSN registration'
  }
];

// Helper function to get appointment type by value
export function getAppointmentType(value: string): AppointmentType | undefined {
  return APPOINTMENT_TYPES.find(type => type.value === value);
}

// Helper function to get location by value
export function getLocation(value: string): Location | undefined {
  return LOCATIONS.find(loc => loc.value === value);
}

// Helper function to get available locations for an appointment type
export function getAvailableLocations(appointmentType: string): Location[] {
  const type = getAppointmentType(appointmentType);
  if (!type) return [];

  return LOCATIONS.filter(loc => type.availableLocations.includes(loc.value));
}

// Helper function to check if a location is available for an appointment type
export function isLocationAvailable(appointmentType: string, location: string): boolean {
  const type = getAppointmentType(appointmentType);
  if (!type) return false;

  return type.availableLocations.includes(location);
}
