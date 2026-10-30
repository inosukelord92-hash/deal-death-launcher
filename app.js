'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOADERS = ['Vanilla', 'Fabric', 'Forge', 'NeoForge', 'Quilt'];
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};
const mkB = (type) => ({ src: 'modrinth', type, q: '', ver: '', loaders: [], cat: '', sort: 'downloads', layout: 'grid', items: null, total: 0, err: null });
const S = {
  view: 'home', instances: store.get('instances', []), account: null,
  versions: null, vError: null, news: null, vt: 'All', vq: '', vLimit: 120,
  hub: mkB('modpack'), br: mkB('mod'), openId: null, itab: 'Content', ctab: 'Mods', iq: '', iqLib: '',
  scan: {}, busy: new Set(), cfKey: store.get('cfkey', '')
};
const save = () => store.set('instances', S.instances);
const PREF_DEF = {
  startup: false, startMinimized: false, tray: false, minimize: true, dblLaunch: true, tabBadge: true, friends: '',
  theme: 'light', accent: '#1f1f1c', cosmic: true, islands: false,
  autoJava: true, javaPath: '', memMax: 4, memMin: 2, winW: 854, winH: 480, jvmArgs: [], env: '', preLaunch: '', postExit: '',
  secureDns: false, nGame: true, nClosed: true, nInstall: true, nError: true, msClientId: ''
};
S.prefs = { ...PREF_DEF, ...store.get('prefs', {}) };
if (!store.get('ui', 0)) { S.prefs.theme = 'light'; S.prefs.accent = '#1f1f1c'; store.set('ui', 2); store.set('prefs', S.prefs); }
if (!Array.isArray(S.prefs.jvmArgs)) S.prefs.jvmArgs = String(S.prefs.jvmArgs || '').split(/\s+/).filter(Boolean);
S.running = {};
const savePrefs = () => store.set('prefs', S.prefs);
applyAppearance(S.prefs);
/* one-time on a fresh install: size the default heap to this PC's RAM */
if (!store.get('memAuto', 0) && !store.get('prefs', null)) {
  window.api.about().then((a) => {
    const g = a?.totalGB || 8;
    const mx = g >= 24 ? 8 : g >= 12 ? 6 : g >= 8 ? 4 : 3;
    S.prefs.memMax = mx; S.prefs.memMin = Math.min(3, Math.max(1, Math.floor(mx / 2)));
    savePrefs(); store.set('memAuto', 1);
    if (S.view === 'settings') render();
  }).catch(() => {});
}
const inst = (id) => S.instances.find((x) => x.id === id);
const who = () => S.account?.name || 'Player';
const heroInst = () => [...S.instances].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0] || null;
const playlogAdd = (mins) => {
  const k = new Date().toLocaleDateString('en-CA'), log = store.get('playlog', {});
  log[k] = (log[k] || 0) + mins; store.set('playlog', log);
};
const saveRunning = () => store.set('running', S.running);
/* fold a session that was still running the last time the launcher closed */
(() => {
  const r = store.get('running', {}) || {}, ids = Object.keys(r);
  if (!ids.length) return;
  const now = Date.now();
  ids.forEach((id) => {
    const i = inst(id); if (!i) return;
    const mins = Math.max(1, Math.round((now - (r[id] || now)) / 60000));
    i.playtime = (i.playtime || 0) + mins; i.lastPlayed = now; playlogAdd(mins);
  });
  save(); store.set('running', {});
})();
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); };
const cleanErr = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const ICONS = ['grass', 'dirt', 'stone', 'cobblestone', 'sand', 'planks', 'log', 'gold', 'iron', 'diamond', 'emerald', 'redstone', 'lapis', 'obsidian', 'netherrack', 'tnt', 'bookshelf', 'diamond_ore', 'gold_ore', 'coal_ore', 'iron_ore', 'redstone_ore', 'glowstone', 'pumpkin', 'sandstone'];
let vIdx = null; // oldest version = 0, so a version keeps its icon when new versions are released
const iconOf = (id) => ICONS[(vIdx && id in vIdx ? vIdx[id] : hash(id)) % ICONS.length];
const cube = () => '<img src="assets/grass.png" alt="">';
const BLOCKS = 31;
const blockOf = (seed) => `assets/blocks/b${String((hash(seed) % BLOCKS) + 1).padStart(2, '0')}.png`;
const ico = (i) => `<img src="${blockOf(i.id || i.name || i.version)}" alt="">`;
const CAL = '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
const CLK = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const DL = '<svg class="i" viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';
const ago = (t) => { if (!t) return 'Never'; const d = Math.floor((Date.now() - t) / 864e5); return d < 1 ? 'Today' : d + 'd ago'; };
const dur = (m) => { m = Math.round(m || 0); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };
const num = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n || 0);
const cap = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/* ---------- featured modpack (XPON Optimize on Modrinth) ---------- */
const XPON = {
  src: 'modrinth', id: '3eQH40qk', slug: 'xpon-optimize', title: 'XPON Optimize',
  icon: 'https://cdn.modrinth.com/data/3eQH40qk/6e9ba8af917cf78220df0a6b65f05f8cddf364f5_96.webp',
  desc: 'A performance-first modpack packed with optimisations, QoL mods and shaders — smooth Minecraft on almost any PC.',
  ver: '1.4.5', mc: '1.21.11', loader: 'fabric', downloads: 1253
};
const xponData = () => ({ ...XPON, ...(S.xpon || {}) });
const xponInst = () => S.instances.find((i) => i.pid === XPON.id || /xpon/i.test(i.name)) || null;

let vPromise = null;
function loadVersions() {
  if (S.versions) return Promise.resolve();
  if (!vPromise) vPromise = window.api.versions().then((r) => { S.versions = r.versions; vIdx = {}; r.versions.forEach((v, k) => { vIdx[v.id] = r.versions.length - 1 - k; }); S.vError = null; })
    .catch((e) => { S.vError = 'Could not load versions: ' + cleanErr(e); }).finally(() => { vPromise = null; });
  return vPromise;
}
const refreshScan = async (id) => { try { S.scan[id] = await window.api.scan(id); } catch { S.scan[id] = {}; } };

