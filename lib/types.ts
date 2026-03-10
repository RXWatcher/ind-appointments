// Shared TypeScript types for the application

import type { AppointmentType, Location } from './ind-api';

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

export interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  full_name: string | null;
  role: 'user' | 'admin';
  email_verified: number; // SQLite boolean
  verification_token: string | null;
  reset_token: string | null;
  reset_token_expires: string | null;
  pending_email: string | null;
  email_change_token: string | null;
  email_change_requested_at: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface AppointmentRow {
  id: number;
  appointment_key: string;
  date: string;
  start_time: string;
  end_time: string;
  appointment_type: AppointmentType;
  location: string;
  location_name: string;
  appointment_type_name: string;
  persons: number;
  parts: number;
  source?: string;
  first_seen_at: string;
  last_seen_at: string;
  is_available: number; // SQLite boolean
}

export interface NotificationPreferenceRow {
  id: number;
  user_id: number;
  appointment_type: AppointmentType;
  location: string;
  persons: number;
  days_ahead: number;
  email_enabled: number; // SQLite boolean
  push_enabled: number; // SQLite boolean
  whatsapp_enabled: number;
  telegram_enabled: number;
  webhook_enabled: number;
  notification_interval: number;
  dnd_start_time: string;
  dnd_end_time: string;
  last_notification_at: string | null;
  is_active: number; // SQLite boolean
  created_at: string;
  updated_at: string;
}

export interface NotificationLogRow {
  id: number;
  user_id: number;
  appointment_id: number | null;
  notification_type: 'email' | 'push' | 'telegram' | 'whatsapp' | 'webhook';
  sent_at: string;
  success: number; // SQLite boolean
  error_message: string | null;
  appointment_count: number;
}

export interface SystemSettingRow {
  id: number;
  setting_key: string;
  setting_value: string | null;
  description: string | null;
  updated_at: string;
}

export interface UserNotificationCredentialsRow {
  id: number;
  user_id: number;
  pushover_user_key: string | null;
  whatsapp_phone_number: string | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CronJobLogRow {
  id: number;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  appointments_found: number;
  new_appointments: number;
  notifications_sent: number;
  error_message: string | null;
  duration_ms: number | null;
}

export interface TelegramLinkTokenRow {
  id: number;
  user_id: number;
  token_hash: string; // Hashed, not plaintext
  expires_at: string;
  created_at: string;
}

// =============================================================================
// JOINED/COMPUTED TYPES
// =============================================================================

export interface PreferenceWithUser extends NotificationPreferenceRow {
  user_email: string;
  username: string;
  full_name: string | null;
  user_timezone: string;
}

export interface AppointmentWithPreference extends AppointmentRow {
  user_id: number;
  email_enabled: number;
  push_enabled: number;
  user_email: string;
  username: string;
  full_name: string | null;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AppointmentFilters {
  appointmentType?: AppointmentType;
  location?: Location | 'ALL';
  persons?: number;
  dateFrom?: string;
  dateTo?: string;
  isAvailable?: boolean;
}

// =============================================================================
// WEBSOCKET TYPES
// =============================================================================

export interface WebSocketMessage {
  type: string;
  data?: unknown;
  timestamp: number;
  requestId?: string;
}

export interface WebSocketAuthMessage {
  type: 'AUTH';
  token: string;
}

export interface NewAppointmentsMessage extends WebSocketMessage {
  type: 'NEW_APPOINTMENTS';
  data: {
    count: number;
    source: string;
    appointments: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      appointmentType: string;
      appointmentTypeName: string;
      location: string;
      locationName: string;
      persons: number;
    }>;
  };
}

// =============================================================================
// TELEGRAM TYPES
// =============================================================================

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export interface NotificationResult {
  success: boolean;
  error?: string;
  retryable?: boolean;
}

export interface NotificationPayload {
  userId: number;
  appointments: Array<{
    date: string;
    startTime: string;
    endTime: string;
    appointmentType: string;
    location: string;
  }>;
  preferenceId: number;
}

// =============================================================================
// AUTH TYPES
// =============================================================================

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  username?: string;
}

export interface JWTPayload extends AuthUser {
  iat: number;
  exp: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** SQLite run result */
export interface SQLiteRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/** Convert SQLite boolean (0/1) to JavaScript boolean */
export function sqliteBool(value: number | undefined | null): boolean {
  return value === 1;
}

/** Convert JavaScript boolean to SQLite boolean (0/1) */
export function toSqliteBool(value: boolean): number {
  return value ? 1 : 0;
}
