// Send screen for the timesheet: preview the PDF and get it to the boss.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon, TopBar, toast } from './ui.js';
import { getSettings } from './store.js';
import { getPay, loadWeek, getTimesheet, saveTimesheet, fmtMoney } from './timesheet.js';
import { buildTimesheetPdf } from './pdf.js';
import { renderPreview, shareAny, shareEmail, shareWhatsApp, saveFile, openFile } from './share.js';
import { fmtDate, fmtDuration } from './util.js';
import { go, cameFrom } from './router.js';

export function SendTimesheet({ weekStart, done, settings, eng }) {
  const engineer = eng || settings.currentEngineer;
  const theirs = !!eng && eng !== settings.currentEngineer;
  const pay = getPay(settings);
  const [week, setWeek] = useState(null);
  const [ts, setTs] = useState(null);
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [pages, setPages] = useState(0);
  const [busy, setBusy] = useState('');
  const previewRef = useRef();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, t, s] = await Promise.all([loadWeek(engineer, weekStart), getTimesheet(engineer, weekStart), getSettings()]);
        if (cancelled) return;
        setWeek(w); setTs(t || null);
        const f = await buildTimesheetPdf(w, t || null, s, getPay(s));
        if (cancelled) return;
        setFile(f);
        const n = await renderPreview(f, previewRef.current, { isCancelled: () => cancelled });
        if (!cancelled) setPages(n);
      } catch (e) {
        console.error(e);
        if (!cancelled) setErr('The timesheet PDF could not be made. Try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [weekStart]);

  // A job-shaped object so the share helpers know who it goes to and what to call it.
  const doc = week && {
    type: 'timesheet', jobNo: '', date: week.weekStart, engineer,
    client: { name: pay.toName || '', email: pay.toEmail || '', phone: pay.toPhone || '' },
    site: { name: `week of ${fmtDate(week.weekStart)}`, address: '' },
  };

  const run = async (key, fn) => {
    if (!file || busy) return;
    setBusy(key);
    try {
      const msg = await fn(file, doc, settings);
      if (msg) toast(msg, { icon: msg === 'Sent' ? 'check' : undefined, ms: 4200 });
      if (msg === 'Sent' && ts) { const n = { ...ts, sentAt: Date.now() }; await saveTimesheet(n); setTs(n); }
    } catch (e) {
      toast("That didn't work. Try Save, then send it from your files.", { icon: 'alert', ms: 5000 });
    } finally {
      setBusy('');
    }
  };

  const actions = [
    { key: 'email', icon: 'mail', label: 'Email', fn: shareEmail },
    { key: 'whatsapp', icon: 'chat', label: 'WhatsApp', fn: shareWhatsApp },
    { key: 'share', icon: 'share', label: 'Share', fn: shareAny },
    { key: 'save', icon: 'download', label: 'Save', fn: async (f) => { saveFile(f); return 'Saved to your downloads'; } },
    { key: 'open', icon: 'open', label: 'Open', fn: async (f) => { openFile(f); return ''; } },
  ];

  return html`<div class="screen send">
    <${TopBar} title=${theirs ? `${engineer.split(' ')[0]}'s timesheet` : done ? 'Timesheet signed' : 'Send timesheet'} sub=${week ? `w/c ${fmtDate(week.weekStart)}` : ''}
      onBack=${() => (cameFrom() ? history.back() : go('/time', null, true))} />
    ${done && week && html`<div class="donebanner">
      <svg class="donebanner__mark" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23" /><path d="m15 27 7.5 7.5L38 19" /></svg>
      <div><b>${fmtDuration(week.totalMins)} signed off${week.payTotal != null ? ', ' + fmtMoney(week.payTotal) : ''}</b><span>Now send it to ${pay.toName || 'the boss'}.</span></div>
    </div>`}
    <div class="send__actions" role="group" aria-label="Send options">
      ${actions.map((a) => html`<button class=${'sendbtn sendbtn--' + a.key} disabled=${!file || !!busy} onClick=${() => run(a.key, a.fn)}>
        <span class="sendbtn__icon">${busy === a.key ? html`<span class="spinner spinner--small"></span>` : html`<${Icon} name=${a.icon} size=${24} />`}</span>
        <span class="sendbtn__label">${a.label}</span>
      </button>`)}
    </div>
    ${ts && ts.sentAt && html`<p class="send__sent"><${Icon} name="check" size=${16} /> Last sent ${fmtDate(new Date(ts.sentAt).toISOString().slice(0, 10))}</p>`}
    ${!pay.toEmail && !pay.toPhone && html`<p class="hint hint--center">Tip: put ${pay.toName || "the boss"}'s email and WhatsApp number in Settings so they're ready to pick.</p>`}
    <div class="preview">
      <div class="preview__head">
        <span class="preview__name">${file ? file.name : ''}</span>
        <span class="preview__pages">${pages ? `${pages} page${pages > 1 ? 's' : ''}` : ''}</span>
      </div>
      ${err && html`<p class="preview__err"><${Icon} name="alert" size=${18} /> ${err}</p>`}
      ${!file && !err && html`<div class="preview__loading"><span class="spinner"></span><span>Making the PDF</span></div>`}
      <div class="preview__pagesbox" ref=${previewRef}></div>
    </div>
    <div class="send__foot">
      <button class="btn btn--ghost" onClick=${() => go('/time', null, true)}><${Icon} name="calendar" size=${18} /> Back to Time</button>
      <button class="btn btn--ghost" onClick=${() => go('/', null, true)}><${Icon} name="home" size=${18} /> Home</button>
    </div>
  </div>`;
}