/* ---------- search / install ---------- */
const bst = () => (S.view === 'br' ? S.br : S.hub);
let bTok = 0;
async function bSearch() {
  const st = bst(), tok = ++bTok; st.err = null;
  const hasL = st.type === 'mod' || st.type === 'modpack';
  try {
    const r = await window.api.search({ src: st.src, type: st.type, q: st.q, ver: st.ver, loaders: hasL ? st.loaders : [], cat: st.cat, sort: st.sort, key: S.cfKey });
    if (tok !== bTok) return; st.items = r.items; st.total = r.total;
  } catch (e) { if (tok !== bTok) return; st.items = []; st.total = 0; st.err = cleanErr(e); }
  if (S.view === 'hub' || S.view === 'br') loadVersions().then(() => render());
render();
}
async function installTo(instId, it, type) {
  const i = inst(instId), key = it.src + it.id; S.busy.add(key); loadVersions().then(() => render());
render();
  try {
    await window.api.install({ src: it.src, id: it.id, type, ver: i.version, loader: i.loader, instId, title: it.title, icon: it.icon, desc: it.desc, url: it.url, key: S.cfKey });
    await refreshScan(instId); toast(it.title + ' installed into ' + i.name + '.'); notify('nInstall', 'Content installed', it.title + ' installed into ' + i.name + '.');
  } catch (e) { toast(cleanErr(e)); notify('nError', 'Install failed', cleanErr(e)); }
  S.busy.delete(key); loadVersions().then(() => render());
render();
}
async function installPackFlow(it, autoPlay) {
  const key = it.src + it.id; S.busy.add(key); render(); toast('Downloading modpack files… this can take a while.');
  const id = 'i' + Date.now();
  try {
    const r = await window.api.installPack({ src: it.src, id: it.id, instId: id, key: S.cfKey });
    S.instances.unshift({ id, pid: String(it.id), name: r.name || it.title, version: r.mc || '?', loader: LOADERS.includes(r.loader) ? r.loader : 'Vanilla', lastPlayed: 0, playtime: 0, installed: false });
    save(); S.busy.delete(key); S.openId = id; S.view = 'instance'; await refreshScan(id); loadVersions().then(() => render());
render();
    const fresh = inst(id);
    if (autoPlay && fresh) { toast('Modpack ready. Starting Minecraft…'); notify('nInstall', 'Modpack ready', it.title); return playInstance(fresh); }
    toast('Modpack files downloaded. Press Play to install Minecraft and the mod loader.'); notify('nInstall', 'Modpack downloaded', it.title);
  } catch (e) { S.busy.delete(key); toast(cleanErr(e)); render(); }
}
async function startXpon() {
  const ex = xponInst();
  if (ex) {
    S.openId = ex.id; S.view = 'instance'; S.itab = 'Content'; S.ctab = 'Mods'; render();
    return playInstance(ex);
  }
  if (S.busy.has('modrinth' + XPON.id)) return toast('XPON is already downloading…');
  await installPackFlow(xponData(), true);
}
function pickInstance(it, type) {
  if (!S.instances.length) return toast('Create an instance first, then install content into it.');
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="dlg"><div class="top"><h2>Install ${esc(it.title)}</h2><button class="btn" id="mx">✕</button></div>
  <label class="l">Choose an instance</label><select id="pi">${S.instances.map((i) => `<option value="${i.id}">${esc(i.name)} (${esc(i.loader)} ${esc(i.version)})</option>`).join('')}</select>
  <div class="row" style="justify-content:flex-end;margin-top:24px"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="pok">Install</button></div></div>`;
  const close = () => m.classList.add('hidden');
  $('#mx').onclick = $('#mc').onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
  $('#pok').onclick = () => { const id = $('#pi').value; close(); installTo(id, it, type); };
}

/* ---------- shared pieces ---------- */
function instCard(i) {
  return `<button class="card ic" data-open="${i.id}"><span class="when">${CAL} ${ago(i.lastPlayed)}</span><div class="ico">${ico(i)}</div><h3>${esc(i.name)}</h3>
  <div class="meta">${CLK} ${dur(i.playtime)}${i.installed ? '' : ' <span class="tag sm">Needs install</span>'}</div>
  <div class="foot"><span class="tag">${esc(i.loader)}</span><span class="ver">${esc(i.version)}</span></div></button>`;
}
function newsPanel() {
  const news = (S.news || []).slice(0, 5).map((n) => `<div class="news"><img src="https://launchercontent.mojang.com${esc(n.image?.url)}" alt=""><div><b>${esc(n.title)}</b><small>${esc((n.date || '').slice(0, 10))}</small></div></div>`).join('') || '<div class="meta">News unavailable offline.</div>';
  return `<div class="panel"><h4>NEWS</h4>${news}</div>`;
}
function last7() {
  const log = store.get('playlog', {}), days = [];
  for (let k = 6; k >= 0; k--) { const d = new Date(Date.now() - k * 864e5); days.push({ l: k === 0 ? 'Today' : d.toLocaleDateString('en', { weekday: 'short' }), v: log[d.toLocaleDateString('en-CA')] || 0 }); }
  return days;
}
const barRow = (days) => {
  const mx = Math.max(1, ...days.map((d) => d.v)), top = days.reduce((a, d) => (d.v > a.v ? d : a), days[0]);
  return `<div class="bars">${days.map((d) => `<div class="bar ${d.v ? '' : 'ghost'}">${d === top && d.v ? `<span class="tip">${dur(d.v)}</span>` : ''}<i style="height:${d.v ? Math.max(8, d.v / mx * 100) : 100}%"></i><small>${d.l}</small></div>`).join('')}</div>`;
};
function playPanel() {
  const days = last7(), tot = days.reduce((a, d) => a + d.v, 0);
  return `<h2>Your Playtime</h2><div class="panel"><div class="big">${dur(tot)}</div><div class="meta">Last 7 days</div>${barRow(days)}</div>`;
}
const promo = '<div class="card promo"><h3 style="margin-top:0">Promotion</h3><div class="meta">Reserved space for announcements and partner offers.</div></div>';

/* ---------- Home ---------- */
const FEAT = [
  { img: 'fo', title: 'Fabulously Optimized', d: 'Beautiful graphics, speedy performance and familiar features in a simple package. Wilderness Bound beta!', a: 'robotkoer', dl: '19.6M' },
  { img: 'cobblemon', title: 'Cobblemon Official Modpack [Fabric]', d: 'The official modpack of the Cobblemon mod, for Fabric!', a: 'CobbledStudios', dl: '11.6M' },
  { img: 'bmc', title: 'Better MC [FABRIC] - BMC2', d: "Version 1.20 | A Proper Vanilla+ Modpack | Don't play Vanilla play this!", a: 'SHXRKIE', dl: '3.8M' }
];
const hms = (m) => { const s = Math.round((m || 0) * 60); const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return [h, mm, ss].map((n) => String(n).padStart(2, '0')).join(':'); };
const ARROW = '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>';

function gauge(pct) {
  const R = 80, C = Math.PI * R, len = C * Math.max(0, Math.min(1, pct / 100));
  return `<svg class="gauge" viewBox="0 0 200 118" aria-hidden="true">
    <defs><pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(120,112,90,.45)" stroke-width="2.4"/></pattern></defs>
    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#hatch)" stroke-width="19" stroke-linecap="round"/>
    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--ink)" stroke-width="19" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}"/>
  </svg>`;
}

function home() {
  const all = S.instances, hero = heroInst();
  const days = last7(), week = days.reduce((a, d) => a + d.v, 0), total = all.reduce((a, i) => a + (i.playtime || 0), 0);
  const content = Object.values(S.scan).reduce((a, sc) => a + Object.values(sc).reduce((x, y) => x + (y?.length || 0), 0), 0);
  const installed = all.filter((i) => i.installed).length;
  const ready = all.length ? Math.round(installed / all.length * 100) : 0;
  const qp = all.slice(0, 8).map((i) => `<button class="qp" data-open="${i.id}" title="${esc(i.name)}">${ico(i)}</button>`).join('') || '<span class="meta">No instances yet</span>';
  const lib = [...all].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)).slice(0, 4);
  const news = (S.news || []).slice(0, 3).map((n) => `<div class="nrow"><img src="https://launchercontent.mojang.com${esc(n.image?.url || '')}" alt=""><div><b>${esc(n.title)}</b><small>${esc((n.date || '').slice(0, 10))}</small></div></div>`).join('') || '<div class="dempty">News unavailable offline.</div>';

  return `<div class="hello">
    <div><h1>Welcome in, <span class="nm">${esc(who())}</span></h1>
    <div class="sub">${all.length ? 'Plan your worlds, track your playtime, jump back in.' : 'Create your first instance and jump into the game.'}</div></div>
    <div class="hello-acts">
      <button class="btn pri" data-new>+ New instance</button>
      <button class="btn" data-go="library">Open library</button>
    </div></div>

  ${(() => {
    const xp = xponData(), xpEx = xponInst(), xpBusy = S.busy.has('modrinth' + XPON.id);
    return `<section class="spot">
      <div class="spot-copy">
        <span class="spot-tag">Featured modpack · Modrinth</span>
        <h2>${esc(xp.title)}</h2>
        <p class="spot-desc">${esc(String(xp.desc || '').replace(/\s+/g, ' ').trim())}</p>
        <div class="spot-pills"><span>${esc(cap(xp.loader))}</span><span>MC ${esc(xp.mc)}</span><span>v${esc(xp.ver)}</span><span>${num(xp.downloads)} downloads</span></div>
        <div class="spot-acts">
          <button class="spot-play" data-xpon ${xpBusy ? 'disabled' : ''}>${xpBusy ? 'Installing…' : (xpEx ? '▶ Play XPON' : '▶ Get &amp; Play XPON')}</button>
          <button class="spot-alt" data-go="hub">Browse modpacks</button>
        </div>
      </div>
      <div class="spot-art"><img src="${esc(xp.icon)}" alt=""><span class="spot-badge">${xpEx ? 'In your library' : 'One-click install'}</span></div>
    </section>`;
  })()}

  <div class="kpis">
    <div class="kpi fill">
      <div class="klabel">Instances<button class="arrow" data-go="library" title="Open library">${ARROW}</button></div>
      <div class="knum">${all.length}</div>
      <div class="kfoot"><span class="up">▲ ${installed} installed</span></div>
    </div>
    <div class="kpi">
      <div class="klabel">Playtime<button class="arrow" data-go="library" title="Open library">${ARROW}</button></div>
      <div class="knum">${dur(total)}</div>
      <div class="kfoot">This week · ${dur(week)}</div>
    </div>
    <div class="kpi">
      <div class="klabel">Content items<button class="arrow" data-go="hub" title="Open content hub">${ARROW}</button></div>
      <div class="knum">${content}</div>
      <div class="kfoot">Mods, packs &amp; shaders</div>
    </div>
    <div class="kpi">
      <div class="klabel">Ready to play<button class="arrow" data-go="library" title="Open library">${ARROW}</button></div>
      <div class="knum">${installed}<span class="kof">/${all.length}</span></div>
      <div class="kfoot">${all.length - installed} need install</div>
    </div>
  </div>

  <div class="dash">
    <div class="card span2">
      <div class="cardhead"><div><div class="eyebrow">Playtime analytics</div><div class="an-big">${dur(week)}</div></div><span class="pill">Last 7 days</span></div>
      ${barRow(days)}
      <div class="glegend"><span><i class="dot"></i>Played</span><span><i class="dot hatch"></i>No session</span></div>
    </div>

    <div class="card upnext">
      <div class="cardhead"><div class="eyebrow">Continue playing</div><span class="pill">${hero ? esc(hero.loader) : '—'}</span></div>
      <div class="big-title">${hero ? esc(hero.name) : 'Your first world'}</div>
      <div class="meta">${hero ? 'Last played ' + ago(hero.lastPlayed).toLowerCase() + ' · MC ' + esc(hero.version) + ' · ' + dur(hero.playtime) : 'Pick a version and build your setup'}</div>
      <div class="uart">${cube()}</div>
      <div class="ufoot">${hero ? `<button class="btn dark" data-open="${hero.id}">Open instance</button>` : '<button class="btn dark" data-new>+ Create</button>'}</div>
    </div>

    <div class="card">
      <div class="cardhead"><div class="eyebrow">Latest news</div><span class="pill">Minecraft</span></div>
      <div class="newslist">${news}</div>
    </div>

    <div class="card span2">
      <div class="cardhead"><div class="eyebrow">Your library</div><button class="btn sm" data-go="library">See all</button></div>
      <div class="drows">${lib.map((i) => `<button class="drow" data-open="${i.id}">
        <span class="dico">${ico(i)}</span>
        <span class="dname"><b>${esc(i.name)}</b><small>${esc(i.loader)} · MC ${esc(i.version)} · ${ago(i.lastPlayed)}</small></span>
        ${i.installed ? '<span class="st ok">Ready</span>' : '<span class="st warn">Pending</span>'}
      </button>`).join('') || '<div class="dempty">Nothing here yet.</div>'}</div>
    </div>

    <div class="card">
      <div class="cardhead"><div class="eyebrow">Library progress</div></div>
      <div class="gaugewrap">${gauge(ready)}<div class="gnum"><b>${ready}%</b><small>ready to play</small></div></div>
      <div class="glegend"><span><i class="dot"></i>Installed</span><span><i class="dot hatch"></i>Pending</span></div>
    </div>

    <div class="card timecard">
      <div class="cardhead"><div class="eyebrow">Total playtime</div><span class="pill darkpill">${all.length} worlds</span></div>
      <div class="timer">${hms(total)}</div>
      <div class="timefoot">
        ${hero ? '<button class="tbtn go" id="playHero" title="Play">▶</button>' : '<button class="tbtn go" data-new title="New instance">+</button>'}
        <button class="tbtn" data-go="library" title="Open library">▤</button>
        <span class="meta">${hero ? esc(hero.name) : 'No instance yet'}</span>
      </div>
    </div>
  </div>

  <div class="strip"><span class="strip-label">Quick access</span>${qp}</div>

  <div class="sect row sp"><h2>Explore content hub</h2><button class="btn sm" data-go="hub">Browse all</button></div>
  <div class="grid">${FEAT.map((f) => `<button class="card hc" data-go="hub"><img class="himg" src="assets/cards/${f.img}.png" alt=""><div class="hb"><h3>${esc(f.title)}</h3><p>${esc(f.d)}</p><div class="foot meta"><span>${esc(f.a)}</span><span>${DL} ${f.dl}</span></div></div></button>`).join('')}</div>

  <div class="sect row sp"><h2>Instances</h2><button class="btn sm" data-new>+ New instance</button></div>
  ${all.length ? `<div class="grid">${all.slice(0, 3).map(instCard).join('')}</div>` : '<div class="empty">No instances yet. Use the + button to create one.</div>'}`;
}

/* ---------- Versions (old Content Hub) ---------- */
function versions() {
  const types = { All: null, Versions: 'release', Snapshots: 'snapshot' }, t = types[S.vt], q = S.vq.toLowerCase();
  let body;
  if (S.vError) body = `<div class="empty">${esc(S.vError)}<br><br><button class="btn" data-retry>Try again</button></div>`;
  else if (!S.versions) body = '<div class="empty">Loading versions…</div>';
  else {
    const all = S.versions.filter((v) => !t || v.type === t), list = all.filter((v) => v.id.toLowerCase().includes(q));
    body = `<h2 style="margin-top:0">${S.vt} <span class="meta" style="display:inline">(${list.length} results)</span></h2>` + (list.length ? `<div class="grid">${list.slice(0, S.vLimit).map((v) => `<div class="card hc"><div class="himg ph vh"><div class="ico big">${cube(v.id)}</div></div><div class="hb"><h3>Minecraft ${esc(v.id)}</h3><p>${esc(v.type.replace('_', ' '))} · released ${esc((v.releaseTime || '').slice(0, 10))}</p><div class="foot meta"><span></span><button class="btn pri sm" data-newver="${esc(v.id)}">Create instance</button></div></div></div>`).join('')}</div>${list.length > S.vLimit ? '<div style="text-align:center;margin:24px"><button class="btn" data-more>Show more</button></div>' : ''}` : '<div class="empty">No matches.</div>');
  }
  return `<h1>Versions</h1><div class="sub">Every Minecraft version, ready to turn into an instance</div>
  <div class="tabs">${Object.keys(types).map((k) => `<button class="chip ${S.vt === k ? 'on' : ''}" data-vt="${k}">${k}</button>`).join('')}</div>
  <input class="search" id="vq" style="margin-bottom:24px" placeholder="Search versions…" value="${esc(S.vq)}">${body}`;
}

/* ---------- Content Hub + Content Browser ---------- */
const CAT = {
  modpack: ['adventure', 'challenging', 'combat', 'kitchen-sink', 'lightweight', 'magic', 'multiplayer', 'optimization'],
  mod: ['adventure', 'cursed', 'decoration', 'economy', 'equipment', 'food', 'game-mechanics', 'library', 'magic', 'management', 'minigame', 'mobs', 'optimization', 'social', 'storage', 'technology', 'transportation', 'utility', 'worldgen'],
  resourcepack: ['combat', 'cursed', 'decoration', 'modded', 'realistic', 'simplistic', 'themed', 'tweaks', 'utility', 'vanilla-like'],
  shader: ['cartoon', 'cursed', 'fantasy', 'realistic', 'semi-realistic', 'vanilla-like']
};
CAT.datapack = CAT.mod;
function browse(st, i) {
  const hubMode = !i;
  const types = hubMode ? [['modpack', 'Modpack'], ['mod', 'Mod'], ['resourcepack', 'Resource Pack'], ['shader', 'Shader'], ['datapack', 'Data Pack']]
    : [['mod', 'Mods'], ['resourcepack', 'Resource Packs'], ['shader', 'Shaders'], ['datapack', 'Data Packs']];
  const tl = (types.find((t) => t[0] === st.type) || [, ''])[1];
  const have = new Set(i ? Object.values(S.scan[i.id] || {}).flat().map((x) => x.pid).filter(Boolean) : []);
  const hasL = st.type === 'mod' || st.type === 'modpack';
  const loaders = hubMode ? ['fabric', 'forge', 'neoforge', 'quilt'] : ['fabric', 'legacy-fabric', 'babric', 'ornithe', 'forge', 'neoforge', 'quilt'];
  const btn = (it, k) => {
    const busy = S.busy.has(it.src + it.id), done = have.has(String(it.id));
    return done ? '<span class="ok">✓ Installed</span>' : `<button class="btn pri sm" data-install="${k}" ${busy ? 'disabled' : ''}>${busy ? 'Installing…' : DL + ' Install'}</button>`;
  };
  let body;
  if (st.items == null) body = '<div class="empty">Loading…</div>';
  else if (st.err) body = `<div class="empty">${esc(st.err)}</div>`;
  else if (!st.items.length) body = '<div class="empty">Nothing found. Try different filters.</div>';
  else if (st.layout === 'list') body = st.items.map((it, k) => `<div class="item"><img src="${esc(it.icon || blockOf(it.title))}" alt=""><div class="grow"><b>${esc(it.title)}</b><p>${esc(it.desc)}</p><p>${esc(it.author)} · ${num(it.downloads)} downloads</p></div>${btn(it, k)}</div>`).join('');
  else body = `<div class="grid g3">${st.items.map((it, k) => `<div class="card hc"><div class="himg ph">${it.image ? `<img class="himg" src="${esc(it.image)}" alt="">` : ''}<img class="pic" src="${esc(it.icon || blockOf(it.title))}" alt=""></div>
    <div class="hb"><div class="row sp" style="align-items:flex-start"><h3>${esc(it.title)}</h3><span class="meta nw">${DL} ${num(it.downloads)}</span></div><p>${esc(it.desc)}</p>
    <div class="foot meta"><span>${esc(it.author)}</span>${btn(it, k)}</div></div></div>`).join('')}</div>`;
  const rel = (S.versions || []).filter((v) => v.type === 'release').slice(0, 80).map((v) => v.id);
  if (st.ver && !rel.includes(st.ver)) rel.unshift(st.ver);
  const head = hubMode ? `<h1>Content Hub</h1><div class="sub">Find and install amazing modpacks, mods, and resources</div>`
    : `<button class="btn" data-back style="margin-bottom:18px">← Back</button><div class="row sp"><div><h1>Content Browser</h1><div class="sub">Browse and install content for your instance</div></div><div class="tag big"><span class="ico" style="width:34px;height:34px;display:inline-grid;vertical-align:middle;margin-right:10px">${cube(i.version)}</span>${esc(i.version)}</div></div>`;
  const keyRow = st.src === 'curseforge' && !S.cfKey ? `<h4>CURSEFORGE API KEY</h4><input class="search" id="cfk" style="padding:12px" placeholder="Paste key"><button class="btn pri sm" style="margin-top:8px" data-savekey>Save key</button>` : '';
  return `<div class="hub"><div style="min-width:0">${head}
    <input class="search" id="bq" style="margin:24px 0" placeholder="Search ${tl.toLowerCase()}…" value="${esc(st.q)}">
    <div class="row sp" style="margin-bottom:20px"><h2 style="margin:0">${tl} <span class="meta" style="display:inline">(${st.items && !st.err ? st.total.toLocaleString() : 0} results)</span></h2>
      <div class="row" style="gap:10px"><select id="bsort" style="width:170px">${[['downloads', 'Downloads'], ['relevance', 'Relevance'], ['newest', 'Newest'], ['updated', 'Updated']].map((s) => `<option value="${s[0]}" ${st.sort === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select>
      <button class="chip ${st.layout === 'grid' ? 'on' : ''}" data-lay="grid">▦</button><button class="chip ${st.layout === 'list' ? 'on' : ''}" data-lay="list">☰</button></div></div>${body}</div>
    <div class="panel fp"><div class="row sp"><b>Filters</b><button class="btn sm" data-clear>Clear</button></div>
    <h4>SOURCE</h4><div class="chips"><button class="chip ${st.src === 'modrinth' ? 'on' : ''}" data-src="modrinth">Modrinth</button><button class="chip ${st.src === 'curseforge' ? 'on' : ''}" data-src="curseforge">CurseForge</button></div>${keyRow}
    <h4>CONTENT TYPE</h4><div class="chips">${types.map((t) => `<button class="chip ${st.type === t[0] ? 'on' : ''}" data-type="${t[0]}">${t[1]}</button>`).join('')}</div>
    <h4>GAME VERSION</h4><select id="bver"><option value="">Any Version</option>${rel.map((v) => `<option ${st.ver === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
    ${hasL ? `<h4>MOD LOADERS</h4><div class="chips">${loaders.map((l) => `<button class="chip ${st.loaders.includes(l) ? 'on' : ''}" data-loader="${l}">${cap(l)}</button>`).join('')}</div>` : ''}
    <h4>CATEGORIES</h4><div class="chips">${CAT[st.type].map((l) => `<button class="chip ${st.cat === l ? 'on' : ''}" data-cat="${l}">${cap(l)}</button>`).join('')}</div></div></div>`;
}
const hub = () => browse(S.hub, null);
function br() { const i = inst(S.openId); if (!i) { S.view = 'library'; return library(); } return browse(S.br, i); }

/* ---------- Library ---------- */
function library() {
  const q = S.iqLib.toLowerCase(), list = S.instances.filter((i) => i.name.toLowerCase().includes(q));
  return `<div class="cols"><div><div class="row sp"><div><h1>Library</h1><div class="sub">Manage your Minecraft instances</div></div>
  <div class="row"><button class="btn" id="imp">${DL} Import</button><button class="btn pri" data-new>+ New Instance</button></div></div>
  <input type="file" id="impFile" accept=".json" class="hidden">
  <input class="search" id="libQ" style="margin:22px 0" placeholder="Search instances…" value="${esc(S.iqLib)}">
  <h2 style="margin-top:0">Instances <span class="meta" style="display:inline">(${list.length} found)</span></h2>
  ${list.length ? `<div class="grid">${list.map(instCard).join('')}</div>` : '<div class="empty">No instances found. Click New Instance to create one.</div>'}</div>
  <div>${newsPanel()}<div style="margin-top:18px">${promo}</div></div></div>`;
}

/* ---------- Instance ---------- */
const TABS = ['Mods', 'Resource Packs', 'Shaders', 'Data Packs'];
function instance() {
  const i = inst(S.openId);
  if (!i) { S.view = 'library'; return library(); }
  if (!S.scan[i.id]) refreshScan(i.id).then(() => S.view === 'instance' && render());
  const sc = S.scan[i.id] || {}, items = (sc[S.ctab] || []).filter((x) => (x.title || x.name).toLowerCase().includes(S.iq.toLowerCase()));
  let content;
  if (S.itab === 'Content') {
    content = `<div class="row" style="margin-bottom:16px;gap:12px"><div class="chips sub-tabs">${TABS.map((t) => `<button class="chip ${S.ctab === t ? 'on' : ''}" data-ctab="${t}">${t} <span class="cnt">${(sc[t] || []).length}</span></button>`).join('')}</div>
      <input class="search" id="iq" style="padding:12px 18px;flex:1" placeholder="Search installed ${S.ctab.toLowerCase()}…" value="${esc(S.iq)}"><button class="btn pri" data-addc>+ Add</button></div>
      <div class="list">${items.map((x) => `<div class="item"><span class="mi"><img src="${esc(x.icon || blockOf(x.name || x.file))}" alt=""></span><div class="grow"><b>${esc(x.title || x.name)}</b> <span class="tag mono">${esc(x.name)}</span>${x.desc ? `<p>${esc(x.desc)}</p>` : ''}</div>${x.url ? `<a class="btn sm" href="${esc(x.url)}" target="_blank" rel="noopener">Open</a>` : ''}<button class="sw ${x.enabled ? 'on' : ''}" data-tog="${esc(x.file)}" title="${x.enabled ? 'Disable' : 'Enable'}"></button><button class="btn sm" data-rm="${esc(x.file)}">Remove</button></div>`).join('') || `<div class="empty">No ${S.ctab.toLowerCase()} yet. Click Add to browse and install.</div>`}</div>`;
  } else if (S.itab === 'Files') content = `<div class="empty">Instance folder<br><br><button class="btn pri" data-folder>Open folder</button></div>`;
  else content = `<div class="empty">${S.itab} will appear here. Nothing to show yet.</div>`;
  return `<button class="btn" data-go="library" style="margin-bottom:18px">← Back</button>
  <div class="hero"><div class="row" style="padding:30px;align-items:center;gap:20px"><div class="ico" style="width:84px;height:84px">${ico(i)}</div>
    <div style="flex:1"><span class="tag mono">${esc(i.loader)} | MC ${esc(i.version)}</span><h1 style="font-size:40px;margin-top:10px">${esc(i.name)}</h1></div><button class="btn pri play" id="play">▷ Play</button></div>
    <div class="hstats"><div><small>STATUS</small><b>${i.installed ? 'Ready to play' : 'Needs install'}</b></div><div><small>LAST PLAYED</small><b>${ago(i.lastPlayed)}</b></div><div><small>PLAYTIME</small><b>${CLK} ${dur(i.playtime)}</b></div><button class="hbtn" data-settings>Instance Settings</button></div></div>
  <div class="tabs big">${['Content', 'Worlds', 'Gallery', 'Files'].map((t) => `<button class="chip ${S.itab === t ? 'on' : ''}" data-itab="${t}">${t}</button>`).join('')}</div>${content}`;
}
function openSettings(i) {
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="dlg"><div class="top"><h2>Instance Settings</h2><button class="btn" id="mx">✕</button></div>
  <label class="l">Instance Name</label><input type="text" id="rn" value="${esc(i.name)}">
  <div class="row sp" style="margin-top:28px"><button class="btn" id="del" style="color:#ff8a8a">Delete instance</button><div class="row"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="sv">Save</button></div></div></div>`;
  const close = () => m.classList.add('hidden');
  $('#mx').onclick = $('#mc').onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
  $('#sv').onclick = () => { i.name = $('#rn').value.trim() || i.name; save(); close(); render(); };
  $('#del').onclick = async () => { if (!confirm('Delete "' + i.name + '" and its files?')) return; await window.api.deleteInstance(i.id).catch(() => {}); S.instances = S.instances.filter((x) => x.id !== i.id); save(); close(); go('library'); };
}

/* ---------- Settings ---------- */
function settings() { return ''; }

/* ---------- render ---------- */
function render() {
  const f = { home, hub, versions, library, instance, br, settings }[S.view];
  const a = document.activeElement, keep = a?.id, pos = a?.selectionStart;
  $('#main').innerHTML = f();
  const nav = S.view === 'instance' || S.view === 'br' ? 'library' : S.view;
  document.querySelectorAll('.nav[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === nav));
  $('#isl').innerHTML = S.instances.map((i) => `<button class="si ${S.openId === i.id && (S.view === 'instance' || S.view === 'br') ? 'on' : ''}" data-open="${i.id}" title="${esc(i.name)}">${ico(i)}</button>`).join('');
  const av = $('#avatar img'); if (av) av.src = S.account?.skin || 'assets/avatar.png';
  if (keep && $('#' + keep)) { const e = $('#' + keep); e.focus(); try { e.setSelectionRange(pos, pos); } catch {} }
}
function go(v) {
  S.view = v;
  if (v === 'versions') { S.vLimit = 120; loadVersions().then(() => S.view === 'versions' && render()); }
  if (v === 'hub') { loadVersions().then(() => S.view === 'hub' && render()); if (!S.hub.items) bSearch(); }
  loadVersions().then(() => render());
render();
}
function openBrowser(i) {
  S.br = mkB('mod'); S.br.ver = i.version; if (i.loader !== 'Vanilla') S.br.loaders = [i.loader.toLowerCase()];
  S.view = 'br'; loadVersions().then(() => S.view === 'br' && render()); render(); bSearch();
}

/* ---------- New Instance modal ---------- */
function openNew(pre = {}) {
  const st = { name: '', version: pre.version || '', loader: 'Vanilla', all: !!pre.all, launch: false };
  const draw = () => {
    const vs = (S.versions || []).filter((v) => st.all || v.type === 'release' || v.id === st.version);
    $('#modal').innerHTML = `<div class="dlg"><div class="top"><h2>New Instance</h2><button class="btn" id="mx">✕</button></div>
    <div class="row" style="align-items:flex-start;gap:24px"><div><label class="l">Icon</label><div class="ico">${cube(st.version)}</div></div>
    <div style="flex:1"><label class="l">Instance Name</label><input type="text" id="mn" placeholder="Enter name or leave empty for auto" value="${esc(st.name)}">
    <div class="row sp" style="margin:22px 0 10px"><b>Minecraft Version</b><button class="row meta" id="mall" style="gap:12px">Show snapshots, historical and local <span class="sw ${st.all ? 'on' : ''}"></span></button></div>
    <select id="mv"><option value="">${S.versions ? 'Select Minecraft version' : 'Loading versions…'}</option>${vs.map((v) => `<option ${v.id === st.version ? 'selected' : ''}>${esc(v.id)}</option>`).join('')}</select></div></div>
    <b style="display:block;margin:22px 0 10px">Mod Loader</b><div class="chips">${LOADERS.map((l) => `<button class="ld ${st.loader === l ? 'on' : ''}" data-ld="${l}">${l}</button>`).join('')}</div>
    <div class="row sp" style="margin-top:28px"><button class="row" id="ml"><span class="sw ${st.launch ? 'on' : ''}"></span> Launch after install</button>
    <div class="row"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="mok" ${st.version ? '' : 'disabled'}>+ Create Instance</button></div></div></div>`;
    const d = $('#modal');
    $('#mn', d).oninput = (e) => { st.name = e.target.value; };
    $('#mv', d).onchange = (e) => { st.version = e.target.value; draw(); };
    $('#mall', d).onclick = () => { st.all = !st.all; draw(); };
    $('#ml', d).onclick = () => { st.launch = !st.launch; draw(); };
    d.querySelectorAll('[data-ld]').forEach((b) => b.onclick = () => { st.loader = b.dataset.ld; draw(); });
    $('#mx', d).onclick = $('#mc', d).onclick = close;
    $('#mok', d).onclick = () => {
      if (!st.version) return;
      const name = st.name.trim() || (st.loader === 'Vanilla' ? st.version : st.loader + ' ' + st.version);
      const n = { id: 'i' + Date.now(), name, version: st.version, loader: st.loader, lastPlayed: 0, playtime: 0, installed: false };
      S.instances.unshift(n); save(); close(); S.openId = n.id; S.view = 'instance'; S.itab = 'Content'; loadVersions().then(() => render());
render();
      if (st.launch) playInstance(n); else toast('Instance saved.');
    };
  };
  const close = () => $('#modal').classList.add('hidden');
  $('#modal').classList.remove('hidden'); draw();
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') close(); };
  loadVersions().then(() => !$('#modal').classList.contains('hidden') && $('#mn') && draw());
}

/* ---------- account popup + offline profile ---------- */
async function togglePop() {
  const p = $('#pop');
  if (!p.classList.contains('hidden')) {
    p.classList.add('hidden');
    return;
  }

  const a = S.account;
  let offline = { username: '' };

  try {
    offline = await window.api.offlineProfileGet();
  } catch (e) {
    console.warn('[offline profile]', e);
  }

  const head = a?.signedIn
    ? `<div class="row accrow">
        <div class="ico" style="width:46px;height:46px">
          <img src="${esc(a.skin || 'assets/avatar.png')}" style="image-rendering:pixelated" alt="">
        </div>
        <div style="text-align:left">
          <b>${esc(a.name)}</b>
          <div class="meta">${a.local ? 'Local account' : 'Microsoft account'}</div>
        </div>
      </div>`
    : `<div class="row accrow">
        <div class="ico" style="width:46px;height:46px">
          <img src="assets/avatar.png" alt="">
        </div>
        <div style="text-align:left">
          <b>Not signed in</b>
          <div class="meta">Microsoft account</div>
        </div>
      </div>`;

  p.innerHTML = head + `
    ${a?.signedIn
      ? '<div class="meta" style="padding:8px;line-height:1.5">' + (a.local ? 'Local (offline) account is active on this PC.' : 'Microsoft sign-in is active on this PC.') + '</div><button class="btn" style="width:100%;margin-top:8px" id="signout">Sign out</button>'
      : '<button class="btn pri" style="width:100%;margin-top:8px" id="signin">Sign in with Microsoft</button>'}

    <hr style="margin:14px 0;opacity:.2">
    <div style="padding:4px">
      <b>Offline Profile</b>
      <div class="meta" style="margin:6px 0 10px">Save a username for display in the launcher.</div>
      <input id="offlineName" class="input" maxlength="16"
        placeholder="Username (3–16 characters)"
        value="${esc(offline.username || '')}"
        style="width:100%;box-sizing:border-box">
      <button class="btn" id="offlineSave"
        style="width:100%;margin-top:8px">Save username</button>
      <button class="btn" id="offlineClear"
        style="width:100%;margin-top:6px">Clear username</button>
      <div class="meta" id="offlineMsg" style="margin-top:8px"></div>
    </div>
  `;

  p.classList.remove('hidden');

  if ($('#signin')) {
    $('#signin').onclick = () => {
      p.classList.add('hidden');
      openWelcome(1);
    };
  }

  if ($('#signout')) {
    $('#signout').onclick = async () => {
      p.classList.add('hidden');
      await (S.account?.local ? window.api.localClear() : window.api.authLogout()).catch(() => {});
      S.account = { signedIn: false };
      render();
      toast('Signed out.');
    };
  }

  $('#offlineSave').onclick = async () => {
    const msg = $('#offlineMsg');
    try {
      const result = await window.api.offlineProfileSave(
        $('#offlineName').value
      );
      $('#offlineName').value = result.username;
      msg.textContent = 'Username saved: ' + result.username;
    } catch (e) {
      msg.textContent = cleanErr(e);
    }
  };

  $('#offlineClear').onclick = async () => {
    try {
      await window.api.offlineProfileClear();
      $('#offlineName').value = '';
      $('#offlineMsg').textContent = 'Username cleared.';
    } catch (e) {
      $('#offlineMsg').textContent = cleanErr(e);
    }
  };
}
function openWelcome(step) {
  const w = $('#welcome'); w.classList.remove('hidden');
  const close = () => w.classList.add('hidden');
  const body = step === 1
    ? `<h2>Welcome to DEAL DEATH</h2><p>Choose how you want to sign in</p><button class="wbtn" id="wmsb"><svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;stroke:none"><rect x="3" y="3" width="8.5" height="8.5"/><rect x="12.5" y="3" width="8.5" height="8.5"/><rect x="3" y="12.5" width="8.5" height="8.5"/><rect x="12.5" y="12.5" width="8.5" height="8.5"/></svg>Microsoft</button><button class="wbtn" id="wloc"><svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>Local</button>`
    : step === 3
    ? `<h2>Local account</h2><p>Pick a username (3–16 letters, numbers or _)</p><input type="text" id="wn" maxlength="16" placeholder="Username" autocomplete="off"><div class="werr" id="werr"></div><button class="wbtn pri" id="wcreate">Create account</button><button class="wback" id="wbk">Back</button>`
    : `<h2>Sign in to play</h2><p>A secure Microsoft window will open. DEAL DEATH never sees your password.</p><button class="wbtn pri" id="wms">Sign in with Microsoft</button><div class="werr" id="werr"></div><button class="wback" id="wbk">Back</button>`;
  w.innerHTML = `<button class="wx" id="wx" title="Close">✕</button><div class="wcard"><img class="wlogo" src="assets/welcome-logo.png" alt=""><div class="wbody">${body}</div></div><div class="wcopy">© 2026 Deal Death. All rights reserved.</div>`;
  $('#wx').onclick = close;
  if (step === 1) { $('#wmsb').onclick = () => openWelcome(2); $('#wloc').onclick = () => openWelcome(3); return; }
  $('#wbk').onclick = () => openWelcome(1);
  if (step === 3) {
    const input = $('#wn'); input.focus();
    const create = async () => {
      const err = $('#werr'), btn = $('#wcreate'); err.textContent = ''; btn.disabled = true;
      try {
        const r = await window.api.localSave(input.value);
        S.account = { signedIn: true, local: true, name: r.username, skin: '', uuid: '' };
        close(); render(); toast('Signed in as ' + r.username + ' (Local).');
      } catch (er) { err.textContent = cleanErr(er); btn.disabled = false; }
    };
    $('#wcreate').onclick = create; input.onkeydown = (ev) => { if (ev.key === 'Enter') create(); };
    return;
  }
  $('#wms').onclick = async () => {
    const btn = $('#wms'), err = $('#werr');
    btn.disabled = true; btn.textContent = 'Waiting for Microsoft…'; err.textContent = '';
    try {
      const r = await window.api.authLogin();
      if (r.canceled) { err.textContent = 'Sign-in cancelled.'; btn.disabled = false; btn.textContent = 'Sign in with Microsoft'; return; }
      S.account = r; close(); render(); toast('Signed in as ' + r.name + '.');
    } catch (e) {
      err.textContent = cleanErr(e); btn.disabled = false; btn.textContent = 'Sign in with Microsoft';
    }
  };
}

/* ---------- events ---------- */
document.addEventListener('click', async (e) => {
  const c = (s) => e.target.closest(s), d = (s, k) => c(s)?.dataset[k];
  if (!c('#pop') && !c('#avatar')) $('#pop').classList.add('hidden');
  if (c('#avatar')) return togglePop();
  if (c('#plus') || c('[data-new]')) return openNew();
  if (c('[data-xpon]')) return startXpon();
  if (c('[data-openroot]')) return window.api.openFolder('');
  if (c('[data-sk]')) { const v = $('#sk').value.trim(); if (!v) return; S.cfKey = v; store.set('cfkey', v); toast('Key saved.'); return render(); }
  if (c('[data-skdel]')) { S.cfKey = ''; store.set('cfkey', ''); return render(); }
  if (c('[data-view]') && d('[data-view]', 'view') === 'settings') return openSettingsModal();
  if (c('[data-view]')) return go(d('[data-view]', 'view'));
  if (c('[data-go]')) return go(d('[data-go]', 'go'));
  if (c('[data-open]')) { S.openId = d('[data-open]', 'open'); S.view = 'instance'; S.itab = 'Content'; S.ctab = 'Mods'; S.iq = ''; return render(); }
  if (c('[data-vt]')) { S.vt = d('[data-vt]', 'vt'); S.vLimit = 120; return render(); }
  if (c('[data-more]')) { S.vLimit += 120; return render(); }
  if (c('[data-retry]')) { S.vError = null; return go('versions'); }
  if (c('[data-newver]')) return openNew({ version: d('[data-newver]', 'newver'), all: S.vt !== 'Versions' });
  if (c('[data-back]')) { S.view = 'instance'; return render(); }
  if (c('[data-addc]')) return openBrowser(inst(S.openId));
  const st = bst();
  if (c('[data-src]')) { st.src = d('[data-src]', 'src'); st.items = null; render(); return bSearch(); }
  if (c('[data-type]')) { st.type = d('[data-type]', 'type'); st.cat = ''; st.items = null; render(); return bSearch(); }
  if (c('[data-loader]')) { const l = d('[data-loader]', 'loader'); st.loaders = st.loaders.includes(l) ? st.loaders.filter((x) => x !== l) : [...st.loaders, l]; st.items = null; render(); return bSearch(); }
  if (c('[data-cat]')) { const v = d('[data-cat]', 'cat'); st.cat = st.cat === v ? '' : v; st.items = null; render(); return bSearch(); }
  if (c('[data-lay]')) { st.layout = d('[data-lay]', 'lay'); return render(); }
  if (c('[data-clear]')) { st.ver = ''; st.loaders = []; st.cat = ''; st.q = ''; st.items = null; render(); return bSearch(); }
  if (c('[data-savekey]')) { const k = $('#cfk').value.trim(); if (!k) return; S.cfKey = k; store.set('cfkey', k); render(); return bSearch(); }
  if (c('[data-install]')) { const it = st.items[+d('[data-install]', 'install')]; return S.view === 'br' ? installTo(S.openId, it, st.type) : st.type === 'modpack' ? installPackFlow(it) : pickInstance(it, st.type); }
  if (c('[data-itab]')) { S.itab = d('[data-itab]', 'itab'); return render(); }
  if (c('[data-ctab]')) { S.ctab = d('[data-ctab]', 'ctab'); S.iq = ''; return render(); }
  if (c('[data-tog]')) { try { await window.api.toggle({ instId: S.openId, tab: S.ctab, file: d('[data-tog]', 'tog') }); } catch (er) { toast(cleanErr(er)); } await refreshScan(S.openId); return render(); }
  if (c('[data-rm]')) { if (!confirm('Remove this file from the instance?')) return; try { await window.api.remove({ instId: S.openId, tab: S.ctab, file: d('[data-rm]', 'rm') }); } catch (er) { toast(cleanErr(er)); } await refreshScan(S.openId); return render(); }
  if (c('[data-folder]')) return window.api.openFolder(S.openId);
  if (c('[data-settings]')) return openSettings(inst(S.openId));
  if (c('#playHero')) { const i = heroInst(); if (!i) return toast('Create an instance first.'); return playInstance(i); }
  
if (c('#play')) { const i = inst(S.openId); if (!i) return toast('Select an instance first.'); return playInstance(i); }

  if (c('#imp')) return $('#impFile').click();
});
let bt;
document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'libQ') { S.iqLib = e.target.value; render(); }
  if (id === 'iq') { S.iq = e.target.value; render(); }
  if (id === 'vq') { S.vq = e.target.value; S.vLimit = 120; render(); }
  if (id === 'bq') { bst().q = e.target.value; clearTimeout(bt); bt = setTimeout(bSearch, 400); }
});
document.addEventListener('change', (e) => {
  const id = e.target.id;
  if (id === 'bsort') { bst().sort = e.target.value; bst().items = null; render(); bSearch(); }
  if (id === 'bver') { bst().ver = e.target.value; bst().items = null; render(); bSearch(); }
  if (id === 'impFile') {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => { try { const a = [].concat(JSON.parse(t)); a.forEach((x) => S.instances.push({ id: 'i' + Math.random().toString(36).slice(2), name: String(x.name || 'Imported'), version: String(x.version || '?'), loader: LOADERS.includes(x.loader) ? x.loader : 'Vanilla', lastPlayed: 0, playtime: 0, installed: false })); save(); render(); toast('Imported ' + a.length + ' instance(s).'); } catch { toast('That file is not valid instance JSON.'); } });
  }
});
window.api.news().then((n) => { S.news = n.entries; if (S.view === 'home' || S.view === 'library') render(); }).catch(() => {});
window.api.featured?.().then((m) => { if (m && m.id) { S.xpon = m; if (S.view === 'home') render(); } }).catch(() => {});
window.api.authStatus().then(async (a) => {
  if (!a.signedIn) { try { const l = await window.api.localGet(); if (l.username) a = { signedIn: true, local: true, name: l.username, skin: '', uuid: '' }; } catch {} }
  S.account = a;
  render();
  if (!a.signedIn) setTimeout(() => { if (!S.account?.signedIn) openWelcome(1); }, 500);
}).catch(() => { S.account = { signedIn: false }; });
loadVersions().then(() => render());
render();


