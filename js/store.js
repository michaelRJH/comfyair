// Data layer: settings, jobs, clients, sites. All local to this phone.

import { db } from './db.js';
import { COMPANY_DEFAULT, newJob, JOB_TYPES } from './schema.js';
import { uid, norm, todayISO, daysBetween, clone, onSiteMinutes } from './util.js';

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS = {
  company: { ...COMPANY_DEFAULT },
  engineers: [{ id: 'eng-elliott', name: 'Elliott Taylor', cert: '' }],
  currentEngineer: '',
  nextJobNo: 1479,
  serviceInterval: 12,
  emailBody:
    'Hi,\n\nPlease find attached the {doc} for {site}.\n\nAny questions, just give us a call on {tel}.\n\nKind regards\n{engineer}\nComfyair',
  onboarded: false,
};

let settingsCache = null;
const listeners = new Set();
export const onSettings = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export async function getSettings() {
  if (settingsCache) return settingsCache;
  const saved = (await db.get('kv', SETTINGS_KEY)) || {};
  settingsCache = {
    ...clone(DEFAULT_SETTINGS),
    ...saved,
    company: { ...DEFAULT_SETTINGS.company, ...(saved.company || {}) },
  };
  return settingsCache;
}

export async function saveSettings(next) {
  settingsCache = next;
  await db.put('kv', next, SETTINGS_KEY);
  listeners.forEach((fn) => fn(next));
  return next;
}

// ---------- jobs ----------

export async function allJobs() {
  const jobs = await db.all('jobs');
  return jobs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updatedAt - a.updatedAt);
}

export const getJob = (id) => db.get('jobs', id);

export async function saveJob(job) {
  job.updatedAt = Date.now();
  await db.put('jobs', job);
  return job;
}

export const deleteJob = (id) => db.del('jobs', id);

// Hands out the next job number and moves the counter on.
export async function takeJobNo() {
  const s = await getSettings();
  const jobs = await db.all('jobs');
  const used = new Set(jobs.map((j) => String(j.jobNo)));
  let n = Number(s.nextJobNo) || 1;
  while (used.has(String(n))) n++;
  await saveSettings({ ...s, nextJobNo: n + 1 });
  return n;
}

export async function createJob(type, prefill) {
  const s = await getSettings();
  const jobNo = await takeJobNo();
  const job = newJob(type, { jobNo, engineer: s.currentEngineer });
  if (prefill) applyPrefill(job, prefill);
  await saveJob(job);
  return job;
}

function applyPrefill(job, p) {
  if (p.client) job.client = { ...job.client, ...p.client };
  if (p.site) job.site = { ...job.site, ...p.site };
  if (p.units && job.type === 'vrf') {
    job.data.units = p.units.map((u) => ({ ...u, id: uid(), comment: '', temp: '' }));
  }
  if (p.unit && job.type === 'service') job.data.unit = { ...job.data.unit, ...p.unit };
}

// Copy an existing job as a new one: same client, site and kit, fresh date, number and signatures.
export async function duplicateJob(src) {
  const s = await getSettings();
  const jobNo = await takeJobNo();
  const fresh = newJob(src.type, { jobNo, engineer: s.currentEngineer });
  const copy = clone(src);
  fresh.client = copy.client;
  fresh.site = copy.site;
  if (src.type === 'service') {
    fresh.data.unit = copy.data.unit;
    fresh.data.serviceType = copy.data.serviceType;
  } else if (src.type === 'vrf') {
    fresh.data.units = copy.data.units.map((u) => ({ ...u, id: uid(), comment: '', temp: '' }));
    fresh.data.locationDesc = copy.data.locationDesc;
    fresh.data.jobType = copy.data.jobType;
  } else if (src.type === 'commissioning') {
    fresh.data = { ...copy.data };
  } else if (src.type === 'rams') {
    fresh.data = copy.data;
    fresh.data.ms.revision = String((Number(copy.data.ms.revision) || 0) + 1);
    fresh.data.ra.reviewDate = '';
  }
  await saveJob(fresh);
  return fresh;
}

// ---------- clients & sites (built up automatically from finished jobs) ----------

export const allClients = () => db.all('clients');
export const allSites = () => db.all('sites');
export const getSite = (id) => db.get('sites', id);
export const saveSite = (s) => db.put('sites', s);
export const deleteSite = (id) => db.del('sites', id);

