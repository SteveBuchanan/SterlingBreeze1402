# Deploying the Sterling Breeze 1402 website

This guide explains how the website is hosted, why it uses one small PHP file, and how to publish updates to GoDaddy.

## How the site is built

The website is plain **HTML, JavaScript and Tailwind CSS**: files that any web host can serve as they are. It's hosted on **GoDaddy Web Hosting (cPanel)**.

There is one exception: the availability calendar uses a single PHP file, `api/availability.php`. PHP is a language that runs on the web server rather than in the visitor's browser, and GoDaddy cPanel hosting runs it with no extra setup.

## Why the calendar needs PHP

The calendar shows live availability from VRBO. VRBO publishes it as an iCal calendar link, but the website's JavaScript can't use that link directly, for two reasons:

1. **Browsers block it.** A web page can only read data from another website if that site allows it (a browser security rule called CORS). VRBO doesn't allow it for calendar links, so a visitor's browser refuses to load VRBO's calendar from our page.
2. **The VRBO calendar contains guest names.** Bookings appear as "Reserved - *guest name*". If browsers loaded it directly, every visitor would download those names.

Something on the server therefore has to fetch the calendar from VRBO, remove the names, and hand the browser only the dates. That's the PHP file's job.

### Options considered

| Option | Why we didn't use it |
|---|---|
| Save a copy of the calendar every few hours (scheduled job) | Not real-time (up to a few hours old), and the scheduled job depended on GitHub. |
| Cloud functions (Cloudflare, Netlify, Vercel) | Would mean moving hosting away from GoDaddy, or running two providers. |
| AWS | Six or more services to set up and maintain for one calendar. |
| **PHP on the existing GoDaddy hosting** | **Chosen:** real-time, no new accounts or costs, and no GitHub. |

## How the calendar works

```
Visitor opens the page
        │
        ▼
Browser asks our own site for  /api/availability.php
        │
        ▼
availability.php (on GoDaddy)
   1. Reads the secret VRBO calendar link from sterlingbreeze1402-config.php
   2. Fetches the calendar from VRBO, live
   3. Keeps the dates only; every booking becomes "Unavailable"
   4. Remembers the result for 60 seconds
        │
        ▼
Browser draws the calendar
```

- **Real-time:** the calendar is as current as VRBO's own calendar link, within about a minute.
- **60-second memory (cache):** however many people visit, VRBO is asked at most once a minute, so VRBO won't block the site for making too many requests.
- **If VRBO is down:** the site shows the last good copy instead of an empty calendar.
- **The VRBO calendar link is secret.** Anyone who has it can see guest names, so it's stored only in a settings file outside the public website folder, never in the website files.

## One-time setup on GoDaddy

Do this once, before the first upload.

1. **Check the PHP version.** In cPanel, open **Select PHP Version** (or **MultiPHP Manager**) and make sure the site uses PHP 7.4 or newer (8.x recommended).
2. **Create the settings file** (see the next section for why it lives where it does).
   1. In cPanel, open **File Manager** and click **Home** (house icon, top left). The address bar should show `/home/<account>` (for this account, `/home/in9syw0613qk`), and the file list should *include* the `public_html` folder. You are in the right place when `public_html` is listed, not open.
   2. Upload the settings file, using either of these:
      - **Easiest:** if the development Mac already has a filled-in `sterlingbreeze1402-config.php` in the project folder, upload that.
      - **Otherwise:** upload `sterlingbreeze1402-config.example.php`, rename it to `sterlingbreeze1402-config.php`, then right-click → **Edit** and paste in the real VRBO calendar link. On the Mac, the link is also in `.env.local`.
   3. The file must look exactly like this, including the `<?php` first line:

   ```php
   <?php
   return [
       'vrbo_ics_url' => 'https://www.vrbo.com/icalendar/....ics',
   ];
   ```

3. **Run the setup check** described under "Checking the settings file". It should report `FOUND` and `Result: OK`.

## Where the settings file lives, and why

The settings file holds the VRBO calendar link. **That link is a secret: anyone who has it can download the full VRBO calendar, including guests' names.** Where the file sits is what keeps it private.

```
/home/in9syw0613qk/                      ← Home: NOT reachable from the web
├── sterlingbreeze1402-config.php        ← the settings file goes HERE
└── public_html/                         ← the website: everything in here can be requested from the internet
    ├── index.html, css/, js/, Images/, .htaccess
    └── api/availability.php             ← reads the settings file from Home
```

