// Availability calendar. Fetches the sanitized feed from api/availability.php (same origin) and
// renders 1 month on mobile, 2 months from 768px up.
import { AVAILABILITY_ICS_PATH, CALENDAR_MONTHS_AHEAD } from './config.js';
import { bookedNights, dayNumber, dayParts, dayStatus, parseIcs, todayDay } from './ics.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REFRESH_AFTER_MS = 2 * 60_000; // re-fetch when the tab regains focus after this long

// Complete class strings (Tailwind only sees literal strings).
const STATUS_CLASS = {
  available: 'cal-day cal-available',
  booked: 'cal-day cal-booked',
  checkin: 'cal-day cal-checkin',
  checkout: 'cal-day cal-checkout',
};
const STATUS_LABEL = {
  available: 'available',
  booked: 'booked',
  checkin: 'check-out only (another stay begins that day)',
  checkout: 'check-in only (another stay ends that morning)',
};
const PAST_CLASS = 'cal-day cal-past';
const PENDING_CLASS = 'cal-day bg-sand-100 text-ocean-900/40';
const TODAY_RING = ' ring-2 ring-ocean-500 ring-offset-1';

const monthName = (year, month, style = 'long') =>
  new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', { month: style, year: 'numeric', timeZone: 'UTC' });

export function initCalendar() {
  const root = document.getElementById('calendar');
  if (!root) return;

  const monthsEl = root.querySelector('[data-cal-months]');
  const rangeEl = root.querySelector('[data-cal-range]');
  const statusEl = root.querySelector('[data-cal-status]');
  const prevBtn = root.querySelector('[data-cal-prev]');
  const nextBtn = root.querySelector('[data-cal-next]');
  const todayBtn = root.querySelector('[data-cal-today]');
  const wide = window.matchMedia('(min-width: 768px)');

  let nights = null; // Set of booked nights once loaded; null while loading / on error
  let offset = 0; // months after the current month
  let lastFetch = 0;

  const visibleCount = () => (wide.matches ? 2 : 1);
  const maxOffset = () => Math.max(0, CALENDAR_MONTHS_AHEAD - visibleCount());

  function render() {
    offset = Math.min(offset, maxOffset());
    const today = todayDay();
    const now = dayParts(today);
    const months = [];
    for (let i = 0; i < visibleCount(); i++) {
      const d = new Date(Date.UTC(now.year, now.month + offset + i, 1));
      months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
    }
    monthsEl.replaceChildren(...months.map((m) => renderMonth(m.year, m.month, today)));

    const first = months[0];
    const last = months[months.length - 1];
    rangeEl.textContent =
      months.length === 1
        ? monthName(first.year, first.month)
        : `${monthName(first.year, first.month, 'short')} – ${monthName(last.year, last.month, 'short')}`;
    prevBtn.disabled = offset === 0;
    nextBtn.disabled = offset >= maxOffset();
    todayBtn.disabled = offset === 0;
  }

  function renderMonth(year, month, today) {
    const section = document.createElement('section');
    section.className = 'min-w-0';
    const heading = document.createElement('h3');
    heading.className = 'mb-3 hidden text-center font-sans md:block text-base font-semibold text-ocean-900';
    heading.textContent = monthName(year, month);

    const head = document.createElement('div');
    head.className = 'mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-ocean-700/70';
    head.setAttribute('aria-hidden', 'true');
    head.innerHTML = WEEKDAYS.map((w) => `<span>${w.slice(0, 2)}</span>`).join('');

    const grid = document.createElement('ol');
    grid.className = 'grid grid-cols-7 gap-1';
    grid.setAttribute('aria-label', monthName(year, month));

    const firstDay = dayNumber(year, month, 1);
    const daysInMonth = dayNumber(year, month + 1, 1) - firstDay;
    for (let i = 0; i < dayParts(firstDay).weekday; i++) {
      const blank = document.createElement('li');
      blank.setAttribute('aria-hidden', 'true');
      grid.append(blank);
    }
    for (let date = 1; date <= daysInMonth; date++) {
      const day = firstDay + date - 1;
      const li = document.createElement('li');
      let className;
      let label;
      if (day < today) {
        className = PAST_CLASS;
        label = 'past';
      } else if (!nights) {
        className = PENDING_CLASS;
        label = 'loading';
      } else {
        const status = dayStatus(nights, day);
        className = STATUS_CLASS[status];
        label = STATUS_LABEL[status];
      }
      if (day === today) className += TODAY_RING;
      li.className = className;
      const fullDate = new Date(Date.UTC(year, month, date)).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
      });
      li.innerHTML = `<span aria-hidden="true">${date}</span><span class="sr-only">${fullDate}${day === today ? ' (today)' : ''}: ${label}</span>`;
      grid.append(li);
    }

    section.append(heading, head, grid);
    return section;
  }

  async function load() {
    lastFetch = Date.now();
    try {
      const response = await fetch(AVAILABILITY_ICS_PATH, { headers: { Accept: 'text/calendar' } });
      const text = await response.text();
      if (!response.ok || !text.includes('BEGIN:VCALENDAR')) throw new Error(`HTTP ${response.status}`);
      nights = bookedNights(parseIcs(text));
      const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      statusEl.textContent = `Live from VRBO · updated ${time}`;
      statusEl.dataset.state = 'ok';
    } catch (error) {
      console.warn('Availability could not be loaded:', error);
      if (!nights) {
        statusEl.textContent = "We couldn't load live availability right now. Please contact the owner for dates.";
        statusEl.dataset.state = 'error';
      }
    }
    render();
  }

  prevBtn.addEventListener('click', () => { offset = Math.max(0, offset - 1); render(); });
  nextBtn.addEventListener('click', () => { offset = Math.min(maxOffset(), offset + 1); render(); });
  todayBtn.addEventListener('click', () => { offset = 0; render(); });
  wide.addEventListener('change', render);

  root.addEventListener('keydown', (event) => {
    if (event.target.closest('button')) return;
    if (event.key === 'ArrowLeft' && !prevBtn.disabled) prevBtn.click();
    if (event.key === 'ArrowRight' && !nextBtn.disabled) nextBtn.click();
  });

  // Swipe between months on touch screens.
  let touchX = null;
  monthsEl.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  monthsEl.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (dx < -50 && !nextBtn.disabled) nextBtn.click();
    if (dx > 50 && !prevBtn.disabled) prevBtn.click();
  }, { passive: true });

  // Keep it real-time: refresh when the visitor comes back to the tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastFetch > REFRESH_AFTER_MS) load();
  });

  render();
  load();
}
