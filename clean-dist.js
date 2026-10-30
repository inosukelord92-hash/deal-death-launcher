/* Keeps `dist/` to a single installer: the one matching package.json version.
   Runs before and after an electron-builder build, so old setup files and the
   unpacked app folder never pile up again.

   Usage: node clean-dist.js */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const version = require('./package.json').version;

if (!fs.existsSync(DIST)) {
  console.log('[clean-dist] nothing to do');
  process.exit(0);
}

let freed = 0;
const sizeOf = (p) => {
  try {
    const st = fs.statSync(p);
    if (!st.isDirectory()) return st.size;
    return fs.readdirSync(p).reduce((n, f) => n + sizeOf(path.join(p, f)), 0);
  } catch { return 0; }
};
const remove = (p) => {
  const size = sizeOf(p);
  try {
    fs.rmSync(p, { recursive: true, force: true });
    freed += size;
    console.log('[clean-dist] removed', path.relative(DIST, p) || p);
  } catch (err) {
    console.warn('[clean-dist] could not remove', p, err.message);
  }
};

for (const entry of fs.readdirSync(DIST)) {
  const full = path.join(DIST, entry);
  const isSetup = /^DEAL DEATH Setup .*\.exe(\.blockmap)?$/i.test(entry);
  if (isSetup && !entry.includes(version)) { remove(full); continue; }
  if (entry === 'win-unpacked') { remove(full); continue; }
  if (entry === 'builder-debug.yml' || entry === 'builder-effective-config.yaml') remove(full);
}

console.log('[clean-dist] freed ' + (freed / 1048576).toFixed(1) + ' MB, kept version ' + version);
