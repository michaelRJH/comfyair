// Clocking in and out, weeks, hours, pay and the honesty flags.

import { db } from './db.js';
import { noteChange } from './sync.js';
import { getSettings, saveSettings, allJobs, allSites } from './store.js';
import { uid, todayISO, toISODate, parseISO, nowHHMM, minutesBetween, onSiteMinutes, isManualOnSite, norm, fmtDuration } from './util.js';
import { stamp, hasFix, nearness, describe, fmtMiles } from './geo.js';

export const PAY_DEFAULT = {
  rate: '',           // £ per hour
  otAfter: '',        // hours per week before overtime, blank = none
  otMult: '1.5',
  weekStart: 1,       // 1 = Monday
  toName: 'Elliott',
  toEmail: '',
  toPhone: '',
  yard: null,         // { lat, lng, status: 'ok' }
  locationExplained: false,
};

export const getPay = (s) => ({ ...PAY_DEFAULT, ...(s.pay || {}) });

// ---------- shifts ----------
// One record per engineer per day. Segments are clocked-in periods; a gap between segments is a break.
// stamp: { t: 'HH:MM', at: ms, loc, edited: bool }

export const shiftId = (engineer, date) => `${norm(engineer)}|${date}`;

export const getShift = (engineer, date) => db.get('shifts', shiftId(engineer, date));
export const allShifts = () => db.all('shifts');
export const saveShift = (s) => { s.updatedAt = Date.now(); return db.put('shifts', s); };

export const blankShift = (engineer, date) => ({ id: shiftId(engineer, date), engineer, date, segments: [], note: '', createdAt: Date.now() });

export const openSegment = (shift) => (shift && shift.segments.find((g) => g.in && !g.out)) || null;

// Clock in now. Grabs location in the background so the tap is instant.
export async function clockIn(engineer, kind = 'start') {
  const date = todayISO();
  const shift = (await getShift(engineer, date)) || blankShift(engineer, date);
  if (openSegment(shift)) return shift;
  const seg = { id: uid(), in: { t: nowHHMM(), at: Date.now(), loc: { status: 'pending' }, edited: false }, out: null, kind };
  shift.segments.push(seg);
  await saveShift(shift);
  stamp().then(async (loc) => {
    const fresh = (await getShift(engineer, date)) || shift;
    const g = fresh.segments.find((x) => x.id === seg.id);
    if (g) { g.in.loc = loc; await saveShift(fresh); notify(); }
  });
  notify();
  return shift;
}

export async function clockOut(engineer, kind = 'end') {
  const date = todayISO();
  const shift = await getShift(engineer, date);
  const seg = openSegment(shift);
  if (!seg) return shift;
  seg.out = { t: nowHHMM(), at: Date.now(), loc: { status: 'pending' }, edited: false, kind };
  await saveShift(shift);
  stamp().then(async (loc) => {
    const fresh = (await getShift(engineer, date)) || shift;
    const g = fresh.segments.find((x) => x.id === seg.id);
    if (g && g.out) { g.out.loc = loc; await saveShift(fresh); notify(); }
  });
  notify();
  return shift;
}

const listeners = new Set();
export const onShifts = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const notify = () => listeners.forEach((fn) => fn());

// ---------- timesheets (submitted weeks) ----------

export const timesheetId = (engineer, weekStart) => `${norm(engineer)}|${weekStart}`;
export const getTimesheet = (engineer, weekStart) => db.get('timesheets', timesheetId(engineer, weekStart));
export const allTimesheets = () => db.all('timesheets');
export const saveTimesheet = async (t) => { t.updatedAt = Date.now(); await db.put('timesheets', t); noteChange('timesheets', t.id, true); };

// ---------- weeks ----------

