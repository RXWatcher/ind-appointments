import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/security';
import {
  buildAppointmentQuery,
  generateCSV,
} from '@/lib/query-utils';
import { db } from '@/lib/database';
import { HTTP, PAGINATION } from '@/lib/constants';
import type { AppointmentRow, AppointmentFilters } from '@/lib/types';
import type { AppointmentType, Location } from '@/lib/ind-api';

/**
 * GET /api/appointments/export
 * Export appointments to CSV format
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;

    // Build filters from query params
    const filters: AppointmentFilters = {};

    const appointmentType = searchParams.get('type');
    if (appointmentType) {
      filters.appointmentType = appointmentType as AppointmentType;
    }

    const location = searchParams.get('location');
    if (location) {
      filters.location = location as Location | 'ALL';
    }

    const persons = searchParams.get('persons');
    if (persons) {
      const parsedPersons = parseInt(persons, 10);
      if (!isNaN(parsedPersons) && parsedPersons > 0) {
        filters.persons = parsedPersons;
      }
    }

    const dateFrom = searchParams.get('dateFrom');
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      filters.dateFrom = dateFrom;
    }

    const dateTo = searchParams.get('dateTo');
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      filters.dateTo = dateTo;
    }

    // Build and execute query (limit to prevent abuse)
    const query = buildAppointmentQuery(filters, {
      selectFields: `
        date,
        start_time,
        end_time,
        appointment_type_name,
        location_name,
        persons,
        first_seen_at
      `,
      limit: PAGINATION.MAX_PAGE_SIZE * 10, // Max 2000 appointments
    });

    const appointments = db.query<AppointmentRow>(query.sql, query.params);

    // Generate CSV content with injection protection
    const csvContent = generateCSV(appointments);

    // Return CSV file
    const filename = `ind-appointments-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': HTTP.CONTENT_TYPE_CSV,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(Buffer.byteLength(csvContent, 'utf-8')),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[EXPORT] Error exporting appointments:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
