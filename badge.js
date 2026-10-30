/* ---- Tab list launcher badge -------------------------------------------------
   Adds the DEAL DEATH logo glyph in front of your name (and your friends' names)
   in the in-game tab list.

   How it works:
   - the DEAL DEATH badge jar adds the logo as a private-use font glyph, so it
     renders like a normal character (the game loads it from the mod, no pack to
     enable by hand);
   - a client-side Fabric mod (PlayerPrefixes) draws that glyph before a player's
     name in the tab list / nametag;
   - this module copies both into the instance and writes the mod's config, so the
     player does not have to set anything up by hand.
   --------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const CHAR = '\uE000';
const IDENT = 'dd';
const PACK_NAME = 'DEAL DEATH Pack.zip'; // old build, cleaned up below
const MOD_PROJECT = 'iX3hK1q6'; // PlayerPrefixes (client side, Fabric)
const SUPPORTED = new Set(['1.21.11']);
const BADGE_JAR = 'deal-death-badge.jar'; // ships the logo glyph font

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const bareUuid = (u) => String(u || '').replace(/-/g, '').toLowerCase();

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'deal-death-launcher/1.3.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function badgeModJar(cacheDir, version, project = MOD_PROJECT, prefix = 'playerprefixes') {
  const cached = path.join(cacheDir, `${prefix}-${version}.jar`);
  try { if (fs.statSync(cached).size > 10000) return cached; } catch {}
  const versions = await getJson(`https://api.modrinth.com/v2/project/${project}/version`);
  const v = (Array.isArray(versions) ? versions : []).find(
    (x) => x.game_versions.includes(version) && x.loaders.includes('fabric')
  );
  if (!v) throw new Error('No ' + prefix + ' build for Minecraft ' + version);
  const file = v.files.find((f) => f.primary) || v.files[0];
  const buf = Buffer.from(await (await fetch(file.url)).arrayBuffer());
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cached, buf);
  return cached;
}

/* Older launcher builds shipped a menu theme. Strip its leftovers so the game
   stops dropping unknown entries from options.txt on every start. */
function cleanOldTheme(root) {
  for (const name of ['deal-death-menu.jar', BADGE_JAR]) {
    try { fs.rmSync(path.join(root, 'mods', name), { force: true }); } catch {}
  }
  try { fs.rmSync(path.join(root, 'resourcepacks', PACK_NAME), { force: true }); } catch {}

  const file = path.join(root, 'options.txt');
  let lines = [];
  try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch { return; }
  const stale = new Set(['dealdeath:theme', 'file/' + PACK_NAME]);
  let changed = false;
  lines = lines.map((line) => {
    if (!line.startsWith('resourcePacks:') && !line.startsWith('incompatibleResourcePacks:')) return line;
    const key = line.slice(0, line.indexOf(':') + 1);
    let list = [];
    try { list = JSON.parse(line.slice(key.length)); } catch {}
    if (!Array.isArray(list)) return line;
    const next = list.filter((id) => !stale.has(id));
    if (next.length === list.length) return line;
    changed = true;
    return key + JSON.stringify(next);
  });
  if (changed) fs.writeFileSync(file, lines.join('\n'));
}

/* The badge font jar only loads on the Minecraft version its metadata accepts,
   otherwise Fabric refuses to start the game. */
function copyBadgeJar(root, version) {
  if (!SUPPORTED.has(String(version || '').trim())) return false;
  const src = path.join(__dirname, 'assets', 'theme', BADGE_JAR);
  if (!fs.existsSync(src)) return false;
  /* A default-font override that points at a missing texture makes the whole
     resource reload fail and the game shows a black screen, so only ship a jar
     that really contains the glyph texture. */
  try {
    if (!fs.readFileSync(src).includes(Buffer.from('assets/dealdeath/textures/font/badge.png'))) {
      console.warn('[badge] jar is missing the glyph texture, skipping badge');
      return false;
    }
  } catch { return false; }
  const dir = path.join(root, 'mods');
  fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, BADGE_JAR);
  let same = false;
  try { same = fs.statSync(dst).size === fs.statSync(src).size; } catch {}
  if (!same) fs.copyFileSync(src, dst);
  return true;
}