/* ================= Play / notifications ================= */
/* live playtime: tick the dashboard timer while a game session is open */
setInterval(() => {
  const el = document.querySelector('.timer'); if (!el) return;
  const base = S.instances.reduce((a, i) => a + (i.playtime || 0), 0);
  const live = Object.values(S.running).reduce((a, t) => a + (Date.now() - t) / 60000, 0);
  el.textContent = hms(base + live);
}, 1000);
function notify(kind, title, body) {
  try { if (S.prefs[kind] && 'Notification' in window) new Notification(title, { body }); } catch {}
}
function playInstance(i) {
  if (!S.account?.signedIn) { toast('Sign in to play.'); return openWelcome(1); }
  if (S.running[i.id]) return toast('This instance is already running.');
  S.running[i.id] = Date.now();
  toast('Starting Minecraft... first launch downloads game files, please wait.');
  window.api.launch({ local: !!S.account?.local, instId: i.id, version: i.version, loader: i.loader, prefs: S.prefs })
    .then(() => {
      S.running[i.id] = Date.now(); i.lastPlayed = Date.now(); i.installed = true; save(); saveRunning(); render();
      toast('Minecraft launched!'); notify('nGame', 'DEAL DEATH', i.name + ' started.');
    })
    .catch((err) => {
      delete S.running[i.id];
      saveRunning();
      if (S.view === 'instance' && S.openId === i.id) render();
      toast('Launch error: ' + cleanErr(err)); notify('nError', 'Launch error', cleanErr(err));
    });
}
window.api.onInfo((m) => toast(m));
window.api.onLaunchProgress((p) => {
  if (!p) return;
  if (p.instId === S.openId) {
    const b = $('#play');
    if (b) {
      b.disabled = true;
      b.textContent = p.percent >= 100 ? 'Starting…' : 'Downloading ' + p.percent + '%';
      if (p.label) b.title = p.label;
    }
  }
  if (p.percent < 100) toast((p.label || 'Preparing Minecraft') + ' · ' + p.percent + '%');
});
window.api.onGameClosed(({ instId }) => {
  const t = S.running[instId]; delete S.running[instId];
  const i = inst(instId); if (!i) return;
  const mins = t ? Math.max(1, Math.round((Date.now() - t) / 60000)) : 0;
  if (mins) { i.playtime = (i.playtime || 0) + mins; playlogAdd(mins); save(); }
  saveRunning();
  if (S.view === 'instance' || S.view === 'home') render();
  notify('nClosed', 'DEAL DEATH', i.name + ' closed' + (mins ? ' after ' + dur(mins) : '') + '.');
});
document.addEventListener('dblclick', (e) => {
  if (!S.prefs.dblLaunch) return;
  const b = e.target.closest('.si'); if (!b) return;
  const i = inst(b.dataset.open); if (i) playInstance(i);
});
window.api.setPrefs(S.prefs).catch(() => {});

