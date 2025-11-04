// Test script for expat center scrapers
import { fetchTheHagueICAppointments, fetchRotterdamICAppointments } from './lib/expat-centers.ts';

async function testScrapers() {
  console.log('=== TESTING EXPAT CENTER SCRAPERS ===\n');

  // Test The Hague IC
  console.log('[1] Testing The Hague International Centre scraper...');
  try {
    const thicAppointments = await fetchTheHagueICAppointments('pickup', 1, 1);
    console.log(`✓ The Hague IC: Found ${thicAppointments.length} appointments`);
    if (thicAppointments.length > 0) {
      console.log('Sample appointment:', thicAppointments[0]);
    }
  } catch (error) {
    console.error('✗ The Hague IC error:', error.message);
  }

  console.log('\n[2] Testing Rotterdam International Center scraper...');
  try {
    const ricAppointments = await fetchRotterdamICAppointments();
    console.log(`✓ Rotterdam IC: Found ${ricAppointments.length} appointments`);
    if (ricAppointments.length > 0) {
      console.log('Sample appointment:', ricAppointments[0]);
    }
  } catch (error) {
    console.error('✗ Rotterdam IC error:', error.message);
  }

  console.log('\n=== TEST COMPLETE ===');
}

testScrapers();
