// Bigger building blocks used by the job forms: signatures, photos, time on site, client and site.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon, Input, Suggest, Toggle, Sheet, TextArea, Field, toast, ask } from './ui.js';
import { uid, nowHHMM, minutesBetween, fmtDuration, norm, vibrate, addMonthsISO } from './util.js';
import { allClients, allSites } from './store.js';

// ---------- signature ----------

function SignaturePad({ onDone, onCancel, who }) {
  const canvasRef = useRef();
  const state = useRef({ drawing: false, pts: [], hasInk: false, bounds: null });
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const fit = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * ratio;
      c.height = r.height * ratio;
      const ctx = c.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0B2346';
      state.current.hasInk = false;
      state.current.bounds = null;
      setHasInk(false);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now(), p: e.pressure || 0.5 };
  };
  const grow = (p) => {
    const b = state.current.bounds || { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    state.current.bounds = { x1: Math.min(b.x1, p.x), y1: Math.min(b.y1, p.y), x2: Math.max(b.x2, p.x), y2: Math.max(b.y2, p.y) };
  };
  const down = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    const p = pos(e);
    state.current.drawing = true;
    state.current.pts = [p];
    state.current.width = 2.6;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.fillStyle = '#0B2346';
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
    grow(p);
  };
  const move = (e) => {
    if (!state.current.drawing) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const ctx = canvasRef.current.getContext('2d');
    for (const ev of evs) {
      const p = pos(ev);
      const pts = state.current.pts;
      const last = pts[pts.length - 1];
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      if (dist < 0.8) continue;
      const v = dist / Math.max(p.t - last.t, 1);
      const target = Math.max(1.4, Math.min(3.4, 3.6 - v * 1.1));
      state.current.width = state.current.width * 0.7 + target * 0.3;
      pts.push(p);
      if (pts.length >= 3) {
        const a = pts[pts.length - 3], b = pts[pts.length - 2], c = p;
        const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
        ctx.lineWidth = state.current.width;
        ctx.beginPath();
        ctx.moveTo(m1.x, m1.y);
        ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
        ctx.stroke();
      }
      grow(p);
    }
    if (!state.current.hasInk) { state.current.hasInk = true; setHasInk(true); }
  };
  const up = () => {
    state.current.drawing = false;
    if (state.current.pts.length) { state.current.hasInk = true; setHasInk(true); }
  };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    state.current.hasInk = false;
    state.current.bounds = null;
    setHasInk(false);
  };
  const done = () => {
    const c = canvasRef.current;
    const b = state.current.bounds;
    if (!b) return;
    const ratio = c.width / c.getBoundingClientRect().width;
    const pad = 12;
    const x = Math.max(0, (b.x1 - pad) * ratio), y = Math.max(0, (b.y1 - pad) * ratio);
    const w = Math.min(c.width - x, (b.x2 - b.x1 + pad * 2) * ratio);
    const h = Math.min(c.height - y, (b.y2 - b.y1 + pad * 2) * ratio);
    const out = document.createElement('canvas');
    const scale = Math.min(1, 900 / w);
    out.width = Math.round(w * scale);
    out.height = Math.round(h * scale);
    out.getContext('2d').drawImage(c, x, y, w, h, 0, 0, out.width, out.height);
    vibrate(15);
    onDone(out.toDataURL('image/png'));
  };

  return html`<div class="sigpad" role="dialog" aria-label="Signature">
    <div class="sigpad__head">
      <button class="btn btn--ghost btn--small" onClick=${onCancel}>Cancel</button>
      <div class="sigpad__who">${who}</div>
      <button class="btn btn--primary btn--small" disabled=${!hasInk} onClick=${done}>Done</button>
    </div>
    <div class="sigpad__area">
      <canvas ref=${canvasRef} class="sigpad__canvas"
        onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onPointerLeave=${up}></canvas>
      <div class="sigpad__line"><span>Sign above the line</span></div>
      ${hasInk && html`<button class="sigpad__clear" onClick=${clear}><${Icon} name="undo" size=${18} /> Clear</button>`}
    </div>
    <p class="sigpad__tip">Turn your phone sideways for more room</p>
  </div>`;
}

export function SignatureBox({ title, sig, onChange, allowUnavailable, namePlaceholder }) {
  const [open, setOpen] = useState(false);
  const set = (patch) => onChange({ ...sig, ...patch });
  const unavailable = allowUnavailable && sig.unavailable;
  return html`<div class="sigbox">
    <div class="sigbox__top">
      <h3 class="sigbox__title">${title}</h3>
      ${sig.img && !unavailable && html`<button class="link" onClick=${() => set({ img: '', at: null })}>Clear</button>`}
    </div>
    ${!unavailable && html`
      <${Input} label="Name" value=${sig.name} placeholder=${namePlaceholder} onChange=${(v) => set({ name: v })} />
      <button type="button" class=${'sigbox__pad' + (sig.img ? ' has-sig' : '')} onClick=${() => setOpen(true)}>
        ${sig.img
          ? html`<img src=${sig.img} alt=${'Signature of ' + (sig.name || title)} />`
          : html`<span class="sigbox__cta"><${Icon} name="pen" size=${26} /> Tap to sign</span>`}
      </button>`}
    ${allowUnavailable && html`<${Toggle} label="Customer not available to sign"
      checked=${sig.unavailable} onChange=${(v) => set({ unavailable: v })} />`}
    ${unavailable && html`<${Input} label="Reason" value=${sig.reason} placeholder="e.g. Site unattended, keys left with caretaker"
      onChange=${(v) => set({ reason: v })} wide />`}
    ${open && html`<${SignaturePad} who=${sig.name || title}
      onCancel=${() => setOpen(false)}
      onDone=${(img) => { set({ img, at: Date.now() }); setOpen(false); }} />`}
  </div>`;
}

