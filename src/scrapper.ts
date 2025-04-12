import puppeteer, { Page } from 'puppeteer';
import 'dotenv/config';
import yargs from 'yargs';
import fs from 'fs/promises';
import { prompt } from 'enquirer';
import { getEventLinks } from './eventLinks';
import { scrapeAttendees } from './attendees';
import { generateExcel } from './excelGenerator';

// Login to Lu.ma with email OTP
async function loginToLuma(email: string, page: Page) {
  try {
    await page.goto('https://lu.ma/signin', { waitUntil: 'networkidle2' });

    console.log('Logging in...');

    await page.waitForSelector('input[placeholder="you@email.com"]', { timeout: 10000000, visible: true });
    await page.focus('input[placeholder="you@email.com"]');
    await page.keyboard.type(email, { delay: 100 });
    await page.click('button[type="submit"]');
    console.log('Entered email:', email);


    // Enter OTP
    await page.waitForSelector('input[inputmode="numeric"]', { timeout: 3000000, visible: true });
    console.log('OTP input field is ready');

    process.stdout.write('\nCheck your email for the OTP and enter it below.\n');    
    const { otp } = await prompt<{otp: string}>({
      type: 'input',
      name: 'otp',
      message: 'Enter the OTP:',
      stdout: process.stdout,
      stdin: process.stdin
    });

    const otpInputs = await page.$$('input[inputmode="numeric"]');
    console.log(`Found ${otpInputs.length} OTP input fields`);
    for (let i = 0; i < otp.length && i < otpInputs.length; i++) {
      await otpInputs[i].type(otp[i], { delay: 100 });
    }
    
    console.log('Entered OTP:', otp);

    // Wait for login to complete and redirect
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 2000000000 }),
      page.waitForSelector('div[class*="UserMenu"]', { timeout: 2000000000 }) // Wait for user menu to appear
    ]);
    
 
    
    console.log('Logged in successfully');
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

async function autoScroll(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      let previousHeight = 0;
      const checkInterval = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollTo(0, scrollHeight);
        
        if (previousHeight === scrollHeight) {
          clearInterval(checkInterval);
          resolve();
        }
        previousHeight = scrollHeight;
      }, 1500);
    });
  });
  
  await page.setDefaultTimeout(300000);
}
// Main function
async function main(calendarUrl: string) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    let email = process.env.LUMA_EMAIL;
    if (!email) {
      const response = await prompt<{ email: string }>({
        type: 'input',
        name: 'email',
        message: 'Enter your Lu.ma email:',
        stdout: process.stdout,
        stdin: process.stdin
      });
      email = response.email;
    }
    
    if (!email) {
      throw new Error('Email is required');
    }
    
    await loginToLuma(email, page);

    console.log('Opened page');

    const { selectionType } = await prompt<{ selectionType: string }>({
      type: 'select',
      name: 'selectionType',
      message: 'Select scraping method:',
      choices: [
          { name: '1', message: 'Get event links from calendar' },
          { name: '2', message: 'Scrape directly from URL' }
      ],
      initial: 0,
      result(names: string) {
          return names;
      },
      stdout: process.stdout,
      stdin: process.stdin
    });

    let scrapingUrl: string;
    let eventLinks: Array<{ url: string; title: string }> = [];
    if (selectionType === '1') {
        console.log('Fetching event links...');
        eventLinks = await getEventLinks(page, calendarUrl);
        // Remove duplicates and ensure we only prompt once
        eventLinks = [...new Set(eventLinks.map(e => JSON.stringify(e)))]
            .map(e => JSON.parse(e));
            
        if (eventLinks.length === 0) {
            throw new Error('No events found in the calendar');
        }

        console.log(`Found ${eventLinks.length} unique events`);
        
        const { selectedEvent } = await prompt<{ selectedEvent: string }>({
            type: 'select',
            name: 'selectedEvent',
            message: 'Select an event to scrape:',
            choices: eventLinks.map((event, index) => ({
                name: index.toString(),
                message: `${event.title} (${event.url})`
            })),
            initial: 0,
            result(names: string) {
                return names;
            }
        });
        const selectedEventIndex = parseInt(selectedEvent);
        scrapingUrl = eventLinks[selectedEventIndex].url;
    } else {
        scrapingUrl = calendarUrl;
    }
    console.log(`Using scraping URL: ${scrapingUrl}`);

    const attendees = await scrapeAttendees(page, scrapingUrl);
    // Get event title from the URL
    const eventTitle = await page.evaluate(() => {
        return document.querySelector('h1')?.textContent?.trim() || 'Unknown Event';
    });

    // In the main function, replace the JSON file creation with Excel generation:
    if (attendees.length > 0) {
        console.log(`Found attendees for event: ${eventTitle}`);
        await generateExcel(attendees, eventTitle);
    }

    
    if (attendees.length > 0) {
        console.log(`Found attendees for event: ${eventTitle}`);
        
        const fileName = `attendees_${eventTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        
        await fs.writeFile(fileName, JSON.stringify(attendees, null, 2));
        console.log(`Saved attendee data to ${fileName}`);
      } else {
        console.log('No attendees found for this event');
      }
   
    
  } catch (error) {
    console.error('Script failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function init() {
  const { calendarUrl } = await prompt<{ calendarUrl: string }>({
    type: 'input',
    name: 'calendarUrl',
    message: 'Enter the Lu.ma event URL:',
    stdout: process.stdout,
    stdin: process.stdin
  });

  await main(calendarUrl).catch((error) => {
    console.error('Script failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  });
}

init();

export { autoScroll };