- **Everything in `public_html` is public.** Anyone can request any file in it by its address. A `.php` file normally runs rather than displays, but if PHP were ever switched off or misconfigured, or someone saved a copy like `config.php.bak`, the file's text, including the VRBO link, would be shown to anyone who asked.
- **The home folder is outside the website.** The web server never serves files from it, so the link can't be reached from a browser in any situation.
- **A copy inside `public_html` is ignored on purpose.** The calendar starts looking *one folder above* the website, so it never uses a settings file placed inside the website. If the setup check says "not here" for the home folder, the file was probably uploaded into `public_html` by mistake: move it (below).
- **It's not in `site.zip`, on purpose.** The zip is extracted into `public_html`, so anything in it would become public. Keeping the secret out of the zip also means it isn't copied around every time the site is packaged, emailed or backed up. The settings file is uploaded once and survives every redeploy. Upload it again only if the VRBO link changes.
- **It's not in Git either.** `.gitignore` excludes `sterlingbreeze1402-config.php` and `.env.local`, so the link never enters the project history.

### Moving the file if it ended up in `public_html`

1. In **File Manager**, open `public_html` and click `sterlingbreeze1402-config.php` **once** to select it.
2. Click **Move** in the toolbar.
3. The box shows `/public_html`. Change it to just **`/`** (your home folder) and click **Move File(s)**.
4. Click **Home** and confirm the file is listed next to `public_html`.

### Checking the settings file

Open this address (replace the domain if needed):

```
https://www.sterlingbreeze1402.com/api/availability.php?diagnose=1
```

It lists each folder the calendar searched and what it found there. It never shows the VRBO link. A good result looks like:

```
Folders searched:
  /home/in9syw0613qk/  ->  FOUND
Result:           OK, feed URL loaded from /home/in9syw0613qk/sterlingbreeze1402-config.php
```

### Several sites with their own calendars

If another site on the same hosting account uses a copy of this calendar code with a *different* VRBO calendar, each site needs its own settings file name. Otherwise both sites find the same file and show the same calendar.

1. In the other site's copy of the project, open `api/availability.php` and change the file name on this line:

   ```php
   const SB_CONFIG_FILENAME = 'sterlingbreeze1402-config.php';   // e.g. 'othercondo-config.php'
   ```
2. Build and upload that site as usual.
3. Create a matching settings file (for example `othercondo-config.php`) in the home folder with that site's VRBO link.

The home folder then holds one settings file per site:

```
home folder/
├── sterlingbreeze1402-config.php   ← this site's VRBO link
├── othercondo-config.php          ← the other site's VRBO link
└── public_html/
    ├── sterlingbreeze/
    └── othercondo/
```

Each site's 60-second cache is named after its own VRBO link, so the sites never share cached data.

## Publishing the site (every update)

### 1. Build the upload package (on the Mac)

In the project folder, run:

```sh
npm install        # first time only
npm run package
```

This creates `dist/site.zip`, which contains only the files the public website needs:

| Included | Purpose |
|---|---|
| `index.html` | The page |
| `css/` | Styles |
| `js/` | Gallery, calendar, contact and menu scripts |
| `Images/` | Photos |
| `api/` | The PHP calendar file |
| `.htaccess` | Server settings: blocks private files, caches photos |

Project notes and private files (`CLAUDE.md`, `Contact.md`, `RentalUnitDetails.md`, `.env.local`, tests, `node_modules`) are **never** included.

### 2. Upload to GoDaddy

First find this site's folder (its **document root**). In cPanel, open **Domains** and read the **Document Root** next to the condo site's domain. If the hosting account has several sites, each has its own folder inside `public_html` (for example `public_html/sterlingbreeze`). If it's the only site, the document root is `public_html` itself.

1. In cPanel, open **File Manager** and go to the document root.
2. Click **Upload** and choose `dist/site.zip`.
3. Back in File Manager, right-click `site.zip`, choose **Extract**, and extract into that same folder, replacing existing files.
4. Delete `site.zip`.

`index.html`, `.htaccess` and the `api`, `css`, `js` and `Images` folders should sit directly in the document root. If they end up one level deeper, move them up.

```
public_html/
├── other-site/            ← another site: leave alone
└── sterlingbreeze/        ← this site's document root
    ├── index.html
    ├── .htaccess
    ├── api/  css/  js/  Images/
```

