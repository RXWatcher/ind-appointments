import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import logger from './logger';
import { SECURITY, RATE_LIMIT } from './constants';

interface User {
  id: number;
  email: string;
  role: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class Security {
  private static instance: Security;
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private jwtSecret: string;
  private bcryptRounds: number;

  private constructor() {
    const envSecret = process.env.JWT_SECRET;
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || String(SECURITY.BCRYPT_ROUNDS));

    if (!envSecret) {
      // Check if we're in Next.js build phase (collecting page data)
      const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' ||
                          process.argv.some(arg => arg.includes('next') && process.argv.some(a => a === 'build'));

      if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
        throw new Error('CRITICAL: JWT_SECRET environment variable must be set in production. Set JWT_SECRET before starting the server.');
      }

      // Development/build fallback - generate a random secret per server restart
      this.jwtSecret = crypto.randomBytes(32).toString('hex');

      // Only warn in non-build contexts
      if (!isBuildPhase) {
        logger.warn('JWT_SECRET not set - using random secret. Sessions will not persist across restarts. Set JWT_SECRET in production!');
      }
    } else {
      this.jwtSecret = envSecret;
    }

    // Start cleanup interval for rate limit entries to prevent memory leak
    this.startRateLimitCleanup();
  }

  /**
   * Start periodic cleanup of expired rate limit entries
   * This prevents memory leaks from accumulated entries
   */
  private startRateLimitCleanup(): void {
    // Only start once
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRateLimits();
    }, RATE_LIMIT.CLEANUP_INTERVAL_MS);

    // Don't let this interval prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpiredRateLimits(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[SECURITY] Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  public getJwtSecret(): string {
    return this.jwtSecret;
  }

  public static getInstance(): Security {
    if (!Security.instance) {
      Security.instance = new Security();
    }
    return Security.instance;
  }

  // Password utilities
  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  public async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // JWT utilities
  public generateToken(user: Omit<User, 'password'>): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      this.jwtSecret,
      { expiresIn: '24h' }
    );
  }

  public verifyToken(token: string): User | null {
    try {
      return jwt.verify(token, this.jwtSecret) as User;
    } catch (error) {
      logger.warn('Invalid JWT token', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  // Rate limiting using Map to enable proper cleanup
  public rateLimit(identifier: string, maxRequests: number = RATE_LIMIT.API_MAX_REQUESTS, windowMs: number = RATE_LIMIT.DEFAULT_WINDOW_MS): boolean {
    const now = Date.now();
    const resetTime = now + windowMs;

    const entry = this.rateLimitStore.get(identifier);

    if (!entry) {
      this.rateLimitStore.set(identifier, { count: 1, resetTime });
      return true;
    }

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = resetTime;
      return true;
    }

    if (entry.count >= maxRequests) {
      logger.warn('Rate limit exceeded', { identifier, count: entry.count });
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get rate limit info for an identifier (for headers)
   */
  public getRateLimitInfo(identifier: string, maxRequests: number = RATE_LIMIT.API_MAX_REQUESTS): { remaining: number; resetTime: number } {
    const entry = this.rateLimitStore.get(identifier);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return { remaining: maxRequests, resetTime: now + RATE_LIMIT.DEFAULT_WINDOW_MS };
    }

    return {
      remaining: Math.max(0, maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  /**
   * Generate a cryptographically secure random token
   */
  public generateSecureToken(bytes: number = SECURITY.TOKEN_BYTES): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Hash a token for secure storage (e.g., Telegram link tokens)
   */
  public hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify a token against a hash
   */
  public verifyTokenHash(token: string, hash: string): boolean {
    const tokenHash = this.hashToken(token);
    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
    } catch {
      return false;
    }
  }

  // Security headers - enabled by default, can be disabled for development
  public addSecurityHeaders<T>(response: NextResponse<T>): NextResponse<T> {
    // Security headers are now enabled by default - set DISABLE_SECURITY_HEADERS=true to disable
    if (process.env.DISABLE_SECURITY_HEADERS !== 'true') {
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;");

      if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
    }
    return response;
  }

  // Input validation
  public validateEmail(email: string): boolean {
    // More robust email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  public validatePassword(password: string): { valid: boolean; message?: string } {
    if (!password || password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }

    if (password.length > 128) {
      return { valid: false, message: 'Password must be less than 128 characters' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one special character' };
    }

    return { valid: true };
  }

  public sanitizeInput(input: string): string {
    return input.trim().replace(/[<>\"']/g, '');
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   * Escapes HTML entities
   */
  public sanitize(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Generate a signed token for sensitive operations like unsubscribe
  public generateSignedToken(data: object, expiresIn: string = '7d'): string {
    return require('jsonwebtoken').sign(data, this.jwtSecret, { expiresIn });
  }

  // Verify a signed token
  public verifySignedToken<T = any>(token: string): T | null {
    try {
      return require('jsonwebtoken').verify(token, this.jwtSecret) as T;
    } catch {
      return null;
    }
  }

  // Authentication middleware
  public async authenticate(request: NextRequest): Promise<User | null> {
    try {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return null;
      }

      return this.verifyToken(token);
    } catch (error) {
      logger.error('Authentication error', { error });
      return null;
    }
  }

  // Authorization middleware
  public authorize(user: User | null, requiredRole?: string): boolean {
    if (!user) return false;

    if (!requiredRole) return true;

    const roleHierarchy: Record<string, number> = {
      'user': 1,
      'owner': 2,
      'admin': 3
    };

    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  }
}

export const security = Security.getInstance();

// Helper function for route handlers
export async function verifyAuth(request: NextRequest): Promise<User | null> {
  return security.authenticate(request);
}

export default security;