import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { rateLimit } from '@/lib/rate-limit';
import { security } from '@/lib/security';
import logger from '@/lib/logger';
import type { UserRow } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Apply rate limiting (5 attempts per 15 minutes per IP)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000);

    if (!rateLimitResult.allowed) {
      const waitMinutes = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 60000);
      return NextResponse.json(
        {
          success: false,
          message: `Too many login attempts. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`
        },
        { status: 429 }
      );
    }

    // Find user
    const query = 'SELECT * FROM users WHERE email = ?';
    const users = await db.query(query, [email]);

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = users[0] as UserRow;

    // Verify password using centralized security module
    const passwordMatch = await security.comparePassword(password, user.password_hash);

    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.email_verified) {
      return NextResponse.json(
        { success: false, message: 'Please verify your email before logging in' },
        { status: 403 }
      );
    }

    // Update last login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Generate JWT token using centralized security module
    const token = security.generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Login error', { error });
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
