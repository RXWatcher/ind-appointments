import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * Generate iCal (.ics) file for appointments
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appointmentId = searchParams.get('id');
    const appointmentType = searchParams.get('type');
    const location = searchParams.get('location');
    const persons = searchParams.get('persons');

    let appointments: any[] = [];

    if (appointmentId) {
      // Single appointment export
      const result = await db.query(`
        SELECT
          id,
          appointment_key,
          date,
          start_time,
          end_time,
          appointment_type_name,
          location_name,
          location,
          persons
        FROM ind_appointments
        WHERE id = ?
      `, [appointmentId]);

      if (result && result.length > 0) {
        appointments = result as any[];
      }
    } else {
      // Multiple appointments export with filters
      let query = `
        SELECT
          id,
          appointment_key,
          date,
          start_time,
          end_time,
          appointment_type_name,
          location_name,
          location,
          persons
        FROM ind_appointments
        WHERE is_available = 1
          AND (
            date > date('now', 'localtime')
            OR (date = date('now', 'localtime') AND start_time > time('now', 'localtime'))
          )
      `;

      const params: any[] = [];

      if (appointmentType) {
        if (['BIO', 'DOC', 'VAA'].includes(appointmentType)) {
          query += ' AND (appointment_type = ? OR location = \'THIC\')';
          params.push(appointmentType);
        } else {
          query += ' AND appointment_type = ?';
          params.push(appointmentType);
        }
      }

      if (location) {
        query += ' AND location = ?';
        params.push(location);
      }

      if (persons) {
        query += ' AND persons = ?';
        params.push(parseInt(persons));
      }

      query += ' ORDER BY date ASC, start_time ASC LIMIT 100';

      appointments = await db.query(query, params) as any[];
    }

    if (appointments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No appointments found' },
        { status: 404 }
      );
    }

    // Generate iCal content
    const icsContent = generateICalContent(appointments);

    // Return as .ics file
    const filename = appointmentId
      ? `ind-appointment-${appointmentId}.ics`
      : `ind-appointments-${new Date().toISOString().split('T')[0]}.ics`;

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating iCal:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateICalContent(appointments: any[]): string {
  const now = new Date();
  const timestamp = formatICalDate(now);

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IND Appointments Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:IND Appointments',
    'X-WR-TIMEZONE:Europe/Amsterdam',
  ].join('\r\n') + '\r\n';

  // Add timezone definition
  icsContent += [
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Amsterdam',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n') + '\r\n';

  for (const appt of appointments) {
    const uid = `${appt.appointment_key}@ind-appointments.tracker`;
    const summary = `IND: ${appt.appointment_type_name}`;
    const locationText = appt.location_name;
    const description = `IND Appointment\\n` +
      `Type: ${appt.appointment_type_name}\\n` +
      `Location: ${appt.location_name}\\n` +
      `Persons: ${appt.persons}\\n\\n` +
      `Book at: https://oap.ind.nl/oap/en/`;

    // Parse date and times
    const dateStr = appt.date.replace(/-/g, '');
    const startTimeStr = appt.start_time.replace(/:/g, '');
    const endTimeStr = appt.end_time.replace(/:/g, '');

    icsContent += [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;TZID=Europe/Amsterdam:${dateStr}T${startTimeStr}00`,
      `DTEND;TZID=Europe/Amsterdam:${dateStr}T${endTimeStr}00`,
      `SUMMARY:${escapeICalText(summary)}`,
      `LOCATION:${escapeICalText(locationText)}`,
      `DESCRIPTION:${escapeICalText(description)}`,
      'STATUS:TENTATIVE',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:IND Appointment Reminder',
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n') + '\r\n';
  }

  icsContent += 'END:VCALENDAR\r\n';

  return icsContent;
}

function formatICalDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
