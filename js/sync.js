// Team sync: jobs, sites and timesheets shared between phones through a Firebase Realtime Database (free tier),
// talked to over plain HTTPS so nothing extra needs loading. Each phone pushes what it changes and pulls what the
// others changed. The team code is the only key: anyone with it can read the team's data, so it's long and random.

import { db } from './db.js';
import { uid, clone } from './util.js';

const STORES = ['jobs', 'sites', 'timesheets', 'shifts'];
const PUSH_DELAY = 20000;     // wait for the typing to stop before uploading a job
const PULL_EVERY = 45000;     // while the app is open
let cfg = null;               // { url, team }
let deviceId = null;
let pushTimer = null, pullTimer = null, pulling = false, applying = false;
const outbox = new Map();     // key store:id -> { store, id, at }
const listeners = new Set();
const state = { status: 'off', lastPull: 0, lastPush: 0, pending: 0, error: '' };

export const onSync = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const syncState = () => state;
const emit = () => { state.pending = outbox.size; listeners.forEach((fn) => fn({ ...state })); };

export const newTeamCode = () => (uid() + uid() + uid()).replace(/[^a-z0-9]/gi, '').slice(0, 24).toLowerCase();
export const isSyncOn = () => !!(cfg && cfg.url && cfg.team);

// Accepts the database URL on its own, a full setup text ("url\ncode"), or a pasted setup line.
export function parseSetup(text) {
  const t = (text || '').trim();
  const url = (t.match(/https?:\/\/[^\s"']+firebasedatabase\.app|https?:\/\/[^\s"']+firebaseio\.com/) || t.match(/https?:\/\/[^\s"']+/) || [''])[0].replace(/\/+$/, '');
  const code = (t.replace(url, '').match(/\b[a-z0-9]{16,32}\b/i) || [''])[0].toLowerCase();
  return { url, code };
}

const base = () => `${cfg.url}/teams/${cfg.team}`;
const fetchJ = async (path, opts = {}) => {
  const r = await fetch(`${base()}/${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`Sync ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.json();
};

async function loadDevice() {
  if (deviceId) return deviceId;
  const kv = await db.get('kv', 'device');
  deviceId = kv && kv.id ? kv.id : uid();
  if (!kv) await db.put('kv', { id: deviceId }, 'device');
  return deviceId;
}

// ---------- configure ----------

export async function configureSync(settings) {
  const s = settings.sync || {};
  const on = s.enabled && s.url && s.team;
  const next = on ? { url: s.url.replace(/\/+$/, ''), team: s.team } : null;
  if (JSON.stringify(next) === JSON.stringify(cfg) && (pullTimer || !next)) return; // nothing changed
  cfg = next;
  clearInterval(pullTimer); pullTimer = null;
  if (!cfg) { state.status = 'off'; state.error = ''; emit(); return; }
  await loadDevice();
  let meta = (await db.get('kv', 'sync')) || {};
  // a different team than last time: start from scratch, and push everything on this phone up to it
  if (meta.team && meta.team !== cfg.team) meta = {};
  // v2: the server copy carries the push time as updatedAt, so older phones need one full pull
  if (!meta.v2) { meta = { ...meta, lastPull: 0, v2: true }; await db.put('kv', meta, 'sync'); }
  state.lastPull = meta.lastPull || 0;
  state.status = navigator.onLine ? 'idle' : 'offline';
  // anything that changed before sync was switched on goes up too
  if (!meta.seeded) {
    for (const store of STORES) for (const row of await db.all(store)) outbox.set(`${store}:${row.id}`, { store, id: row.id, at: Date.now() });
    await db.put('kv', { ...meta, seeded: true, team: cfg.team }, 'sync');
  }
  emit();
  pullTimer = setInterval(() => { if (document.visibilityState === 'visible') pullNow(); }, PULL_EVERY);
  pullNow().then(flush).then(reconcile);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (cfg) { state.status = 'idle'; emit(); pullNow().then(flush); } });
  window.addEventListener('offline', () => { if (cfg) { state.status = 'offline'; emit(); } });
  let lastReconcile = 0;
  document.addEventListener('visibilitychange', () => { if (cfg && document.visibilityState === 'visible') pullNow().then(flush).then(() => { if (Date.now() - lastReconcile > 30 * 60000) { lastReconcile = Date.now(); reconcile(); } }); });
}

// ---------- push ----------

// Called by the data layer after every local write. `urgent` pushes straight away (a finished job, a timesheet sent).
export function noteChange(store, id, urgent = false) {
  if (!cfg || applying || !STORES.includes(store)) return;
  outbox.set(`${store}:${id}`, { store, id, at: Date.now() });
  emit();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, urgent ? 300 : PUSH_DELAY);
}
export function noteDelete(store, id) {
  if (!cfg || applying || !STORES.includes(store)) return;
  outbox.set(`${store}:${id}`, { store, id, at: Date.now(), deleted: true });
  emit();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, 300);
}

