// Preview with the REAL api/availability.php, using PHP's built-in server in Docker (php:8.3-cli).
// Only index.html, css, js, Images and api are mounted, so private files can't be served.
//
//   npm run dev:php        -> http://127.0.0.1:8080   (PORT=8091 to change)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFeedUrl } from './feed-url.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT) || 8080;
const { url, source } = findFeedUrl();

const mounts = ['index.html', 'css', 'js', 'Images', 'api'].flatMap((p) => ['-v', `${root}${p}:/site/${p}:ro`]);
const args = [
  'run', '--rm', '--init', '-p', `127.0.0.1:${port}:8080`,
  // Passed by name only, so the secret URL never appears in the process list.
  '-e', 'VRBO_ICS_URL',
  ...mounts,
  'php:8.3-cli', 'php', '-S', '0.0.0.0:8080', '-t', '/site',
];

console.log(`Preview (real PHP): http://127.0.0.1:${port}`);
console.log(url ? `Calendar feed: from ${source}` : 'Calendar feed: NOT configured (add VRBO_ICS_URL to .env.local)');

const child = spawn('docker', args, { stdio: 'inherit', env: { ...process.env, VRBO_ICS_URL: url ?? '' } });
child.on('error', () => {
  console.error('Could not start Docker. Install and start Docker Desktop, then try again.');
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
