<?php
// TEMPLATE (safe to commit: contains no real link).
// Copy this file to your cPanel HOME folder (the folder that contains public_html, NOT inside
// public_html), rename it to sterlingbreeze1402-config.php, and paste your VRBO iCal export link
// below. Keep the real link out of this repository: anyone who has it can see guest names.
//
// The file name must match SB_CONFIG_FILENAME in api/availability.php. Each site on the
// hosting account that has its own calendar needs its own differently named settings file.

return [
    'vrbo_ics_url' => 'https://www.vrbo.com/icalendar/....ics',
];
