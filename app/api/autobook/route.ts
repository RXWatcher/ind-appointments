import { NextRequest, NextResponse } from 'next/server';

/**
 * Automated IND Appointment Booking API
 * Uses browser automation to fill the IND booking form
 */
export async function POST(request: NextRequest) {
  try {
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

    // Generate the booking URL based on appointment type
    const bookingUrls: Record<string, string> = {
      'DOC': 'https://oap.ind.nl/oap/en/#/doc',
      'BIO': 'https://oap.ind.nl/oap/en/#/bio',
      'VAA': 'https://oap.ind.nl/oap/en/#/vaa',
      'TKV': 'https://oap.ind.nl/oap/en/#/tkv',
      'UKR': 'https://oap.ind.nl/oap/en/#/ukr',
      'FAM': 'https://oap.ind.nl/oap/en/#/fam'
    };

    const bookingUrl = bookingUrls[appointmentType];
    if (!bookingUrl) {
      return NextResponse.json(
        { success: false, error: 'Invalid appointment type' },
        { status: 400 }
      );
    }

    // Return automation instructions for the client
    return NextResponse.json({
      success: true,
      data: {
        bookingUrl,
        automationSteps: {
          location: locationName,
          persons: parseInt(persons),
          date,
          time: `${startTime} - ${endTime}`,
          instructions: [
            `1. Opening ${bookingUrl}`,
            `2. Selecting location: ${locationName}`,
            `3. Setting persons: ${persons}`,
            `4. Navigating to date: ${date}`,
            `5. Selecting time: ${startTime} - ${endTime}`,
            `6. Taking you to personal details form`
          ]
        }
      }
    });

  } catch (error) {
    console.error('Autobook error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
