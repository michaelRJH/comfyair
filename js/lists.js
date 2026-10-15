// "Add your own" lists. Anything typed into an Other / Add box is remembered on this phone
// and offered again next time. Managed from Settings, Your lists.

import { useState, useEffect } from '../vendor/preact-htm.js';
import { getSettings, saveSettings, onSettings } from './store.js';
import { norm } from './util.js';

export const LISTS = {
  gases: 'Gases',
  serviceTypes: 'Visit types',
  vrfJobTypes: 'Multi-unit job types',
  completion: 'Job status',
  makes: 'Makes',
  unitTypes: 'Unit types',
  quickComments: 'Unit quick comments',
  checkStatus: 'Check results',
  serviceChecks: 'Service sheet checks',
  vrfChecks: 'Multi-unit checks',
  materials: 'Materials',
  pipeSizes: 'Pipe sizes',
  drain: 'Drain types',
  supply: 'Supply types',
  tools: 'Materials and tools (RAMS)',
};

const read = (s, key) => (s && s.lists && s.lists[key]) || [];

export function useList(key) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    getSettings().then((s) => live && setList(read(s, key)));
    const off = onSettings((s) => setList(read(s, key)));
    return () => { live = false; off(); };
  }, [key]);
  return list;
}

// Join lists, dropping blanks and repeats (ignoring case and spacing), keeping the first spelling.
export function merge(...arrs) {
  const seen = new Set();
  const out = [];
  for (const a of arrs) {
    for (const v of a || []) {
      const k = norm(String(v ?? ''));
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

// Adds a value to a list (unless it's already there or in the built-in options). Returns the spelling to use.
export async function addToList(key, value, base = []) {
  const v = String(value || '').trim().replace(/\s+/g, ' ');
  if (!v) return '';
  const s = await getSettings();
  const cur = read(s, key);
  const existing = [...base, ...cur].find((x) => norm(String(x)) === norm(v));
  if (existing) return existing;
  await saveSettings({ ...s, lists: { ...(s.lists || {}), [key]: [...cur, v] } });
  return v;
}

export async function addManyToList(key, values, base = []) {
  const s = await getSettings();
  const cur = read(s, key);
  const known = new Set([...base, ...cur].map((x) => norm(String(x))));
  const fresh = [];
  for (const raw of values) {
    const v = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!v || known.has(norm(v))) continue;
    known.add(norm(v));
    fresh.push(v);
  }
  if (fresh.length) await saveSettings({ ...s, lists: { ...(s.lists || {}), [key]: [...cur, ...fresh] } });
}

export async function removeFromList(key, value) {
  const s = await getSettings();
  await saveSettings({ ...s, lists: { ...(s.lists || {}), [key]: read(s, key).filter((x) => x !== value) } });
}

// Saved hazards for the RAMS hazard picker.
export function useCustomHazards() {
  const [list, setList] = useState([]);
  useEffect(() => {
    let live = true;
    getSettings().then((s) => live && setList(s.customHazards || []));
    const off = onSettings((s) => setList(s.customHazards || []));
    return () => { live = false; off(); };
  }, []);
  return list;
}

export async function saveCustomHazard(h, key) {
  const s = await getSettings();
  const item = {
    key, hazard: h.hazard, cause: h.cause, effect: h.effect, atRisk: h.atRisk,
    existing: h.existing, s: h.s, p: h.p, further: h.further, rs: h.rs, rp: h.rp,
  };
  const list = (s.customHazards || []).filter((x) => x.key !== key);
  await saveSettings({ ...s, customHazards: [...list, item] });
}

export async function removeCustomHazard(key) {
  const s = await getSettings();
  await saveSettings({ ...s, customHazards: (s.customHazards || []).filter((x) => x.key !== key) });
}
