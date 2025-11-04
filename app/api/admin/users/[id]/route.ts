import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);
    const body = await request.json();
    const { email_verified } = body;

    // Check if user exists
    const users = await db.query('SELECT id, email FROM users WHERE id = ?', [userId]);
    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Update email_verified status
    if (email_verified !== undefined) {
      await db.query(
        'UPDATE users SET email_verified = ? WHERE id = ?',
        [email_verified ? 1 : 0, userId]
      );

      console.log(`Admin ${auth.email} manually ${email_verified ? 'verified' : 'unverified'} user ${(users[0] as any).email}`);

      return NextResponse.json({
        success: true,
        message: `User ${email_verified ? 'verified' : 'unverified'} successfully`
      });
    }

    return NextResponse.json(
      { success: false, message: 'No valid fields to update' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);

    // Check if user exists
    const users = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deleting yourself
    if (userId === auth.id) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete user (CASCADE will delete related preferences and notifications)
    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
