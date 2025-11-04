// In-memory rate limiter for API endpoints
// For production use, consider Redis or a distributed solution

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime?: number;
}

/**
 * Simple in-memory rate limiter
 * @param identifier - Unique identifier (e.g., IP address, user ID, email)
 * @param maxAttempts - Maximum number of attempts allowed in the time window
 * @param windowMs - Time window in milliseconds (default: 15 minutes)
 * @returns Object indicating if request is allowed and remaining attempts
 */
export function rateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  // If no record exists or the time window has expired, create a new one
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  // If max attempts exceeded, deny the request
  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  // Increment the counter and allow the request
  record.count++;
  return {
    allowed: true,
    remaining: maxAttempts - record.count
  };
}

/**
 * Clean up expired records to prevent memory leaks
 * Should be called periodically
 */
export function cleanupExpiredRecords(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or admin override
 */
export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

/**
 * Get current rate limit info for an identifier
 */
export function getRateLimitInfo(identifier: string): { count: number; resetTime: number } | null {
  return rateLimitMap.get(identifier) || null;
}

// Cleanup expired records every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = cleanupExpiredRecords();
    if (cleaned > 0) {
      console.log(`[RATE LIMIT] Cleaned up ${cleaned} expired records`);
    }
  }, 5 * 60 * 1000);
}
