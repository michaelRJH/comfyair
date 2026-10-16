// Time tab: clock in and out, the week, and submitting a timesheet to the boss.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon, TopBar, Sheet, Input, TextArea, Toggle, ask, toast } from './ui.js';
import { SignatureBox } from './components.js';
import { getSettings, saveSettings } from './store.js';
import {
  getPay, getShift, saveShift, blankShift, openSegment, clockIn, clockOut, onShifts, notify,
  weekStartOf, addDays, weekDates, dayName, loadWeek, shiftMinutes, breakMinutes, segMinutes,
  getTimesheet, saveTimesheet, fmtMoney,
} from './timesheet.js';
import { todayISO, fmtDate, fmtDuration, nowHHMM, firstName, uid, vibrate, minutesBetween } from './util.js';
import { hasFix, statusLabel, stamp, mapsLink } from './geo.js';
import { copyText } from './share.js';
import { go } from './router.js';

// ---------- live clock state ----------

export function useTodayShift(engineer) {
  const [shift, setShift] = useState(null);
  const load = () => getShift(engineer, todayISO()).then((s) => setShift(s || null));
  useEffect(() => { load(); return onShifts(load); }, [engineer]);
  return shift;
}

function useTick(ms = 30000) {
  const [, setN] = useState(0);
  useEffect(() => { const h = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(h); }, [ms]);
}

const liveMinutes = (shift) => {
  if (!shift) return 0;
  const open = openSegment(shift);
  return shiftMinutes(shift) + (open ? Math.max(0, minutesBetween(open.in.t, nowHHMM()) || 0) : 0);
};

const LocPill = ({ loc }) => {
  if (!loc) return null;
  if (loc.status === 'pending') return html`<span class="locpill locpill--wait"><span class="spinner spinner--tiny"></span> Locating</span>`;
  return html`<span class=${'locpill' + (hasFix(loc) ? '' : ' locpill--off')}><${Icon} name="pin" size=${13} /> ${hasFix(loc) ? 'Location saved' : statusLabel(loc)}</span>`;
};

// The big clock card, used on Home and on the Time tab.
export function ClockCard({ engineer, compact }) {
  const shift = useTodayShift(engineer);
  useTick(20000);
  const [busy, setBusy] = useState(false);
  const open = openSegment(shift);
  const onBreak = shift && !open && shift.segments.length && shift.segments[shift.segments.length - 1].out?.kind === 'break';
  const mins = liveMinutes(shift);
  const act = async (fn) => { if (busy) return; setBusy(true); vibrate(20); try { await fn(); } finally { setBusy(false); } };
  const status = open
    ? html`<span class="clockcard__status is-on"><i></i>Clocked in since ${open.in.t}</span>`
    : onBreak ? html`<span class="clockcard__status is-break"><i></i>On a break since ${shift.segments[shift.segments.length - 1].out.t}</span>`
    : shift && shift.segments.length ? html`<span class="clockcard__status"><i></i>Clocked out at ${shift.segments[shift.segments.length - 1].out?.t}</span>`
    : html`<span class="clockcard__status"><i></i>Not clocked in today</span>`;
  const lastStamp = open ? open.in : shift && shift.segments.length ? shift.segments[shift.segments.length - 1].out : null;
  return html`<div class=${'clockcard' + (open ? ' is-on' : '') + (compact ? ' clockcard--compact' : '')}>
    <div class="clockcard__top">
      <div>
        ${status}
        <div class="clockcard__hours"><b>${fmtDuration(mins) || '0m'}</b><span>today</span></div>
      </div>
      ${lastStamp && html`<${LocPill} loc=${lastStamp.loc} />`}
    </div>
    <div class="clockcard__btns">
      ${open
        ? html`<button class="btn btn--ghost" disabled=${busy} onClick=${() => act(() => clockOut(engineer, 'break'))}><${Icon} name="clock" size=${18} /> Break</button>
               <button class="btn btn--primary btn--grow" disabled=${busy} onClick=${() => act(() => clockOut(engineer, 'end'))}><${Icon} name="check" size=${20} /> Clock out</button>`
        : html`<button class="btn btn--primary btn--grow btn--navy" disabled=${busy} onClick=${() => act(() => clockIn(engineer, onBreak ? 'break' : 'start'))}>
            <${Icon} name="clock" size=${20} /> ${onBreak ? 'Back from break' : shift && shift.segments.length ? 'Clock in again' : 'Clock in'}</button>`}
      ${compact && html`<button class="btn btn--ghost" onClick=${() => go('/time')} aria-label="Timesheet"><${Icon} name="calendar" size=${18} /> Week</button>`}
    </div>
  </div>`;
}

