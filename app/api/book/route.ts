import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointmentType, location, date, startTime, endTime, persons } = body;

    // Step 1: Get available slots from IND API
    const slotsResponse = await fetch(
      `https://oap.ind.nl/oap/api/desks/${location}/slots?productKey=${appointmentType}&persons=${persons}`,
      {
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'oap-locale': 'en'
        }
      }
    );

    if (!slotsResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch slots from IND API' },
        { status: 500 }
      );
    }

    const slotsData = await slotsResponse.text();
    // IND API returns ")]}',\n" prefix for security - remove it
    const jsonData = JSON.parse(slotsData.substring(6));

    if (jsonData.status !== 'OK') {
      return NextResponse.json(
        { success: false, error: 'Invalid response from IND API' },
        { status: 500 }
      );
    }

    // Step 2: Find the matching slot
    const matchingSlot = jsonData.data.find((slot: any) =>
      slot.date === date &&
      slot.startTime === startTime &&
      slot.endTime === endTime
    );

    if (!matchingSlot) {
      return NextResponse.json(
        { success: false, error: 'Slot no longer available' },
        { status: 404 }
      );
    }

    // Step 3: Reserve the slot by POSTing to the IND API
    const reserveResponse = await fetch(
      `https://oap.ind.nl/oap/api/desks/${appointmentType}/${location}/slots/${matchingSlot.key}`,
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'oap-locale': 'en'
        },
        body: JSON.stringify({
          key: matchingSlot.key,
          date: matchingSlot.date,
          startTime: matchingSlot.startTime,
          endTime: matchingSlot.endTime,
          parts: matchingSlot.parts
        })
      }
    );

    if (!reserveResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to reserve slot' },
        { status: 500 }
      );
    }

    const reserveData = await reserveResponse.text();
    const reserveJson = JSON.parse(reserveData.substring(6));

    if (reserveJson.status !== 'OK') {
      return NextResponse.json(
        { success: false, error: 'Failed to reserve slot' },
        { status: 500 }
      );
    }

    // Step 4: The IND system uses hash routing, so we construct the booking URL
    // After reserving a slot via API, the user needs to be directed to the booking page
    // The IND SPA will handle the routing based on the hash
    const bookingUrl = `https://oap.ind.nl/oap/en/#/${appointmentType.toLowerCase()}`;

    return NextResponse.json({
      success: true,
      data: {
        bookingUrl,
        slotKey: matchingSlot.key,
        message: 'Slot reserved successfully. Please complete your booking within 15 minutes.'
      }
    });

  } catch (error) {
    console.error('Booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
