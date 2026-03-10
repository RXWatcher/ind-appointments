import { NextRequest, NextResponse } from 'next/server';
import { security } from './security';
import logger from './logger';
import { ValidationError } from './validation';
import type { z } from 'zod';

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export class ApiException extends Error {
  public status: number;
  public code?: string;

  constructor(message: string, status: number = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiException';
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiHandler {
  public static success<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
    const response = NextResponse.json({
      success: true,
      data,
      message
    });

    return security.addSecurityHeaders(response);
  }

  public static error(
    error: string | ApiException,
    status: number = 500
  ): NextResponse<ApiResponse> {
    let message: string;
    let statusCode: number;

    if (error instanceof ApiException) {
      message = error.message;
      statusCode = error.status;
    } else {
      message = error;
      statusCode = status;
    }

    logger.error('API Error', { message, status: statusCode });

    const response = NextResponse.json({
      success: false,
      error: message
    }, { status: statusCode });

    return security.addSecurityHeaders(response);
  }

  public static async withErrorHandling<T>(
    handler: () => Promise<NextResponse<T>>
  ): Promise<NextResponse<T | ApiResponse>> {
    try {
      return await handler();
    } catch (error) {
      if (error instanceof ApiException) {
        return this.error(error);
      }

      if (error instanceof ValidationError) {
        return this.error(error.message, 400);
      }

      // Log unexpected errors
      logger.error('Unhandled API error', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return this.error(
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : (error as Error).message,
        500
      );
    }
  }

  public static async withRateLimit(
    request: NextRequest,
    identifier?: string,
    maxRequests?: number,
    windowMs?: number
  ): Promise<boolean> {
    const clientIdentifier = identifier ||
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const isAllowed = security.rateLimit(
      clientIdentifier,
      maxRequests || parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
      windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000')
    );

    if (!isAllowed) {
      throw new ApiException('Rate limit exceeded', 429);
    }

    return true;
  }

  public static async withAuth(
    request: NextRequest,
    requiredRole?: string
  ): Promise<any> {
    const user = await security.authenticate(request);

    if (!user) {
      throw new ApiException('Authentication required', 401);
    }

    if (!security.authorize(user, requiredRole)) {
      throw new ApiException('Insufficient permissions', 403);
    }

    return user;
  }

  public static async parseBody<T>(request: NextRequest): Promise<T> {
    try {
      return await request.json();
    } catch (error) {
      throw new ApiException('Invalid JSON body', 400);
    }
  }

  public static validateRequired(data: any, fields: string[]): void {
    const missing = fields.filter(field => !data[field]);

    if (missing.length > 0) {
      throw new ApiException(
        `Missing required fields: ${missing.join(', ')}`,
        400
      );
    }
  }

  /**
   * Parse and validate request body using a Zod schema
   */
  public static async parseBodyWithSchema<T extends z.ZodSchema>(
    request: NextRequest,
    schema: T
  ): Promise<z.infer<T>> {
    const body = await this.parseBody(request);
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ApiException(errors, 400, 'VALIDATION_ERROR');
    }

    return result.data;
  }

  /**
   * Parse query parameters using a Zod schema
   */
  public static parseQueryWithSchema<T extends z.ZodSchema>(
    request: NextRequest,
    schema: T
  ): z.infer<T> {
    const params: Record<string, string> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = result.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ApiException(errors, 400, 'VALIDATION_ERROR');
    }

    return result.data;
  }

  /**
   * Get user from request headers (set by middleware)
   */
  public static getUserFromHeaders(request: NextRequest): { id: number; role: string } | null {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userRole) {
      return null;
    }

    return {
      id: parseInt(userId, 10),
      role: userRole,
    };
  }
}

// Middleware wrapper for API routes
export function withMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    auth?: boolean;
    role?: string;
    rateLimit?: boolean;
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    return ApiHandler.withErrorHandling(async () => {
      // Rate limiting
      if (options.rateLimit !== false) {
        await ApiHandler.withRateLimit(request);
      }

      // Authentication
      if (options.auth) {
        await ApiHandler.withAuth(request, options.role);
      }

      return await handler(request);
    });
  };
}

export default ApiHandler;