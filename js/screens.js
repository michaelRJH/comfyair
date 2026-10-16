// Home, Jobs, Sites, Settings and first-run screens.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon, TopBar, Input, TextArea, Field, Sheet, Empty, ask, toast } from './ui.js';
import { JOB_TYPES, TYPE_ORDER, jobTitle } from './schema.js';
import {
  allJobs, createJob, servicesDue, allSites, getSite, saveSite, deleteSite, saveSettings, importJobFile,
  exportBackup, importBackup, jobsCSV, duplicateJob,
} from './store.js';
import { greeting, firstName, fmtLongToday, fmtDate, monthLabel, initials, todayISO, isStandalone, isIOS, norm, uid, safeFileName, vibrate, daysBetween } from './util.js';
import { go } from './router.js';
import { saveFile, canShareFiles } from './share.js';
import { LISTS, removeFromList, removeCustomHazard } from './lists.js';
import { ClockCard } from './timescreen.js';
import { getPay, setYardHere } from './timesheet.js';
import { hasFix, statusLabel, stamp, mapsLink } from './geo.js';

const VERSION = '1.4.0';

// ---------- shared bits ----------

export function TypeBadge({ type, size = 'md' }) {
  const t = JOB_TYPES[type];
  return html`<span class=${`tbadge tbadge--${t.tone} tbadge--${size}`}><${Icon} name=${t.icon} size=${size === 'lg' ? 28 : 20} /></span>`;
}

export function JobRow({ job }) {
  const t = JOB_TYPES[job.type];
  const where = job.type === 'rams' ? [job.client.name, job.site.name || job.site.address].filter(Boolean).join(', ') : job.site.name || job.site.address;
  return html`<button class="jobrow" onClick=${() => go(job.status === 'complete' ? `/job/${job.id}/send` : `/job/${job.id}`)}>
    <${TypeBadge} type=${job.type} />
    <span class="jobrow__main">
      <span class="jobrow__title">${jobTitle(job)}</span>
      <span class="jobrow__sub">${job.importedFrom ? html`<span class="fromtag">from ${job.importedFrom.split(' ')[0]}</span> ` : ''}${where || t.label}</span>
    </span>
    <span class="jobrow__meta">
      <span class="jobrow__no">${job.jobNo}</span>
      ${job.status === 'complete'
        ? html`<span class="jobrow__date">${fmtDate(job.date)}</span>`
        : html`<span class="status status--draft">Draft</span>`}
    </span>
  </button>`;
}

export function NewJobSheet({ open, onClose, prefill }) {
  const start = async (type) => {
    vibrate(12);
    const j = await createJob(type, prefill);
    onClose();
    go(`/job/${j.id}`);
  };
  return html`<${Sheet} open=${open} onClose=${onClose} title=${prefill ? 'New job at this site' : 'Start a job'}>
    <div class="typepick">
      ${TYPE_ORDER.map((k) => {
        const t = JOB_TYPES[k];
        return html`<button class=${'typepick__item tone-' + t.tone} onClick=${() => start(k)}>
          <${TypeBadge} type=${k} size="lg" />
          <span><b>${t.label}</b><small>${t.blurb}</small></span>
          <${Icon} name="chevron" size=${18} class="typepick__chev" />
        </button>`;
      })}
    </div>
  </${Sheet}>`;
}

// ---------- Home ----------