// ---------- photos ----------

async function compress(file, max = 1600, quality = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL('image/jpeg', quality), w: c.width, h: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Photos({ photos, onChange }) {
  const camRef = useRef();
  const libRef = useRef();
  const [busy, setBusy] = useState(0);
  const [edit, setEdit] = useState(null);

  const add = async (files) => {
    const list = [...(files || [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    setBusy(list.length);
    const added = [];
    for (const f of list) {
      try {
        const r = await compress(f);
        added.push({ id: uid(), dataUrl: r.dataUrl, w: r.w, h: r.h, caption: '', at: Date.now() });
      } catch (e) {
        toast("One photo couldn't be read. Try taking it again.", { icon: 'alert' });
      }
      setBusy((b) => b - 1);
    }
    onChange([...photos, ...added]);
    setBusy(0);
    if (added.length) vibrate(12);
  };

  const current = edit && photos.find((p) => p.id === edit);
  const update = (patch) => onChange(photos.map((p) => (p.id === edit ? { ...p, ...patch } : p)));
  const remove = async () => {
    if (await ask({ title: 'Delete this photo?', ok: 'Delete', danger: true })) {
      onChange(photos.filter((p) => p.id !== edit));
      setEdit(null);
    }
  };

  return html`<div class="photos">
    <div class="photos__actions">
      <button type="button" class="tile-btn" onClick=${() => camRef.current.click()}>
        <${Icon} name="camera" size=${26} /><span>Take photo</span></button>
      <button type="button" class="tile-btn" onClick=${() => libRef.current.click()}>
        <${Icon} name="image" size=${26} /><span>From library</span></button>
    </div>
    <input ref=${camRef} type="file" accept="image/*" capture="environment" hidden
      onChange=${(e) => { add(e.currentTarget.files); e.currentTarget.value = ''; }} />
    <input ref=${libRef} type="file" accept="image/*" multiple hidden
      onChange=${(e) => { add(e.currentTarget.files); e.currentTarget.value = ''; }} />
    ${(photos.length > 0 || busy > 0) && html`<div class="photos__grid">
      ${photos.map((p, i) => html`<button type="button" class="photo" key=${p.id} onClick=${() => setEdit(p.id)}>
        <img src=${p.dataUrl} alt=${p.caption || 'Photo ' + (i + 1)} loading="lazy" />
        <span class=${'photo__cap' + (p.caption ? '' : ' is-empty')}>${p.caption || 'Add caption'}</span>
      </button>`)}
      ${Array.from({ length: busy }).map(() => html`<div class="photo photo--loading"><span class="spinner"></span></div>`)}
    </div>`}
    <${Sheet} open=${!!current} onClose=${() => setEdit(null)} title="Photo" tall>
      ${current && html`<div class="photo-edit">
        <img src=${current.dataUrl} alt="" class="photo-edit__img" />
        <${Input} label="Caption" value=${current.caption} placeholder="e.g. Condensate pump before replacement"
          onChange=${(v) => update({ caption: v })} wide enterkeyhint="done" />
        <div class="photo-edit__row">
          <button class="btn btn--danger-ghost" onClick=${remove}><${Icon} name="trash" size=${20} /> Delete</button>
          <button class="btn btn--primary" onClick=${() => setEdit(null)}>Done</button>
        </div>
      </div>`}
    </${Sheet}>
  </div>`;
}

// ---------- time on site ----------

export function TimeBlock({ time, onChange }) {
  const set = (patch) => onChange({ ...time, ...patch });
  const mins = minutesBetween(time.arrived, time.left);
  const stamp = (k) => { vibrate(15); set({ [k]: nowHHMM() }); };
  return html`<div class="timeblock">
    <div class="timeblock__clock">
      <div class="clock">
        <span class="clock__label">Arrived</span>
        ${time.arrived
          ? html`<input class="clock__time" type="time" value=${time.arrived} onInput=${(e) => set({ arrived: e.currentTarget.value })} aria-label="Arrived time" />`
          : html`<button type="button" class="clock__now" onClick=${() => stamp('arrived')}><${Icon} name="clock" size=${18} /> Arrived now</button>`}
      </div>
      <div class="clock">
        <span class="clock__label">Left</span>
        ${time.left
          ? html`<input class="clock__time" type="time" value=${time.left} onInput=${(e) => set({ left: e.currentTarget.value })} aria-label="Left time" />`
          : html`<button type="button" class="clock__now" onClick=${() => stamp('left')}><${Icon} name="clock" size=${18} /> Leaving now</button>`}
      </div>
      <div class="clock clock--total">
        <span class="clock__label">On site</span>
        <span class="clock__total">${mins != null ? fmtDuration(mins) : '–'}</span>
      </div>
    </div>
    <div class="grid2">
      <${Input} label="Travel time" value=${time.travelMins} inputmode="numeric" suffix="mins" onChange=${(v) => set({ travelMins: v })} />
      <${Input} label="Mileage" value=${time.miles} inputmode="decimal" suffix="miles" onChange=${(v) => set({ miles: v })} />
    </div>
  </div>`;
}

// ---------- client & site ----------

export function ClientSite({ job, onChange, onLoadUnits }) {
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  useEffect(() => { allClients().then(setClients); allSites().then(setSites); }, []);

  const c = job.client, s = job.site;
  const setC = (patch) => onChange({ client: { ...c, ...patch } });
  const setS = (patch) => onChange({ site: { ...s, ...patch } });

  const clientSites = sites.filter((x) => !c.name || norm(x.clientName) === norm(c.name));
  const siteOptions = (clientSites.length ? clientSites : sites).map((x) => ({
    label: x.name ? `${x.name}, ${x.address}` : x.address, site: x,
  }));

  const pickSite = async (o) => {
    const x = o.site;
    onChange({ site: { name: x.name || '', address: x.address || '' }, client: x.clientName && !c.name ? { ...c, name: x.clientName } : c });
    if (onLoadUnits && x.units && x.units.length) {
      const ok = await ask({
        title: `Load the ${x.units.length} unit${x.units.length > 1 ? 's' : ''} from last time?`,
        body: 'Makes, models and locations from the last visit to this site will be filled in for you.',
        ok: 'Load units', cancel: 'No thanks',
      });
      if (ok) onLoadUnits(x.units);
    }
  };

  return html`<div class="grid2">
    <${Suggest} label="Client" value=${c.name} placeholder="Company or customer name" wide
      options=${clients.map((x) => ({ label: x.name, client: x }))}
      onChange=${(v) => setC({ name: v })}
      onPick=${(o) => setC({ name: o.client.name, contact: o.client.contact || c.contact, email: o.client.email || c.email, phone: o.client.phone || c.phone })} />
    <${Input} label="Contact name" value=${c.contact} placeholder="Who you dealt with" onChange=${(v) => setC({ contact: v })} />
    <${Input} label="Phone" type="tel" inputmode="tel" value=${c.phone} onChange=${(v) => setC({ phone: v })} />
    <${Input} label="Email" type="email" inputmode="email" value=${c.email} placeholder="For sending the report" onChange=${(v) => setC({ email: v })} wide />
    <${Suggest} label="Site address" value=${s.address} placeholder="Start typing, or pick a saved site" wide
      options=${siteOptions} onChange=${(v) => setS({ address: v })} onPick=${pickSite}
      renderOption=${(o) => html`<span class="opt2"><${Icon} name="pin" size=${16} /><span>${o.label}</span></span>`} />
    <${Input} label="Site name" value=${s.name} placeholder="Optional, e.g. Cushion School" onChange=${(v) => setS({ name: v })} wide />
  </div>`;
}

export function MaterialsList({ items, onChange }) {
  const set = (i, patch) => onChange(items.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return html`<div class="materials">
    ${items.map((m, i) => html`<div class="materials__row" key=${m.id}>
      <input class="materials__item" placeholder="Item, e.g. Condensate pump" value=${m.item} onInput=${(e) => set(i, { item: e.currentTarget.value })} aria-label="Material" />
      <input class="materials__qty" placeholder="Qty" inputmode="decimal" value=${m.qty} onInput=${(e) => set(i, { qty: e.currentTarget.value })} aria-label="Quantity" />
      <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove item" onClick=${() => onChange(items.filter((_, j) => j !== i))}><${Icon} name="x" size=${18} /></button>
    </div>`)}
    <button type="button" class="addrow" onClick=${() => onChange([...items, { id: uid(), item: '', qty: '1' }])}>
      <${Icon} name="plus" size=${18} /> Add material</button>
  </div>`;
}

// Quick picks for when the next service is due, feeds the "Due for service" list on Home.
export function NextService({ value, baseDate, onChange }) {
  const opts = [3, 6, 12];
  const picked = opts.find((m) => addMonthsISO(baseDate, m) === value);
  return html`<div class="nextservice">
    <${Field} label="Next service due" hint="Shows on the Home screen when it's coming up" wide group>
      <span class="chips">
        ${opts.map((m) => html`<button type="button" class=${'chip' + (picked === m ? ' is-on' : '')}
          onClick=${() => { vibrate(); onChange(picked === m ? '' : addMonthsISO(baseDate, m)); }}>${m} months</button>`)}
        <span class="inp inp--date"><input type="date" value=${value || ''} onInput=${(e) => onChange(e.currentTarget.value)} aria-label="Next service date" /></span>
      </span>
    </${Field}>
  </div>`;
}
