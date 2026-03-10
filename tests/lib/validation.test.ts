/**
 * Tests for validation schemas
 */

import { describe, it, expect } from 'vitest';
import {
  EmailSchema,
  PasswordSchema,
  LoginSchema,
  SignupSchema,
  AppointmentFilterSchema,
  CreatePreferenceSchema,
  validateBody,
  ValidationError,
} from '@/lib/validation';

describe('EmailSchema', () => {
  it('should accept valid emails', () => {
    expect(EmailSchema.parse('test@example.com')).toBe('test@example.com');
    expect(EmailSchema.parse('USER@DOMAIN.COM')).toBe('user@domain.com');
    expect(EmailSchema.parse('  spaced@email.com  ')).toBe('spaced@email.com');
  });

  it('should reject invalid emails', () => {
    expect(() => EmailSchema.parse('invalid')).toThrow();
    expect(() => EmailSchema.parse('')).toThrow();
    expect(() => EmailSchema.parse('no@domain')).toThrow();
  });
});

describe('PasswordSchema', () => {
  it('should accept valid passwords', () => {
    const validPassword = 'SecureP@ss123';
    expect(PasswordSchema.parse(validPassword)).toBe(validPassword);
  });

  it('should reject passwords without uppercase', () => {
    expect(() => PasswordSchema.parse('lowercase@123')).toThrow();
  });

  it('should reject passwords without lowercase', () => {
    expect(() => PasswordSchema.parse('UPPERCASE@123')).toThrow();
  });

  it('should reject passwords without numbers', () => {
    expect(() => PasswordSchema.parse('NoNumbers@here')).toThrow();
  });

  it('should reject passwords without special characters', () => {
    expect(() => PasswordSchema.parse('NoSpecial123')).toThrow();
  });

  it('should reject short passwords', () => {
    expect(() => PasswordSchema.parse('Sh0rt!')).toThrow();
  });
});

describe('LoginSchema', () => {
  it('should validate login input', () => {
    const input = { email: 'test@example.com', password: 'anypassword' };
    const result = LoginSchema.parse(input);
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('anypassword');
  });

  it('should reject missing fields', () => {
    expect(() => LoginSchema.parse({ email: 'test@example.com' })).toThrow();
    expect(() => LoginSchema.parse({ password: 'test' })).toThrow();
    expect(() => LoginSchema.parse({})).toThrow();
  });
});

describe('SignupSchema', () => {
  it('should validate signup input', () => {
    const input = {
      email: 'new@user.com',
      password: 'SecureP@ss123',
      fullName: 'John Doe',
    };
    const result = SignupSchema.parse(input);
    expect(result.email).toBe('new@user.com');
    expect(result.fullName).toBe('John Doe');
  });

  it('should make fullName optional', () => {
    const input = {
      email: 'new@user.com',
      password: 'SecureP@ss123',
    };
    const result = SignupSchema.parse(input);
    expect(result.fullName).toBeUndefined();
  });
});

describe('AppointmentFilterSchema', () => {
  it('should parse valid filters', () => {
    const result = AppointmentFilterSchema.parse({
      type: 'BIO',
      location: 'AM',
      persons: '2',
      limit: '50',
    });
    expect(result.type).toBe('BIO');
    expect(result.location).toBe('AM');
    expect(result.persons).toBe(2);
    expect(result.limit).toBe(50);
  });

  it('should use defaults', () => {
    const result = AppointmentFilterSchema.parse({});
    expect(result.limit).toBe(100);
    expect(result.offset).toBe(0);
  });

  it('should reject invalid appointment types', () => {
    expect(() => AppointmentFilterSchema.parse({ type: 'INVALID' })).toThrow();
  });
});

describe('CreatePreferenceSchema', () => {
  it('should validate preference creation', () => {
    const input = {
      appointmentType: 'DOC',
      location: 'AM,DH',
      persons: 1,
      daysAhead: 30,
      emailEnabled: true,
    };
    const result = CreatePreferenceSchema.parse(input);
    expect(result.appointmentType).toBe('DOC');
    expect(result.location).toBe('AM,DH');
  });

  it('should use default values', () => {
    const input = {
      appointmentType: 'BIO',
      location: 'ALL',
    };
    const result = CreatePreferenceSchema.parse(input);
    expect(result.persons).toBe(1);
    expect(result.daysAhead).toBe(30);
    expect(result.emailEnabled).toBe(true);
    expect(result.pushEnabled).toBe(false);
    expect(result.notificationInterval).toBe(15);
  });
});

describe('validateBody', () => {
  it('should return parsed data for valid input', () => {
    const result = validateBody(LoginSchema, {
      email: 'test@example.com',
      password: 'password',
    });
    expect(result.email).toBe('test@example.com');
  });

  it('should throw ValidationError for invalid input', () => {
    expect(() => validateBody(LoginSchema, { email: 'invalid' })).toThrow(ValidationError);
  });
});
