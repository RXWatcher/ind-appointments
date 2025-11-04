import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointmentType, location, locationName, date, startTime, endTime, persons } = body;

    // Generate a booking helper URL with all the details encoded
    const params = new URLSearchParams({
      type: appointmentType,
      location: location,
      locationName: locationName,
      date: date,
      startTime: startTime,
      endTime: endTime,
      persons: persons.toString()
    });

    const helperUrl = `${request.nextUrl.origin}/book-helper?${params.toString()}`;

    return NextResponse.json({
      success: true,
      data: {
        helperUrl,
        message: 'Booking helper page generated successfully'
      }
    });

  } catch (error) {
    console.error('Booking helper error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
