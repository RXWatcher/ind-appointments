import { NextRequest, NextResponse } from 'next/server';
import { automateINDBooking } from '@/lib/ind-automation';

/**
 * Server-Side Browser Automation API
 * Uses Puppeteer to fully automate IND booking form
 */
export async function POST(request: NextRequest) {
  try {
    // Check if automation is enabled via environment variable
    const automationEnabled = process.env.ENABLE_BROWSER_AUTOMATION !== 'false';

    if (!automationEnabled) {
      return NextResponse.json({
        success: false,
        error: 'Browser automation is disabled',
        message: 'Please use the manual booking helper'
      }, { status: 503 });
    }

    const body = await request.json();
    const {
      appointmentType,
      location,
      locationName,
      date,
      startTime,
      endTime,
      persons
    } = body;

    // Validate required fields
    if (!appointmentType || !location || !locationName || !date || !startTime || !persons) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`[API] Starting automation for ${locationName} on ${date} at ${startTime}`);

    // Run the automation
    const result = await automateINDBooking({
      appointmentType,
      location,
      locationName,
      date,
      startTime,
      endTime,
      persons: parseInt(persons)
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          steps: result.steps,
          debugUrl: result.debugUrl
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Automation failed',
        steps: result.steps
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[API] Automation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get automation service status
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    service: 'IND Booking Automation',
    status: 'available',
    info: 'Use POST with appointment details to automate booking'
  });
}
