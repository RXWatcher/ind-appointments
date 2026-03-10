// Shared query utilities to prevent code duplication

import { db } from './database';
import { PAGINATION, SCRAPING } from './constants';
import type {
  AppointmentRow,
  AppointmentFilters,
  PaginationParams,
  PaginatedResponse,
} from './types';

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

/**
 * Parse and validate pagination parameters from request
 */
export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const page = Math.max(
    PAGINATION.DEFAULT_PAGE,
    parseInt(searchParams.get('page') || String(PAGINATION.DEFAULT_PAGE), 10)
  );

  let pageSize = parseInt(
    searchParams.get('pageSize') || String(PAGINATION.DEFAULT_PAGE_SIZE),
    10
  );

  // Clamp page size to valid range
  pageSize = Math.max(1, Math.min(pageSize, PAGINATION.MAX_PAGE_SIZE));

  return { page, pageSize };
}

/**
 * Create paginated response wrapper
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pagination.pageSize);

  return {
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
  };
}

// =============================================================================
// APPOINTMENT QUERY BUILDERS
// =============================================================================

interface QueryResult {
  sql: string;
  params: (string | number)[];
}

// Whitelist of allowed select fields to prevent SQL injection
const ALLOWED_SELECT_FIELDS = new Set([
  '*',
  'id',
  'appointment_key',
  'date',
  'start_time',
  'end_time',
  'appointment_type',
  'location',
  'location_name',
  'appointment_type_name',
  'persons',
  'parts',
  'source',
  'first_seen_at',
  'last_seen_at',
  'is_available',
  'COUNT(*) as total',
]);

// Whitelist of allowed order by clauses to prevent SQL injection
const ALLOWED_ORDER_BY = new Set([
  'date ASC',
  'date DESC',
  'date ASC, start_time ASC',
  'date ASC, start_time DESC',
  'date DESC, start_time ASC',
  'date DESC, start_time DESC',
  'start_time ASC',
  'start_time DESC',
  'first_seen_at ASC',
  'first_seen_at DESC',
  'last_seen_at ASC',
  'last_seen_at DESC',
  'location ASC',
  'location DESC',
  'appointment_type ASC',
  'appointment_type DESC',
]);

// Absolute maximum limit to prevent OOM
const ABSOLUTE_MAX_LIMIT = 10000;

/**
 * Validate select fields to prevent SQL injection
 * Only allows whitelisted field combinations
 */
function validateSelectFields(fields: string): string {
  // Normalize whitespace
  const normalized = fields.trim().replace(/\s+/g, ' ');

  // Check if it's a single allowed field
  if (ALLOWED_SELECT_FIELDS.has(normalized)) {
    return normalized;
  }

  // Check if it's a comma-separated list of allowed fields
  const fieldList = normalized.split(',').map(f => f.trim());
  const allValid = fieldList.every(field => {
    // Allow field with optional alias (e.g., "date", "COUNT(*) as total")
    const baseField = field.split(' as ')[0].trim();
    return ALLOWED_SELECT_FIELDS.has(field) || ALLOWED_SELECT_FIELDS.has(baseField);
  });

  if (allValid) {
    return normalized;
  }

  // Default to safe fallback
  console.warn(`[QUERY] Invalid selectFields rejected: "${fields}"`);
  return '*';
}

/**
 * Validate order by clause to prevent SQL injection
 * Only allows whitelisted order combinations
 */
function validateOrderBy(orderBy: string): string {
  const normalized = orderBy.trim().replace(/\s+/g, ' ');

  if (ALLOWED_ORDER_BY.has(normalized)) {
    return normalized;
  }

  // Default to safe fallback
  console.warn(`[QUERY] Invalid orderBy rejected: "${orderBy}"`);
  return 'date ASC, start_time ASC';
}

/**
 * Build appointment query with filters
 * Prevents SQL injection by using parameterized queries and whitelisted values
 */
