// Job editor and the finish/send screen.

import { html, useState, useEffect, useRef, useMemo } from '../vendor/preact-htm.js';
import { Icon, TopBar, Section, Sheet, ask, toast } from './ui.js';
import { SECTIONS, setIn, checkJob } from './forms.js';
import { JOB_TYPES, MAKES } from './schema.js';
import { getJob, saveJob, deleteJob, duplicateJob, rememberFromJob, getSettings } from './store.js';
import { isSyncOn } from './sync.js';
import { buildPdf, loadPdfLib } from './pdf.js';
import { renderPreview, shareAny, shareEmail, shareWhatsApp, saveFile, openFile, jobFile, shareJobFile } from './share.js';
import { getPay } from './timesheet.js';
import { allSites } from './store.js';
import { norm } from './util.js';
import { debounce, fmtDate, vibrate } from './util.js';
import { go, cameFrom } from './router.js';
import { addManyToList } from './lists.js';

export function Editor({ id, settings }) {
  const [job, setJob] = useState(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(true);
  const [active, setActive] = useState('job');
  const [menu, setMenu] = useState(false);
  const [warn, setWarn] = useState(null);
  const jobRef = useRef(null);
  const navRef = useRef();

  useEffect(() => {
    getJob(id).then((j) => (j ? setJob(j) : setMissing(true)));
    loadPdfLib().catch(() => {}); // warm up so Preview is quick
  }, [id]);

  const persist = useMemo(() => debounce(async (j) => { await saveJob(j); setSaved(true); }, 450), []);
  useEffect(() => () => { if (jobRef.current) persist.flush(jobRef.current); }, []);

  const update = (fn) => {
    setJob((prev) => {
      const next = fn(prev);
      jobRef.current = next;
      setSaved(false);
      persist(next);
      return next;
    });
  };
  const set = (path, value) => update((j) => setIn(j, path, value));
  const patch = (p) => update((j) => ({ ...j, ...p }));

  // highlight the section in view
  useEffect(() => {
    if (!job) return;
    const els = [...document.querySelectorAll('[data-sec]')];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.dataset.sec);
      },
      { rootMargin: '-120px 0px -60% 0px' }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [job && job.id]);

  useEffect(() => {
    const el = navRef.current && navRef.current.querySelector('.is-on');
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  if (missing) {
    return html`<div class="screen"><${TopBar} title="Job not found" onBack=${() => go('/jobs')} />
      <div class="pad"><p>This job isn't on this phone. It may have been deleted.</p></div></div>`;
  }
  if (!job) return html`<div class="screen screen--loading"><span class="spinner"></span></div>`;

  const t = JOB_TYPES[job.type];
  const engineers = settings.engineers.map((e) => e.name);
  const sections = SECTIONS[job.type](job, { set, patch, engineers, settings });

  const jump = (sid) => {
    const el = document.getElementById(sid);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 112, behavior: 'smooth' });
  };

  const flush = async () => { if (jobRef.current) { persist.flush(jobRef.current); await saveJob(jobRef.current); } };

  const finish = async (force) => {
    const w = checkJob(job);
    if (w.length && !force) return setWarn(w);
    setWarn(null);
    const done = { ...job, status: 'complete', completedAt: job.completedAt || Date.now() };
    jobRef.current = done;
    setJob(done);
    await saveJob(done);
    await rememberFromJob(done);
    // remember makes and materials so they're suggested next time
    const d = done.data || {};
    const makes = [d.make, d.unit && d.unit.make, ...((d.units || []).map((u) => u.make))].filter(Boolean);
    if (makes.length) await addManyToList('makes', makes, MAKES);
    if (d.materials) await addManyToList('materials', d.materials.map((m) => m.item));
    vibrate(25);
    go(`/job/${job.id}/send`, { done: job.status !== 'complete' ? 1 : 0 });
  };

  const preview = async () => { await flush(); go(`/job/${job.id}/send`); };

  const doDuplicate = async () => {
    setMenu(false);
    await flush();
    const n = await duplicateJob(jobRef.current || job);
    toast(job.type === 'quote' ? `Revision ${n.data.pipeline.revision} is quote ${n.jobNo}` : `Copied as job ${n.jobNo}`, { icon: 'copy' });
    go(`/job/${n.id}`);
  };
  const doDelete = async () => {
    setMenu(false);
    if (await ask({ title: `Delete job ${job.jobNo}?`, body: 'This removes it from this phone for good. PDFs you have already sent are not affected.', ok: 'Delete job', danger: true })) {
      persist.flush = () => {};
      jobRef.current = null;
      await deleteJob(job.id);
      toast('Job deleted', { icon: 'trash' });
      go('/jobs', null, true);
    }
  };

  return html`<div class=${'screen editor tone-' + t.tone}>
    <div class="editor__chrome">
      <${TopBar} title=${t.label} onBack=${async () => { await flush(); cameFrom() ? history.back() : go('/', null, true); }}
        sub=${html`<span>${job.type === 'quote' ? 'Quote' : 'Job'} ${job.jobNo}</span><span class=${'savedot' + (saved ? ' is-saved' : '')}>${saved ? 'Saved' : 'Saving'}</span>`}
        right=${html`<button class="iconbtn" aria-label="More options" onClick=${() => setMenu(true)}><${Icon} name="more" /></button>`} />
      <nav class="secnav" ref=${navRef} aria-label="Sections">
        ${sections.map((s) => html`<button type="button" class=${'secnav__btn' + (active === s.id ? ' is-on' : '')} onClick=${() => jump(s.id)}>${s.nav}</button>`)}
      </nav>
    </div>
    <div class="editor__body">
      ${sections.map((s) => html`<${Section} key=${s.id} id=${s.id} title=${s.title} aside=${s.aside}>${s.body}</${Section}>`)}
      <div class="editor__end">
        <p>${job.status === 'complete' ? 'Changes save as you go. Send it again to share the updated PDF.' : 'Everything saves as you go, so you can leave this and come back.'}</p>
      </div>
    </div>
    <div class="actionbar">
      <button class="btn btn--ghost" onClick=${preview}><${Icon} name="eye" size=${20} /> Preview</button>
      <button class="btn btn--primary btn--grow" onClick=${() => (job.status === 'complete' ? preview() : finish(false))}>
        <${Icon} name=${job.status === 'complete' ? 'share' : 'check'} size=${20} />
        ${job.status === 'complete' ? 'Send PDF' : job.type === 'quote' ? 'Finish quote' : 'Finish job'}</button>
    </div>

    <${Sheet} open=${menu} onClose=${() => setMenu(false)} title=${`${job.type === 'quote' ? 'Quote' : 'Job'} ${job.jobNo}`}>
      <div class="menu">
        ${job.type === 'quote'
          ? html`<button class="menu__item" onClick=${doDuplicate}><${Icon} name="copy" /><span><b>New revision</b><small>Copy of this quote with a new number, for changes after it's been sent</small></span></button>`
          : html`<button class="menu__item" onClick=${doDuplicate}><${Icon} name="copy" /><span><b>Copy as a new job</b><small>Same client, site and kit with a new job number</small></span></button>`}
        ${job.type === 'quote' && job.data.accepted.tier && html`<button class="menu__item" onClick=${async () => {
            setMenu(false); await flush();
            const { createJob } = await import('./store.js');
            const { priceQuote, getPrice } = await import('./quote.js');
            const p = priceQuote(job.data, getPrice(settings));
            const opt = p.options.find((o) => o.tier.id === job.data.accepted.tier);
            const sys = opt && opt.systems[0];
            const first = sys && sys.units.find((u) => u.role === 'indoor');
            const out = sys && sys.units.find((u) => u.role === 'outdoor');
            const j = await createJob('commissioning', { client: job.client, site: job.site });
            if (first) { j.data.make = first.unit.make; j.data.indoor.model = first.unit.model; j.data.indoor.location = first.indoor.spot || first.indoor.room.name; j.data.outdoor.location = sys.sys.outdoor.spot; j.data.coolKw = String(first.unit.kwCool); j.data.pipeLength = first.indoor.pipeM; if (out) j.data.outdoor.model = out.unit.model; }
            j.fromQuote = job.jobNo;
            await saveJob(j);
            toast(`Commissioning sheet ${j.jobNo} started from quote ${job.jobNo}`, { icon: 'check' });
            go(`/job/${j.id}`);
          }}><${Icon} name="gauge" /><span><b>Start the install job</b><small>Commissioning sheet with the client, site and accepted unit filled in</small></span></button>`}
        ${job.type === 'quote' && job.data.accepted.tier && job.data.kind === 'install' && html`<button class="menu__item" onClick=${async () => {
            setMenu(false); await flush();
            const { pickList, getPrice } = await import('./quote.js');
            const rows = pickList(job.data, getPrice(settings), job.data.accepted.tier);
            const text = `Pick list, quote ${job.jobNo}, ${job.client.name || job.site.name}\n` + rows.map((r) => `- ${r.qty}${r.unit === 'm' ? 'm' : r.unit === 'm²' ? 'm²' : r.unit === 'each' || r.unit === 'set' ? 'x' : ' ' + r.unit} ${r.item}`).join('\n');
            if (navigator.share) { try { await navigator.share({ title: `Pick list ${job.jobNo}`, text }); } catch (e) { /* cancelled */ } }
            else { await navigator.clipboard.writeText(text); toast('Pick list copied', { icon: 'check' }); }
          }}><${Icon} name="box" /><span><b>Pick list for the wholesaler</b><small>Every part on the accepted option, ready to send</small></span></button>`}
        ${job.status === 'complete' && html`<button class="menu__item" onClick=${async () => { setMenu(false); patch({ status: 'draft' }); toast('Moved back to drafts'); }}><${Icon} name="undo" /><span><b>Move back to drafts</b><small>Mark as not finished</small></span></button>`}
        <button class="menu__item menu__item--danger" onClick=${doDelete}><${Icon} name="trash" /><span><b>Delete job</b><small>Removes it from this phone</small></span></button>
      </div>
    </${Sheet}>

    <${Sheet} open=${!!warn} onClose=${() => setWarn(null)} title="Before you finish">
      ${warn && html`<div class="warnlist">
        <p>A few things are missing. You can go back and add them, or finish anyway.</p>
        <ul>${warn.map((w) => html`<li><${Icon} name="alert" size=${18} />${w}</li>`)}</ul>
        <div class="dialog__actions">
          <button class="btn btn--ghost" onClick=${() => setWarn(null)}>Go back</button>
          <button class="btn btn--primary" onClick=${() => finish(true)}>Finish anyway</button>
        </div>
      </div>`}
    </${Sheet}>
  </div>`;
}

// ---------- send ----------

export function Send({ id, done, settings }) {
  const [job, setJob] = useState(null);
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [pages, setPages] = useState(0);
  const [busy, setBusy] = useState('');
  const previewRef = useRef();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const j = await getJob(id);
      if (!j) return setErr('This job is not on this phone.');
      setJob(j);
      try {
        const s = await getSettings();
        const f = await buildPdf(j, s);
        if (cancelled) return;
        setFile(f);
        const n = await renderPreview(f, previewRef.current, { isCancelled: () => cancelled });
        if (!cancelled) setPages(n);
      } catch (e) {
        console.error(e);
        if (!cancelled) setErr(`The PDF could not be made. Check you have signal for the first use, then try again. (${(e && e.message) || e}${e && e.stack ? ' @ ' + String(e.stack).split('\n')[1]?.trim() : ''})`);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const run = async (key, fn) => {
    if (!file || busy) return;
    setBusy(key);
    try {
      const msg = await fn(file, job, settings);
      if (msg) toast(msg, { icon: msg === 'Sent' ? 'check' : undefined, ms: 4200 });
      if (msg === 'Sent') {
        const j = { ...job, sentAt: Date.now() };
        if (j.type === 'quote' && j.data.pipeline && !j.data.accepted.tier && j.data.pipeline.status !== 'lost') {
          j.data = { ...j.data, pipeline: { ...j.data.pipeline, status: 'sent', sentAt: j.data.pipeline.sentAt || Date.now(), chaseAt: Date.now() + 5 * 86400000 } };
        }
        await saveJob(j);
        setJob(j);
      }
    } catch (e) {
      toast("That didn't work. Try Save, then send it from your files.", { icon: 'alert', ms: 5000 });
    } finally {
      setBusy('');
    }
  };

  const t = job && JOB_TYPES[job.type];
  const actions = [
    { key: 'email', icon: 'mail', label: 'Email', fn: shareEmail },
    { key: 'whatsapp', icon: 'chat', label: 'WhatsApp', fn: shareWhatsApp },
    { key: 'share', icon: 'share', label: 'Share', fn: shareAny },
    { key: 'save', icon: 'download', label: 'Save', fn: async (f) => { saveFile(f); return 'Saved to your downloads'; } },
    { key: 'open', icon: 'open', label: 'Open', fn: async (f) => { openFile(f); return ''; } },
  ];

  return html`<div class="screen send">
    <${TopBar} title=${done ? 'Job finished' : 'Send PDF'} sub=${job ? `Job ${job.jobNo}` : ''}
      onBack=${() => (cameFrom() ? history.back() : go('/', null, true))} />
    ${done && html`<div class="donebanner">
      <svg class="donebanner__mark" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="23" /><path d="m15 27 7.5 7.5L38 19" />
      </svg>
      <div><b>${job && job.type === 'quote' ? `Quote ${job.jobNo} is ready` : `Job ${job ? job.jobNo : ''} is finished`}</b><span>Now send the PDF to the customer.</span></div>
    </div>`}
    <div class="send__actions" role="group" aria-label="Send options">
      ${actions.map((a) => html`<button class=${'sendbtn sendbtn--' + a.key} disabled=${!file || !!busy} onClick=${() => run(a.key, a.fn)}>
        <span class="sendbtn__icon">${busy === a.key ? html`<span class="spinner spinner--small"></span>` : html`<${Icon} name=${a.icon} size=${24} />`}</span>
        <span class="sendbtn__label">${a.label}</span>
      </button>`)}
    </div>
    ${job && job.sentAt && html`<p class="send__sent"><${Icon} name="check" size=${16} /> Last sent ${fmtDate(new Date(job.sentAt).toISOString().slice(0, 10))}</p>`}
    ${job && !isSyncOn() && html`<button class="toapp" disabled=${!!busy} onClick=${() => run('toapp', async () => {
        const sites = await allSites();
        const key = norm(job.site.address || job.site.name);
        const site = sites.find((x) => norm(x.address || x.name) === key) || null;
        return shareJobFile(jobFile(job, site, settings.currentEngineer), job, getPay(settings).toName);
      })}>
      <span class="toapp__icon">${busy === 'toapp' ? html`<span class="spinner spinner--small"></span>` : html`<${Icon} name="upload" size=${22} />`}</span>
      <span class="toapp__text"><b>Send to ${getPay(settings).toName || 'the boss'}'s app</b><small>Sends the job file. The PDF above carries the job inside it too, so sending that works just as well</small></span>
      <${Icon} name="chevron" size=${18} class="toapp__chev" />
    </button>`}
    <div class="preview">
      <div class="preview__head">
        <span class="preview__name">${file ? file.name : t ? `${t.pdfTitle} ${job.jobNo}` : ''}</span>
        <span class="preview__pages">${pages ? `${pages} page${pages > 1 ? 's' : ''}` : ''}</span>
      </div>
      ${err && html`<p class="preview__err"><${Icon} name="alert" size=${18} /> ${err}</p>`}
      ${!file && !err && html`<div class="preview__loading"><span class="spinner"></span><span>Making the PDF</span></div>`}
      <div class="preview__pagesbox" ref=${previewRef}></div>
    </div>
    <div class="send__foot">
      <button class="btn btn--ghost" onClick=${() => (cameFrom() === `/job/${id}` ? history.back() : go(`/job/${id}`, null, true))}><${Icon} name="pen" size=${18} /> Edit job</button>
      <button class="btn btn--ghost" onClick=${() => go('/', null, true)}><${Icon} name="home" size=${18} /> Home</button>
    </div>
  </div>`;
}