The settings file `sterlingbreeze1402-config.php` still goes in the **home folder**, not the site folder. The calendar searches upward from the site folder to find it.

File Manager hides files that start with a dot (`.htaccess`) by default. To see them, open **Settings** (top right) and tick **Show Hidden Files**.

Extracting replaces files but doesn't delete old ones. If a file or photo has been removed from the project, delete it from `public_html` by hand.

### 3. Check it works

1. **Calendar:** open `https://<your-domain>/api/availability.php`. You should see a list of dates in which every entry says `SUMMARY:Unavailable` and no guest names appear. If you get an error instead, run the setup check (`?diagnose=1`, see "Checking the settings file").
2. **Site:** open `https://<your-domain>/`, scroll to **Availability**, and confirm booked dates appear.
3. **Changes not showing?** Browsers keep styles and scripts for up to an hour. Do a hard refresh (`Cmd+Shift+R` on Mac, `Ctrl+F5` on Windows).

## Updating content

After any of these changes, publish again (build the package and upload it).

| To change | Edit | Notes |
|---|---|---|
| Unit details (sleeps, beds, address) | `RentalUnitDetails.md` and `index.html` | The `.md` file is the record; the page shows it. |
| Owner contact | `Contact.md` and `CONTACT` in `js/config.js` | Keep both the same. |
| "Book on VRBO" button | `VRBO_LISTING_URL` in `js/config.js` | The button stays hidden until this is set. |
| Photos | Add all three sizes to `Images/` (`-600`, `-1200`, `-2000` `.webp`) and an entry in `js/gallery-data.js` | Folder name is `Images` with a capital I. |
| VRBO calendar link | `sterlingbreeze1402-config.php` on GoDaddy, and `.env.local` on the Mac | No upload needed for the server copy; just edit it in File Manager. |

## Previewing on the Mac before publishing

```sh
npm run dev
```

Open http://127.0.0.1:8080. This preview server includes a stand-in for the PHP calendar, so the live calendar works without PHP installed on the Mac. It reads the VRBO link from `.env.local` (a line `VRBO_ICS_URL=https://...`), or from the filled-in `sterlingbreeze1402-config.php` in the project folder. Stop it with `Ctrl+C`.

To test the real PHP file locally, start Docker Desktop and run `npm run dev:php` (or `npm run test:php` for the PHP tests).

Opening `index.html` by double-clicking it won't work: the scripts and calendar only run when the site is served over `http://`.

## Troubleshooting

| What you see | Likely cause | Fix |
|---|---|---|
| Calendar says "We couldn't load live availability" | `availability.php` is returning an error | Open `/api/availability.php` directly and read the message. |
| `Availability is not configured (missing sterlingbreeze1402-config.php)` | Settings file missing or in the wrong folder (often uploaded into `public_html` by mistake) | Run the setup check (`?diagnose=1`). The file must be in the home folder, above `public_html`, and its name must match `SB_CONFIG_FILENAME` in `api/availability.php` exactly. See "Moving the file if it ended up in `public_html`". |
| `sterlingbreeze1402-config.php was found but is not valid` | The file's contents are wrong, usually a missing `<?php` first line | Edit it to match the example in "One-time setup" exactly. |
| Setup check says `found but NOT READABLE` | File permissions | In File Manager, right-click the file → **Change Permissions** → `644`. |
| This site shows another site's bookings | Both sites use the same settings file name | Give each site its own `SB_CONFIG_FILENAME` (see "Several sites with their own calendars"). |
| `Could not reach the VRBO calendar` | VRBO is down, or the link in the settings file is wrong | Paste the link into a browser. It should download a `.ics` file. |
| The PHP code shows as text instead of a calendar | PHP isn't enabled for the site | Check **Select PHP Version** in cPanel. |
| "500 Internal Server Error" on every page | The host rejected a setting in `.htaccess` | Rename `.htaccess` to `.htaccess-off` to confirm, then contact GoDaddy support or ask to have the setting removed. |
| Odd redirects or errors only on this site, when other sites share `public_html` | An `.htaccess` file directly in `public_html` (from another site) also applies to subfolders | Check that file's rules, or ask GoDaddy support to exclude this site's folder. |
| Photos missing on the live site, but fine on the Mac | Folder name case | It must be `Images` (capital I), not `images`. |
| Old version still showing | Browser cache | Hard refresh (`Cmd+Shift+R`). |
