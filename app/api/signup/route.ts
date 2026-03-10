import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { sendVerificationEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { security } from '@/lib/security';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Apply rate limiting (5 attempts per 15 minutes per IP)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = rateLimit(`signup:${ip}`, 5, 15 * 60 * 1000);

    if (!rateLimitResult.allowed) {
      const waitMinutes = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 60000);
      return NextResponse.json(
        {
          success: false,
          message: `Too many signup attempts. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`
        },
        { status: 429 }
      );
    }

    // Validate email format
    if (!security.validateEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
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

    // Check if email already exists
    const emailCheck = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (Array.isArray(emailCheck) && emailCheck.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Email already registered' },
        { status: 409 }
      );
    }

    // Auto-generate username from email (part before @)
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let suffix = 1;

    // Keep trying until we find a unique username
    while (true) {
      const usernameCheck = await db.query('SELECT id FROM users WHERE username = ?', [username]);
      if (!Array.isArray(usernameCheck) || usernameCheck.length === 0) {
        break; // Username is available
      }
      username = `${baseUsername}${suffix}`;
      suffix++;
    }

    // Hash password using centralized security module
    const passwordHash = await security.hashPassword(password);

    // Generate verification token using centralized security module
    const verificationToken = security.generateSecureToken();

    // Create user
    const insertQuery = `
      INSERT INTO users (email, username, password_hash, full_name, verification_token, email_verified)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    // Users start unverified and must verify email
    const emailVerified = 0;

    await db.query(insertQuery, [
      email,
      username,
      passwordHash,
      fullName || email.split('@')[0],
      verificationToken,
      emailVerified
    ]);

    // Send verification email
    try {
      await sendVerificationEmail(email, fullName || email.split('@')[0], verificationToken);
    } catch (emailError) {
      logger.error('Error sending verification email', { email, error: emailError });
      // Don't fail signup if email fails - user can request resend later
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account before logging in.',
      data: {
        email,
        emailVerified: false,
        requiresVerification: true
      }
    });
  } catch (error) {
    logger.error('Signup error', { error });
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
