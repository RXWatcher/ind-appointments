import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/settings?error=invalid_token', request.url));
    }

    // Find user with this email change token
    const users = await db.query(
      `SELECT id, email, pending_email, email_change_requested_at
       FROM users
       WHERE email_change_token = ? AND pending_email IS NOT NULL`,
      [token]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.redirect(new URL('/settings?error=invalid_token', request.url));
    }

    const user = users[0] as any;

    // Check if token is expired (24 hours)
    const requestedAt = new Date(user.email_change_requested_at);
    const now = new Date();
    const hoursSinceRequest = (now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceRequest > 24) {
      console.log(`Email change token expired for user: ${user.email}`);
      // Clear the expired request
      await db.query(
        `UPDATE users
         SET pending_email = NULL,
             email_change_token = NULL,
             email_change_requested_at = NULL
         WHERE id = ?`,
        [user.id]
      );
      return NextResponse.redirect(new URL('/settings?error=token_expired', request.url));
    }

    // Check if new email is still available
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [user.pending_email, user.id]
    );

    if (Array.isArray(emailCheck) && emailCheck.length > 0) {
      // Email is now taken, clear the request
      await db.query(
        `UPDATE users
         SET pending_email = NULL,
             email_change_token = NULL,
             email_change_requested_at = NULL
         WHERE id = ?`,
        [user.id]
      );
      return NextResponse.redirect(new URL('/settings?error=email_taken', request.url));
    }

    // Update email and clear the pending request
    await db.query(
      `UPDATE users
       SET email = ?,
           pending_email = NULL,
           email_change_token = NULL,
           email_change_requested_at = NULL,
           email_verified = 1
       WHERE id = ?`,
      [user.pending_email, user.id]
    );

    console.log(`Email changed from ${user.email} to ${user.pending_email} for user ID: ${user.id}`);

    // Send confirmation email to new address
    try {
      const { sendEmailChangeConfirmationEmail } = await import('@/lib/email');
      await sendEmailChangeConfirmationEmail(user.pending_email, user.email);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the change if confirmation email fails
    }

    // Redirect to settings with success message
    return NextResponse.redirect(new URL('/settings?message=email_changed', request.url));
  } catch (error) {
    console.error('Email change verification error:', error);
    return NextResponse.redirect(new URL('/settings?error=verification_failed', request.url));
  }
}