export function Home({ settings }) {
  const [jobs, setJobs] = useState(null);
  useEffect(() => { allJobs().then(setJobs); }, []);
  const start = async (type) => {
    vibrate(12);
    const j = await createJob(type);
    go(`/job/${j.id}`);
  };
  const name = firstName(settings.currentEngineer);
  const drafts = (jobs || []).filter((j) => j.status !== 'complete').slice(0, 4);
  const recent = (jobs || []).filter((j) => j.status === 'complete').sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 5);
  const due = jobs ? servicesDue(jobs, 60) : [];
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = (jobs || []).filter((j) => j.status === 'complete' && (j.completedAt || 0) > weekAgo).length;

  const bookNext = async (j) => {
    const n = await duplicateJob(j);
    go(`/job/${n.id}`);
  };

  return html`<div class="screen home">
    <header class="hero">
      <svg class="hero__orbit" viewBox="0 0 400 260" aria-hidden="true" preserveAspectRatio="none">
        <ellipse cx="250" cy="120" rx="190" ry="78" transform="rotate(-24 250 120)" />
      </svg>
      <div class="hero__top">
        <img src="assets/logo-white.png" alt="Comfyair" class="hero__logo" width="132" height="58" />
        <button class="avatar" onClick=${() => go('/settings')} aria-label="Settings">${initials(settings.currentEngineer) || '?'}</button>
      </div>
      <h1 class="hero__hello">${greeting()}${name ? ', ' + name : ''}</h1>
      <p class="hero__date">${fmtLongToday()}</p>
      <div class="hero__stats">
        <span><b>${thisWeek}</b> finished this week</span>
        <span><b>${drafts.length}</b> in progress</span>
        <span><b>${settings.nextJobNo}</b> next job no</span>
      </div>
    </header>

    <div class="home__body">
      <section class="block">
        <${ClockCard} engineer=${settings.currentEngineer} compact />
      </section>
      <section class="block">
        <h2 class="block__title">Start a job</h2>
        <div class="starts">
          ${TYPE_ORDER.map((k) => {
            const t = JOB_TYPES[k];
            return html`<button class=${'start tone-' + t.tone} onClick=${() => start(k)}>
              <${TypeBadge} type=${k} size="lg" />
              <span class="start__label">${t.label}</span>
              <span class="start__blurb">${t.blurb}</span>
            </button>`;
          })}
        </div>
      </section>

      ${drafts.length > 0 && html`<section class="block">
        <h2 class="block__title">Carry on</h2>
        <div class="list">${drafts.map((j) => html`<${JobRow} key=${j.id} job=${j} />`)}</div>
      </section>`}

      ${due.length > 0 && html`<section class="block">
        <h2 class="block__title">Due for service</h2>
        <div class="list">
          ${due.map(({ job: j, days }) => html`<div class="duerow" key=${j.id}>
            <span class=${'duerow__when' + (days < 0 ? ' is-late' : days <= 14 ? ' is-soon' : '')}>
              <b>${days < 0 ? Math.abs(days) : days}</b><small>${days < 0 ? 'days late' : days === 1 ? 'day' : 'days'}</small>
            </span>
            <span class="duerow__main">
              <span class="jobrow__title">${j.client.name || j.site.name}</span>
              <span class="jobrow__sub">${j.site.name || j.site.address}, due ${fmtDate(j.nextService)}</span>
            </span>
            <button class="btn btn--small btn--soft" onClick=${() => bookNext(j)}>Start</button>
          </div>`)}
        </div>
      </section>`}

      <section class="block">
        <div class="block__row">
          <h2 class="block__title">Recently finished</h2>
          ${recent.length > 0 && html`<button class="link" onClick=${() => go('/jobs')}>All jobs</button>`}
        </div>
        ${jobs && recent.length === 0
          ? html`<p class="block__empty">Finished jobs show here, ready to send again if a customer asks.</p>`
          : html`<div class="list">${recent.map((j) => html`<${JobRow} key=${j.id} job=${j} />`)}</div>`}
      </section>
      <${InstallHint} />
    </div>
  </div>`;
}

function InstallHint() {
  const [prompt, setPrompt] = useState(window.__installPrompt || null);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('hideInstall') === '1'; } catch (e) { return false; }
  });
  useEffect(() => {
    const on = () => setPrompt(window.__installPrompt);
    window.addEventListener('installready', on);
    return () => window.removeEventListener('installready', on);
  }, []);
  if (isStandalone() || hidden) return null;
  if (!prompt && !isIOS()) return null;
  const hide = () => { try { localStorage.setItem('hideInstall', '1'); } catch (e) { /* ignore */ } setHidden(true); };
  return html`<div class="installhint">
    <img src="assets/icons/icon-192.png" alt="" width="44" height="44" />
    <div>
      <b>Put Comfyair on your home screen</b>
      ${prompt
        ? html`<span>It opens full screen and works with no signal.</span>`
        : html`<span>Tap the Share button in Safari, then Add to Home Screen. It then works with no signal.</span>`}
    </div>
    ${prompt && html`<button class="btn btn--small btn--primary" onClick=${async () => { prompt.prompt(); await prompt.userChoice; window.__installPrompt = null; setPrompt(null); }}>Install</button>`}
    <button class="iconbtn iconbtn--muted" onClick=${hide} aria-label="Dismiss"><${Icon} name="x" size=${18} /></button>
  </div>`;
}

