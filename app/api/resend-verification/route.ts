import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/database';
import { sendVerificationEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    // Apply rate limiting (5 attempts per 15 minutes per IP)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = rateLimit(`resend-verification:${ip}`, 5, 15 * 60 * 1000);

    if (!rateLimitResult.allowed) {
      const waitMinutes = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 60000);
      return NextResponse.json(
        {
          success: false,
          message: `Too many requests. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`
        },
        { status: 429 }
      );
    }

    // Find user by email
    const users = await db.query(
      'SELECT id, email, full_name, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (!Array.isArray(users) || users.length === 0) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If this email is registered, a verification email has been sent.'
      });
    }

    const user = users[0] as any;

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified. You can log in.'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Update user with new token and set created timestamp
    await db.query(
      'UPDATE users SET verification_token = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
      [verificationToken, user.id]
    );

    // Send verification email
    try {
      await sendVerificationEmail(email, user.full_name, verificationToken);
      console.log(`Resent verification email to: ${email}`);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      return NextResponse.json(
        { success: false, message: 'Failed to send email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
