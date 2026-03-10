import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/security';
import {
  buildAppointmentQuery,
  generateICalContent,
  getAppointmentById,
} from '@/lib/query-utils';
import { db } from '@/lib/database';
import { HTTP, ICAL } from '@/lib/constants';
import type { AppointmentRow, AppointmentFilters } from '@/lib/types';
import type { AppointmentType, Location } from '@/lib/ind-api';

/**
 * GET /api/appointments/ical
 * Generate iCal (.ics) file for appointments
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

    const searchParams = request.nextUrl.searchParams;
    const appointmentId = searchParams.get('id');

    let appointments: AppointmentRow[] = [];

    if (appointmentId) {
      // Single appointment export
      const id = parseInt(appointmentId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { success: false, message: 'Invalid appointment ID' },
          { status: 400 }
        );
      }

      const appointment = getAppointmentById(id);
      if (appointment) {
        appointments = [appointment];
      }
    } else {
      // Multiple appointments export with filters
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

      const query = buildAppointmentQuery(filters, {
        limit: ICAL.MAX_EXPORT_APPOINTMENTS,
      });

      appointments = db.query<AppointmentRow>(query.sql, query.params);
    }

    if (appointments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No appointments found' },
        { status: 404 }
      );
    }

    // Generate iCal content with proper line folding (RFC 5545 compliant)
    const icsContent = generateICalContent(appointments);

    // Return as .ics file
    const filename = appointmentId
      ? `ind-appointment-${appointmentId}.ics`
      : `ind-appointments-${new Date().toISOString().split('T')[0]}.ics`;

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': HTTP.CONTENT_TYPE_ICAL,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(Buffer.byteLength(icsContent, 'utf-8')),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[ICAL] Error generating iCal:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
