import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/database';
import { rateLimit } from '@/lib/rate-limit';
import { security } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { success: false, message: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Apply rate limiting (5 attempts per 15 minutes per IP to prevent token brute force)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = rateLimit(`reset-password:${ip}`, 5, 15 * 60 * 1000);

    if (!rateLimitResult.allowed) {
      const waitMinutes = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 60000);
      return NextResponse.json(
        {
          success: false,
          message: `Too many password reset attempts. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`
        },
        { status: 429 }
      );
    }

    // Validate password strength
    const passwordValidation = security.validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, message: passwordValidation.message },
        { status: 400 }
      );
    }

    // Find user with this reset token
    const users = await db.query(
      'SELECT id, email, reset_token_expires FROM users WHERE reset_token = ?',
      [token]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const user = users[0] as any;

    // Check if token is expired
    const expiresAt = new Date(user.reset_token_expires);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, message: 'Reset token has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await db.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, user.id]
    );

    console.log(`Password reset successful for user: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
