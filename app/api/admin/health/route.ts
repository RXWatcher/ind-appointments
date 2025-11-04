import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/security';
import { runHealthChecks } from '@/lib/health-monitor';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const healthResult = await runHealthChecks();

    return NextResponse.json({
      success: true,
      data: healthResult
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