/* ================= Appearance ================= */
function applyAppearance(p) {
  const r = document.documentElement;
  const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  r.dataset.theme = p.theme === 'system' ? (light ? 'light' : 'dark') : (['light', 'dark', 'oled'].includes(p.theme) ? p.theme : 'dark');
  r.dataset.cosmic = p.cosmic ? 'on' : 'off';
  r.dataset.islands = p.islands ? 'on' : 'off';
  r.style.setProperty('--p', /^#[0-9a-f]{6}$/i.test(p.accent || '') ? p.accent : '#1f1f1c');
}
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (S.prefs.theme === 'system' && !SD) applyAppearance(S.prefs); });

/* ================= Settings window ================= */
const SV = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const SI = {
  General: SV('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  Appearance: SV('<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.6-2.1-.4-1.1.2-2.1 1.4-2.1H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="8" r="1"/>'),
  'Java Manager': SV('<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5v2M12 3.5v2"/>'),
  Storage: SV('<rect x="3" y="14" width="18" height="6" rx="2"/><path d="M3 14l2.6-8.1A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.4L21 14M7 17h.01"/>'),
  'Default Options': SV('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  Privacy: SV('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  Notifications: SV('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  About: SV('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>')
};
const CHECK = '<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
const TRASH = '<svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
const FOLDER = '<svg class="i" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const INFO = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
const STABS = ['General', 'Appearance', 'Java Manager', 'Storage', 'Default Options', 'Privacy', 'Notifications', 'About'];
const ACCENTS = ['#8b5cf6', '#ef4444', '#b45309', '#f59e0b', '#4ade80', '#16a34a', '#14b8a6', '#3b82f6', '#a8a29e', '#c4b5fd', '#c026d3'];

let SD = null, STAB = 'General', SBUSY = {}, SSEL = new Set(), SSORT = 'size', SARGTXT = false;
const SCACHE = { java: null, storage: null, about: null };
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmtB = (n) => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? Math.round(n / 1048576) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';

const sw = (k) => `<button class="sw ${SD[k] ? 'on' : ''}" data-sx-tog="${k}"></button>`;
const srow = (t, s, ctl, cls = '') => `<div class="srow ${cls}"><div><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div><div class="sctl">${ctl}</div></div>`;
const sgrp = (rows) => `<div class="sgroup">${rows}</div>`;
const shead = (t, s) => `<h1>${t}</h1><div class="sub" style="margin-bottom:22px">${s}</div>`;
const sin = (k, v, extra = '') => `<input class="sin" data-sx-in="${k}" value="${esc(v)}" ${extra}>`;

const PANES = {
  General: () => shead('General', 'General application settings and preferences') +
    '<h3>Application</h3>' + sgrp(
      srow('Open on system startup', 'Open DEAL DEATH when your computer starts (works in the built .exe)', sw('startup')) +
      srow('Start minimized', 'Start hidden in the tray (or minimized) so it stays out of your way', sw('startMinimized'), SD.startup ? '' : 'dis') +
      srow('Minimize to Tray', 'Keep the app running in the system tray when you close the window', sw('tray')) +
      srow('Minimize on Launch', 'Hide the launcher when a game starts. It comes back when the game closes.', sw('minimize')) +
      srow('Double-Click to Launch', 'Start an instance by double-clicking it in the sidebar', sw('dblLaunch')) +
      srow('Tab List Badge', 'Show the DEAL DEATH logo next to your name in the in-game tab list (Fabric 1.21.11)', sw('tabBadge')) +
      srow('Launcher friends', 'Friends who also use DEAL DEATH get the logo too — type their usernames, comma separated.', sin('friends', SD.friends, 'placeholder="Steve, Alex" style="width:220px"'))) +
    '<h3>Account</h3>' + sgrp(srow('Microsoft account',
      S.account?.signedIn ? 'Signed in as ' + esc(S.account.name) + (S.account.local ? ' (Local account, offline).' : '. Minecraft ownership verified.') : 'Not signed in. Minecraft: Java Edition is required to play.',
      S.account?.signedIn ? '<button class="btn sm" data-sx-signout>Sign out</button>' : '<button class="btn sm pri" data-sx-signin>Sign in</button>')) +
    '<h3>Integrations</h3>' + sgrp(srow('CurseForge API key', S.cfKey ? 'A key is saved. Paste a new one to replace it.' : 'Needed to browse CurseForge. Free key at console.curseforge.com',
      `<input class="sin" type="password" style="width:240px" data-sx-in="_cf" placeholder="${S.cfKey ? 'Key saved' : 'Paste key'}">`) +
      srow('Microsoft client ID', 'Optional. Use your own free Azure app registration for sign-in. Leave empty to use the built-in one.', sin('msClientId', SD.msClientId, 'style="width:240px" placeholder="built-in"'))),

  Appearance: () => shead('Appearance', 'Customize the look and feel of your launcher') +
    '<div class="spv"><div class="spv-side"><i></i><i></i><i></i></div><div class="spv-main"><i class="w60"></i><i class="w30"></i><div class="cards"><i></i><i></i><i></i></div></div></div>' +
    sgrp(
      srow('Theme', 'System follows your OS setting', `<div class="row" style="gap:12px">${[['system', 'System'], ['light', 'Cream'], ['dark', 'Dark'], ['oled', 'OLED']].map(([k, l]) => `<button class="thc ${SD.theme === k ? 'on' : ''}" data-sx-theme="${k}"><span class="pv pv-${k}"></span><small>${l}</small></button>`).join('')}</div>`) +
      srow('Accent', 'Used for buttons, highlights and selection', `<div class="accs">${ACCENTS.map((c) => `<button class="acc ${SD.accent === c ? 'on' : ''}" style="background:${c}" data-sx-accent="${c}"></button>`).join('')}<input type="color" class="acc-pick" data-sx-accent-pick value="${esc(SD.accent)}" title="Custom color"></div>`)) +
    sgrp(
      srow('Cosmic Background', 'Soft gradient glow behind the launcher', sw('cosmic')) +
      srow('Transparent Islands', 'Panels let the background show through with a blur', sw('islands'))),

  'Java Manager': () => {
    const J = SCACHE.java;
    let list = '<div class="empty">Loading...</div>';
    if (J) {
      list = sgrp(J.items.map((it) => {
        const b = SBUSY['j' + it.n] || it.busy;
        const act = b ? '<span class="meta">Please wait...</span>' : it.installed ? `<button class="ibtn" data-sx-jdel="${it.n}" title="Delete">${TRASH}</button>` : `<button class="btn sm" data-sx-jins="${it.n}">Install</button>`;
        return `<div class="srow"><div class="row" style="gap:14px"><span class="jn ${it.installed ? 'ok' : ''}">${it.n}</span><div><b>Java ${it.n}</b><small>${b ? 'Downloading... this can take a minute' : it.installed ? 'Installed · Temurin · ' + fmtB(it.size) : 'Not installed · Temurin'}</small></div></div><div class="sctl">${act}</div></div>`;
      }).join('')) + `<div class="meta" style="margin:-8px 4px 0">Detected platform: ${esc(J.arch)} (${esc(J.os)}) · Runtimes use ${fmtB(J.items.reduce((a, x) => a + x.size, 0))}</div>`;
    }
    return shead('Java Manager', 'Install and manage Java runtimes for Minecraft') +
      sgrp(
        srow('Automatic Java', 'Pick (and download) the right Java for each Minecraft version', sw('autoJava')) +
        srow('Custom Java path', 'Overrides automatic Java. Leave empty to use the automatic runtime.', `<div class="row">${sin('javaPath', SD.javaPath, 'placeholder="automatic" style="width:220px"')}<button class="btn sm" data-sx-jbrowse>Browse</button><button class="btn sm" data-sx-jcheck>Check</button></div>`)) +
      '<div class="row sp" style="margin:0 4px 10px"><span class="meta">Runtimes</span><span class="meta">Installed automatically when a game needs them</span></div>' + list;
  },

  Storage: () => {
    const T = SCACHE.storage;
    if (!T) return shead('Storage', 'See where disk space is used and remove instances') + '<div class="empty">Calculating...</div>';
    const inst = S.instances.map((i) => ({ i, size: T.sizes[i.id] || 0 }));
    const used = inst.reduce((a, x) => a + x.size, 0);
    inst.sort((a, b) => SSORT === 'name' ? a.i.name.localeCompare(b.i.name) : SSORT === 'played' ? (b.i.lastPlayed || 0) - (a.i.lastPlayed || 0) : b.size - a.size);
    const pct = (n) => T.total ? Math.max(n ? 0.8 : 0, n / T.total * 100) : 0;
    return shead('Storage', 'See where disk space is used and remove instances') +
      `<div class="sgroup" style="padding:20px"><div class="row sp"><div class="row" style="gap:12px"><span class="jn">${FOLDER}</span><b style="font-size:17px">Location</b></div><span class="meta">${T.total ? fmtB(T.free) + ' free of ' + fmtB(T.total) : ''}</span></div>
      <div class="spath"><span class="mono">${esc(T.root)}</span><button class="ibtn" data-sx-openroot title="Open folder">${FOLDER}</button></div>
      <div class="meta" style="margin:10px 0 16px">The folder where DEAL DEATH stores your instances and Java runtimes.</div>
      <div class="sbar"><i style="width:${pct(used)}%;background:#38bdf8"></i><i style="width:${pct(T.runtimes)}%;background:#f59e0b"></i><i style="width:${T.total ? Math.max(0, 100 - pct(used) - pct(T.runtimes) - (T.free / T.total * 100)) : 0}%;background:#4a4a56"></i></div>
      <div class="legend"><span><i style="background:#38bdf8"></i>INSTANCES <b>${fmtB(used)}</b></span><span><i style="background:#f59e0b"></i>RUNTIMES <b>${fmtB(T.runtimes)}</b></span><span><i style="background:#4a4a56"></i>FREE <b>${fmtB(T.free)}</b></span></div></div>
      <div class="row sp" style="margin:6px 0 12px"><div class="row" style="gap:10px"><b style="font-size:19px">Items</b><span class="cnt">${inst.length + 1}</span></div>
      <div class="row"><select class="sin ssel" data-sx-sort><option value="size" ${SSORT === 'size' ? 'selected' : ''}>Size on disk</option><option value="name" ${SSORT === 'name' ? 'selected' : ''}>Name</option><option value="played" ${SSORT === 'played' ? 'selected' : ''}>Last played</option></select>
      <button class="btn dng" data-sx-uninstall ${SSEL.size ? '' : 'disabled'}>${TRASH} Uninstall${SSEL.size ? ' (' + SSEL.size + ')' : ''}</button></div></div>` +
      inst.map(({ i, size }) => `<div class="srow sitem"><div class="row" style="gap:14px"><span class="jn">${ico(i)}</span><div><b>${esc(i.name)}</b><small>${esc(i.loader)} · MC ${esc(i.version)} · Last played ${ago(i.lastPlayed)}</small></div></div><div class="row"><b>${fmtB(size)}</b><button class="cbx ${SSEL.has(i.id) ? 'on' : ''}" data-sx-sel="${i.id}"></button></div></div>`).join('') +
      `<div class="srow sitem" style="opacity:.8"><div class="row" style="gap:14px"><span class="jn">${SV('<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/>')}</span><div><b>Java Runtimes</b><small>Manage them in Java Manager</small></div></div><b>${fmtB(T.runtimes)}</b></div>`;
  },

  'Default Options': () => shead('Default Options', 'Used every time you press Play') +
    `<div class="sinfo">${INFO} These settings apply to every instance.</div>` +
    '<h3>Java Defaults</h3>' + sgrp(
      srow('Maximum memory (GB)', 'RAM Minecraft may use. 4 is fine for vanilla, 6-8 for big modpacks.', `<input class="sin snum" type="number" min="1" max="64" data-sx-in="memMax" value="${esc(SD.memMax)}">`) +
      srow('Minimum memory (GB)', 'RAM allocated at startup', `<input class="sin snum" type="number" min="1" max="64" data-sx-in="memMin" value="${esc(SD.memMin)}">`) +
      srow('Game window size', 'Width x height in pixels', `<div class="row"><input class="sin snum" type="number" data-sx-in="winW" value="${esc(SD.winW)}"><span class="meta">x</span><input class="sin snum" type="number" data-sx-in="winH" value="${esc(SD.winH)}"></div>`)) +
    `<div class="sgroup" style="padding:18px 20px"><div class="row sp"><div><b>JVM Arguments</b><small class="smt">Extra flags passed to Java</small></div><button class="btn sm" data-sx-argtxt>${SARGTXT ? 'Edit as list' : 'Edit as text'}</button></div>` +
    (SARGTXT
      ? `<textarea class="sin mono" rows="4" data-sx-argtext placeholder="-XX:+UseG1GC" style="margin-top:12px">${esc(SD.jvmArgs.join('\n'))}</textarea>`
      : (SD.jvmArgs.length ? SD.jvmArgs.map((x, k) => `<div class="row" style="margin-top:10px"><input class="sin mono" data-sx-arg="${k}" value="${esc(x)}"><button class="ibtn" data-sx-argdel="${k}">✕</button></div>`).join('') : '<div class="sempty">No arguments set. Click below to add one.</div>') + '<button class="sadd" data-sx-argadd>+ Add argument</button>') + '</div>' +
    `<div class="sgroup" style="padding:18px 20px"><b>Environment Variables</b><small class="smt">One per line, applied when the game starts</small><textarea class="sin mono" rows="3" data-sx-in="env" placeholder="KEY=value&#10;ANOTHER_KEY=another_value" style="margin-top:12px">${esc(SD.env)}</textarea></div>` +
    '<h3>Launch Hook Defaults</h3>' + sgrp(
      srow('Pre-Launch Command', 'Runs before the game starts. Launch is cancelled if it fails (60 s limit).', sin('preLaunch', SD.preLaunch, 'style="width:300px" placeholder="optional"')) +
      srow('Post-Exit Command', 'Runs after the game closes.', sin('postExit', SD.postExit, 'style="width:300px" placeholder="optional"'))),

  Privacy: () => shead('Privacy', 'Privacy and security settings') +
    '<h3>Data Collection</h3>' + sgrp(srow('No analytics', 'DEAL DEATH does not collect or send usage data. It only contacts Mojang, Modrinth, CurseForge, Fabric/Quilt and Adoptium when you use those features.', '<span class="tag">Always off</span>')) +
    '<h3>Security</h3>' + sgrp(srow('Use encrypted DNS', 'Look up the launcher\'s own requests (versions, mods, news) over DNS-over-HTTPS. Game file downloads use your system DNS. Restart to apply.', sw('secureDns'))) +
    '<h3>Saved data</h3>' + sgrp(
      srow('CurseForge API key', S.cfKey ? 'A key is stored on this PC.' : 'No key stored.', S.cfKey ? '<button class="btn sm" data-sx-delkey>Remove</button>' : '') +
      srow('Reset launcher settings', 'Restore every setting to its default. Your instances are kept.', '<button class="btn sm dng" data-sx-reset>Reset</button>')),

  Notifications: () => shead('Notifications', 'Choose what DEAL DEATH tells you about') +
    sgrp(
      srow('Game started', 'Notify when Minecraft launches', sw('nGame')) +
      srow('Game closed', 'Notify when Minecraft exits and how long you played', sw('nClosed')) +
      srow('Content installed', 'Notify when a mod, pack or modpack finishes installing', sw('nInstall')) +
      srow('Errors', 'Notify when launching or installing fails', sw('nError'))) +
    '<button class="btn" data-sx-testnotif>Send test notification</button>',

  About: () => {
    const a = SCACHE.about || {};
    return shead('About', 'DEAL DEATH Launcher') + sgrp(
      srow('Version', 'Launcher version', `<span class="mono">${esc(a.version || '1.3.0')}</span>`) +
      srow('Platform', 'Operating system', `<span class="mono">${esc(a.platform || '-')} ${esc(a.arch || '')}</span>`) +
      srow('Electron', 'App runtime', `<span class="mono">${esc(a.electron || '-')}</span>`) +
      srow('Account type', 'How you sign in to Minecraft', `<span class="tag">${S.account?.signedIn ? (S.account.local ? 'Local' : 'Microsoft') : 'Not signed in'}</span>`) +
      srow('Data folder', 'Where the launcher keeps its files', '<button class="btn sm" data-sx-openroot>Open folder</button>')) +
      '<div class="meta" style="margin-top:8px">Not affiliated with Mojang or Microsoft. © 2026 Deal Death.</div>';
  }
};

function drawSettings(resetScroll) {
  const m = $('#modal'); if (!SD) return;
  const old = m.querySelector('.spane'), st = old && !resetScroll ? old.scrollTop : 0;
  const ab = SCACHE.about, plat = ab ? ({ win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[ab.platform] || ab.platform) : 'Windows';
  m.innerHTML = `<div class="sdlg"><aside class="snav"><h2>Settings</h2>${STABS.map((t) => `<button class="stab ${t === STAB ? 'on' : ''}" data-sx-tab="${t}">${SI[t]}<span>${t}</span></button>`).join('')}
    <div class="sfoot"><b>DEAL DEATH</b><span>Version ${esc(ab ? ab.version : '1.3.0')}</span><span>${plat}</span></div></aside>
    <section class="sbody"><button class="sx" data-sx-close title="Close">✕</button><div class="spane">${PANES[STAB]()}</div><button class="btn pri ssave" data-sx-save>${CHECK} Save changes</button></section></div>`;
  const np = m.querySelector('.spane'); if (np) np.scrollTop = st;
}
function openSettingsModal(tab) {
  SD = clone(S.prefs); SD._cf = ''; STAB = tab || 'General'; SSEL = new Set(); SARGTXT = false;
  const m = $('#modal'); m.classList.remove('hidden');
  m.onclick = settingsClick; m.oninput = settingsInput; m.onchange = settingsChange;
  window.api.about().then((a) => { SCACHE.about = a; if (SD) drawSettings(); }).catch(() => {});
  drawSettings(true);
}
function closeSettings(keep) {
  const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; m.onclick = m.oninput = m.onchange = null;
  if (!keep) applyAppearance(S.prefs);
  SD = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && SD) closeSettings(); });

async function loadJava() { try { SCACHE.java = await window.api.javaList(); } catch (er) { toast(cleanErr(er)); } if (SD && STAB === 'Java Manager') drawSettings(); }
async function loadStorage() { try { SCACHE.storage = await window.api.storageInfo(S.instances.map((i) => i.id)); } catch (er) { toast(cleanErr(er)); } if (SD && STAB === 'Storage') drawSettings(); }

function settingsInput(e) {
  const t = e.target; if (!SD) return;
  if (t.dataset.sxIn) SD[t.dataset.sxIn] = t.value;
  else if (t.dataset.sxArg !== undefined) SD.jvmArgs[+t.dataset.sxArg] = t.value;
  else if (t.dataset.sxArgtext !== undefined) SD.jvmArgs = t.value.split(/\s+/).filter(Boolean);
  else if (t.dataset.sxAccentPick !== undefined) { SD.accent = t.value; applyAppearance(SD); }
}
function settingsChange(e) {
  const t = e.target; if (!SD) return;
  if (t.dataset.sxSort !== undefined) { SSORT = t.value; drawSettings(); }
  else if (t.dataset.sxAccentPick !== undefined) { SD.accent = t.value; applyAppearance(SD); drawSettings(); }
}
async function settingsClick(e) {
  if (!SD) return;
  const c = (s) => e.target.closest(s), d = (s, k) => c(s)?.dataset[k];
  if (c('[data-sx-close]')) return closeSettings();
  if (c('[data-sx-save]')) return saveSettings();
  if (c('[data-sx-tab]')) { STAB = d('[data-sx-tab]', 'sxTab'); if (STAB === 'Java Manager') loadJava(); if (STAB === 'Storage') loadStorage(); return drawSettings(true); }
  if (c('[data-sx-tog]')) { const k = d('[data-sx-tog]', 'sxTog'); SD[k] = !SD[k]; if (k === 'cosmic' || k === 'islands') applyAppearance(SD); return drawSettings(); }
  if (c('[data-sx-theme]')) { SD.theme = d('[data-sx-theme]', 'sxTheme'); applyAppearance(SD); return drawSettings(); }
  if (c('[data-sx-accent]')) { SD.accent = d('[data-sx-accent]', 'sxAccent'); applyAppearance(SD); return drawSettings(); }
  if (c('[data-sx-openroot]')) return window.api.openFolder('');
  if (c('[data-sx-signin]')) {
    try { const r = await window.api.authLogin(); if (r.canceled) toast('Sign-in cancelled.'); else { S.account = r; toast('Signed in as ' + r.name + '.'); } }
    catch (er) { toast(cleanErr(er)); }
    drawSettings(); render(); return;
  }
  if (c('[data-sx-signout]')) {
    await (S.account?.local ? window.api.localClear() : window.api.authLogout()).catch(() => {});
    S.account = { signedIn: false }; toast('Signed out.'); drawSettings(); render(); return;
  }
  if (c('[data-sx-jbrowse]')) { const p = await window.api.pickJava(); if (p && SD) { SD.javaPath = p; drawSettings(); } return; }
  if (c('[data-sx-jcheck]')) { try { toast(await window.api.javaCheck(SD.javaPath)); } catch (er) { toast(cleanErr(er)); } return; }
  if (c('[data-sx-jins]')) {
    const n = d('[data-sx-jins]', 'sxJins'); SBUSY['j' + n] = true; drawSettings();
    try { await window.api.javaInstall(n); toast('Java ' + n + ' installed.'); } catch (er) { toast(cleanErr(er)); }
    delete SBUSY['j' + n]; return loadJava();
  }
  if (c('[data-sx-jdel]')) {
    const n = d('[data-sx-jdel]', 'sxJdel'); if (!confirm('Delete Java ' + n + '? It is downloaded again when a game needs it.')) return;
    try { await window.api.javaRemove(n); } catch (er) { toast(cleanErr(er)); } return loadJava();
  }
  if (c('[data-sx-sel]')) { const id = d('[data-sx-sel]', 'sxSel'); SSEL.has(id) ? SSEL.delete(id) : SSEL.add(id); return drawSettings(); }
  if (c('[data-sx-uninstall]')) {
    if (!SSEL.size) return;
    if (!confirm('Delete ' + SSEL.size + ' instance(s) and all their files? This cannot be undone.')) return;
    for (const id of [...SSEL]) { await window.api.deleteInstance(id).catch(() => {}); S.instances = S.instances.filter((x) => x.id !== id); }
    SSEL = new Set(); save(); render(); toast('Instances removed.'); return loadStorage();
  }
  if (c('[data-sx-argtxt]')) { SARGTXT = !SARGTXT; return drawSettings(); }
  if (c('[data-sx-argadd]')) { SD.jvmArgs.push(''); return drawSettings(); }
  if (c('[data-sx-argdel]')) { SD.jvmArgs.splice(+d('[data-sx-argdel]', 'sxArgdel'), 1); return drawSettings(); }
  if (c('[data-sx-delkey]')) { S.cfKey = ''; store.set('cfkey', ''); toast('CurseForge key removed.'); return drawSettings(); }
  if (c('[data-sx-reset]')) {
    if (!confirm('Restore all settings to their defaults?')) return;
    const keep = { _cf: '' }; SD = { ...clone(PREF_DEF), ...keep }; applyAppearance(SD); toast('Defaults loaded. Press Save changes to keep them.'); return drawSettings();
  }
  if (c('[data-sx-testnotif]')) { try { new Notification('DEAL DEATH', { body: 'Notifications are working.' }); } catch { toast('Notifications are not available.'); } return; }
}
function saveSettings() {
  const cl = (v, lo, hi, df) => { const n = Math.round(Number(v)); return n >= lo && n <= hi ? n : df; };
  const mx = cl(SD.memMax, 1, 64, 4);
  const p = { ...PREF_DEF, ...SD };
  delete p._cf;
  Object.assign(p, {
    memMax: mx, memMin: Math.min(cl(SD.memMin, 1, 64, 2), mx), winW: cl(SD.winW, 200, 10000, 854), winH: cl(SD.winH, 200, 10000, 480),
    jvmArgs: (SD.jvmArgs || []).map((x) => String(x).trim()).filter(Boolean), javaPath: String(SD.javaPath || '').trim()
  });
  S.prefs = p; savePrefs();
  if (String(SD._cf || '').trim()) { S.cfKey = SD._cf.trim(); store.set('cfkey', S.cfKey); }
  applyAppearance(S.prefs);
  window.api.setPrefs(S.prefs).catch(() => {});
  closeSettings(true); render(); toast('Settings saved.');
}
