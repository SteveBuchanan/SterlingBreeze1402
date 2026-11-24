// Finds the secret VRBO feed URL for LOCAL development only, in this order:
//   1. VRBO_ICS_URL environment variable
//   2. VRBO_ICS_URL=... in .env.local (gitignored)
//   3. 'vrbo_ics_url' => '...' in ./sterlingbreeze1402-config.php (gitignored)
// Never log the returned URL: it exposes guest names.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function readOptional(name) {
  try {
    return readFileSync(root + name, 'utf8');
  } catch {
    return '';
  }
}

export function findFeedUrl() {
  if (process.env.VRBO_ICS_URL) return { url: process.env.VRBO_ICS_URL, source: 'VRBO_ICS_URL environment variable' };

  const env = /^\s*VRBO_ICS_URL\s*=\s*["']?([^"'\s]+)/m.exec(readOptional('.env.local'));
  if (env) return { url: env[1], source: '.env.local' };

  const php = /['"]vrbo_ics_url['"]\s*=>\s*['"]([^'"]+)['"]/.exec(readOptional('sterlingbreeze1402-config.php'));
  if (php && /^https?:\/\//.test(php[1]) && !php[1].includes('....')) {
    return { url: php[1], source: 'sterlingbreeze1402-config.php' };
  }
  return { url: null, source: null };
}