// ---------- Jobs ----------

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  ...TYPE_ORDER.map((k) => ({ id: k, label: JOB_TYPES[k].label })),
];

// Reads a job file sent from another phone. Used on the Jobs screen and in Settings.
export async function importJobFromFiles(fileList, onDone) {
  const f = fileList && fileList[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app === 'comfyair' && !data.kind && data.jobs) {
      toast('That is a full backup. Use Restore from a backup in Settings.', { icon: 'alert', ms: 5000 });
      return;
    }
    let r = await importJobFile(data);
    if (r.exists) {
      const ok = await ask({ title: `Job ${r.incoming.jobNo} is already on this phone`, body: 'Replace it with the version in this file?', ok: 'Replace' });
      if (!ok) return;
      r = await importJobFile(data, { replace: true });
    }
    toast(`Job ${r.job.jobNo} added${data.from ? ' from ' + data.from : ''}`, { icon: 'check' });
    onDone && onDone(r.job);
  } catch (e) {
    toast(e.message || 'That file could not be read.', { icon: 'alert', ms: 4500 });
  }
}

export function Jobs() {
  const [jobs, setJobs] = useState(null);
  const importRef = useRef();
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const [sheet, setSheet] = useState(false);
  useEffect(() => { allJobs().then(setJobs); }, []);

  const term = norm(q);
  const list = (jobs || []).filter((j) => {
    if (f === 'draft' && j.status === 'complete') return false;
    if (JOB_TYPES[f] && j.type !== f) return false;
    if (!term) return true;
    const hay = norm([j.jobNo, j.client.name, j.site.name, j.site.address, j.engineer, j.data?.ms?.project].join(' '));
    return hay.includes(term);
  });
  const groups = [];
  for (const j of list) {
    const m = monthLabel(j.date);
    const g = groups[groups.length - 1];
    if (g && g.m === m) g.items.push(j);
    else groups.push({ m, items: [j] });
  }

  return html`<div class="screen">
    <${TopBar} title="Jobs" sub=${jobs ? `${jobs.length} on this phone` : ''}
      right=${html`<button class="iconbtn" aria-label="Import a job" onClick=${() => importRef.current.click()}><${Icon} name="download" /></button>`} />
    <input type="file" accept="application/json,.json" hidden ref=${importRef} onChange=${(e) => { importJobFromFiles(e.currentTarget.files, () => allJobs().then(setJobs)); e.currentTarget.value = ''; }} />
    <div class="toolbar">
      <label class="searchbox">
        <${Icon} name="search" size=${20} />
        <input type="search" placeholder="Search client, site or job number" value=${q} onInput=${(e) => setQ(e.currentTarget.value)} />
      </label>
      <div class="filters" role="tablist">
        ${FILTERS.map((x) => html`<button role="tab" aria-selected=${f === x.id} class=${'filter' + (f === x.id ? ' is-on' : '')} onClick=${() => setF(x.id)}>${x.label}</button>`)}
      </div>
    </div>
    <div class="pad">
      ${jobs && list.length === 0 && (jobs.length === 0
        ? html`<${Empty} icon="jobs" title="No jobs yet" body="Start your first job and it will appear here."
            action=${html`<button class="btn btn--primary" onClick=${() => setSheet(true)}><${Icon} name="plus" size=${20} /> Start a job</button>`} />`
        : html`<${Empty} icon="search" title="Nothing matches" body="Try a different search or filter." />`)}
      ${groups.map((g) => html`<section class="block" key=${g.m}>
        <h2 class="block__title block__title--month">${g.m}</h2>
        <div class="list">${g.items.map((j) => html`<${JobRow} key=${j.id} job=${j} />`)}</div>
      </section>`)}
    </div>
    <button class="fab" onClick=${() => setSheet(true)} aria-label="Start a job"><${Icon} name="plus" size=${26} stroke=${2.2} /><span>New job</span></button>
    <${NewJobSheet} open=${sheet} onClose=${() => setSheet(false)} />
  </div>`;
}

