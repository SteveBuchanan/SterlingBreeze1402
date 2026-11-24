// Fills [data-contact="name|phone|email"] from CONTACT at runtime, so the owner's phone number
// and email address never appear as plain text in index.html (keeps simple scrapers away).
import { CONTACT, VRBO_LISTING_URL } from './config.js';

export function initContact() {
  const name = CONTACT.name.join(' ');
  const [area, prefix, line] = CONTACT.phone;
  const phoneDisplay = `(${area}) ${prefix}-${line}`;
  const phoneHref = `tel:+1${area}${prefix}${line}`;
  const email = `${CONTACT.email.user.join('')}@${CONTACT.email.domain.join('.')}`;
  const subject = encodeURIComponent('Sterling Breeze 1402 rental inquiry');

  for (const el of document.querySelectorAll('[data-contact]')) {
    switch (el.dataset.contact) {
      case 'name':
        el.textContent = name;
        break;
      case 'phone':
        el.textContent = phoneDisplay;
        if (el instanceof HTMLAnchorElement) el.href = phoneHref;
        break;
      case 'phone-link':
        if (el instanceof HTMLAnchorElement) el.href = phoneHref;
        break;
      case 'email':
        el.textContent = email;
        if (el instanceof HTMLAnchorElement) el.href = `mailto:${email}?subject=${subject}`;
        break;
      case 'email-link':
        if (el instanceof HTMLAnchorElement) el.href = `mailto:${email}?subject=${subject}`;
        break;
    }
  }

  // "Book on VRBO" buttons stay hidden until a listing URL is configured.
  if (VRBO_LISTING_URL) {
    for (const el of document.querySelectorAll('[data-vrbo-link]')) {
      el.href = VRBO_LISTING_URL;
      el.hidden = false;
    }
  }
}
