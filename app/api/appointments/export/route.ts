import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters (same as main appointments endpoint)
    const searchParams = request.nextUrl.searchParams;
    const appointmentType = searchParams.get('type');
    const location = searchParams.get('location');
    const persons = searchParams.get('persons');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query
    let query = `
      SELECT
        date,
        start_time,
        end_time,
        appointment_type_name,
        location_name,
        persons,
        first_seen_at
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

    if (dateFrom) {
      query += ' AND date >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND date <= ?';
      params.push(dateTo);
    }

    query += ' ORDER BY date ASC, start_time ASC';

    const appointments = await db.query(query, params) as any[];

    // Generate CSV content
    const headers = ['Date', 'Start Time', 'End Time', 'Appointment Type', 'Location', 'Persons', 'First Seen'];
    const csvRows = [headers.join(',')];

    for (const appt of appointments) {
      const row = [
        appt.date,
        appt.start_time,
        appt.end_time,
        `"${(appt.appointment_type_name || '').replace(/"/g, '""')}"`,
        `"${(appt.location_name || '').replace(/"/g, '""')}"`,
        appt.persons,
        appt.first_seen_at
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ind-appointments-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting appointments:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
