import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apply rate limiting (3 attempts per hour per user)
    const rateLimitResult = rateLimit(`change-email:${auth.id}`, 3, 60 * 60 * 1000);

    if (!rateLimitResult.allowed) {
      const waitMinutes = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 60000);
      return NextResponse.json(
        {
          success: false,
          message: `Too many email change requests. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { newEmail } = body;

    // Validate input
    if (!newEmail || !newEmail.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Valid email address is required' },
        { status: 400 }
      );
    }

    // Get current user
    const users = await db.query(
      'SELECT email, username FROM users WHERE id = ?',
      [auth.id]
    );

    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const currentUser = users[0] as any;
    const currentEmail = currentUser.email;
    const username = currentUser.username || 'User';

    // Check if new email is same as current
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: 'New email is the same as current email' },
        { status: 400 }
      );
    }

    // Check if new email is already in use
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [newEmail, auth.id]
    );

    if (Array.isArray(emailCheck) && emailCheck.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Email address is already in use' },
        { status: 409 }
      );
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Store pending email change
    await db.query(
      `UPDATE users
       SET pending_email = ?,
           email_change_token = ?,
           email_change_requested_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newEmail, verificationToken, auth.id]
    );

    // Send verification email to NEW address
    try {
      const { sendEmailChangeVerificationEmail } = await import('@/lib/email');
      await sendEmailChangeVerificationEmail(newEmail, username, verificationToken);
    } catch (emailError) {
      console.error('Error sending email change verification:', emailError);
      return NextResponse.json(
        { success: false, message: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    // Send notification to OLD address
    try {
      const { sendEmailChangeNotificationEmail } = await import('@/lib/email');
      await sendEmailChangeNotificationEmail(currentEmail, username, newEmail);
    } catch (emailError) {
      console.error('Error sending email change notification:', emailError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: `Verification email sent to ${newEmail}. Please check your inbox and click the link to complete the email change.`
    });
  } catch (error) {
    console.error('Change email request error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
