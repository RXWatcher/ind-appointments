// Quick test script to check IND API
const https = require('https');

const url = 'https://oap.ind.nl/oap/api/desks/AM/slots?productKey=BIO&persons=1';

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    // Remove the ")]}'" prefix
    const jsonData = data.substring(5);
    const parsed = JSON.parse(jsonData);

    console.log('✅ IND API Test Results:\n');
    console.log(`Status: ${parsed.status}`);
    console.log(`Total appointments found: ${parsed.data.length}`);
    console.log('\nFirst 10 appointments:\n');

    parsed.data.slice(0, 10).forEach((appt, i) => {
      console.log(`${i + 1}. ${appt.date} at ${appt.startTime}-${appt.endTime}`);
    });

    console.log('\n✅ API is working perfectly!');
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
