import { Page } from 'puppeteer';
import { autoScroll } from './scrapper';

export async function getEventLinks(page: Page, calendarUrl: string): Promise<Array<{ url: string; title: string }>> {
  console.log('Navigating to calendar:', calendarUrl);
  await page.goto(calendarUrl, { waitUntil: 'networkidle2', timeout: 600000000 });
  
  // Wait for the timeline and event links to load
  await page.waitForSelector('.timeline a.event-link', { timeout: 2000000000, visible: true });
  console.log('Found event elements, starting scroll');
  
  await autoScroll(page);

  const eventLinks = await page.evaluate(() => {
    const links: Array<{ url: string; title: string }> = [];
    const eventElements = document.querySelectorAll('.timeline a.event-link');
    
    eventElements.forEach((el) => {
      const href = el.getAttribute('href');
      const title = el.getAttribute('aria-label');
      if (href && title && !links.some(link => link.url === `https://lu.ma${href}`)) {
        links.push({
          url: `https://lu.ma${href}`,
          title: title
        });
      }
    });
    return links;
  });

  console.log(`Found ${eventLinks.length} unique event links:`);
  eventLinks.forEach(event => {
    console.log(`- ${event.title}: ${event.url}`);
  });
  return eventLinks;
}