// "Where are you?" The engineer taps once and a pin with the time goes to the boss by WhatsApp.
export function SendLocation({ engineer, toName }) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    vibrate(15);
    const loc = await stamp();
    setBusy(false);
    if (!hasFix(loc)) return toast(statusLabel(loc) + '. Check location is allowed for this app.', { icon: 'alert', ms: 4500 });
    const when = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const text = `${firstName(engineer)} is here at ${when}: ${mapsLink(loc)}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'My location', text }); toast('Sent', { icon: 'check' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    (await copyText(text)) ? toast('Location copied, paste it into WhatsApp', { icon: 'check', ms: 4000 }) : window.open(mapsLink(loc), '_blank');
  };
  return html`<button class="toapp toapp--loc" disabled=${busy} onClick=${send}>
    <span class="toapp__icon">${busy ? html`<span class="spinner spinner--small"></span>` : html`<${Icon} name="pin" size=${22} />`}</span>
    <span class="toapp__text"><b>Send ${toName || 'the boss'} my location</b><small>One tap sends a map pin with the time. Handy when ${toName || 'the boss'} asks "where are you?"</small></span>
    <${Icon} name="chevron" size=${18} class="toapp__chev" />
  </button>`;
}

// ---------- location permission explainer ----------

function LocationIntro({ onDone }) {
  const [state, setState] = useState('');
  const allow = async () => {
    setState('asking');
    const loc = await stamp();
    setState(loc.status);
    const s = await getSettings();
    await saveSettings({ ...s, pay: { ...getPay(s), locationExplained: true } });
    if (hasFix(loc)) setTimeout(onDone, 900);
  };
  return html`<div class="locintro">
    <span class="locintro__icon"><${Icon} name="pin" size=${26} /></span>
    <h3>Where you are goes on the timesheet</h3>
    <p>When you tap Clock in, Clock out, Arrived or Left, the app saves the time and the phone's location at that moment. It never tracks you in between.</p>
    <p>Your phone will ask once. Choose <b>Allow</b> (and <b>Precise</b> on iPhone) so the stamps are accurate.</p>
    ${state === 'asking' ? html`<p class="locintro__state"><span class="spinner spinner--small"></span> Waiting for the phone</p>`
      : state === 'ok' ? html`<p class="locintro__state is-ok"><${Icon} name="check" size=${18} /> Location is working</p>`
      : state ? html`<p class="locintro__state is-bad"><${Icon} name="alert" size=${18} /> ${statusLabel({ status: state })}. You can still clock in, but the timesheet will say location was off.</p>` : ''}
    <div class="dialog__actions">
      <button class="btn btn--ghost" onClick=${onDone}>Not now</button>
      <button class="btn btn--primary" disabled=${state === 'asking'} onClick=${allow}>Allow location</button>
    </div>
  </div>`;
}

// ---------- day editor ----------

function DaySheet({ engineer, date, week, onClose, onChanged }) {
  const [shift, setShift] = useState(null);
  useEffect(() => { getShift(engineer, date).then((s) => setShift(s || blankShift(engineer, date))); }, [engineer, date]);
  if (!shift) return null;
  const day = week.days.find((d) => d.date === date);
  const save = async (next) => { setShift(next); await saveShift(next); notify(); onChanged(); };
  const setStamp = (gi, k, t) => {
    const segs = shift.segments.map((g, i) => {
      if (i !== gi) return g;
      const cur = g[k] || { t: '', at: Date.now(), loc: { status: 'off' }, edited: false };
      return { ...g, [k]: { ...cur, t, edited: cur.t !== t ? true : cur.edited, kind: cur.kind || (k === 'out' ? 'end' : 'start') } };
    });
    save({ ...shift, segments: segs });
  };
  const addSeg = () => save({ ...shift, segments: [...shift.segments, { id: uid(), kind: 'start', in: { t: '08:00', at: Date.now(), loc: { status: 'off' }, edited: true }, out: { t: '16:30', at: Date.now(), loc: { status: 'off' }, edited: true, kind: 'end' } }] });
  const removeSeg = async (gi) => {
    if (await ask({ title: 'Remove these hours?', ok: 'Remove', danger: true })) save({ ...shift, segments: shift.segments.filter((_, i) => i !== gi) });
  };
  const mins = shiftMinutes(shift);
  return html`<div class="daysheet">
    <div class="daysheet__head">
      <div><span>${mins ? fmtDuration(mins) + ' worked' : 'No hours yet'}${breakMinutes(shift) ? `, ${fmtDuration(breakMinutes(shift))} break` : ''}</span></div>
    </div>
    ${shift.segments.map((g, i) => html`<div class="seg" key=${g.id}>
      <div class="seg__times">
        <label class="seg__t"><span>${g.kind === 'break' ? 'Back' : 'In'}</span>
          <input type="time" value=${g.in.t} onInput=${(e) => setStamp(i, 'in', e.currentTarget.value)} />
          <${LocPill} loc=${g.in.loc} />${g.in.edited && html`<em class="seg__edited">edited</em>`}</label>
        <label class="seg__t"><span>${g.out && g.out.kind === 'break' ? 'Break' : 'Out'}</span>
          <input type="time" value=${g.out ? g.out.t : ''} onInput=${(e) => setStamp(i, 'out', e.currentTarget.value)} />
          ${g.out ? html`<${LocPill} loc=${g.out.loc} />` : html`<span class="locpill locpill--open">Still clocked in</span>`}${g.out && g.out.edited && html`<em class="seg__edited">edited</em>`}</label>
        <span class="seg__len">${g.out ? fmtDuration(segMinutes(g)) : ''}</span>
        <button class="iconbtn iconbtn--muted" aria-label="Remove" onClick=${() => removeSeg(i)}><${Icon} name="x" size=${18} /></button>
      </div>
    </div>`)}
    <button class="addrow" onClick=${addSeg}><${Icon} name="plus" size=${18} /> Add hours by hand</button>
    <p class="hint">Times changed or added by hand are marked on the timesheet so ${'the boss'} can see which ones weren't stamped.</p>
    <${TextArea} label="Note for the day" value=${shift.note} rows=${2} placeholder="e.g. Holiday, sick, yard day, van in for MOT" onChange=${(v) => save({ ...shift, note: v })} />
    ${day && day.jobs.length > 0 && html`<div class="daysheet__jobs">
      <span class="field__label">Jobs this day</span>
      ${day.jobs.map((r) => html`<button class="dayjob" onClick=${() => go('/job/' + r.job.id)}>
        <span class="dayjob__main"><b>${r.where}</b><span>Job ${r.job.jobNo}${r.arrived ? `, ${r.arrived} to ${r.left || '…'}` : ''}${r.onSite != null ? `, ${fmtDuration(r.onSite)}` : ''}</span></span>
        ${r.arrivedNote && html`<span class=${'locnote locnote--' + r.arrivedNote.level}>${r.arrivedNote.text}</span>`}
      </button>`)}
    </div>`}
    ${day && day.flags.length > 0 && html`<div class="flags">${day.flags.map((f) => html`<span class=${'flag flag--' + f.level}><${Icon} name="alert" size=${15} />${f.text}</span>`)}</div>`}
    <button class="btn btn--primary btn--block" onClick=${onClose}>Done</button>
  </div>`;
}

// ---------- submit ----------

function SubmitSheet({ week, engineer, existing, onClose, onDone }) {
  const [sig, setSig] = useState(existing?.sign || { name: engineer, img: '', at: null });
  const [confirm, setConfirm] = useState(!!existing);
  const submit = async () => {
    const t = {
      id: `${engineer.toLowerCase().replace(/\s+/g, ' ').trim()}|${week.weekStart}`, engineer, weekStart: week.weekStart,
      submittedAt: Date.now(), sign: sig, totalMins: week.totalMins, otMins: week.otMins, payTotal: week.payTotal,
      flags: week.flags.length, sentAt: existing?.sentAt || null,
    };
    await saveTimesheet(t);
    vibrate(25);
    onDone(t);
  };
  return html`<div class="submit">
    <div class="submit__totals">
      <div><b>${fmtDuration(week.totalMins) || '0h'}</b><span>hours</span></div>
      <div><b>${week.daysWorked}</b><span>days</span></div>
      ${week.otMins > 0 && html`<div><b>${fmtDuration(week.otMins)}</b><span>overtime</span></div>`}
      ${week.payTotal != null && html`<div><b>${fmtMoney(week.payTotal)}</b><span>pay</span></div>`}
    </div>
    ${week.flags.length > 0 && html`<p class="submit__flags"><${Icon} name="alert" size=${16} /> ${week.red ? `${week.red} red` : ''}${week.red && week.amber ? ' and ' : ''}${week.amber ? `${week.amber} amber` : ''} flag${week.flags.length > 1 ? 's' : ''} will show on the sheet. Fix anything wrong before you sign.</p>`}
    <${SignatureBox} title="I confirm these hours are correct" sig=${sig} namePlaceholder="Your name" onChange=${setSig} />
    <${Toggle} label="The hours above are true and complete" checked=${confirm} onChange=${setConfirm} />
    <div class="dialog__actions">
      <button class="btn btn--ghost" onClick=${onClose}>Cancel</button>
      <button class="btn btn--primary" disabled=${!sig.img || !confirm} onClick=${submit}>${existing ? 'Update and send' : 'Sign and send'}</button>
    </div>
  </div>`;
}

// ---------- the screen ----------

export function TimeScreen({ settings }) {
  const engineer = settings.currentEngineer;
  const pay = getPay(settings);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayISO(), pay.weekStart));
  const [week, setWeek] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [existing, setExisting] = useState(null);
  const [intro, setIntro] = useState(!pay.locationExplained);
  useTick(60000);
  const reload = () => { loadWeek(engineer, weekStart).then(setWeek); getTimesheet(engineer, weekStart).then((t) => setExisting(t || null)); };
  useEffect(reload, [engineer, weekStart]);
  useEffect(() => onShifts(reload), [engineer, weekStart]);
  const today = todayISO();
  const thisWeek = weekStartOf(today, pay.weekStart);

  return html`<div class="screen time">
    <${TopBar} title="Time" sub=${firstName(engineer)} />
    <div class="pad stack stack--loose">
      ${intro ? html`<${LocationIntro} onDone=${() => setIntro(false)} />` : html`<${ClockCard} engineer=${engineer} />`}
      ${!intro && html`<${SendLocation} engineer=${engineer} toName=${pay.toName} />`}

      <section class="weekbox">
        <div class="weekbox__nav">
          <button class="iconbtn" aria-label="Previous week" onClick=${() => setWeekStart(addDays(weekStart, -7))}><${Icon} name="back" /></button>
          <div class="weekbox__title">
            <b>${weekStart === thisWeek ? 'This week' : weekStart === addDays(thisWeek, -7) ? 'Last week' : 'Week'}</b>
            <span>${fmtDate(weekStart)} to ${fmtDate(addDays(weekStart, 6))}</span>
          </div>
          <button class="iconbtn" aria-label="Next week" disabled=${weekStart >= thisWeek} onClick=${() => setWeekStart(addDays(weekStart, 7))}><${Icon} name="chevron" /></button>
        </div>
        ${!week ? html`<div class="preview__loading"><span class="spinner"></span></div>` : html`
          <div class="weekdays">
            ${week.days.map((d) => html`<button class=${'wday' + (d.date === today ? ' is-today' : '') + (d.minutes ? ' has-hours' : '') + (d.date > today ? ' is-future' : '')} disabled=${d.date > today}
              onClick=${() => setSheet({ kind: 'day', date: d.date })}>
              <span class="wday__name">${d.day}</span>
              <span class="wday__num">${d.date.slice(8)}</span>
              <span class="wday__hrs">${d.open ? html`<i class="wday__live"></i>` : d.minutes ? fmtDuration(d.minutes) : d.date > today ? '' : '–'}</span>
              ${(d.jobs.length > 0 || d.shift?.note) && html`<span class="wday__dots">${d.jobs.slice(0, 4).map(() => html`<i></i>`)}${d.shift?.note && html`<i class="is-note"></i>`}</span>`}
              ${d.flags.some((f) => f.level === 'red') ? html`<span class="wday__flag is-red"></span>` : d.flags.length ? html`<span class="wday__flag"></span>` : ''}
            </button>`)}
          </div>
          <div class="weektotals">
            <div><b>${fmtDuration(week.totalMins) || '0h'}</b><span>worked</span></div>
            <div><b>${week.daysWorked}</b><span>days</span></div>
            <div><b>${week.days.reduce((a, d) => a + d.jobs.length, 0)}</b><span>jobs</span></div>
            ${week.payTotal != null ? html`<div><b>${fmtMoney(week.payTotal)}</b><span>${week.otMins ? 'incl. overtime' : 'pay'}</span></div>` : html`<div><b>${week.flags.length}</b><span>flag${week.flags.length === 1 ? '' : 's'}</span></div>`}
          </div>
          ${week.flags.length > 0 && html`<details class="weekflags">
            <summary><${Icon} name="alert" size=${16} /> ${week.flags.length} thing${week.flags.length > 1 ? 's' : ''} ${pay.toName || 'the boss'} will see flagged</summary>
            <div class="flags">${week.flags.map((f) => html`<span class=${'flag flag--' + f.level}><b>${f.day}</b> ${f.text}</span>`)}</div>
          </details>`}
          ${existing
            ? html`<div class="submitted"><${Icon} name="check" size=${18} /><span><b>Sent ${fmtDate(new Date(existing.submittedAt).toISOString().slice(0, 10))}</b>${existing.totalMins !== week.totalMins ? ', hours have changed since' : ''}</span>
                <button class="btn btn--small btn--soft" onClick=${() => go(`/timesheet/${weekStart}/send`)}>Send again</button></div>`
            : ''}
          <button class="btn btn--primary btn--block" disabled=${!week.totalMins} onClick=${() => setSheet({ kind: 'submit' })}>
            <${Icon} name="pen" size=${18} /> ${existing ? 'Update timesheet' : `Sign and send to ${pay.toName || 'the boss'}`}</button>
        `}
      </section>

      <p class="hint hint--center">Hours come from your Clock in and Clock out taps. Jobs fill in from your job sheets. Each tap saves where you were.</p>
    </div>

    <${Sheet} open=${sheet?.kind === 'day'} onClose=${() => setSheet(null)} tall title=${sheet?.kind === 'day' ? dayName(sheet.date) + ' ' + fmtDate(sheet.date) : ''}>
      ${sheet?.kind === 'day' && week && html`<${DaySheet} engineer=${engineer} date=${sheet.date} week=${week} onClose=${() => setSheet(null)} onChanged=${reload} />`}
    </${Sheet}>
    <${Sheet} open=${sheet?.kind === 'submit'} onClose=${() => setSheet(null)} tall title="Sign your timesheet">
      ${sheet?.kind === 'submit' && week && html`<${SubmitSheet} week=${week} engineer=${engineer} existing=${existing} onClose=${() => setSheet(null)}
        onDone=${() => { setSheet(null); go(`/timesheet/${weekStart}/send`, { done: 1 }); }} />`}
    </${Sheet}>
  </div>`;
}
