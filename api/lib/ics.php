<?php
// iCalendar helpers for the availability endpoint. PHP 7.4+ compatible.
// Mirrors the parsing rules in js/ics.js: dates only, DTEND exclusive, missing DTEND = one night.

declare(strict_types=1);

/**
 * Parse ICS text into events: list of ['start' => 'Ymd', 'end' => 'Ymd'], sorted by start.
 * Everything except the dates (SUMMARY, DESCRIPTION, UID, ...) is discarded.
 */
function sb_parse_ics_events(string $text): array
{
    // Normalise line endings and undo RFC 5545 line folding.
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace("/\n[ \t]/", '', $text);

    $events = [];
    $current = null;

    foreach (explode("\n", $text) as $line) {
        $colon = strpos($line, ':');
        if ($colon === false) {
            continue;
        }
        $name = strtoupper(explode(';', substr($line, 0, $colon))[0]);
        $value = trim(substr($line, $colon + 1));

        if ($name === 'BEGIN' && strtoupper($value) === 'VEVENT') {
            $current = [];
        } elseif ($name === 'END' && strtoupper($value) === 'VEVENT') {
            if (is_array($current) && isset($current['start'])) {
                $end = isset($current['end']) && $current['end'] > $current['start']
                    ? $current['end']
                    : sb_add_days($current['start'], 1);
                $events[] = ['start' => $current['start'], 'end' => $end];
            }
            $current = null;
        } elseif (is_array($current) && ($name === 'DTSTART' || $name === 'DTEND')) {
            if (preg_match('/^(\d{8})/', $value, $m) === 1) {
                $current[$name === 'DTSTART' ? 'start' : 'end'] = $m[1];
            }
        }
    }

    usort($events, static function (array $a, array $b): int {
        return strcmp($a['start'], $b['start']);
    });
    return $events;
}

/** Add days to a Ymd date string. */
function sb_add_days(string $ymd, int $days): string
{
    $date = DateTimeImmutable::createFromFormat('!Ymd', $ymd, new DateTimeZone('UTC'));
    return $date->modify(sprintf('%+d days', $days))->format('Ymd');
}

/** Serialize events as a minimal ICS document: dates only, every summary "Unavailable". */
function sb_sanitized_ics(array $events): string
{
    $lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Sterling Breeze 1402//Availability//EN',
        'CALSCALE:GREGORIAN',
    ];
    foreach ($events as $i => $event) {
        array_push(
            $lines,
            'BEGIN:VEVENT',
            "UID:sb1402-{$event['start']}-{$i}",
            "DTSTART;VALUE=DATE:{$event['start']}",
            "DTEND;VALUE=DATE:{$event['end']}",
            'SUMMARY:Unavailable',
            'END:VEVENT'
        );
    }
    $lines[] = 'END:VCALENDAR';
    return implode("\r\n", $lines) . "\r\n";
}
