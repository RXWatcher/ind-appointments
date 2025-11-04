// Manual script to scrape and insert expat center appointments
import Database from 'better-sqlite3';
import { fetchTheHagueICAppointments, fetchRotterdamICAppointments } from './lib/expat-centers.ts';

const db = new Database('./data/ind_appointments.db');

async function manualExpatScrape() {
  console.log('=== MANUAL EXPAT CENTER SCRAPING ===\n');

  let totalInserted = 0;

  // The Hague IC - IND Services (pickup type works for all services)
  // Note: The Hague IC uses the same appointment pool for all IND services
  // (biometrics, document collection, stickers, etc.)
  // Scrape for 1-6 people
  try {
    console.log('[1] Scraping The Hague IC - IND Services...');

    for (let personCount = 1; personCount <= 6; personCount++) {
      console.log(`\n  Fetching appointments for ${personCount} person(s)...`);
      const thicPickup = await fetchTheHagueICAppointments('pickup', personCount, 1, 6);
      console.log(`  Found ${thicPickup.length} appointments`);

      if (thicPickup.length > 0) {
        // Insert as Document Collection
        const insertedDoc = insertAppointments(thicPickup, 'THE_HAGUE_IC', 'DOC', 'THIC', 'The Hague International Centre', 'Document Collection', `_DOC_P${personCount}`, personCount);
        totalInserted += insertedDoc;
        console.log(`  ✓ Inserted ${insertedDoc} document collection appointments`);

        // Insert same appointments as Biometrics
        const insertedBio = insertAppointments(thicPickup, 'THE_HAGUE_IC', 'BIO', 'THIC', 'The Hague International Centre', 'Biometrics', `_BIO_P${personCount}`, personCount);
        totalInserted += insertedBio;
        console.log(`  ✓ Inserted ${insertedBio} biometrics appointments`);

        // Insert same appointments as Residence Endorsement Sticker
        const insertedVaa = insertAppointments(thicPickup, 'THE_HAGUE_IC', 'VAA', 'THIC', 'The Hague International Centre', 'Residence Endorsement Sticker', `_VAA_P${personCount}`, personCount);
        totalInserted += insertedVaa;
        console.log(`  ✓ Inserted ${insertedVaa} sticker appointments`);
      }

      // Rate limiting between person counts
      if (personCount < 6) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('');
  } catch (error) {
    console.error('✗ The Hague IC error:', error.message);
  }

  // Rotterdam IC
  try {
    console.log('[2] Scraping Rotterdam IC...');
    const ricAppointments = await fetchRotterdamICAppointments();
    console.log(`Found ${ricAppointments.length} appointments`);

    if (ricAppointments.length > 0) {
      const inserted = insertAppointments(ricAppointments, 'ROTTERDAM_IC', 'BIO', 'RIC', 'Rotterdam International Center', 'Biometrics');
      totalInserted += inserted;
      console.log(`✓ Inserted ${inserted} new appointments\n`);
    }
  } catch (error) {
    console.error('✗ Rotterdam IC error:', error.message);
  }

  console.log(`\n=== COMPLETE: ${totalInserted} total new appointments inserted ===`);
  db.close();
}

function insertAppointments(appointments, source, appointmentType, location, locationName, appointmentTypeName, keySuffix = '', personCount = 1) {
  // Add suffix to keys to differentiate between appointment types
  const keys = appointments.map(a => a.key + keySuffix);
  const placeholders = keys.map(() => '?').join(',');
  const existingQuery = `SELECT appointment_key FROM ind_appointments WHERE appointment_key IN (${placeholders})`;
  const existingRows = db.prepare(existingQuery).all(...keys);
  const existingKeys = new Set(existingRows.map(row => row.appointment_key));

  // Filter to only new appointments
  const newAppointments = appointments.filter((a, idx) => !existingKeys.has(keys[idx]));

  if (newAppointments.length === 0) {
    return 0;
  }

  // Insert new appointments
  const insertStmt = db.prepare(`
    INSERT INTO ind_appointments (
      appointment_key, date, start_time, end_time,
      appointment_type, location, location_name, appointment_type_name,
      persons, parts, source, is_available
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertMany = db.transaction((appointments) => {
    for (let i = 0; i < appointments.length; i++) {
      const apt = appointments[i];
      insertStmt.run(
        keys[i], // Use the key with suffix
        apt.date,
        apt.startTime,
        apt.endTime,
        appointmentType,
        location,
        locationName,
        appointmentTypeName,
        personCount, // Use the provided person count
        apt.parts,
        source
      );
    }
  });

  insertMany(newAppointments);
  return newAppointments.length;
}

manualExpatScrape().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
