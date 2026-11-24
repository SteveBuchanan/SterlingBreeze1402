// Local preview server. Serves the public site files and stands in for api/availability.php
// (same sanitizing rules, via js/ics.js) so the calendar works without PHP. Not deployed.
//
//   npm run dev            -> http://127.0.0.1:8080   (PORT=8091 npm run dev to change)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterRecent, parseIcs, sanitizedIcs, todayDay } from '../js/ics.js';
import { findFeedUrl } from './feed-url.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const HOST = '127.0.0.1';
const CACHE_TTL_MS = 60_000;
const KEEP_PAST_DAYS = 31;

// Only what the live site serves (mirrors scripts/package.mjs). Never serve .env.local, *.md, the config, etc.
const PUBLIC_DIRS = ['css', 'js', 'Images'];
const PUBLIC_FILES = ['index.html'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const { url: feedUrl, source: feedSource } = findFeedUrl();
let cache = null; // { ics, at }

async function availability(res) {
  if (!feedUrl) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Availability is not configured: set VRBO_ICS_URL in .env.local.');
    return;
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return send(res, cache.ics, 'HIT');

  try {
    const response = await fetch(feedUrl, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (availability calendar)' } });
    const raw = await response.text();
    if (!response.ok || !raw.includes('BEGIN:VCALENDAR')) throw new Error(`HTTP ${response.status}`);
    const ics = sanitizedIcs(filterRecent(parseIcs(raw), todayDay(new Date()), KEEP_PAST_DAYS));
    cache = { ics, at: Date.now() };
    send(res, ics, 'MISS');
  } catch (error) {
    console.warn(`VRBO fetch failed: ${error.message}`);
    if (cache) return send(res, cache.ics, 'STALE');
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Could not reach the VRBO calendar.');
  }
}

function send(res, ics, cacheStatus) {
  res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store', 'X-Cache': cacheStatus });
  res.end(ics);
}

async function staticFile(pathname, res) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '') || 'index.html';
  const top = rel.split(sep)[0];
  const allowed = PUBLIC_FILES.includes(rel) || (PUBLIC_DIRS.includes(top) && rel !== top);
  if (!allowed || rel.includes('..')) return notFound(res);

  const file = join(ROOT, rel);
  try {
    if (!(await stat(file)).isFile()) return notFound(res);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    notFound(res);
  }
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${HOST}`);
  if (pathname === '/api/availability.php') return availability(res);
  return staticFile(pathname, res);
}).listen(PORT, HOST, () => {
  console.log(`Preview: http://${HOST}:${PORT}`);
  console.log(feedUrl ? `Calendar feed: from ${feedSource}` : 'Calendar feed: NOT configured (add VRBO_ICS_URL to .env.local)');
});