// ---------- Sites ----------

export function Sites() {
  const [sites, setSites] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { allSites().then((s) => setSites(s.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)))); }, []);
  const term = norm(q);
  const list = (sites || []).filter((s) => !term || norm([s.name, s.address, s.clientName].join(' ')).includes(term));
  return html`<div class="screen">
    <${TopBar} title="Sites" sub=${sites ? `${sites.length} saved` : ''} />
    <div class="toolbar">
      <label class="searchbox">
        <${Icon} name="search" size=${20} />
        <input type="search" placeholder="Search sites or clients" value=${q} onInput=${(e) => setQ(e.currentTarget.value)} />
      </label>
    </div>
    <div class="pad">
      ${sites && sites.length === 0 && html`<${Empty} icon="sites" title="Sites build up as you work"
        body="When you finish a job, the client, address and every unit you worked on are saved here. Next visit, pick the site and it all fills in." />`}
      <div class="list">
        ${list.map((s) => html`<button class="siterow" key=${s.id} onClick=${() => go('/site/' + s.id)}>
          <span class="siterow__icon"><${Icon} name="pin" size=${20} /></span>
          <span class="jobrow__main">
            <span class="jobrow__title">${s.name || s.clientName || s.address}</span>
            <span class="jobrow__sub">${s.name || s.clientName ? s.address : ''}</span>
          </span>
          <span class="siterow__units">${s.units.length}<small>${s.units.length === 1 ? 'unit' : 'units'}</small></span>
        </button>`)}
      </div>
    </div>
  </div>`;
}

export function Site({ id }) {
  const [site, setSite] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    getSite(id).then(setSite);
    allJobs().then(setJobs);
  }, [id]);
  if (!site) return html`<div class="screen screen--loading"><span class="spinner"></span></div>`;
  const key = norm(site.address || site.name);
  const history = jobs.filter((j) => norm(j.site.address || j.site.name) === key);
  const removeUnit = async (u) => {
    if (await ask({ title: `Remove ${u.model || 'this unit'}?`, body: 'It will no longer fill in on new jobs here.', ok: 'Remove', danger: true })) {
      const s = { ...site, units: site.units.filter((x) => x.id !== u.id) };
      await saveSite(s);
      setSite(s);
    }
  };
  const remove = async () => {
    if (await ask({ title: 'Forget this site?', body: 'Jobs already done here are kept. The site and its unit list are removed.', ok: 'Forget site', danger: true })) {
      await deleteSite(site.id);
      go('/sites', null, true);
    }
  };
  const prefill = {
    client: { name: site.clientName || '' },
    site: { name: site.name, address: site.address },
    units: site.units,
    unit: site.units[0] ? { make: site.units[0].make, model: site.units[0].model, serial: site.units[0].serial, location: site.units[0].location } : undefined,
  };
  return html`<div class="screen">
    <${TopBar} title=${site.name || site.clientName || 'Site'} sub=${site.clientName && site.name ? site.clientName : ''} onBack=${() => go('/sites')}
      right=${html`<button class="iconbtn" aria-label="Forget site" onClick=${remove}><${Icon} name="trash" /></button>`} />
    <div class="pad">
      <div class="sitecard">
        <${Icon} name="pin" size=${22} />
        <div><b>${site.address}</b>${site.clientName && html`<span>${site.clientName}</span>`}</div>
        <a class="btn btn--small btn--soft" href=${'https://maps.google.com/?q=' + encodeURIComponent(site.address)} target="_blank" rel="noopener">Directions</a>
      </div>
      <button class="btn btn--primary btn--block" onClick=${() => setSheet(true)}><${Icon} name="plus" size=${20} /> New job at this site</button>
      <div class="yardrow yardrow--site">
        <span class=${'locpill' + (hasFix(site.pin) ? '' : ' locpill--off')}><${Icon} name="pin" size=${13} /> ${hasFix(site.pin) ? `Site location set${site.pin.setFrom === 'arrived' ? ' from first visit' : ''}` : 'No site location yet'}</span>
        ${hasFix(site.pin) && html`<a class="link" href=${mapsLink(site.pin)} target="_blank" rel="noopener">Map</a>`}
        <button class="link" onClick=${async () => { const loc = await stamp(); if (!hasFix(loc)) return toast(statusLabel(loc), { icon: 'alert' }); const s2 = { ...site, pin: { ...loc, setFrom: 'manual' } }; await saveSite(s2); setSite(s2); toast('Site location set to here', { icon: 'check' }); }}>${hasFix(site.pin) ? 'Reset to here' : 'Set to here'}</button>
      </div>
      <p class="hint">Arrived and Left stamps on jobs here are checked against this spot.</p>

      <section class="block">
        <h2 class="block__title">Units on site <span class="count">${site.units.length}</span></h2>
        ${site.units.length === 0
          ? html`<p class="block__empty">No units recorded yet.</p>`
          : html`<div class="unitlist">${site.units.map((u) => html`<div class="unitlist__row" key=${u.id}>
              <span class="unitlist__main"><b>${u.model || 'Unknown model'}</b><span>${[u.make, u.type, u.location].filter(Boolean).join(', ')}</span>
                ${u.serial && html`<span class="mono">S/N ${u.serial}</span>`}</span>
              <span class="unitlist__seen">${u.lastSeen ? fmtDate(u.lastSeen) : ''}</span>
              <button class="iconbtn iconbtn--muted" aria-label="Remove unit" onClick=${() => removeUnit(u)}><${Icon} name="x" size=${18} /></button>
            </div>`)}</div>`}
      </section>

      <section class="block">
        <h2 class="block__title">Job history <span class="count">${history.length}</span></h2>
        <div class="list">${history.map((j) => html`<${JobRow} key=${j.id} job=${j} />`)}</div>
      </section>
    </div>
    <${NewJobSheet} open=${sheet} onClose=${() => setSheet(false)} prefill=${prefill} />
  </div>`;
}

