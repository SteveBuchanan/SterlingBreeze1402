<?php
// GET /api/availability.php
// Fetches the VRBO iCal feed live, strips everything but the dates (VRBO summaries contain
// guest names), and returns a minimal ICS document that js/calendar.js renders.
//
// The VRBO feed URL is secret (it exposes guest names), so it is never stored in the site files.
// It is read from, in order:
//   1. the VRBO_ICS_URL environment variable (local development), or
//   2. the file named by SB_CONFIG_FILENAME in a folder ABOVE the site root (e.g. the cPanel home
//      folder, next to public_html), which returns ['vrbo_ics_url' => 'https://...'].

declare(strict_types=1);

require __DIR__ . '/lib/ics.php';

// Settings file for THIS site. If several sites on the same hosting account use a copy of this
// calendar, give each one a different file name here so they never read each other's calendar.
const SB_CONFIG_FILENAME = 'sterlingbreeze1402-config.php';

const SB_CACHE_TTL_SECONDS = 60;   // at most one VRBO request per minute, however many visitors
const SB_KEEP_PAST_DAYS = 31;      // keep last month so the calendar's earlier days still render
const SB_FETCH_TIMEOUT_SECONDS = 8;

/** Folders searched for the settings file: upward from above the site root, then the account's home folder. */
function sb_config_dirs(): array
{
    $dirs = [];
    // Walk up from the folder above the site root, so this works whether the site lives in
    // public_html or a subfolder of it.
    $dir = dirname(__DIR__, 2);
    for ($i = 0; $i < 5; $i++) {
        $dirs[] = $dir;
        $parent = dirname($dir);
        if ($parent === $dir) {
            break;
        }
        $dir = $parent;
    }
    $home = getenv('HOME');
    if (is_string($home) && $home !== '') {
        $dirs[] = rtrim($home, '/');
    }
    if (function_exists('posix_getpwuid') && function_exists('posix_geteuid')) {
        $user = posix_getpwuid(posix_geteuid());
        if (is_array($user) && !empty($user['dir'])) {
            $dirs[] = rtrim($user['dir'], '/');
        }
    }
    return array_values(array_unique($dirs));
}

/**
 * Locate and load the settings file.
 * Returns ['url' => ?string, 'file' => ?string, 'error' => ?string].
 */
function sb_load_config(): array
{
    $env = getenv('VRBO_ICS_URL');
    if (is_string($env) && $env !== '') {
        return ['url' => $env, 'file' => null, 'error' => null];
    }
    foreach (sb_config_dirs() as $dir) {
        $file = $dir . '/' . SB_CONFIG_FILENAME;
        if (!@is_file($file)) {
            continue;
        }
        // Swallow any output: if the file is missing its "<?php" line, PHP would otherwise print
        // its contents (the secret feed URL) straight into the public response.
        ob_start();
        $config = include $file;
        ob_end_clean();
        if (is_array($config) && !empty($config['vrbo_ics_url'])) {
            return ['url' => (string) $config['vrbo_ics_url'], 'file' => $file, 'error' => null];
        }
        return [
            'url' => null,
            'file' => $file,
            'error' => SB_CONFIG_FILENAME . " was found but is not valid: it must start with <?php and return ['vrbo_ics_url' => '...'].",
        ];
    }
    return ['url' => null, 'file' => null, 'error' => 'Availability is not configured (missing ' . SB_CONFIG_FILENAME . ').'];
}

/** ?diagnose=1 — plain-text setup report. Never prints the feed URL. */
function sb_diagnose(): void
{
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    $config = sb_load_config();
    $basedir = (string) ini_get('open_basedir');
    echo "Availability setup check\n========================\n";
    echo 'PHP version:      ' . PHP_VERSION . "\n";
    echo 'curl available:   ' . (function_exists('curl_init') ? 'yes' : 'no') . "\n";
    echo 'open_basedir:     ' . ($basedir === '' ? '(none)' : $basedir) . "\n";
    echo 'This script:      ' . __FILE__ . "\n";
    echo 'Looking for:      ' . SB_CONFIG_FILENAME . "\n\nFolders searched:\n";
    foreach (sb_config_dirs() as $dir) {
        $file = $dir . '/' . SB_CONFIG_FILENAME;
        $state = @is_file($file) ? (@is_readable($file) ? 'FOUND' : 'found but NOT READABLE') : 'not here';
        echo "  {$dir}/  ->  {$state}\n";
    }
    echo "\nResult:           " . ($config['url'] !== null ? 'OK, feed URL loaded from ' . ($config['file'] ?? 'environment') : $config['error']) . "\n";
}

function sb_fetch(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_TIMEOUT => SB_FETCH_TIMEOUT_SECONDS,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (availability calendar)',
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return is_string($body) && $status === 200 ? $body : null;
    }
    $context = stream_context_create([
        'http' => ['timeout' => SB_FETCH_TIMEOUT_SECONDS, 'user_agent' => 'Mozilla/5.0 (availability calendar)'],
    ]);
    $body = @file_get_contents($url, false, $context);
    return is_string($body) ? $body : null;
}

function sb_send(string $ics, string $cacheStatus): void
{
    header('Content-Type: text/calendar; charset=utf-8');
    header('Cache-Control: public, max-age=' . SB_CACHE_TTL_SECONDS);
    header('X-Cache: ' . $cacheStatus);
    echo $ics;
}

function sb_fail(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo $message;
}

if (isset($_GET['diagnose'])) {
    sb_diagnose();
    exit;
}

$config = sb_load_config();
if ($config['url'] === null) {
    sb_fail(500, (string) $config['error']);
    exit;
}
$feedUrl = $config['url'];

// The temp folder is shared by every site on the hosting account, so the cache file is named
// after a hash of this site's feed URL: two sites with different calendars never share a cache.
// The cache only ever holds sanitized (name-free) data.
$cacheFile = sys_get_temp_dir() . '/vrbo-availability-' . substr(sha1($feedUrl), 0, 16) . '.ics';
$cacheAge = is_file($cacheFile) ? time() - (int) filemtime($cacheFile) : PHP_INT_MAX;

if ($cacheAge < SB_CACHE_TTL_SECONDS) {
    sb_send((string) file_get_contents($cacheFile), 'HIT');
    exit;
}

$raw = sb_fetch($feedUrl);
if ($raw === null || strpos($raw, 'BEGIN:VCALENDAR') === false) {
    // VRBO unreachable: fall back to the last good copy rather than showing nothing.
    if (is_file($cacheFile)) {
        sb_send((string) file_get_contents($cacheFile), 'STALE');
    } else {
        sb_fail(502, 'Could not reach the VRBO calendar.');
    }
    exit;
}

$cutoff = (new DateTimeImmutable('today', new DateTimeZone('UTC')))
    ->modify('-' . SB_KEEP_PAST_DAYS . ' days')
    ->format('Ymd');
$events = array_values(array_filter(sb_parse_ics_events($raw), static function (array $e) use ($cutoff): bool {
    return $e['end'] >= $cutoff;
}));
$ics = sb_sanitized_ics($events);

// Write atomically so concurrent requests never read a half-written file.
$tmp = $cacheFile . '.' . getmypid() . '.tmp';
if (@file_put_contents($tmp, $ics) !== false) {
    @rename($tmp, $cacheFile);
}

sb_send($ics, 'MISS');