export function weekStartOf(dateISO, startDay = 1) {
  const d = parseISO(dateISO) || new Date();
  const diff = (d.getDay() - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

export function addDays(dateISO, n) {
  const d = parseISO(dateISO);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export const weekDates = (weekStart) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dayName = (iso) => DAY[parseISO(iso).getDay()];

export function segMinutes(g) {
  if (!g.in || !g.out) return 0;
  const m = minutesBetween(g.in.t, g.out.t);
  return m == null ? 0 : m;
}

export const shiftMinutes = (shift) => (shift ? shift.segments.reduce((a, g) => a + segMinutes(g), 0) : 0);

// Break minutes = gaps between consecutive segments on the day.
export function breakMinutes(shift) {
  if (!shift) return 0;
  let m = 0;
  for (let i = 1; i < shift.segments.length; i++) {
    const prev = shift.segments[i - 1], cur = shift.segments[i];
    if (prev.out && cur.in) m += minutesBetween(prev.out.t, cur.in.t) || 0;
  }
  return m;
}

const sitePinFor = (job, sites) => {
  const key = norm(job.site.address || job.site.name);
  const s = sites.find((x) => norm(x.address || x.name) === key);
  return s && s.pin && hasFix(s.pin) ? s.pin : null;
};

// Builds everything the Time screen and the PDF need for one week.
export function buildWeek({ weekStart, engineer, shifts, jobs, sites, pay }) {
  const dates = weekDates(weekStart);
  const today = todayISO();
  const days = dates.map((date) => {
    const shift = shifts.find((s) => s.date === date && norm(s.engineer) === norm(engineer)) || null;
    const dayJobs = jobs
      .filter((j) => j.date === date && norm(j.engineer) === norm(engineer) && j.type !== 'rams')
      .sort((a, b) => (a.time?.arrived || '').localeCompare(b.time?.arrived || ''));
    const flags = [];
    const stamps = [];
    const open = openSegment(shift);

    if (shift) {
      shift.segments.forEach((g, i) => {
        const label = g.kind === 'break' ? 'Back from break' : i === 0 ? 'Clock in' : 'Clock in';
        pushStamp(stamps, flags, { date, event: label, s: g.in, ref: null, refName: '' });
        if (g.out) pushStamp(stamps, flags, { date, event: g.out.kind === 'break' ? 'Break' : 'Clock out', s: g.out, ref: null, refName: '' });
      });
      if (open && date < today) flags.push({ level: 'red', text: 'Clocked in but never clocked out' });
    }

    const jobRows = dayJobs.map((j) => {
      const t = j.time || {};
      const pin = sitePinFor(j, sites);
      const where = j.site.name || j.client.name || j.site.address || 'site';
      const row = {
        job: j, where, arrived: t.arrived || '', left: t.left || '', onSite: onSiteMinutes(t),
        typed: isManualOnSite(t), arrivedNote: null, leftNote: null,
      };
      if (t.arrivedLoc) {
        row.arrivedNote = describe(t.arrivedLoc, pin, 'site');
        pushStamp(stamps, flags, { date, event: `Arrived, ${where}`, s: { t: t.arrived, at: t.arrivedLoc.at, loc: t.arrivedLoc, edited: t.arrivedEdited }, ref: pin, refName: where });
      } else if (t.arrived) {
        flags.push({ level: 'amber', text: `Arrived time at ${where} typed in, no location` });
      }
      if (t.leftLoc) {
        row.leftNote = describe(t.leftLoc, pin, 'site');
        pushStamp(stamps, flags, { date, event: `Left, ${where}`, s: { t: t.left, at: t.leftLoc.at, loc: t.leftLoc, edited: t.leftEdited }, ref: pin, refName: where });
      } else if (t.left) {
        flags.push({ level: 'amber', text: `Left time at ${where} typed in, no location` });
      }
      const clock = minutesBetween(t.arrived, t.left);
      if (row.typed && clock != null && Math.abs(clock - row.onSite) > 30) {
        flags.push({ level: 'amber', text: `${where}: typed ${fmtDuration(row.onSite)} on site, clock times say ${fmtDuration(clock)}` });
      }
      if (shift && shift.segments.length && t.arrived) {
        const first = shift.segments[0].in.t;
        const last = shift.segments[shift.segments.length - 1].out?.t;
        if (first && t.arrived < first) flags.push({ level: 'amber', text: `${where}: arrived ${t.arrived}, before clocking in at ${first}` });
        if (last && t.left && t.left > last) flags.push({ level: 'amber', text: `${where}: left ${t.left}, after clocking out at ${last}` });
      }
      return row;
    });

    // Clock in / out compared to the first and last job of the day, or the yard.
    if (shift && shift.segments.length) {
      const firstIn = shift.segments[0].in;
      const lastOut = shift.segments[shift.segments.length - 1].out;
      const firstPin = jobRows.length ? sitePinFor(jobRows[0].job, sites) : null;
      const lastPin = jobRows.length ? sitePinFor(jobRows[jobRows.length - 1].job, sites) : null;
      const yard = pay.yard && hasFix(pay.yard) ? pay.yard : null;
      const inRef = firstPin || yard;
      const outRef = lastPin || yard;
      const inName = firstPin ? jobRows[0].where : 'yard';
      const outName = lastPin ? jobRows[jobRows.length - 1].where : 'yard';
      const inNote = describe(firstIn.loc, inRef, inName);
      const outNote = lastOut ? describe(lastOut.loc, outRef, outName) : null;
      const inStamp = stamps.find((x) => x.s === firstIn);
      if (inStamp) inStamp.note = inNote;
      const outStamp = lastOut && stamps.find((x) => x.s === lastOut);
      if (outStamp) outStamp.note = outNote;
      if (inNote.level === 'far') flags.push({ level: 'red', text: `Clocked in ${inNote.text}${firstPin ? ' (first job of the day)' : ''}` });
      if (outNote && outNote.level === 'far') flags.push({ level: 'red', text: `Clocked out ${outNote.text}${lastPin ? ' (last job of the day)' : ''}` });
    }

    const minutes = shiftMinutes(shift);
    if (minutes > 0 && !jobRows.length && !(shift.note || '').trim()) flags.push({ level: 'amber', text: 'Hours clocked but no job sheets and no note' });
    if (minutes > 14 * 60) flags.push({ level: 'red', text: `${fmtDuration(minutes)} in one day` });

    return { date, day: dayName(date), shift, minutes, breaks: breakMinutes(shift), jobs: jobRows, stamps, flags, open: !!open };
  });

  const totalMins = days.reduce((a, d) => a + d.minutes, 0);
  const otAfter = parseFloat(pay.otAfter);
  const otMins = otAfter > 0 ? Math.max(0, totalMins - Math.round(otAfter * 60)) : 0;
  const stdMins = totalMins - otMins;
  const rate = parseFloat(pay.rate);
  const mult = parseFloat(pay.otMult) || 1.5;
  const payTotal = rate > 0 ? (stdMins / 60) * rate + (otMins / 60) * rate * mult : null;
  const allFlags = days.flatMap((d) => d.flags.map((f) => ({ ...f, date: d.date, day: d.day })));
  return {
    weekStart, weekEnd: dates[6], engineer, days, totalMins, stdMins, otMins, rate: rate > 0 ? rate : null, mult, payTotal,
    daysWorked: days.filter((d) => d.minutes > 0).length, flags: allFlags,
    red: allFlags.filter((f) => f.level === 'red').length, amber: allFlags.filter((f) => f.level === 'amber').length,
  };
}

function pushStamp(stamps, flags, { date, event, s, ref, refName }) {
  if (!s) return;
  const note = describe(s.loc, ref, refName || 'site');
  const entry = { date, event, t: s.t, s, loc: s.loc, note, edited: !!s.edited };
  stamps.push(entry);
  if (s.loc && s.loc.status === 'pending') return;
  if (!hasFix(s.loc)) flags.push({ level: 'amber', text: `${event} ${s.t}: ${note.text.toLowerCase()}` });
  else if (note.level === 'far') flags.push({ level: 'red', text: `${event} ${s.t}: ${note.text}` });
  if (s.edited) flags.push({ level: 'amber', text: `${event} time changed by hand to ${s.t}` });
}

export async function loadWeek(engineer, weekStart) {
  const [settings, shifts, jobs, sites] = await Promise.all([getSettings(), allShifts(), allJobs(), allSites()]);
  const pay = getPay(settings);
  return buildWeek({ weekStart, engineer, shifts, jobs, sites, pay });
}

export const fmtMoney = (n) => (n == null ? '' : '£' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','));

export async function setYardHere() {
  const loc = await stamp();
  if (!hasFix(loc)) return loc;
  const s = await getSettings();
  await saveSettings({ ...s, pay: { ...getPay(s), yard: loc } });
  return loc;
}
