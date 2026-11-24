// Site settings. Keep CONTACT in sync with Contact.md.

// VRBO listing page for the "Book on VRBO" buttons. While empty, those buttons stay hidden.
export const VRBO_LISTING_URL = '';

// Sanitized availability feed (same origin). See api/availability.php.
export const AVAILABILITY_ICS_PATH = 'api/availability.php';

// How many months ahead visitors can browse the calendar (counting the current month).
export const CALENDAR_MONTHS_AHEAD = 18;

// Owner contact details, split into parts so they never appear as plain text in index.html.
// js/contact.js assembles them at runtime.
export const CONTACT = {
  name: ['Kirk', 'Boston'],
  phone: ['615', '645', '7310'],
  email: { user: ['kboston'], domain: ['bledsoe', 'net'] },
};
