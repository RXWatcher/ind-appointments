import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import logger from './logger';

interface User {
  id: number;
  email: string;
  role: string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class Security {
  private static instance: Security;
  private rateLimitStore: RateLimitStore = {};
  private jwtSecret: string;
  private bcryptRounds: number;

  private constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-this';
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');

    if (this.jwtSecret === 'fallback-secret-change-this') {
      logger.warn('Using fallback JWT secret. Please set JWT_SECRET environment variable.');
    }
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

  // Rate limiting
  public rateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 15 * 60 * 1000): boolean {
    const now = Date.now();
    const resetTime = now + windowMs;

    if (!this.rateLimitStore[identifier]) {
      this.rateLimitStore[identifier] = { count: 1, resetTime };
      return true;
    }

    const entry = this.rateLimitStore[identifier];

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

  // Security headers
  public addSecurityHeaders<T>(response: NextResponse<T>): NextResponse<T> {
    if (process.env.ENABLE_SECURITY_HEADERS === 'true') {
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

      if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
    }
    return response;
  }

  // Input validation
  public validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public sanitizeInput(input: string): string {
    return input.trim().replace(/[<>\"']/g, '');
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