<?php
// Tests for api/lib/ics.php. Mirrors tests/ics.test.js and uses the same fixtures.
// Run: npm run test:php   (php:8.3-cli in Docker), or: php tests/ics_test.php

declare(strict_types=1);

require __DIR__ . '/../api/lib/ics.php';

$failures = 0;
$count = 0;

function check(string $name, bool $ok, string $detail = ''): void
{
    global $failures, $count;
    $count++;
    if ($ok) {
        echo "ok   {$name}\n";
    } else {
        $failures++;
        echo "FAIL {$name}" . ($detail !== '' ? "\n     {$detail}" : '') . "\n";
    }
}

$raw = (string) file_get_contents(__DIR__ . '/fixtures/vrbo-sample.ics');
$expected = (string) file_get_contents(__DIR__ . '/fixtures/vrbo-sample.sanitized.ics');

$events = sb_parse_ics_events($raw);
check('parses VRBO events: dates only, sorted, folded lines, missing DTEND = one night', $events === [
    ['start' => '20260310', 'end' => '20260314'],
    ['start' => '20260320', 'end' => '20260327'],
    ['start' => '20260327', 'end' => '20260329'],
    ['start' => '20260401', 'end' => '20260402'],
], json_encode($events));

$lf = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260105\nDTEND:20260105\nEND:VEVENT\nEND:VCALENDAR\n";
check('handles LF-only input and a DTEND that is not after DTSTART',
    sb_parse_ics_events($lf) === [['start' => '20260105', 'end' => '20260106']]);
check('empty input gives no events', sb_parse_ics_events('') === []);

$out = sb_sanitized_ics($events);
check('sanitized output matches the shared fixture', $out === $expected, json_encode($out));

$leaked = array_filter(
    ['Jane', 'John', 'Guestname', 'Foldedname', '555-0100', 'Reserved', 'Blocked', 'DESCRIPTION'],
    static function (string $s) use ($out): bool {
        return strpos($out, $s) !== false;
    }
);
check('sanitized output contains no guest details', $leaked === [], implode(', ', $leaked));
check('sanitized output parses back to the same events', sb_parse_ics_events($out) === $events);
check('sb_add_days crosses month and leap-day boundaries',
    sb_add_days('20260131', 1) === '20260201' && sb_add_days('20280228', 1) === '20280229');

echo "\n" . ($count - $failures) . "/{$count} passed\n";
exit($failures === 0 ? 0 : 1);
