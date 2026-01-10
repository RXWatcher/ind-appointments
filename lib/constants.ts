// Application-wide constants to eliminate magic numbers
// Object.freeze is used for runtime immutability in addition to TypeScript's 'as const'

/**
 * Deep freeze an object to make it truly immutable at runtime
 */
function deepFreeze<T extends object>(obj: T): T {
  Object.keys(obj).forEach(key => {
    const value = (obj as Record<string, unknown>)[key];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  });
  return Object.freeze(obj);
}

// =============================================================================
// RATE LIMITING
// =============================================================================
export const RATE_LIMIT = deepFreeze({
  /** Default rate limit window in milliseconds (15 minutes) */
  DEFAULT_WINDOW_MS: 15 * 60 * 1000,
  /** Login attempts allowed per window */
  LOGIN_MAX_ATTEMPTS: 5,
  /** Password reset attempts allowed per window */
  PASSWORD_RESET_MAX_ATTEMPTS: 3,
  /** API requests allowed per window for general endpoints */
  API_MAX_REQUESTS: 100,
  /** WebSocket messages allowed per minute */
  WEBSOCKET_MAX_MESSAGES_PER_MINUTE: 60,
  /** Cleanup interval for expired rate limit records (5 minutes) */
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
});

// =============================================================================
// SCRAPING
// =============================================================================
export const SCRAPING = deepFreeze({
  /** Delay between IND API requests in milliseconds */
  IND_API_DELAY_MS: 2000,
  /** Delay between expat center requests in milliseconds */
  EXPAT_CENTER_DELAY_MS: 500,
  /** Number of requests before pausing for IND API */
  IND_API_BATCH_SIZE: 10,
  /** Maximum appointments to fetch per query */
  MAX_APPOINTMENTS_PER_QUERY: 1000,
  /** SQLite maximum variables in a single query */
  SQLITE_MAX_VARIABLES: 999,
});

// =============================================================================
// NOTIFICATIONS
// =============================================================================
export const NOTIFICATIONS = deepFreeze({
  /** Default notification interval in minutes */
  DEFAULT_INTERVAL_MINUTES: 15,
  /** Urgent appointment threshold in days (appointments sooner than this bypass throttling) */
  URGENT_THRESHOLD_DAYS: 2,
  /** Minimum interval for urgent notifications in minutes */
  URGENT_MIN_INTERVAL_MINUTES: 5,
  /** Maximum appointments to show in email before "and X more" */
  MAX_APPOINTMENTS_IN_EMAIL: 10,
  /** Retry attempts for failed notifications */
  MAX_RETRY_ATTEMPTS: 3,
  /** Initial retry delay in milliseconds */
  INITIAL_RETRY_DELAY_MS: 1000,
  /** Maximum retry delay in milliseconds */
  MAX_RETRY_DELAY_MS: 30000,
});

// =============================================================================
// WEBSOCKET
// =============================================================================
export const WEBSOCKET = deepFreeze({
  /** Initial reconnect delay in milliseconds */
  INITIAL_RECONNECT_DELAY_MS: 1000,
  /** Maximum reconnect delay in milliseconds */
  MAX_RECONNECT_DELAY_MS: 30000,
  /** Maximum reconnect attempts before giving up */
  MAX_RECONNECT_ATTEMPTS: 10,
  /** Heartbeat interval in milliseconds (30 seconds) */
  HEARTBEAT_INTERVAL_MS: 30000,
  /** Connection timeout in milliseconds */
  CONNECTION_TIMEOUT_MS: 10000,
  /** Authentication timeout in milliseconds */
  AUTH_TIMEOUT_MS: 5000,
});

// =============================================================================
// SECURITY
// =============================================================================
export const SECURITY = deepFreeze({
  /** JWT token expiry */
  JWT_EXPIRY: '24h',
  /** Password reset token expiry in hours */
  PASSWORD_RESET_EXPIRY_HOURS: 1,
  /** Email verification token expiry in days */
  EMAIL_VERIFICATION_EXPIRY_DAYS: 7,
  /** Telegram link token expiry in minutes */
  TELEGRAM_LINK_TOKEN_EXPIRY_MINUTES: 15,
  /** Minimum password length */
  MIN_PASSWORD_LENGTH: 8,
  /** Maximum password length */
  MAX_PASSWORD_LENGTH: 128,
  /** Bcrypt rounds for password hashing */
  BCRYPT_ROUNDS: 12,
  /** Token bytes for crypto random tokens */
  TOKEN_BYTES: 32,
});

