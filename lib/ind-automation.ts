/**
 * IND Booking Automation Service
 * Uses Puppeteer to automate the IND booking form
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface AutomationConfig {
  appointmentType: string;
  location: string;
  locationName: string;
  date: string;
  startTime: string;
  endTime: string;
  persons: number;
}

export interface AutomationResult {
  success: boolean;
  message: string;
  error?: string;
  debugUrl?: string;
  steps?: string[];
}

/**
 * Automate the IND booking process
 */
export async function automateINDBooking(config: AutomationConfig): Promise<AutomationResult> {
  const {
    appointmentType,
    location,
    locationName,
    date,
    startTime,
    persons
  } = config;

  // Map appointment types to URLs
  const bookingUrls: Record<string, string> = {
    'DOC': 'https://oap.ind.nl/oap/en/#/doc',
    'BIO': 'https://oap.ind.nl/oap/en/#/bio',
    'VAA': 'https://oap.ind.nl/oap/en/#/vaa',
    'TKV': 'https://oap.ind.nl/oap/en/#/tkv',
    'UKR': 'https://oap.ind.nl/oap/en/#/ukr',
    'FAM': 'https://oap.ind.nl/oap/en/#/fam'
  };

  // Map location codes to exact IND website dropdown text
  const indLocationNames: Record<string, string> = {
    'AM': 'IND Amsterdam',
    'DH': 'IND Den Haag',
    'HAA': 'IND Haarlem',
    'DEN_L14': "IND 's-Hertogenbosch Leeghwaterlaan 14",
    'DEN_M222': "IND 's-Hertogenbosch Magistratenlaan 222",
    'ZW': 'IND Zwolle',
    'EXP_EN': 'Expatcenter Enschede',
    'EXP_UT': 'Expatcenter Utrecht',
    'MAA': 'Expat Centre Maastricht',
    'GO': 'IND Service Point Goes',
    'AM_UKR': 'IND Amsterdam'
  };

  // Use the exact IND website location name
  const exactLocationName = indLocationNames[location] || locationName;

  const bookingUrl = bookingUrls[appointmentType];
  if (!bookingUrl) {
    return {
      success: false,
      message: 'Invalid appointment type',
      error: `Unknown appointment type: ${appointmentType}`
    };
  }

  let browser: Browser | null = null;
  const steps: string[] = [];

  try {
    console.log('[AUTOMATION] Launching browser...');
    steps.push('Launching browser');

    browser = await puppeteer.launch({
      headless: false, // Show the browser so user can see what's happening
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1200,900'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });

    // Step 1: Navigate to IND booking page
    console.log(`[AUTOMATION] Navigating to ${bookingUrl}...`);
    steps.push(`Opening ${bookingUrl}`);
    await page.goto(bookingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Select location
    console.log(`[AUTOMATION] Selecting location: ${exactLocationName}...`);
    steps.push(`Selecting location: ${exactLocationName}`);

    await page.waitForSelector('select, [role="combobox"]', { timeout: 10000 });

    // Try to find and select the location
    const locationSelected = await page.evaluate((locName) => {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = Array.from(select.querySelectorAll('option'));
        const targetOption = options.find(opt => opt.textContent?.trim() === locName);
        if (targetOption) {
          select.value = targetOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, exactLocationName);

    if (!locationSelected) {
      throw new Error(`Could not find location: ${exactLocationName}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Set person count
    console.log(`[AUTOMATION] Setting persons to: ${persons}...`);
    steps.push(`Setting ${persons} person(s)`);

    await page.evaluate((targetPersons) => {
      const spinButtons = document.querySelectorAll('[role="spinbutton"], input[type="number"]');
      for (const input of spinButtons) {
        const currentValue = parseInt((input as HTMLInputElement).value || '1');
        const diff = targetPersons - currentValue;

        if (diff !== 0) {
          const buttonSelector = diff > 0 ? 'button:has-text("+")' : 'button:has-text("-")';
          const parentContainer = input.closest('div');

          if (parentContainer) {
            const buttons = parentContainer.querySelectorAll('button');
            const targetButton = Array.from(buttons).find(btn =>
              btn.textContent?.includes(diff > 0 ? '+' : '-')
            );

            if (targetButton) {
              for (let i = 0; i < Math.abs(diff); i++) {
                (targetButton as HTMLButtonElement).click();
              }
            }
          }
        }
        break;
      }
    }, persons);

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 4: Wait for calendar to load and select date
    console.log(`[AUTOMATION] Waiting for calendar...`);
    steps.push('Waiting for available dates to load');

    await new Promise(resolve => setTimeout(resolve, 3000));

    const dayOfMonth = new Date(date).getDate();
    console.log(`[AUTOMATION] Clicking on day: ${dayOfMonth}...`);
    steps.push(`Selecting date: day ${dayOfMonth}`);

    // Click the date
    const dateClicked = await page.evaluate((day) => {
      const buttons = document.querySelectorAll('button, [role="button"], td, div[class*="day"]');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === day.toString()) {
          const element = btn as HTMLElement;
          // Check if it's not disabled
          if (!element.hasAttribute('disabled') &&
              !element.classList.contains('disabled') &&
              !element.classList.contains('unavailable')) {
            element.click();
            return true;
          }
        }
      }
      return false;
    }, dayOfMonth);

    if (!dateClicked) {
      throw new Error(`Could not click date ${dayOfMonth} - it may not be available`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: Select time slot
    console.log(`[AUTOMATION] Selecting time: ${startTime}...`);
    steps.push(`Selecting time slot: ${startTime}`);

    await page.waitForSelector('select[class*="time"], [aria-label*="time"], select', { timeout: 5000 });

    // Get available time slots for debugging
    const availableTimes = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = Array.from(select.querySelectorAll('option'));
        if (options.length > 1 && options.some(opt => opt.textContent?.match(/\d{1,2}:\d{2}/))) {
          return options.map(opt => opt.textContent?.trim()).filter(t => t && t !== '');
        }
      }
      return [];
    });

    console.log(`[AUTOMATION] Available time slots:`, availableTimes);

    const timeSelected = await page.evaluate((time) => {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = Array.from(select.querySelectorAll('option'));
        // Try exact match first
        let targetOption = options.find(opt => opt.textContent?.includes(time));

        // If not found, try matching just the start time without end time
        if (!targetOption) {
          const timeStart = time.split(':')[0] + ':' + time.split(':')[1];
          targetOption = options.find(opt => opt.textContent?.startsWith(timeStart));
        }

        if (targetOption && targetOption.value) {
          select.value = targetOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, startTime);

    if (!timeSelected) {
      // If the exact time is not available, try to select the FIRST available time slot
      console.log(`[AUTOMATION] Exact time ${startTime} not found, trying first available slot...`);
      steps.push(`⚠️ Time ${startTime} unavailable, selecting first available slot`);

      const fallbackTimeSelected = await page.evaluate(() => {
        const selects = document.querySelectorAll('select');
        for (const select of selects) {
          const options = Array.from(select.querySelectorAll('option'));
          if (options.length > 1) {
            // Find first non-empty option
            const firstValidOption = options.find(opt => opt.value && opt.value !== '' && opt.textContent?.match(/\d{1,2}:\d{2}/));
            if (firstValidOption) {
              select.value = firstValidOption.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              select.dispatchEvent(new Event('input', { bubbles: true }));
              return firstValidOption.textContent?.trim();
            }
          }
        }
        return null;
      });

      if (!fallbackTimeSelected) {
        const availableTimesStr = availableTimes.length > 0
          ? `\n\nAvailable times: ${availableTimes.slice(0, 5).join(', ')}${availableTimes.length > 5 ? '...' : ''}`
          : '';
        throw new Error(`No time slots available on this date${availableTimesStr}`);
      }

      console.log(`[AUTOMATION] ✓ Selected alternative time: ${fallbackTimeSelected}`);
      steps.push(`✓ Selected alternative time: ${fallbackTimeSelected}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 6: Click "To details" button
    console.log('[AUTOMATION] Clicking "To details" button...');
    steps.push('Proceeding to personal details form');

    const detailsButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('To details') || btn.textContent?.includes('details')) {
          if (!btn.hasAttribute('disabled')) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });

    if (!detailsButtonClicked) {
      throw new Error('Could not click "To details" button - it may be disabled');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[AUTOMATION] ✅ Successfully automated booking form!');
    console.log('[AUTOMATION] Browser will remain open for user to complete personal details');
    steps.push('✓ Ready for personal information');
    steps.push('⚠️ Browser left open - complete your booking!');

    // Get URL before disconnecting
    const pages = await browser.pages();
    const currentUrl = pages[0] ? await pages[0].url() : bookingUrl;

    // IMPORTANT: Disconnect (not close) the browser to keep it running independently
    // This detaches the Node.js process from the browser but keeps the browser window open
    browser.disconnect();

    console.log('[AUTOMATION] Browser disconnected - running independently now');
    console.log('[AUTOMATION] User should manually close the browser window when done');

    return {
      success: true,
      message: 'Automation completed successfully. Browser left open for you to enter personal details and complete booking. Close the browser window when done.',
      debugUrl: currentUrl,
      steps
    };

  } catch (error) {
    console.error('[AUTOMATION] Error:', error);

    // Close browser on error
    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      message: 'Automation failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      steps: [...steps, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Helper to parse date string and get day of month
 */
export function getDayOfMonth(dateString: string): number {
  return new Date(dateString).getDate();
}

/**
 * Helper to get month and year from date
 */
export function getMonthYear(dateString: string): { month: string; year: number } {
  const date = new Date(dateString);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    month: months[date.getMonth()],
    year: date.getFullYear()
  };
}
