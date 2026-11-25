# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Brochure website for the owner's VRBO rental condo: **Sterling Breeze unit 1402**, Panama City Beach, Florida, near Pier Park. Requirements:

- Pure HTML5 + JavaScript + latest Tailwind CSS (v4). No frameworks.
- Hosted on **GoDaddy cPanel** (Apache/LiteSpeed + PHP). One small PHP endpoint is the only server-side code. Nothing may depend on GitHub (no Actions, no GitHub hosting).
- Professional, inviting look with beach colors; easy navigation of the condo photos; modern UX.
- An **Availability** menu item with a professional, easy-to-navigate calendar that is **real-time** from the VRBO iCal feed. The feed URL is a secret (it exposes guest names): it lives only in `.env.local` (local, gitignored) and `~/sterlingbreeze1402-config.php` on the server. Never write it into tracked files.

## Content sources (source of truth)

Property facts and owner contact details come from these files. Use them instead of guessing, update the site when they change, and don't invent facts that aren't in them or visible in the photos.

- @RentalUnitDetails.md — building, address, unit and sleeping details
- @Contact.md — owner contact information

Owner phone/email are shown via `js/config.js` (`CONTACT`), split into parts and assembled by `js/contact.js` at runtime, so they never appear as plain text in `index.html`. Keep it that way, and keep `CONTACT` in sync with `Contact.md`.


## Commands

```sh
npm install                 # one-time: Tailwind CLI (only dev dependency)
npm run build               # src/input.css -> css/styles.css (minified). Run after changing any classes.
npm run watch               # rebuild CSS on change while developing
npm run dev                 # preview at http://127.0.0.1:8080 (Node stand-in for the PHP endpoint; PORT=8091 to change port)
npm run dev:php             # same, but runs the real PHP via Docker (php:8.3-cli); needs Docker running
npm test                    # node:test unit tests for js/ics.js (tests/*.test.js)
node --test --test-name-pattern="sanitized" "tests/**/*.test.js"   # single test
npm run test:php            # PHP tests for api/lib/ics.php (tests/ics_test.php) via Docker
npm run package             # build CSS, then dist/site/ + dist/site.zip with only the public files
```

`css/styles.css` is generated but committed. Opening `index.html` from disk (`file://`) won't work: ES modules and the calendar fetch need a server.

## Deploying (GoDaddy cPanel)

`DEPLOYMENT.md` is the owner-facing guide (why PHP, setup, publishing, troubleshooting). Update it whenever deploy steps, public files or config locations change. Summary:

1. `npm run package`, then in cPanel File Manager upload `dist/site.zip` into `public_html` and Extract.
2. One-time: copy `sterlingbreeze1402-config.example.php` to the cPanel **home folder** (above `public_html`) as `sterlingbreeze1402-config.php` with the real feed URL.
3. Check `https://<domain>/api/availability.php` returns ICS with `SUMMARY:Unavailable` only.

**Caching (keep when reusing this project for another site):** `.htaccess` sends `Cache-Control: no-cache` for `.html/.css/.js` (plus `mod_expires` 0 seconds), so browsers revalidate on every visit (cheap 304s) and every upload is live on the next load. ES module imports (`./config.js` etc.) carry no version string, so without this rule browsers serve stale scripts after a deploy. Don't raise those lifetimes or rely on hard refreshes. `.webp` photos are cached 30 days: replace a photo by giving it a new file name, never by overwriting. The dev server already sends `no-cache`.

`scripts/package.mjs` has an allowlist of public files (`index.html`, `css`, `js`, `Images`, `api`, `.htaccess`). Never upload the `*.md` files, `.env.local`, tests or `node_modules`; add new public folders to that list.

## Architecture

Single page (`index.html`) with anchored sections (`#condo`, `#gallery`, `#resort`, `#availability`, `#location`, `#contact`) and a sticky header. `js/main.js` is the ES module entry point.

**Availability data flow**: the browser cannot fetch the VRBO feed directly (no CORS headers), and VRBO event summaries contain guest names. So:

1. `js/calendar.js` fetches same-origin `api/availability.php` on page load.
2. `api/availability.php` fetches the VRBO feed live (curl, 8s timeout), keeps only dates via `api/lib/ics.php`, replaces every SUMMARY with `Unavailable`, and returns ICS. It caches the sanitized result for 60s in the system temp dir and serves the stale copy if VRBO is unreachable. PHP must stay 7.4-compatible.
   The hosting account serves other sites too: the settings file name is the `SB_CONFIG_FILENAME` constant (one distinct name per site), and the cache file is keyed by a hash of the feed URL. Never reintroduce a fixed shared cache or config name.
   The config file is `include`d inside `ob_start()`/`ob_end_clean()` so a malformed file (missing `<?php`) can't echo the secret URL; keep that. `?diagnose=1` prints the searched folders and result (never the URL). The search deliberately starts one folder above the site root, so a copy inside `public_html` is ignored.
3. `js/ics.js` parses the response and the calendar renders 1 (mobile) or 2 (≥768px) months.

`scripts/dev-server.mjs` reimplements step 2 in Node (using `js/ics.js`) for local preview only. It serves only the public paths, and `scripts/feed-url.mjs` finds the feed URL in `VRBO_ICS_URL`, then `.env.local`, then the gitignored `./sterlingbreeze1402-config.php` (never log it). The parsing rules exist twice (`js/ics.js` and `api/lib/ics.php`), so change both together. `tests/ics.test.js` and `tests/ics_test.php` both check against `tests/fixtures/vrbo-sample.sanitized.ics`, so the two must produce byte-identical output.

Never publish the raw VRBO feed or anything containing SUMMARY text from it.

`js/ics.js` is shared by browser, the dev server and tests, so it must stay DOM-free. Dates are UTC day numbers (avoids time-zone off-by-one). DTEND is exclusive (checkout day). `dayStatus()` yields `available` / `booked` / `checkin` (booked from tonight: check-out only) / `checkout` (guest leaves this morning: check-in possible), rendered as the `cal-*` utilities with a diagonal split.

**Gallery**: `js/gallery-data.js` is the photo catalog (order, caption, category `condo|resort|beach`). Images live in `Images/` (capital I, which matters on case-sensitive hosts) as `<name>-{600,1200,2000}.webp`, where the suffix is the LONG edge: landscape photos are 4:3 (2000×1500) and portrait ones 3:4 (1500×2000, marked `portrait: true` in the catalog so `srcset` widths are right). Names are `unit-1402-NN-<slug>` for the condo and `sterling-breeze-NN-<slug>` for the resort and beach. `photoUrl(file, size)` builds paths. Adding a photo means adding all three sizes plus a catalog entry. `js/gallery.js` handles filters, "show all", and the `<dialog>` lightbox (arrows, keyboard, swipe).

**Config**: `js/config.js` holds `VRBO_LISTING_URL` (Book buttons with `data-vrbo-link` stay hidden while it's empty), the ICS path, and how far ahead the calendar browses.

## Tailwind v4 notes

- Theme (beach palette `sand`/`sea`/`ocean`/`coral`, fonts) is defined in `@theme` in `src/input.css`; there is no `tailwind.config.js`.
- Reusable classes (`btn-primary`, `eyebrow`, `cal-booked`, …) are declared with `@utility` (not `@layer components`) so they work with `@apply` and variants.
- Classes generated in JS must be complete literal strings; `@source` scans `index.html` and `js/`.
- Header state uses attribute variants: `data-scrolled` on `#site-header` (`group-data-scrolled:`), `data-active` on nav links.