export function buildAppointmentQuery(
  filters: AppointmentFilters,
  options: {
    selectFields?: string;
    includeUnavailable?: boolean;
    orderBy?: string;
    limit?: number;
    offset?: number;
  } = {}
): QueryResult {
  const {
    selectFields = '*',
    includeUnavailable = false,
    orderBy = 'date ASC, start_time ASC',
    limit,
    offset,
  } = options;

  // Validate and sanitize selectFields and orderBy to prevent injection
  const safeSelectFields = validateSelectFields(selectFields);
  const safeOrderBy = validateOrderBy(orderBy);

  // Enforce maximum limit to prevent OOM
  const safeLimit = limit !== undefined ? Math.min(limit, ABSOLUTE_MAX_LIMIT) : undefined;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Base availability check
  if (!includeUnavailable) {
    conditions.push('is_available = 1');
    conditions.push(`(
      date > date('now', 'localtime')
      OR (date = date('now', 'localtime') AND start_time > time('now', 'localtime'))
    )`);
  }

  // Appointment type filter
  if (filters.appointmentType) {
    // Handle THIC appointments that can be BIO, DOC, or VAA
    if (['BIO', 'DOC', 'VAA'].includes(filters.appointmentType)) {
      conditions.push("(appointment_type = ? OR location = 'THIC')");
      params.push(filters.appointmentType);
    } else {
      conditions.push('appointment_type = ?');
      params.push(filters.appointmentType);
    }
  }

  // Location filter
  if (filters.location && filters.location !== 'ALL') {
    conditions.push('location = ?');
    params.push(filters.location);
  }

  // Persons filter
  if (filters.persons) {
    conditions.push('persons = ?');
    params.push(filters.persons);
  }

  // Date range filters
  if (filters.dateFrom) {
    conditions.push('date >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('date <= ?');
    params.push(filters.dateTo);
  }

  // Build the query using validated values
  let sql = `SELECT ${safeSelectFields} FROM ind_appointments`;

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ` ORDER BY ${safeOrderBy}`;

  if (safeLimit !== undefined) {
    sql += ` LIMIT ?`;
    params.push(safeLimit);

    if (offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }
  } else {
    // Always apply a max limit to prevent accidental full table scans
    sql += ` LIMIT ?`;
    params.push(ABSOLUTE_MAX_LIMIT);
  }

  return { sql, params };
}

/**
 * Get appointments with filters and pagination
 * Note: This uses synchronous better-sqlite3 calls, returns immediately
 */
export function getAppointments(
  filters: AppointmentFilters,
  pagination?: PaginationParams
): PaginatedResponse<AppointmentRow> {
  // Get total count first
  const countQuery = buildAppointmentQuery(filters, {
    selectFields: 'COUNT(*) as total',
  });

  const countResult = db.queryOne<{ total: number }>(countQuery.sql, countQuery.params);
  const total = countResult?.total || 0;

  // Get actual data with pagination
  const page = pagination?.page || PAGINATION.DEFAULT_PAGE;
  const pageSize = pagination?.pageSize || PAGINATION.DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const dataQuery = buildAppointmentQuery(filters, {
    limit: pageSize,
    offset,
  });

  const data = db.query<AppointmentRow>(dataQuery.sql, dataQuery.params);

  return createPaginatedResponse(data, total, { page, pageSize });
}

/**
 * Get appointment by ID
 */
export function getAppointmentById(id: number): AppointmentRow | undefined {
  return db.queryOne<AppointmentRow>(
    'SELECT * FROM ind_appointments WHERE id = ?',
    [id]
  );
}

/**
 * Get appointments by keys (with chunking for SQLite limit)
 */
export function getAppointmentsByKeys(keys: string[]): AppointmentRow[] {
  if (keys.length === 0) return [];

  const results: AppointmentRow[] = [];

  // Chunk keys to avoid SQLite variable limit
  for (let i = 0; i < keys.length; i += SCRAPING.SQLITE_MAX_VARIABLES) {
    const chunk = keys.slice(i, i + SCRAPING.SQLITE_MAX_VARIABLES);
    const placeholders = chunk.map(() => '?').join(',');
    const query = `SELECT * FROM ind_appointments WHERE appointment_key IN (${placeholders})`;
    const rows = db.query<AppointmentRow>(query, chunk);
    results.push(...rows);
  }

  return results;
}

/**
 * Check which appointment keys already exist
 */
export function getExistingAppointmentKeys(keys: string[]): Set<string> {
  if (keys.length === 0) return new Set();

  const existingKeys = new Set<string>();

  // Chunk keys to avoid SQLite variable limit
  for (let i = 0; i < keys.length; i += SCRAPING.SQLITE_MAX_VARIABLES) {
    const chunk = keys.slice(i, i + SCRAPING.SQLITE_MAX_VARIABLES);
    const placeholders = chunk.map(() => '?').join(',');
    const query = `SELECT appointment_key FROM ind_appointments WHERE appointment_key IN (${placeholders})`;
    const rows = db.query<{ appointment_key: string }>(query, chunk);
    rows.forEach((row) => existingKeys.add(row.appointment_key));
  }

  return existingKeys;
}

// =============================================================================
// CSV/ICAL EXPORT HELPERS
// =============================================================================

/**
 * Escape a value for CSV output
 * Prevents CSV injection attacks (formula injection in Excel/LibreOffice)
 * See: https://owasp.org/www-community/attacks/CSV_Injection
 */
export function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Formula injection characters that Excel/LibreOffice interpret specially
  // Even after whitespace, these can trigger formula execution
  const FORMULA_CHARS = /[=+\-@\t\r|]/;

  // Check if value could be interpreted as a formula
  // This includes values that START with formula chars, or contain them after whitespace
  const trimmed = stringValue.trimStart();
  const isFormulaLike =
    FORMULA_CHARS.test(trimmed.charAt(0)) ||
    // Also check for formulas hidden after whitespace at the start
    (stringValue !== trimmed && FORMULA_CHARS.test(trimmed.charAt(0)));

  if (isFormulaLike) {
    // Prefix with a tab character wrapped in quotes - this is the safest approach
    // The tab prevents Excel from interpreting the content as a formula
    // Alternative: prefix with single quote, but some apps strip it
    return `"\t${stringValue.replace(/"/g, '""')}"`;
  }

  // Check if value needs quoting due to special CSV characters
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Generate CSV content from appointments
 */
export function generateCSV(appointments: AppointmentRow[]): string {
  const headers = [
    'Date',
    'Start Time',
    'End Time',
    'Appointment Type',
    'Location',
    'Persons',
    'First Seen',
  ];

  const rows = [headers.join(',')];

  for (const appt of appointments) {
    const row = [
      escapeCSVValue(appt.date),
      escapeCSVValue(appt.start_time),
      escapeCSVValue(appt.end_time),
      escapeCSVValue(appt.appointment_type_name),
      escapeCSVValue(appt.location_name),
      escapeCSVValue(appt.persons),
      escapeCSVValue(appt.first_seen_at),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Fold a line to comply with RFC 5545 (max 75 OCTETS/bytes, not characters)
 * This correctly handles multi-byte Unicode characters like emojis
 */
export function foldICalLine(line: string): string {
  const MAX_OCTETS = 75;

  // Check byte length, not character length
  const lineBytes = Buffer.byteLength(line, 'utf-8');
  if (lineBytes <= MAX_OCTETS) {
    return line;
  }

  const parts: string[] = [];
  let remaining = line;
  let isFirstLine = true;

  while (remaining.length > 0) {
    // For continuation lines, we need to account for the leading space (1 byte)
    const maxBytesForThisLine = isFirstLine ? MAX_OCTETS : MAX_OCTETS - 1;

    // Find the maximum number of characters that fit within the byte limit
    let charCount = 0;
    let byteCount = 0;

    for (const char of remaining) {
      const charBytes = Buffer.byteLength(char, 'utf-8');
      if (byteCount + charBytes > maxBytesForThisLine) {
        break;
      }
      byteCount += charBytes;
      charCount++;
    }

    // Handle edge case where even one character doesn't fit (shouldn't happen with 75 bytes)
    if (charCount === 0) {
      charCount = 1;
    }

    const chunk = remaining.substring(0, charCount);
    remaining = remaining.substring(charCount);

    if (isFirstLine) {
      parts.push(chunk);
      isFirstLine = false;
    } else {
      // Continuation lines start with a space
      parts.push(' ' + chunk);
    }
  }

  return parts.join('\r\n');
}

/**
 * Escape text for iCal format
 */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/**
 * Format date for iCal (UTC)
 */
export function formatICalDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate iCal content from appointments
 */
export function generateICalContent(appointments: AppointmentRow[]): string {
  const now = new Date();
  const timestamp = formatICalDateUTC(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IND Appointments Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:IND Appointments',
    'X-WR-TIMEZONE:Europe/Amsterdam',
  ];

  // Add timezone definition
  lines.push(
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Amsterdam',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'END:STANDARD',
    'END:VTIMEZONE'
  );

  for (const appt of appointments) {
    const uid = `${appt.appointment_key}@ind-appointments.tracker`;
    const summary = `IND: ${appt.appointment_type_name}`;
    const description =
      `IND Appointment\\n` +
      `Type: ${appt.appointment_type_name}\\n` +
      `Location: ${appt.location_name}\\n` +
      `Persons: ${appt.persons}\\n\\n` +
      `Book at: https://oap.ind.nl/oap/en/`;

    const dateStr = appt.date.replace(/-/g, '');
    const startTimeStr = appt.start_time.replace(/:/g, '');
    const endTimeStr = appt.end_time.replace(/:/g, '');

    lines.push(
      'BEGIN:VEVENT',
      foldICalLine(`UID:${uid}`),
      `DTSTAMP:${timestamp}`,
      `DTSTART;TZID=Europe/Amsterdam:${dateStr}T${startTimeStr}00`,
      `DTEND;TZID=Europe/Amsterdam:${dateStr}T${endTimeStr}00`,
      foldICalLine(`SUMMARY:${escapeICalText(summary)}`),
      foldICalLine(`LOCATION:${escapeICalText(appt.location_name)}`),
      foldICalLine(`DESCRIPTION:${escapeICalText(description)}`),
      'STATUS:TENTATIVE',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:IND Appointment Reminder',
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  // Join with CRLF as per RFC 5545
  return lines.join('\r\n') + '\r\n';
}

// =============================================================================
// REQUEST ID / CORRELATION
// =============================================================================

// Use BigInt for counter to prevent overflow
// Counter resets to 0 after Number.MAX_SAFE_INTEGER (9007199254740991)
let requestCounter = BigInt(0);
const MAX_COUNTER = BigInt(Number.MAX_SAFE_INTEGER);

// Generate a process ID once at startup for uniqueness across restarts
const processId = Math.random().toString(36).substring(2, 8);

/**
 * Generate a unique request ID for tracing
 * Format: [timestamp]-[processId]-[counter]-[random]
 * This is unique across server restarts and doesn't overflow
 */
export function generateRequestId(): string {
  // Increment counter, reset if it exceeds safe integer
  requestCounter = requestCounter >= MAX_COUNTER ? BigInt(0) : requestCounter + BigInt(1);

  const timestamp = Date.now().toString(36);
  const counter = requestCounter.toString(36);
  const random = Math.random().toString(36).substring(2, 6);

  return `${timestamp}-${processId}-${counter}-${random}`;
}
