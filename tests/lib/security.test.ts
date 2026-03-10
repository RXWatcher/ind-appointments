/**
 * Tests for security module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to set up mocks before importing the security module
beforeEach(() => {
  vi.resetModules();
  process.env.JWT_SECRET = 'test-secret-key-for-testing-minimum-32-chars';
});

describe('security module', () => {
  it('should validate email addresses', async () => {
    const { security } = await import('@/lib/security');

    expect(security.validateEmail('test@example.com')).toBe(true);
    expect(security.validateEmail('user.name@domain.co.uk')).toBe(true);
    expect(security.validateEmail('invalid')).toBe(false);
    expect(security.validateEmail('')).toBe(false);
    expect(security.validateEmail('no@domain')).toBe(false);
  });

  it('should validate password strength', async () => {
    const { security } = await import('@/lib/security');

    // Valid password
    const valid = security.validatePassword('SecureP@ss123');
    expect(valid.valid).toBe(true);

    // Too short
    const tooShort = security.validatePassword('Sh0rt!');
    expect(tooShort.valid).toBe(false);
    expect(tooShort.message).toContain('8 characters');

    // No uppercase
    const noUpper = security.validatePassword('lowercase@123');
    expect(noUpper.valid).toBe(false);
    expect(noUpper.message).toContain('uppercase');

    // No lowercase
    const noLower = security.validatePassword('UPPERCASE@123');
    expect(noLower.valid).toBe(false);
    expect(noLower.message).toContain('lowercase');

    // No number
    const noNumber = security.validatePassword('NoNumbers@here');
    expect(noNumber.valid).toBe(false);
    expect(noNumber.message).toContain('number');

    // No special char
    const noSpecial = security.validatePassword('NoSpecial123');
    expect(noSpecial.valid).toBe(false);
    expect(noSpecial.message).toContain('special');
  });

  it('should hash and compare passwords', async () => {
    const { security } = await import('@/lib/security');

    const password = 'TestPassword123!';
    const hash = await security.hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt format

    const isMatch = await security.comparePassword(password, hash);
    expect(isMatch).toBe(true);

    const noMatch = await security.comparePassword('wrongpassword', hash);
    expect(noMatch).toBe(false);
  });

  it('should generate and verify tokens', async () => {
    const { security } = await import('@/lib/security');

    const payload = { id: 1, email: 'test@example.com', role: 'user' };
    const token = security.generateToken(payload);

    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

    const decoded = security.verifyToken(token);
    expect(decoded).toBeTruthy();
    expect(decoded!.id).toBe(1);
    expect(decoded!.email).toBe('test@example.com');
  });

  it('should return null for invalid tokens', async () => {
    const { security } = await import('@/lib/security');

    expect(security.verifyToken('invalid-token')).toBeNull();
    expect(security.verifyToken('')).toBeNull();
    expect(security.verifyToken('a.b.c')).toBeNull();
  });

  it('should generate secure random tokens', async () => {
    const { security } = await import('@/lib/security');

    const token1 = security.generateSecureToken();
    const token2 = security.generateSecureToken();

    expect(token1).not.toBe(token2);
    expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
  });

  it('should sanitize input', async () => {
    const { security } = await import('@/lib/security');

    expect(security.sanitize('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(security.sanitize('Normal text')).toBe('Normal text');
    expect(security.sanitize("O'Brien")).toBe('O&#39;Brien');
  });
});
