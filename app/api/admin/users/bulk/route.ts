import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, userIds } = body;

    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid request: action and userIds are required' },
        { status: 400 }
      );
    }

    // Prevent operating on self
    const filteredIds = userIds.filter(id => id !== auth.id);

    if (filteredIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Cannot perform bulk operations on your own account' },
        { status: 400 }
      );
    }

    const placeholders = filteredIds.map(() => '?').join(',');

    let result;
    let message = '';

    switch (action) {
      case 'delete':
        result = await db.query(
          `DELETE FROM users WHERE id IN (${placeholders})`,
          filteredIds
        );
        message = `Successfully deleted ${filteredIds.length} user(s)`;
        console.log(`Admin ${auth.email} bulk deleted ${filteredIds.length} users`);
        break;

      case 'verify':
        result = await db.query(
          `UPDATE users SET email_verified = 1 WHERE id IN (${placeholders})`,
          filteredIds
        );
        message = `Successfully verified ${filteredIds.length} user(s)`;
        console.log(`Admin ${auth.email} bulk verified ${filteredIds.length} users`);
        break;

      case 'unverify':
        result = await db.query(
          `UPDATE users SET email_verified = 0 WHERE id IN (${placeholders})`,
          filteredIds
        );
        message = `Successfully unverified ${filteredIds.length} user(s)`;
        console.log(`Admin ${auth.email} bulk unverified ${filteredIds.length} users`);
        break;

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message,
      data: { affected: filteredIds.length }
    });
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
