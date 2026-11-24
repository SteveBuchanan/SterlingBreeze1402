// iCalendar helpers shared by the browser (calendar.js), the dev server and the tests.
// Must stay DOM-free. Mirrors api/lib/ics.php: change both together and keep their tests in step.
//
// Dates are "day numbers": whole days since 1970-01-01 in UTC. Using plain integers avoids
// time-zone off-by-one errors. Events are { start, end } with end EXCLUSIVE (the checkout day).

const MS_PER_DAY = 86_400_000;

/** Day number for a calendar date (month is 0-based, like Date). */
export function dayNumber(year, month, day) {
  return Math.floor(Date.UTC(year, month, day) / MS_PER_DAY);
}

/** Day number for today's date in the visitor's own time zone. */
export function todayDay(now = new Date()) {
  return dayNumber(now.getFullYear(), now.getMonth(), now.getDate());
}

/** "20260315" -> day number. */
export function ymdToDay(ymd) {
  return dayNumber(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)));
}

/** Day number -> "20260315". */
export function dayToYmd(day) {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10).replaceAll('-', '');
}

/** Day number -> { year, month (0-based), date, weekday (0 = Sunday) }. */
export function dayParts(day) {
  const d = new Date(day * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate(), weekday: d.getUTCDay() };
}

/**
 * Parse ICS text into events sorted by start. Everything except the dates is discarded.
 * A missing or non-increasing DTEND means a one-night stay.
 */
export function parseIcs(text) {
  const unfolded = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
  const events = [];
  let current = null;

  for (const line of unfolded.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const name = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = line.slice(colon + 1).trim();

    if (name === 'BEGIN' && value.toUpperCase() === 'VEVENT') {
      current = {};
    } else if (name === 'END' && value.toUpperCase() === 'VEVENT') {
      if (current && current.start !== undefined) {
        const end = current.end !== undefined && current.end > current.start ? current.end : current.start + 1;
        events.push({ start: current.start, end });
      }
      current = null;
    } else if (current && (name === 'DTSTART' || name === 'DTEND')) {
      const match = /^(\d{8})/.exec(value);
      if (match) current[name === 'DTSTART' ? 'start' : 'end'] = ymdToDay(match[1]);
    }
  }

  return events.sort((a, b) => a.start - b.start);
}

/** Drop events that ended more than keepPastDays before today (mirrors the PHP cutoff). */
export function filterRecent(events, today, keepPastDays = 31) {
  const cutoff = today - keepPastDays;
  return events.filter((e) => e.end >= cutoff);
}

/** Serialize events as a minimal ICS document: dates only, every summary "Unavailable". */
export function sanitizedIcs(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sterling Breeze 1402//Availability//EN', 'CALSCALE:GREGORIAN'];
  events.forEach((event, i) => {
    const start = dayToYmd(event.start);
    lines.push(
      'BEGIN:VEVENT',
      `UID:sb1402-${start}-${i}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${dayToYmd(event.end)}`,
      'SUMMARY:Unavailable',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/** Set of booked nights: day d is in the set when someone sleeps there on the night of d. */
export function bookedNights(events) {
  const nights = new Set();
  for (const { start, end } of events) {
    for (let d = start; d < end; d++) nights.add(d);
  }
  return nights;
}

/**
 * Status of one day:
 *  - "available": free last night and tonight
 *  - "booked":    occupied last night and tonight
 *  - "checkin":   a guest arrives tonight (booked from tonight: check-out only)
 *  - "checkout":  a guest leaves this morning (check-in possible)
 */
export function dayStatus(nights, day) {
  const tonight = nights.has(day);
  const lastNight = nights.has(day - 1);
  if (tonight && lastNight) return 'booked';
  if (tonight) return 'checkin';
  if (lastNight) return 'checkout';
  return 'available';
}