export async function rememberFromJob(job) {
  if (!job.client.name && !job.site.name && !job.site.address) return;
  const clients = await allClients();
  let client = null;
  if (job.client.name) {
    client = clients.find((c) => norm(c.name) === norm(job.client.name));
    if (!client) client = { id: uid(), name: job.client.name, contact: '', email: '', phone: '' };
    client.contact = job.client.contact || client.contact;
    client.email = job.client.email || client.email;
    client.phone = job.client.phone || client.phone;
    await db.put('clients', client);
  }

  if (!job.site.address && !job.site.name) return;
  const sites = await allSites();
  const key = norm(job.site.address || job.site.name);
  let site = sites.find((s) => norm(s.address || s.name) === key);
  if (!site) site = { id: uid(), name: '', address: '', clientName: '', units: [], createdAt: Date.now() };
  site.name = job.site.name || site.name;
  site.address = job.site.address || site.address;
  site.clientName = job.client.name || site.clientName;
  site.clientId = client ? client.id : site.clientId;

  const seen = (u) => ({
    make: u.make || '', model: u.model || '', serial: u.serial || '', location: u.location || '',
    type: u.type || '', lastSeen: job.date, lastJobId: job.id,
  });
  const incoming = [];
  if (job.type === 'service' && (job.data.unit.model || job.data.unit.location)) incoming.push(seen(job.data.unit));
  if (job.type === 'vrf') job.data.units.filter((u) => u.model || u.location).forEach((u) => incoming.push(seen(u)));
  if (job.type === 'commissioning' && job.data.indoor.model) {
    incoming.push(seen({ make: job.data.make, model: job.data.indoor.model, serial: job.data.indoor.serial, location: job.data.indoor.location, type: 'Indoor unit' }));
    if (job.data.outdoor.model) incoming.push(seen({ make: job.data.make, model: job.data.outdoor.model, serial: job.data.outdoor.serial, location: job.data.outdoor.location, type: 'Outdoor unit' }));
  }
  for (const u of incoming) {
    const k = norm(`${u.model}|${u.location}`);
    const i = site.units.findIndex((x) => norm(`${x.model}|${x.location}`) === k);
    if (i >= 0) site.units[i] = { ...site.units[i], ...u, id: site.units[i].id };
    else site.units.push({ id: uid(), ...u });
  }
  site.updatedAt = Date.now();
  await db.put('sites', site);
}

// Most recent finished job per site with a next service date, soonest first.
export function servicesDue(jobs, withinDays = 60) {
  const bySite = new Map();
  for (const j of jobs) {
    if (j.status !== 'complete' || j.type === 'rams') continue;
    const key = norm(j.site.address || j.site.name || j.client.name);
    if (!key) continue;
    const prev = bySite.get(key);
    if (!prev || (j.date || '') > (prev.date || '')) bySite.set(key, j);
  }
  const today = todayISO();
  return [...bySite.values()]
    .filter((j) => j.nextService)
    .map((j) => ({ job: j, days: daysBetween(today, j.nextService) }))
    .filter((x) => x.days <= withinDays)
    .sort((a, b) => a.days - b.days);
}

// ---------- backup ----------

export async function exportBackup() {
  const [jobs, clients, sites, settings] = await Promise.all([
    db.all('jobs'), db.all('clients'), db.all('sites'), getSettings(),
  ]);
  return { app: 'comfyair', version: 1, exportedAt: new Date().toISOString(), settings, jobs, clients, sites };
}

export async function importBackup(data) {
  if (!data || data.app !== 'comfyair') throw new Error('That file is not a Comfyair backup.');
  await db.putMany('jobs', data.jobs || []);
  await db.putMany('clients', data.clients || []);
  await db.putMany('sites', data.sites || []);
  const s = await getSettings();
  const highest = Math.max(
    Number(s.nextJobNo) || 0,
    ...(data.jobs || []).map((j) => (Number(j.jobNo) || 0) + 1),
    Number(data.settings?.nextJobNo) || 0
  );
  await saveSettings({ ...s, ...(data.settings || {}), currentEngineer: s.currentEngineer, nextJobNo: highest, onboarded: true });
  return { jobs: (data.jobs || []).length };
}

export function jobsCSV(jobs) {
  const rows = [['Job no', 'Date', 'Type', 'Client', 'Site', 'Engineer', 'Arrived', 'Left', 'Hours on site', 'Travel (mins)', 'Miles', 'Status']];
  for (const j of jobs) {
    const t = j.time || {};
    const m = onSiteMinutes(t);
    const hrs = m != null ? (m / 60).toFixed(2) : '';
    rows.push([
      j.jobNo, j.date, JOB_TYPES[j.type].label, j.client.name, j.site.name || j.site.address, j.engineer,
      t.arrived || '', t.left || '', hrs, t.travelMins || '', t.miles || '', j.status === 'complete' ? 'Complete' : 'Draft',
    ]);
  }
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
