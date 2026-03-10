/**
 * Next.js Middleware for centralized authentication and request processing
 *
 * This middleware handles:
 * - Authentication verification for protected routes
 * - Rate limiting for public endpoints
 * - Security headers
 * - Request logging
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/api/preferences',
  '/api/user',
  '/api/notifications/history',
  '/preferences',
  '/settings',
  '/notifications',
];

// Routes that require admin role
const ADMIN_ROUTES = [
  '/api/admin',
  '/admin',
];

// Public API routes that need rate limiting
const RATE_LIMITED_ROUTES = [
  '/api/appointments',
  '/api/status',
  '/api/health',
];

// Routes that should be completely public (no auth check even if token present)
const PUBLIC_ROUTES = [
  '/api/login',
  '/api/signup',
  '/api/forgot-password',
  '/api/reset-password',
  '/api/verify-email',
  '/api/verify-email-change',
  '/api/resend-verification',
  '/api/telegram/webhook',
  '/api/preferences/unsubscribe',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

// In-memory rate limit store (for edge runtime compatibility)
// Note: In production with multiple instances, use Redis
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple rate limiter for edge runtime
 */
function checkRateLimit(ip: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const key = `rate:${ip}`;
  const entry = rateLimitStore.get(key);

  // Cleanup old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetAt) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Verify JWT token without full crypto operations (basic check)
 * Full verification happens in API routes
 */
function getTokenPayload(token: string): { id: number; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return { id: payload.id, role: payload.role };
  } catch {
    return null;
  }
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

/**
 * Check if path matches any pattern in the list
 */
function matchesPath(pathname: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.endsWith('*')) {
      return pathname.startsWith(pattern.slice(0, -1));
    }
    return pathname === pattern || pathname.startsWith(pattern + '/');
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Files with extensions
  ) {
    return NextResponse.next();
  }

  // Get client IP for rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';

  // Rate limit public API endpoints
  if (matchesPath(pathname, RATE_LIMITED_ROUTES)) {
    if (!checkRateLimit(ip, 100, 60000)) { // 100 requests per minute
      const response = NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
      response.headers.set('Retry-After', '60');
      return addSecurityHeaders(response);
    }
  }

  // Allow public routes without auth
  if (matchesPath(pathname, PUBLIC_ROUTES)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Check authentication for protected routes
  if (matchesPath(pathname, PROTECTED_ROUTES) || matchesPath(pathname, ADMIN_ROUTES)) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      // For API routes, return 401
      if (pathname.startsWith('/api/')) {
        return addSecurityHeaders(NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        ));
      }
      // For pages, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const payload = getTokenPayload(token);

    if (!payload) {
      if (pathname.startsWith('/api/')) {
        return addSecurityHeaders(NextResponse.json(
          { success: false, error: 'Invalid or expired token' },
          { status: 401 }
        ));
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(loginUrl);
    }

    // Check admin routes
    if (matchesPath(pathname, ADMIN_ROUTES) && payload.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return addSecurityHeaders(NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        ));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Attach user info to request headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', String(payload.id));
    response.headers.set('x-user-role', payload.role);
    return addSecurityHeaders(response);
  }

  // Default: add security headers
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
