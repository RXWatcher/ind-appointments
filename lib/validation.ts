/**
 * Zod validation schemas for API request/response validation
 * Provides type-safe validation with automatic TypeScript type inference
 */

import { z } from 'zod';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/** Valid appointment types */
export const AppointmentTypeSchema = z.enum(['BIO', 'DOC', 'VAA', 'TKV', 'UKR', 'FAM', 'DGD']);
export type AppointmentTypeEnum = z.infer<typeof AppointmentTypeSchema>;

/** Valid appointment sources */
export const AppointmentSourceSchema = z.enum(['IND', 'THE_HAGUE_IC', 'ROTTERDAM_IC', 'DIGID']);
export type AppointmentSourceEnum = z.infer<typeof AppointmentSourceSchema>;

/** Valid locations */
export const LocationSchema = z.enum([
  'AM', 'DH', 'ZW', 'DB', 'UT', 'EX', 'GN', 'EN', 'RO', 'THIC', 'DIGID_VC', 'ALL'
]);
export type LocationEnum = z.infer<typeof LocationSchema>;

/** User roles */
export const UserRoleSchema = z.enum(['user', 'admin']);
export type UserRoleEnum = z.infer<typeof UserRoleSchema>;

/** ISO date string (YYYY-MM-DD) */
export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)');

/** Time string (HH:MM or HH:MM:SS) */
export const TimeStringSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (expected HH:MM)');

/** Email validation */
export const EmailSchema = z.string()
  .trim()
  .toLowerCase()
  .email('Invalid email format')
  .max(254, 'Email must be 254 characters or less');

/** Password validation */
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/, 'Password must contain at least one special character');

/** Pagination params */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const SignupSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  fullName: z.string().max(100).optional().transform(val => val?.trim()),
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: PasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const ChangeEmailSchema = z.object({
  newEmail: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type ChangeEmailInput = z.infer<typeof ChangeEmailSchema>;

// =============================================================================
// APPOINTMENT SCHEMAS
// =============================================================================

export const AppointmentFilterSchema = z.object({
  type: AppointmentTypeSchema.optional(),
  location: LocationSchema.optional(),
  persons: z.coerce.number().int().min(1).max(6).optional(),
  dateFrom: DateStringSchema.optional(),
  dateTo: DateStringSchema.optional(),
  source: AppointmentSourceSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AppointmentFilterInput = z.infer<typeof AppointmentFilterSchema>;

export const AppointmentResponseSchema = z.object({
  id: z.number(),
  appointment_key: z.string(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  appointment_type: AppointmentTypeSchema,
  location: z.string(),
  location_name: z.string(),
  appointment_type_name: z.string(),
  persons: z.number(),
  source: AppointmentSourceSchema.optional(),
  first_seen_at: z.string(),
});
export type AppointmentResponse = z.infer<typeof AppointmentResponseSchema>;

// =============================================================================
// PREFERENCES SCHEMAS
// =============================================================================

export const CreatePreferenceSchema = z.object({
  appointmentType: AppointmentTypeSchema,
  location: z.string().min(1, 'Location is required'), // Can be 'ALL' or comma-separated
  locations: z.array(z.string()).optional(), // Alternative format
  persons: z.coerce.number().int().min(1).max(6).default(1),
  daysAhead: z.coerce.number().int().min(1).max(90).default(30),
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(false),
  whatsappEnabled: z.boolean().default(false),
  telegramEnabled: z.boolean().default(false),
  webhookEnabled: z.boolean().default(false),
  notificationInterval: z.coerce.number().int().min(5).max(1440).default(15),
  dndStartTime: TimeStringSchema.default('22:00'),
  dndEndTime: TimeStringSchema.default('08:00'),
});
export type CreatePreferenceInput = z.infer<typeof CreatePreferenceSchema>;

export const UpdatePreferenceSchema = CreatePreferenceSchema.partial().extend({
  id: z.number().int().positive(),
  isActive: z.boolean().optional(),
});
export type UpdatePreferenceInput = z.infer<typeof UpdatePreferenceSchema>;

// =============================================================================
// NOTIFICATION CREDENTIALS SCHEMAS
// =============================================================================

export const NotificationCredentialsSchema = z.object({
  pushoverUserKey: z.string().optional().nullable(),
  whatsappPhoneNumber: z.string().optional().nullable(),
  webhookUrl: z.string().url().optional().nullable(),
}).refine(data => {
  // At least one credential should be provided
  return Object.values(data).some(v => v !== undefined && v !== null && v !== '');
}, {
  message: 'At least one notification credential must be provided',
});
export type NotificationCredentialsInput = z.infer<typeof NotificationCredentialsSchema>;

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

export const AdminUserUpdateSchema = z.object({
  role: UserRoleSchema.optional(),
  emailVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type AdminUserUpdateInput = z.infer<typeof AdminUserUpdateSchema>;

export const BulkUserActionSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1, 'At least one user ID required'),
  action: z.enum(['delete', 'verify', 'unverify', 'makeAdmin', 'removeAdmin']),
});
export type BulkUserActionInput = z.infer<typeof BulkUserActionSchema>;

export const SystemSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
export type SystemSettingInput = z.infer<typeof SystemSettingSchema>;

// =============================================================================
// TELEGRAM SCHEMAS
// =============================================================================

export const TelegramLinkSchema = z.object({
  action: z.enum(['generate', 'unlink']),
});
export type TelegramLinkInput = z.infer<typeof TelegramLinkSchema>;

// =============================================================================
// TIMEZONE SCHEMA
// =============================================================================

export const TimezoneSchema = z.object({
  timezone: z.string().refine(tz => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, { message: 'Invalid timezone' }),
});
export type TimezoneInput = z.infer<typeof TimezoneSchema>;

// =============================================================================
// VALIDATION HELPER
// =============================================================================

/**
 * Validate request body against a schema
 * Returns parsed data or throws ApiException
 */
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ValidationError(errors);
  }

  return result.data;
}

/**
 * Validate query parameters against a schema
 */
export function validateQuery<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams
): z.infer<T> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return validateBody(schema, params);
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  public readonly status = 400;
  public readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
