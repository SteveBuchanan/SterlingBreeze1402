// Unit tests for js/ics.js. The PHP twin (tests/ics_test.php) uses the same fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  bookedNights, dayNumber, dayParts, dayStatus, dayToYmd, filterRecent, parseIcs, sanitizedIcs, todayDay, ymdToDay,
} from '../js/ics.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const RAW = fixture('vrbo-sample.ics');
const SANITIZED = fixture('vrbo-sample.sanitized.ics');
const ymd = (events) => events.map((e) => [dayToYmd(e.start), dayToYmd(e.end)]);

test('day numbers round-trip and avoid time zones', () => {
  assert.equal(dayNumber(1970, 0, 1), 0);
  assert.equal(ymdToDay('20260310'), dayNumber(2026, 2, 10));
  assert.equal(dayToYmd(ymdToDay('20280229')), '20280229');
  assert.equal(dayNumber(2026, 11, 32), dayNumber(2027, 0, 1));
  assert.deepEqual(dayParts(ymdToDay('20261124')), { year: 2026, month: 10, date: 24, weekday: 2 });
  assert.equal(todayDay(new Date(2026, 10, 24, 23, 59)), ymdToDay('20261124'));
});

test('parses VRBO events: dates only, sorted, folded lines, missing DTEND = one night', () => {
  const events = parseIcs(RAW);
  assert.deepEqual(ymd(events), [
    ['20260310', '20260314'],
    ['20260320', '20260327'],
    ['20260327', '20260329'],
    ['20260401', '20260402'],
  ]);
  for (const e of events) assert.deepEqual(Object.keys(e).sort(), ['end', 'start']);
});

test('handles LF-only input and a DTEND that is not after DTSTART', () => {
  const text = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260105\nDTEND:20260105\nEND:VEVENT\nEND:VCALENDAR\n';
  assert.deepEqual(ymd(parseIcs(text)), [['20260105', '20260106']]);
  assert.deepEqual(parseIcs(''), []);
});

test('sanitized output matches the shared fixture and contains no guest details', () => {
  const out = sanitizedIcs(parseIcs(RAW));
  assert.equal(out, SANITIZED);
  for (const secret of ['Jane', 'John', 'Guestname', 'Foldedname', '555-0100', 'Reserved', 'Blocked', 'DESCRIPTION']) {
    assert.ok(!out.includes(secret), `sanitized output leaked "${secret}"`);
  }
  const summaries = out.split('\r\n').filter((l) => l.startsWith('SUMMARY'));
  assert.ok(summaries.length > 0 && summaries.every((l) => l === 'SUMMARY:Unavailable'));
});

test('sanitized output parses back to the same events', () => {
  const events = parseIcs(RAW);
  assert.deepEqual(parseIcs(sanitizedIcs(events)), events);
});

test('filterRecent keeps events that ended within the window', () => {
  const events = parseIcs(RAW);
  const today = ymdToDay('20260420');
  // cutoff = 20260320: the stay ending 20260314 is dropped
  assert.deepEqual(ymd(filterRecent(events, today, 31)).map((e) => e[0]), ['20260320', '20260327', '20260401']);
});

test('dayStatus: available, booked, check-in and check-out days', () => {
  const nights = bookedNights(parseIcs(RAW));
  const status = (d) => dayStatus(nights, ymdToDay(d));
  assert.equal(status('20260309'), 'available');
  assert.equal(status('20260310'), 'checkin'); // guest arrives: check-out only
  assert.equal(status('20260312'), 'booked');
  assert.equal(status('20260314'), 'checkout'); // guest leaves that morning: check-in possible
  assert.equal(status('20260315'), 'available');
  assert.equal(status('20260327'), 'booked'); // back-to-back turnover day is fully booked
  assert.equal(status('20260329'), 'checkout');
  assert.equal(status('20260401'), 'checkin');
  assert.equal(status('20260402'), 'checkout');
});