export async function flush() {
  if (!cfg || !outbox.size || !navigator.onLine) return;
  state.status = 'pushing'; emit();
  for (const [key, item] of [...outbox.entries()]) {
    try {
      if (item.deleted) {
        await fetchJ(`${item.store}/${encodeURIComponent(item.id)}.json`, { method: 'DELETE' });
        await fetchJ(`deleted/${item.store}/${encodeURIComponent(item.id)}.json`, { method: 'PUT', body: JSON.stringify({ at: Date.now(), by: deviceId }) });
      } else {
        const row = await db.get(item.store, item.id);
        if (row) await fetchJ(`${item.store}/${encodeURIComponent(item.id)}.json`, { method: 'PUT', body: JSON.stringify({ ...row, updatedAt: Date.now(), syncBy: deviceId, syncAt: Date.now() }) });
      }
      outbox.delete(key);
      state.lastPush = Date.now(); state.error = '';
    } catch (e) {
      // one bad row must not block the rest: note it, move on, try again later
      state.error = e.message.includes('Failed to fetch') ? 'No connection to the database' : e.message;
      if (e.message.includes('Failed to fetch')) break;
    }
  }
  if (outbox.size) { clearTimeout(pushTimer); pushTimer = setTimeout(flush, 60000); }
  state.status = 'idle'; emit();
}

// Belt and braces: compare what the team has with what this phone has, by id only (cheap), and fetch anything missing.
// Catches rows pushed by phones on older versions, or anything a timed pull skipped.
export async function reconcile() {
  if (!cfg || !navigator.onLine) return 0;
  let fetched = 0;
  const counts = {};
  try {
    for (const store of STORES) {
      const keys = await fetchJ(`${store}.json?shallow=true`);
      const ids = keys ? Object.keys(keys) : [];
      counts[store] = ids.length;
      const local = new Set((await db.all(store)).map((r) => r.id));
      const gone = (await fetchJ(`deleted/${store}.json?shallow=true`).catch(() => null)) || {};
      for (const id of ids) {
        if (local.has(id) || gone[id]) continue;
        const row = await fetchJ(`${store}/${encodeURIComponent(id)}.json`);
        if (!row || !row.id) continue;
        applying = true;
        try { const clean = clone(row); delete clean.syncBy; delete clean.syncAt; await db.put(store, clean); fetched++; } finally { applying = false; }
      }
    }
    state.teamCounts = counts; state.error = '';
  } catch (e) { state.error = e.message; }
  state.changed = fetched; emit();
  return fetched;
}

// ---------- pull ----------

export async function pullNow() {
  if (!cfg || pulling || !navigator.onLine) return 0;
  pulling = true; state.status = 'pulling'; emit();
  let changed = 0;
  try {
    const since = Math.max(0, state.lastPull - 5 * 60000); // overlap a little in case clocks differ
    const startedAt = Date.now();
    for (const store of STORES) {
      const rows = await fetchJ(`${store}.json?orderBy="updatedAt"&startAt=${since}`);
      if (!rows) continue;
      applying = true;
      try {
        for (const row of Object.values(rows)) {
          if (!row || !row.id) continue;
          if (row.syncBy === deviceId) continue;
          const local = await db.get(store, row.id);
          if (local && (local.updatedAt || 0) >= (row.updatedAt || 0)) continue;
          const clean = clone(row); delete clean.syncBy; delete clean.syncAt;
          await db.put(store, clean);
          changed++;
        }
      } finally { applying = false; }
    }
    const gone = await fetchJ(`deleted.json?orderBy="$key"`).catch(() => null);
    if (gone) {
      applying = true;
      try {
        for (const store of STORES) for (const [id, d] of Object.entries(gone[store] || {})) {
          if (d.by === deviceId || (d.at || 0) < since) continue;
          const local = await db.get(store, id);
          if (local && (local.updatedAt || 0) < d.at) { await db.del(store, id); changed++; }
        }
      } finally { applying = false; }
    }
    state.lastPull = startedAt; state.error = '';
    await db.put('kv', { ...((await db.get('kv', 'sync')) || {}), lastPull: startedAt, seeded: true, team: cfg.team, v2: true }, 'sync');
  } catch (e) {
    state.error = e.message;
  } finally {
    pulling = false; state.status = navigator.onLine ? 'idle' : 'offline';
    state.changed = changed; emit();
  }
  return changed;
}

// Checks a URL and team code actually work before saving them.
export async function testSync(url, team) {
  const r = await fetch(`${url.replace(/\/+$/, '')}/teams/${team}/ping.json`, { method: 'PUT', body: JSON.stringify(Date.now()) });
  if (r.status === 401 || r.status === 403) throw new Error('The database refused the write. Check the rules were pasted in.');
  if (!r.ok) throw new Error(`Could not reach the database (${r.status}).`);
  const q = await fetch(`${url.replace(/\/+$/, '')}/teams/${team}/jobs.json?orderBy="updatedAt"&limitToLast=1`);
  if (!q.ok) throw new Error('The database answered, but the rules are missing the index. Paste the rules in again.');
  return true;
}

export const RULES_JSON = `{
  "rules": {
    "teams": {
      "$team": {
        ".read": true,
        ".write": true,
        "jobs": { ".indexOn": ["updatedAt"] },
        "sites": { ".indexOn": ["updatedAt"] },
        "timesheets": { ".indexOn": ["updatedAt"] },
        "shifts": { ".indexOn": ["updatedAt"] }
      }
    }
  }
}`;