function writePrefixConfig(root, uuid, name) {
  const dir = path.join(root, 'config', 'PlayerPrefixes');
  const prefixFile = path.join(dir, 'prefixes.json');
  const playerFile = path.join(dir, 'players.json');

  let prefixes = readJson(prefixFile, []);
  if (!Array.isArray(prefixes)) prefixes = [];
  const hit = prefixes.findIndex((p) => p && String(p.identifier).toLowerCase() === IDENT);
  const entry = { identifier: IDENT, prefix: CHAR, topTablist: false };
  if (hit >= 0) prefixes[hit] = { ...prefixes[hit], ...entry };
  else prefixes.push(entry);
  writeJson(prefixFile, prefixes);

  return playerFile;
}

function assignPlayer(playerFile, uuid, name) {
  const key = bareUuid(uuid);
  if (!key) return;
  let players = readJson(playerFile, []);
  if (!Array.isArray(players)) players = [];
  const at = players.findIndex((p) => p && bareUuid(p.uuid) === key);
  if (at >= 0) {
    players[at] = {
      ...players[at],
      nameAtCreation: name || players[at].nameAtCreation || '',
      prefixIdentifiers: { ...(players[at].prefixIdentifiers || {}), [IDENT]: Date.now() }
    };
  } else {
    players.push({ uuid: key, nameAtCreation: name || '', prefixIdentifiers: { [IDENT]: Date.now() } });
  }
  writeJson(playerFile, players);
}

/* username -> { id, name } (cached, Mojang profile lookup) */
async function lookupPlayer(cacheDir, username) {
  const cacheFile = path.join(cacheDir, 'uuids.json');
  const cache = readJson(cacheFile, {});
  const key = String(username).toLowerCase();
  if (cache[key]) return cache[key];
  const r = await fetch('https://api.mojang.com/users/profiles/minecraft/' + encodeURIComponent(username), {
    headers: { 'User-Agent': 'deal-death-launcher/1.3.0' }
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j || !j.id) return null;
  const hit = { id: j.id, name: j.name || username };
  cache[key] = hit;
  writeJson(cacheFile, cache);
  return hit;
}

/* Copy the badge glyph + prefix mod into the instance. Never throws: a badge
   must not be the reason a launch fails. */
async function applyPack(root, opts = {}) {
  const out = { badge: false };
  const loader = String(opts.loader || '').toLowerCase();
  const version = String(opts.version || '').trim();

  try {
    cleanOldTheme(root);
  } catch (err) {
    console.warn('[badge] cleanup skipped:', err && err.message ? err.message : err);
  }

  if (opts.badge === false) return out;
  if (loader !== 'fabric' || !SUPPORTED.has(version)) return out;

  try {
    const modsDir = path.join(root, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });
    const cacheDir = path.join(opts.cacheDir || root, 'badge-cache');

    if (!copyBadgeJar(root, version)) return out;

    /* the badge mod needs Fabric API — install it if the pack does not ship it */
    const hasApi = () => fs.readdirSync(modsDir).some((f) => /^fabric-api.*\.jar$/i.test(f));
    if (!hasApi()) {
      try {
        const api = await badgeModJar(cacheDir, version, 'P7dR8mSH', 'fabric-api');
        if (!hasApi()) fs.copyFileSync(api, path.join(modsDir, path.basename(api)));
      } catch (err) {
        console.warn('[badge] Fabric API missing, skipping badge:', err && err.message ? err.message : err);
        return out;
      }
    }

    const jar = await badgeModJar(cacheDir, version);
    const modName = path.basename(jar);
    const installed = fs.readdirSync(modsDir).some((f) => /^playerprefixes.*\.jar$/i.test(f));
    if (!installed) fs.copyFileSync(jar, path.join(modsDir, modName));

    const playerFile = writePrefixConfig(root);
    assignPlayer(playerFile, opts.uuid, opts.name);

    /* friends who also use DEAL DEATH: their badge shows up for you too */
    const friends = (Array.isArray(opts.friends) ? opts.friends : String(opts.friends || '').split(','))
      .map((s) => String(s).trim())
      .filter((s) => /^[A-Za-z0-9_]{3,16}$/.test(s))
      .slice(0, 40);
    for (const friend of friends) {
      try {
        const p = await lookupPlayer(cacheDir, friend);
        if (p) assignPlayer(playerFile, p.id, p.name);
      } catch {}
    }
    out.badge = true;
  } catch (err) {
    console.warn('[badge] skipped:', err && err.message ? err.message : err);
  }
  return out;
}

module.exports = { applyPack, CHAR, IDENT };
