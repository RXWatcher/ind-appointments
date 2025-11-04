import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const appointmentType = searchParams.get('type');
    const location = searchParams.get('location');
    const persons = searchParams.get('persons');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = `
      SELECT
        id,
        appointment_key,
        date,
        start_time,
        end_time,
        appointment_type,
        location,
        location_name,
        appointment_type_name,
        persons,
        first_seen_at,
        last_seen_at,
        source
      FROM ind_appointments
      WHERE is_available = 1
        AND (
          date > date('now', 'localtime')
          OR (date = date('now', 'localtime') AND start_time > time('now', 'localtime'))
        )
    `;

    const params: any[] = [];

    if (appointmentType) {
      // THIC appointments support multiple types (BIO, DOC, VAA)
      // Show them when filtering for any of these types
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

    query += ' ORDER BY date ASC, start_time ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const appointments = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM ind_appointments
      WHERE is_available = 1
        AND (
          date > date('now', 'localtime')
          OR (date = date('now', 'localtime') AND start_time > time('now', 'localtime'))
        )`;
    const countParams: any[] = [];

    if (appointmentType) {
      // THIC appointments support multiple types (BIO, DOC, VAA)
      // Show them when filtering for any of these types
      if (['BIO', 'DOC', 'VAA'].includes(appointmentType)) {
        countQuery += ' AND (appointment_type = ? OR location = \'THIC\')';
        countParams.push(appointmentType);
      } else {
        countQuery += ' AND appointment_type = ?';
        countParams.push(appointmentType);
      }
    }

    if (location) {
      countQuery += ' AND location = ?';
      countParams.push(location);
    }

    if (persons) {
      countQuery += ' AND persons = ?';
      countParams.push(parseInt(persons));
    }

    if (dateFrom) {
      countQuery += ' AND date >= ?';
      countParams.push(dateFrom);
    }

    if (dateTo) {
      countQuery += ' AND date <= ?';
      countParams.push(dateTo);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = (countResult[0] as any).total;

    return NextResponse.json({
      success: true,
      data: {
        appointments,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Trigger manual appointment check (admin only)
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { checkAndNotifyNewAppointments } = await import('@/lib/appointment-checker');
    const result = await checkAndNotifyNewAppointments();

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error triggering appointment check:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