// ---------- Settings ----------

export function Settings({ settings }) {
  const [s, setS] = useState(settings);
  const [stats, setStats] = useState(null);
  const restoreRef = useRef();
  const jobRef = useRef();
  useEffect(() => { setS(settings); }, [settings]);
  useEffect(() => {
    (async () => {
      try {
        const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
        const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
        const jobs = await allJobs();
        setStats({ used: est ? est.usage : null, persisted, jobs: jobs.length });
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const save = (next) => { setS(next); saveSettings(next); };
  const co = (k, v) => save({ ...s, company: { ...s.company, [k]: v } });
  const setEng = (i, patch) => save({ ...s, engineers: s.engineers.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  const backup = async () => {
    const data = await exportBackup();
    const file = new File([JSON.stringify(data)], safeFileName(`Comfyair backup ${todayISO()}.json`), { type: 'application/json' });
    if (canShareFiles(file)) {
      try { await navigator.share({ files: [file], title: 'Comfyair backup' }); toast('Backup sent', { icon: 'check' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    saveFile(file);
    toast('Backup saved to your downloads', { icon: 'check' });
  };
  const restore = async (fileList) => {
    const f = fileList && fileList[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const ok = await ask({ title: `Restore ${data.jobs?.length || 0} jobs from this backup?`, body: 'Jobs, sites and settings in the backup are added to this phone. Jobs with the same ID are replaced by the backup copy.', ok: 'Restore' });
      if (!ok) return;
      const r = await importBackup(data);
      toast(`${r.jobs} jobs restored`, { icon: 'check' });
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      toast(e.message || 'That file could not be read.', { icon: 'alert', ms: 4500 });
    }
  };
  const csv = async () => {
    const jobs = await allJobs();
    const file = new File(['﻿' + jobsCSV(jobs)], safeFileName(`Comfyair jobs ${todayISO()}.csv`), { type: 'text/csv' });
    if (canShareFiles(file)) {
      try { await navigator.share({ files: [file], title: 'Comfyair jobs' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    saveFile(file);
    toast('Spreadsheet saved to your downloads', { icon: 'check' });
  };

  const mb = stats && stats.used != null ? (stats.used / 1048576).toFixed(1) : null;

  return html`<div class="screen settings">
    <${TopBar} title="Settings" />
    <div class="pad stack stack--loose">

      <section class="setblock">
        <h2 class="setblock__title">Who's using this phone</h2>
        <div class="who">
          ${s.engineers.map((e) => html`<button class=${'who__opt' + (s.currentEngineer === e.name ? ' is-on' : '')}
            onClick=${() => { vibrate(); save({ ...s, currentEngineer: e.name }); }}>
            <span class="avatar avatar--small">${initials(e.name)}</span>${e.name || 'Unnamed'}</button>`)}
        </div>
        <p class="hint">New jobs on this phone are put in this name.</p>
      </section>

      <section class="setblock">
        <h2 class="setblock__title">Engineers</h2>
        <div class="stack stack--tight">
          ${s.engineers.map((e, i) => html`<div class="materials__row" key=${e.id}>
            <input class="materials__item" value=${e.name} placeholder="Full name" aria-label="Engineer name"
              onInput=${(ev) => { const old = e.name; const name = ev.currentTarget.value; save({ ...s, engineers: s.engineers.map((x, j) => (j === i ? { ...x, name } : x)), currentEngineer: s.currentEngineer === old ? name : s.currentEngineer }); }} />
            ${s.engineers.length > 1 && html`<button class="iconbtn iconbtn--muted" aria-label="Remove engineer"
              onClick=${async () => { if (await ask({ title: `Remove ${e.name || 'this engineer'}?`, ok: 'Remove', danger: true })) save({ ...s, engineers: s.engineers.filter((_, j) => j !== i) }); }}><${Icon} name="x" size=${18} /></button>`}
          </div>`)}
          <button class="addrow" onClick=${() => save({ ...s, engineers: [...s.engineers, { id: uid(), name: '', cert: '' }] })}><${Icon} name="plus" size=${18} /> Add engineer</button>
        </div>
      </section>

      <section class="setblock">
        <h2 class="setblock__title">Job numbers</h2>
        <${Input} label="Next job number" value=${s.nextJobNo} inputmode="numeric" hint="Each new job takes the next number. Skips any already used on this phone."
          onChange=${(v) => save({ ...s, nextJobNo: v.replace(/\D/g, '') })} />
        ${s.engineers.length > 1 && html`<p class="hint">With more than one phone, give each engineer their own range (for example 2000s and 5000s) so numbers never clash.</p>`}
      </section>

      <section class="setblock">
        <h2 class="setblock__title">Company details</h2>
        <p class="hint">These print at the foot of every PDF.</p>
        <div class="grid2">
          <${Input} label="Company name" value=${s.company.name} onChange=${(v) => co('name', v)} wide />
          <${Input} label="Address" value=${s.company.address} onChange=${(v) => co('address', v)} wide />
          <${Input} label="Phone" type="tel" value=${s.company.tel} onChange=${(v) => co('tel', v)} />
          <${Input} label="F-Gas number" value=${s.company.fgas} onChange=${(v) => co('fgas', v)} />
          <${Input} label="Email" type="email" value=${s.company.email} onChange=${(v) => co('email', v)} wide />
        </div>
      </section>

      <section class="setblock">
        <h2 class="setblock__title">Email message</h2>
        <${TextArea} label="Text sent with each PDF" value=${s.emailBody} rows=${6}
          hint="{doc} {site} {tel} {engineer} {jobno} are filled in for you" onChange=${(v) => save({ ...s, emailBody: v })} />
      </section>

      <${PaySettings} settings=${s} save=${save} />

      <${YourLists} settings=${settings} />

      <section class="setblock">
        <h2 class="setblock__title">Backup</h2>
        <p class="hint">Jobs are stored on this phone only. Send yourself a backup every week or so, and keep it somewhere safe like your email or Google Drive.</p>
        <div class="setactions">
          <button class="setaction" onClick=${backup}><${Icon} name="upload" /><span><b>Back up everything</b><small>${stats ? `${stats.jobs} jobs` : ''}${mb ? `, ${mb} MB` : ''}</small></span></button>
          <button class="setaction" onClick=${() => restoreRef.current.click()}><${Icon} name="download" /><span><b>Restore from a backup</b><small>Also moves jobs to a new phone</small></span></button>
          <button class="setaction" onClick=${() => jobRef.current.click()}><${Icon} name="jobs" /><span><b>Import a job</b><small>A job file sent from another engineer's phone</small></span></button>
          <button class="setaction" onClick=${csv}><${Icon} name="sheet" /><span><b>Hours and miles spreadsheet</b><small>Every job with times, travel and mileage, for invoicing</small></span></button>
        </div>
        <input type="file" accept="application/json,.json" hidden ref=${restoreRef} onChange=${(e) => { restore(e.currentTarget.files); e.currentTarget.value = ''; }} />
        <input type="file" accept="application/json,.json" hidden ref=${jobRef} onChange=${(e) => { importJobFromFiles(e.currentTarget.files, (j) => go('/job/' + j.id + '/send')); e.currentTarget.value = ''; }} />
      </section>

      <section class="setblock setblock--about">
        <img src="assets/logo.png" alt="Comfyair" width="120" />
        <p>Job Sheets ${VERSION}${stats && stats.persisted ? ', storage protected' : ''}</p>
        <button class="link" onClick=${() => { if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((r) => r && r.update()); toast('Checking for updates'); }}>Check for updates</button>
      </section>
    </div>
  </div>`;
}

function PaySettings({ settings, save }) {
  const pay = getPay(settings);
  const set = (k, v) => save({ ...settings, pay: { ...pay, [k]: v } });
  const [yardBusy, setYardBusy] = useState(false);
  const yard = async () => {
    setYardBusy(true);
    const loc = await setYardHere();
    setYardBusy(false);
    toast(hasFix(loc) ? 'Yard location saved' : statusLabel(loc), { icon: hasFix(loc) ? 'check' : 'alert' });
  };
  return html`<section class="setblock">
    <h2 class="setblock__title">Timesheets and pay</h2>
    <p class="hint">Hours come from Clock in and Clock out on the Time tab. Put a rate in and the timesheet shows the pay as well.</p>
    <div class="grid2">
      <${Input} label="Hourly rate" value=${pay.rate} inputmode="decimal" suffix="£/hr" placeholder="Optional" onChange=${(v) => set('rate', v.replace(/[^\d.]/g, ''))} />
      <${Input} label="Overtime after" value=${pay.otAfter} inputmode="decimal" suffix="hrs/wk" placeholder="None" onChange=${(v) => set('otAfter', v.replace(/[^\d.]/g, ''))} />
      <${Input} label="Overtime rate" value=${pay.otMult} inputmode="decimal" suffix="x" onChange=${(v) => set('otMult', v.replace(/[^\d.]/g, ''))} />
      <${Field} label="Week starts"><span class="inp inp--select"><select value=${String(pay.weekStart)} onChange=${(e) => set('weekStart', Number(e.currentTarget.value))}>
        ${[['1', 'Monday'], ['0', 'Sunday'], ['6', 'Saturday'], ['5', 'Friday']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select><${Icon} name="down" size=${18} class="inp__chev" /></span></${Field}>
    </div>
    <div class="subhead">Send timesheets to</div>
    <div class="grid2">
      <${Input} label="Name" value=${pay.toName} placeholder="e.g. Elliott" onChange=${(v) => set('toName', v)} />
      <${Input} label="WhatsApp number" type="tel" inputmode="tel" value=${pay.toPhone} onChange=${(v) => set('toPhone', v)} />
      <${Input} label="Email" type="email" inputmode="email" value=${pay.toEmail} onChange=${(v) => set('toEmail', v)} wide />
    </div>
    <div class="subhead">Yard location</div>
    <p class="hint">Clock in and out stamps are compared to the first and last job of the day, or to the yard when there are no jobs.</p>
    <div class="yardrow">
      <span class=${'locpill' + (hasFix(pay.yard) ? '' : ' locpill--off')}><${Icon} name="pin" size=${13} /> ${hasFix(pay.yard) ? 'Yard location set' : 'Not set'}</span>
      <button class="btn btn--small btn--soft" disabled=${yardBusy} onClick=${yard}>${yardBusy ? 'Locating' : hasFix(pay.yard) ? 'Set to here again' : "Set to where I am now"}</button>
      ${hasFix(pay.yard) && html`<button class="link" onClick=${() => set('yard', null)}>Clear</button>`}
    </div>
  </section>`;
}

function YourLists({ settings }) {
  const lists = settings.lists || {};
  const hazards = settings.customHazards || [];
  const keys = Object.keys(LISTS).filter((k) => (lists[k] || []).length);
  const drop = async (key, v) => {
    if (await ask({ title: `Remove "${v}"?`, body: 'It stops being offered on new jobs. Jobs that already use it keep it.', ok: 'Remove', danger: true })) removeFromList(key, v);
  };
  return html`<section class="setblock">
    <h2 class="setblock__title">Your lists</h2>
    <p class="hint">Everything you've added with Other, Add or Save to my hazards. It's offered again on every job. Remove any typos here.</p>
    ${!keys.length && !hazards.length && html`<p class="yourlists__empty">Nothing added yet. Tap Other or Add on any job to put your own option in.</p>`}
    ${keys.map((k) => html`<div class="yourlist" key=${k}>
      <span class="yourlist__title">${LISTS[k]}</span>
      <span class="chips">
        ${lists[k].map((v) => html`<button type="button" class="chip chip--small chip--remove" aria-label=${'Remove ' + v} onClick=${() => drop(k, v)}>
          ${v}<${Icon} name="x" size=${14} stroke=${2.2} /></button>`)}
      </span>
    </div>`)}
    ${hazards.length > 0 && html`<div class="yourlist">
      <span class="yourlist__title">Your hazards</span>
      <span class="chips">
        ${hazards.map((h) => html`<button type="button" class="chip chip--small chip--remove" aria-label=${'Remove ' + h.hazard}
          onClick=${async () => { if (await ask({ title: `Remove "${h.hazard}" from your hazards?`, body: 'RAMS that already include it keep it.', ok: 'Remove', danger: true })) removeCustomHazard(h.key); }}>
          ${h.hazard}<${Icon} name="x" size=${14} stroke=${2.2} /></button>`)}
      </span>
    </div>`}
  </section>`;
}

// ---------- first run ----------

export function Welcome({ settings, onDone }) {
  const [other, setOther] = useState('');
  const pick = async (name) => {
    if (!name.trim()) return;
    let engineers = settings.engineers;
    if (!engineers.some((e) => e.name === name)) engineers = [...engineers, { id: uid(), name: name.trim(), cert: '' }];
    const next = { ...settings, engineers, currentEngineer: name.trim(), onboarded: true };
    await saveSettings(next);
    onDone(next);
  };
  return html`<div class="welcome">
    <svg class="welcome__orbit" viewBox="0 0 400 260" aria-hidden="true"><ellipse cx="220" cy="130" rx="200" ry="82" transform="rotate(-24 220 130)" /></svg>
    <img src="assets/logo-white.png" alt="Comfyair" class="welcome__logo" />
    <h1>Job sheets, done on site</h1>
    <p>Service sheets, commissioning, multi-unit reports and RAMS, signed on the phone and sent as a PDF.</p>
    <div class="welcome__card">
      <h2>Who's using this phone?</h2>
      <div class="who">
        ${settings.engineers.map((e) => html`<button class="who__opt" onClick=${() => pick(e.name)}>
          <span class="avatar avatar--small">${initials(e.name)}</span>${e.name}</button>`)}
      </div>
      <form class="welcome__other" onSubmit=${(e) => { e.preventDefault(); pick(other); }}>
        <${Input} label="Someone else" value=${other} placeholder="Your full name" onChange=${setOther} autocomplete="name" enterkeyhint="go" />
        <button class="btn btn--primary" disabled=${!other.trim()}>Continue</button>
      </form>
    </div>
  </div>`;
}
