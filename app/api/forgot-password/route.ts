import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/database';
import { sendPasswordResetEmail } from '@/lib/email';

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

    // Find user by email
    const users = await db.query(
      'SELECT id, email, full_name FROM users WHERE email = ?',
      [email]
    );

    // Don't reveal if email exists for security
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'If this email is registered, a password reset link has been sent.'
      });
    }

    const user = users[0] as any;

    // Generate reset token (expires in 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Update user with reset token
    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, expiresAt.toISOString(), user.id]
    );

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, user.full_name || email.split('@')[0], resetToken);
      console.log(`Password reset email sent to: ${email}`);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return NextResponse.json(
        { success: false, message: 'Failed to send email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'If this email is registered, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
