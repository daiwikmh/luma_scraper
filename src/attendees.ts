import { Page } from 'puppeteer';

export interface Attendee {
  name: string;
  profileLink: string;
  eventName: string;
  eventLink: string;
  twitter?: string;
  telegram?: string;
  timezone?: string;
  username?: string;
  bioShort?: string;
  avatarUrl?: string;
  lastOnlineAt?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
  numTicketsRegistered?: number;
}

export async function scrapeAttendees(page: Page, eventUrl: string): Promise<Attendee[]> {
  try {
    await page.goto(eventUrl, { waitUntil: 'networkidle2' });
    
    // Click on guests link to open popup
    await page.waitForSelector('.event-page-left .jsx-4155675949.content', { timeout: 2000000000 });
    const guestsButton = await page.$('.event-page-left .jsx-4155675949.content .jsx-2911588165.guests-button');
    
    if (!guestsButton) {
      throw new Error('Could not find guests button');
    }

    const requestUrls: string[] = [];
    const listener = (request: any) => {
        const url = request.url();
        if (url.includes('https://api.lu.ma/event/get-guest-list?event_api_id') && url.includes('&ticket_key=')) {
            // Create new URL with updated pagination limit
            const urlObj = new URL(url);
            console.log('Captured request URL:', urlObj.href);
            requestUrls.push(urlObj.href);
            // Stop listening after capturing one URL
            page.off('request', listener);
        }
    };

    page.on('request', listener);

    await guestsButton.click();
    console.log('Clicked guests button');

   // Wait until the <h3> appears on the page
await page.waitForSelector('h3.title', { timeout: 200000000 });

// Use a looser selector just in case class names change
const maxAttendeesText = await page.$eval('h3.title', el => el.textContent?.trim());

if (maxAttendeesText) {
  const numberMatch = maxAttendeesText.match(/[\d,]+/);
  const maxnumber = numberMatch ? parseInt(numberMatch[0].replace(/,/g, '')) : null;
  console.log('Max attendees count:', maxnumber);
  
  // Modify the captured URL with the correct pagination limit
  if (requestUrls.length > 0 && maxnumber) {
    const urlObj = new URL(requestUrls[0]);
    urlObj.searchParams.set('pagination_limit', maxnumber.toString());
    requestUrls[0] = urlObj.toString();
    console.log('Updated API URL with correct pagination limit:', requestUrls[0]);
  }
} else {
  console.log('No text content found in the element.');
}

 
    
    
    
    // Pause for manual verification
    await page.getDefaultTimeout();

    // Stop listening to further requests
    page.off('request', listener);

    // Use or return the captured URLs
    if (requestUrls.length > 0) {
      console.log('Captured Event API URLs:', requestUrls);
    } else {
      console.log('No event/get requests were captured.');
    }

    const response = await fetch(requestUrls[0]);
    const data = await response.json();

    console.log('Fetched guest list from API');

    // Get event name
    const eventName = await page.evaluate(() => {
      return document.querySelector('h1')?.textContent?.trim() || 'Unknown Event';
    });

    // Ensure data.entries exists before mapping
    const entries = data.entries || [];
    return entries.map((guest: any) => ({
      name: guest.name || 'Anonymous',
      profileLink: `https://lu.ma/user/${guest.api_id}`,
      eventName,
      eventLink: eventUrl,
      timezone: guest.timezone || 'Unknown',
      username: guest.username || '',
      bioShort: guest.bio_short || '',
      avatarUrl: guest.avatar_url || '',
      lastOnlineAt: guest.last_online_at || '',
      twitter: guest.twitter_handle ? `https://twitter.com/${guest.twitter_handle}` : undefined,
      instagram: guest.instagram_handle ? `https://instagram.com/${guest.instagram_handle}` : undefined,
      linkedin: guest.linkedin_handle ? `https://linkedin.com/in/${guest.linkedin_handle}` : undefined,
      youtube: guest.youtube_handle ? `https://youtube.com/${guest.youtube_handle}` : undefined,
      tiktok: guest.tiktok_handle ? `https://tiktok.com/@${guest.tiktok_handle}` : undefined,
      website: guest.website || undefined,
      numTicketsRegistered: guest.num_tickets_registered || 0
    }));

  } catch (error) {
    console.error(`Failed to scrape ${eventUrl}:`, error);
    return [];
  }
}