// =============================================================================
// DATABASE
// =============================================================================
export const DATABASE = deepFreeze({
  /** Days after which unavailable appointments are deleted */
  CLEANUP_UNAVAILABLE_DAYS: 7,
  /** Days after which cron logs are deleted */
  CLEANUP_LOGS_DAYS: 30,
  /** Days after which unverified accounts are deleted */
  CLEANUP_UNVERIFIED_ACCOUNTS_DAYS: 30,
  /** Hours after which appointments not seen are marked unavailable */
  MARK_UNAVAILABLE_HOURS: 1,
});

// =============================================================================
// PAGINATION
// =============================================================================
export const PAGINATION = deepFreeze({
  /** Default page size for list endpoints */
  DEFAULT_PAGE_SIZE: 50,
  /** Maximum page size allowed */
  MAX_PAGE_SIZE: 200,
  /** Default page number */
  DEFAULT_PAGE: 1,
});

// =============================================================================
// ICAL
// =============================================================================
export const ICAL = deepFreeze({
  /** Maximum line length before folding (RFC 5545) */
  MAX_LINE_LENGTH: 75,
  /** Maximum appointments in iCal export */
  MAX_EXPORT_APPOINTMENTS: 100,
});

// =============================================================================
// CRON
// =============================================================================
export const CRON = deepFreeze({
  /** High priority appointment types (checked more frequently) */
  HIGH_PRIORITY_TYPES: ['DOC', 'BIO'],
  /** Low priority appointment types */
  LOW_PRIORITY_TYPES: ['VAA', 'TKV', 'UKR', 'FAM'],
  /** High priority check interval (cron expression - every 5 minutes) */
  HIGH_PRIORITY_SCHEDULE: '*/5 * * * *',
  /** Low priority check interval (cron expression - every 15 minutes) */
  LOW_PRIORITY_SCHEDULE: '*/15 * * * *',
  /** Health check schedule (cron expression - every hour) */
  HEALTH_CHECK_SCHEDULE: '0 * * * *',
  /** Cleanup schedule (cron expression - daily at 3 AM) */
  CLEANUP_SCHEDULE: '0 3 * * *',
  /** Lock timeout in milliseconds to prevent overlapping jobs */
  JOB_LOCK_TIMEOUT_MS: 10 * 60 * 1000,
});

// =============================================================================
// HTTP
// =============================================================================
export const HTTP = deepFreeze({
  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT_MS: 30000,
  /** Default content type */
  CONTENT_TYPE_JSON: 'application/json',
  /** CSV content type */
  CONTENT_TYPE_CSV: 'text/csv; charset=utf-8',
  /** iCal content type */
  CONTENT_TYPE_ICAL: 'text/calendar; charset=utf-8',
});

// =============================================================================
// DIGID VIDEO CALLS
// =============================================================================
export const DIGID = deepFreeze({
  /** Base URL for DigiD video call appointments */
  BASE_URL: 'https://digidafspraak.nederlandwereldwijd.nl',
  /** Booking portal URL */
  BOOKING_URL: 'https://digidafspraak.nederlandwereldwijd.nl/',
  /** Normal polling interval in minutes (outside release windows) */
  NORMAL_POLL_INTERVAL_MINUTES: 30,
  /** Aggressive polling interval in seconds (during release windows) */
  AGGRESSIVE_POLL_INTERVAL_SECONDS: 30,
  /** Duration of aggressive polling in minutes after release window opens */
  AGGRESSIVE_POLL_DURATION_MINUTES: 30,
  /** API delay between requests in milliseconds */
  API_DELAY_MS: 500,
  /** Release windows - appointments open every Friday at these times (Amsterdam timezone) */
  RELEASE_WINDOWS: [
    { hour: 9, minute: 0 },
    { hour: 14, minute: 0 },
  ],
  /** Day of week for release (0 = Sunday, 5 = Friday) */
  RELEASE_DAY_OF_WEEK: 5,
  /** Maximum persons per appointment */
  MAX_PERSONS: 6,
  /** Days ahead to scrape for appointments */
  DAYS_AHEAD: 60,
  /** Timezone for release window calculations */
  TIMEZONE: 'Europe/Amsterdam',
});
