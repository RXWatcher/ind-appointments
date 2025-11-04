// Quick test script to debug the automation
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  console.log('Opening IND page...');
  await page.goto('https://oap.ind.nl/oap/en/#/bio', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: '1-initial-page.png' });

  console.log('Selecting location...');
  await page.waitForSelector('select');
  await page.select('select', 'IND Amsterdam');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '2-after-location.png' });

  console.log('Waiting for calendar...');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '3-calendar-loaded.png' });

  // Check what's actually on the page
  const pageContent = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select')).map(s => ({
      options: Array.from(s.querySelectorAll('option')).map(o => o.textContent)
    }));

    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t && t.length < 50);

    return { selects, buttonSample: buttons.slice(0, 20) };
  });

  console.log('Page content:', JSON.stringify(pageContent, null, 2));

  console.log('\n\nBrowser will stay open for 30 seconds. Check the screenshots!');
  await new Promise(r => setTimeout(r, 30000));

  await browser.close();
})();
