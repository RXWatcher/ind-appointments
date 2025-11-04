import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
    }

    // Find user with this verification token
    const users = await db.query(
      'SELECT id, email, email_verified, created_at FROM users WHERE verification_token = ?',
      [token]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
    }

    const user = users[0] as any;

    // Check if token is expired (24 hours)
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation > 24) {
      console.log(`Verification token expired for user: ${user.email}`);
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
    }

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.redirect(new URL('/login?message=already_verified', request.url));
    }

    // Mark user as verified and clear the verification token
    await db.query(
      'UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?',
      [user.id]
    );

    console.log(`Email verified for user: ${user.email}`);

    // Send welcome email
    try {
      const { sendWelcomeEmail } = await import('@/lib/email');
      await sendWelcomeEmail(user.email, user.full_name || 'User');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail verification if welcome email fails
    }

    // Redirect to login with success message
    return NextResponse.redirect(new URL('/login?message=email_verified', request.url));
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(new URL('/login?error=verification_failed', request.url));
  }
}
