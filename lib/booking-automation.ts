import { chromium, Browser, Page } from 'playwright';

export interface BookingDetails {
  appointmentType: string;
  location: string;
  locationName: string;
  date: string;
  startTime: string;
  endTime: string;
  persons: number;
}

export async function automateBookingFlow(details: BookingDetails): Promise<{ success: boolean; url?: string; error?: string }> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser in headless mode
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Navigate to the booking page for this appointment type
    const bookingUrl = `https://oap.ind.nl/oap/en/#/${details.appointmentType.toLowerCase()}`;
    await page.goto(bookingUrl, { waitUntil: 'networkidle' });

    // Wait for the location dropdown to be visible
    await page.waitForSelector('select, [role="combobox"]', { timeout: 10000 });

    // Step 1: Select the location
    // Try to find the select element or combobox
    const locationSelector = 'select, [role="combobox"]';
    await page.waitForSelector(locationSelector);

    // Fill the location - look for the option with matching text
    const locationFilled = await page.evaluate((locationName) => {
      const selects = Array.from(document.querySelectorAll('select, [role="combobox"]'));
      for (const select of selects) {
        const options = Array.from(select.querySelectorAll('option'));
        const matchingOption = options.find(opt => opt.textContent?.includes(locationName));
        if (matchingOption && select instanceof HTMLSelectElement) {
          select.value = matchingOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, details.locationName);

    if (!locationFilled) {
      throw new Error('Failed to select location');
    }

    // Wait for slots to load
    await page.waitForTimeout(2000);

    // Step 2: Set the person count
    await page.evaluate((persons) => {
      const spinButton = document.querySelector('[role="spinbutton"]') as HTMLInputElement;
      if (spinButton) {
        spinButton.value = persons.toString();
        spinButton.dispatchEvent(new Event('change', { bubbles: true }));
        spinButton.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, details.persons);

    await page.waitForTimeout(1000);

    // Step 3: Click on the date
    // Format date: "2025-12-02" -> need to click on day "2"
    const dayOfMonth = new Date(details.date).getDate().toString();

    // Find and click the date in the calendar
    const dateClicked = await page.evaluate((day) => {
      const allText = Array.from(document.querySelectorAll('*')).filter(el => {
        return el.textContent?.trim() === day &&
               el.tagName !== 'SCRIPT' &&
               el.tagName !== 'STYLE' &&
               !el.querySelector('*'); // Leaf node
      });

      for (const el of allText) {
        const clickable = el as HTMLElement;
        if (clickable.onclick || clickable.parentElement?.onclick) {
          clickable.click();
          return true;
        }
      }
      return false;
    }, dayOfMonth);

    if (!dateClicked) {
      throw new Error('Failed to click date');
    }

    // Wait for time slots to populate
    await page.waitForTimeout(2000);

    // Step 4: Select the time slot
    const timeSlotText = `${details.startTime} - ${details.endTime}`;
    await page.evaluate((timeText) => {
      const selects = Array.from(document.querySelectorAll('select, [role="combobox"]'));
      for (const select of selects) {
        const options = Array.from(select.querySelectorAll('option'));
        const matchingOption = options.find(opt => opt.textContent?.trim() === timeText);
        if (matchingOption && select instanceof HTMLSelectElement) {
          select.value = matchingOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, timeSlotText);

    await page.waitForTimeout(1000);

    // Step 5: Click "To details" button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const detailsButton = buttons.find(btn =>
        btn.textContent?.includes('details') ||
        btn.textContent?.includes('›')
      );
      if (detailsButton) {
        detailsButton.click();
        return true;
      }
      return false;
    });

    // Wait for the details form to load
    await page.waitForTimeout(3000);

    // Get the current URL (should be at the details form now)
    const finalUrl = page.url();

    await browser.close();

    return {
      success: true,
      url: finalUrl
    };

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('Booking automation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
