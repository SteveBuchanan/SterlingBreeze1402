// Publishes the site to GoDaddy over SSH: checks, tests, `npm run package`, then rsyncs dist/site/
// into the site's document root. Only changed files are uploaded.
//
//   npm run deploy                  # publish
//   npm run deploy -- --dry-run     # list what would change, upload nothing
//   npm run deploy -- --prune       # also delete server files in css/ js/ Images/ api/ that are no longer in the project
//   npm run deploy -- --allow-dirty # publish even with uncommitted changes to public files
//
// Settings (environment variables, or KEY=value lines in the gitignored .env.local):
//   DEPLOY_HOST      SSH host (the domain or the server address from the GoDaddy dashboard)
//   DEPLOY_USER      cPanel username
//   DEPLOY_PATH      document root relative to the home folder: public_html or public_html/<folder>
//   DEPLOY_PORT      optional, default 22
//   DEPLOY_SITE_URL  optional, e.g. https://www.sterlingbreeze1402.com, to check the live site afterwards
//
// The settings file sterlingbreeze1402-config.php is never uploaded (it lives above public_html, set up once by hand).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'dist', 'site');

// Everything that ends up in, or generates, the public site.
const SOURCE_PATHS = ['index.html', '.htaccess', 'css', 'js', 'Images', 'api', 'src', 'package.json', 'package-lock.json'];
// Folders owned by this site, where --prune may delete files. Never the document root itself:
// other sites on the account may live inside it.
const PRUNABLE = ['css', 'js', 'Images', 'api'];

const args = new Set(process.argv.slice(2));
for (const a of args) {
  if (!['--dry-run', '--prune', '--allow-dirty'].includes(a)) fail(`Unknown option ${a}`);
}
const dryRun = args.has('--dry-run');
const prune = args.has('--prune');
const allowDirty = args.has('--allow-dirty');

function fail(message) {
  console.error(`\ndeploy: ${message}`);
  process.exit(1);
}

function step(message) {
  console.log(`\n▸ ${message}`);
}

function run(cmd, cmdArgs, options = {}) {
  return execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', ...options });
}

function readSettings() {
  const file = join(ROOT, '.env.local');
  const fromFile = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(DEPLOY_[A-Z_]+)\s*=\s*["']?([^"'#]*?)["']?\s*$/.exec(line);
      if (m) fromFile[m[1]] = m[2];
    }
  }
  const get = (key) => process.env[key] || fromFile[key] || '';
  return {
    host: get('DEPLOY_HOST'),
    user: get('DEPLOY_USER'),
    path: get('DEPLOY_PATH').replace(/\/+$/, ''),
    port: get('DEPLOY_PORT') || '22',
    siteUrl: get('DEPLOY_SITE_URL').replace(/\/+$/, ''),
  };
}

function gitChanges(paths) {
  return execFileSync('git', ['status', '--porcelain', '--', ...paths], { cwd: ROOT, encoding: 'utf8' }).trimEnd();
}

async function checkLiveSite(siteUrl) {
  const home = await fetch(`${siteUrl}/`, { cache: 'no-store' });
  if (!home.ok) fail(`${siteUrl}/ returned HTTP ${home.status}`);

  const res = await fetch(`${siteUrl}/api/availability.php`, { cache: 'no-store' });
  const body = await res.text();
  if (!res.ok) fail(`/api/availability.php returned HTTP ${res.status}. Open it in a browser, or add ?diagnose=1.`);
  if (!body.includes('BEGIN:VCALENDAR')) fail('/api/availability.php did not return a calendar. Open it in a browser to see why.');
  // Never print the body: if sanitizing ever broke, it would contain guest names.
  const summaries = body.match(/^SUMMARY:.*$/gm) || [];
  if (summaries.some((s) => s.trim() !== 'SUMMARY:Unavailable')) {
    fail('/api/availability.php returned a SUMMARY other than "Unavailable". Guest names may be exposed: check it now.');
  }
  console.log(`  Site OK; calendar OK (${summaries.length} booked periods, all "Unavailable").`);
}

const s = readSettings();
const missing = ['host', 'user', 'path'].filter((k) => !s[k]).map((k) => `DEPLOY_${k.toUpperCase()}`);
if (missing.length) fail(`Missing ${missing.join(', ')}. Add them to .env.local (see DEPLOYMENT.md, "Publishing from the Mac").`);
if (!/^public_html(\/[A-Za-z0-9._-]+)*$/.test(s.path) || s.path.split('/').includes('..')) {
  fail(`DEPLOY_PATH must be public_html or a folder inside it (relative to the home folder), got "${s.path}".`);
}
if (!/^[A-Za-z0-9._-]+$/.test(s.user) || !/^[A-Za-z0-9.-]+$/.test(s.host) || !/^\d+$/.test(s.port)) {
  fail('DEPLOY_USER, DEPLOY_HOST or DEPLOY_PORT contains unexpected characters.');
}
const target = `${s.user}@${s.host}`;
const ssh = ['ssh', '-p', s.port, '-o', 'ConnectTimeout=15'];

step('Checking for uncommitted changes');
const dirty = gitChanges(SOURCE_PATHS);
if (dirty && !allowDirty) {
  fail(`These public files have uncommitted changes, so the live site wouldn't match Git:\n${dirty}\n\nCommit them first, or run: npm run deploy -- --allow-dirty`);
}
console.log(dirty ? '  Uncommitted changes allowed (--allow-dirty).' : '  Clean.');

step('Running tests');
run('npm', ['test', '--silent']);

step('Building the package');
run('npm', ['run', 'package', '--silent']);
if (!allowDirty && gitChanges(['css/styles.css'])) {
  fail('Building changed css/styles.css, so the committed CSS was out of date. Commit the rebuilt css/styles.css, then deploy again.');
}

step(`Connecting to ${target}`);
try {
  run(ssh[0], [...ssh.slice(1), target, `test -d "$HOME/${s.path}"`]);
} catch {
  fail(`Couldn't connect, or ~/${s.path} doesn't exist on the server. Try: ssh -p ${s.port} ${target}`);
}

const rsyncBase = ['-rltzO', '--chmod=u=rwX,go=rX', '--itemize-changes', '-e', `ssh -p ${s.port}`];
if (dryRun) rsyncBase.push('--dry-run');
const remote = `${target}:${s.path}`;

step(`${dryRun ? 'Would upload' : 'Uploading'} changed files to ~/${s.path}`);
run('rsync', [...rsyncBase, `${SITE}/`, `${remote}/`]);

if (prune) {
  step(`${dryRun ? 'Would delete' : 'Deleting'} server files no longer in the project (${PRUNABLE.join(', ')})`);
  for (const dir of PRUNABLE) {
    run('rsync', [...rsyncBase, '--delete', `${SITE}/${dir}/`, `${remote}/${dir}/`]);
  }
}

if (dryRun) {
  console.log('\nDry run: nothing was uploaded.');
} else if (s.siteUrl) {
  step(`Checking ${s.siteUrl}`);
  await checkLiveSite(s.siteUrl);
  console.log('\nPublished.');
} else {
  console.log('\nPublished. Set DEPLOY_SITE_URL in .env.local to have the live site checked automatically.');
}
