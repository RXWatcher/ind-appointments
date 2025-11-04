// Test all The Hague IC appointment types
import { fetchTheHagueICAppointments } from './lib/expat-centers.ts';

async function testAllTypes() {
  console.log('=== TESTING ALL THE HAGUE IC APPOINTMENT TYPES ===\n');

  const types = ['pickup', 'combined', 'certificate', 'municipal'];

  for (const type of types) {
    console.log(`[${type.toUpperCase()}] Testing...`);
    try {
      const appointments = await fetchTheHagueICAppointments(type, 1, 1);
      console.log(`✓ Found ${appointments.length} appointments`);
      if (appointments.length > 0) {
        console.log('First 3 appointments:');
        appointments.slice(0, 3).forEach(apt => {
          console.log(`  - ${apt.date} ${apt.startTime}-${apt.endTime}`);
        });
      }
    } catch (error) {
      console.error(`✗ Error:`, error.message);
    }
    console.log('');
  }

  console.log('=== TEST COMPLETE ===');
}

testAllTypes();
