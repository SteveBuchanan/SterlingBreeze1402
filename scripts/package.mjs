// Builds the upload package: dist/site/ and dist/site.zip containing ONLY the public files.
// Run via `npm run package` (which builds the CSS first). Add new public folders to PUBLIC.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SITE = join(DIST, 'site');
const ZIP = join(DIST, 'site.zip');

const PUBLIC = ['index.html', '.htaccess', 'css', 'js', 'Images', 'api'];

// Never ship these, even if they end up inside a public folder.
const BLOCKED = /(^\.DS_Store$|\.md$|^\.env|-config\.php$|\.tmp$|~$)/;

rmSync(DIST, { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });

for (const entry of PUBLIC) {
  const from = join(ROOT, entry);
  if (!existsSync(from)) throw new Error(`Missing public file or folder: ${entry}`);
  cpSync(from, join(SITE, entry), {
    recursive: true,
    preserveTimestamps: true, // so `npm run deploy` (rsync) only uploads files that really changed
    filter: (src) => {
      const name = basename(src);
      if (BLOCKED.test(name)) {
        if (name !== '.DS_Store') console.warn(`  skipped ${src.slice(ROOT.length)}`);
        return false;
      }
      return true;
    },
  });
}

// -X: no macOS extra attributes. Zip the folder's contents so they extract straight into public_html.
execFileSync('zip', ['-r', '-q', '-X', ZIP, '.'], { cwd: SITE });
console.log(`Created ${ZIP.slice(ROOT.length)} (${PUBLIC.join(', ')})`);
