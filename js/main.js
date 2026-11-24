// Entry point (loaded as an ES module from index.html).
import { initCalendar } from './calendar.js';
import { initContact } from './contact.js';
import { initGallery } from './gallery.js';
import { initNav } from './nav.js';

initNav();
initContact();
initGallery();
initCalendar();

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
