// Shared interface pieces: icons, inputs, sheets, dialogs, toasts.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { vibrate } from './util.js';
import { useList, merge, addToList } from './lists.js';

// ---------- icons (24px grid, 1.75 stroke) ----------
const P = {
  home: '<path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9v10.5h4.75v-6h3.5v6h4.75V9"/>',
  jobs: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  sites: '<path d="M4 20.5V8.2l6-3.7v16"/><path d="M10 20.5V9.5l10 3.6v7.4"/><path d="M2.5 20.5h19"/><path d="M6.6 10.5h.8M6.6 14h.8M13.5 15h3M13.5 17.7h3"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5v-.2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c-.6-2.6-.2-5.6 2.1-6.4 2.5-.8 4.1 2.3 2.6 4.5-1.1 1.6-3 2-4.7 1.9"/><path d="M13.4 12.8c2.5.8 4.9 2.7 4.4 5.1-.6 2.6-4 2.4-5.1 0-.8-1.8-.3-3.6.7-5.1"/><path d="M10.6 12.8c-2 1.8-4.8 3-6.6 1.3-1.9-1.8.1-4.6 2.8-4.3 1.9.2 3.3 1.5 4.1 3"/>',
  grid: '<rect x="3.5" y="4" width="7" height="5.5" rx="1.2"/><rect x="13.5" y="4" width="7" height="5.5" rx="1.2"/><rect x="3.5" y="14.5" width="7" height="5.5" rx="1.2"/><rect x="13.5" y="14.5" width="7" height="5.5" rx="1.2"/><path d="M5.5 7.5h3M15.5 7.5h3M5.5 18h3M15.5 18h3"/>',
  gauge: '<path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0"/><path d="M12 13.5l4-4.5"/><circle cx="12" cy="14" r="1.4"/><path d="M7 12.5h.01M8.6 8.7h.01M12 7.2h.01M17 12.5h.01"/>',
  shield: '<path d="M12 3.2 5 6v5.6c0 4.4 3 8 7 9.2 4-1.2 7-4.8 7-9.2V6z"/><path d="m9 12 2.2 2.2L15.4 10"/>',
  camera: '<path d="M4 8.2c0-1 .8-1.7 1.7-1.7h2l1.5-2h5.6l1.5 2h2c1 0 1.7.8 1.7 1.7v9.6c0 1-.8 1.7-1.7 1.7H5.7c-1 0-1.7-.8-1.7-1.7z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m20.5 16-4.8-4.8L6 19.5"/>',
  pen: '<path d="M4 20c2.5-1 4-3.5 6.5-3.5 1.6 0 1.2 2 2.8 2 1.7 0 2.5-2 4.2-2"/><path d="M14.5 4.5l3 3-7.5 7.5H7v-3z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  car: '<path d="M5 16.5h14"/><path d="M4.5 16.5v-3.8l1.8-4.5c.3-.7 1-1.2 1.8-1.2h7.8c.8 0 1.5.5 1.8 1.2l1.8 4.5v3.8"/><path d="M4.5 12.5h15"/><circle cx="7.8" cy="17.3" r="1.7"/><circle cx="16.2" cy="17.3" r="1.7"/>',
  share: '<path d="M12 3.5v11"/><path d="m7.5 7.5 4.5-4 4.5 4"/><path d="M6 11.5H5v8.5h14v-8.5h-1"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m4.5 7 7.5 6 7.5-6"/>',
  chat: '<path d="M4.5 19.5l1.2-3.7A7.7 7.7 0 1 1 9 19z"/><path d="M9.2 9.3c.2 2.6 2.4 4.9 5.2 5.4l1-1.2-1.8-.9-.8.8c-1-.4-1.8-1.2-2.3-2.2l.8-.8-.8-1.9z"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
  open: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v5c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1v-11c0-.6.4-1 1-1h5"/>',
  eye: '<path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l.9 12.2c.1.7.6 1.3 1.3 1.3h6.6c.7 0 1.3-.6 1.3-1.3L17.5 7"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5c0-1.1-.9-2-2-2h-7c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17h.01"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5"/>',
  phone: '<path d="M5.5 4h3l1.5 4-2 1.3a10 10 0 0 0 6.7 6.7l1.3-2 4 1.5v3c0 .8-.7 1.5-1.5 1.5A15.5 15.5 0 0 1 4 5.5C4 4.7 4.7 4 5.5 4z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  wrench: '<path d="M14.6 6.3a4 4 0 0 0 5.1 5.1l-8.6 8.6a2.1 2.1 0 1 1-3-3z" transform="translate(-1 -1)"/><path d="M13.5 5.3 15.8 3a4.5 4.5 0 0 1 5.2 5.2l-2.3 2.3"/>',
  thermo: '<path d="M10 14.2V5.5a2 2 0 1 1 4 0v8.7a3.8 3.8 0 1 1-4 0z"/><path d="M12 15.5V9"/>',
  pin: '<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 1 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  undo: '<path d="M8.5 7.5 4.5 11.5l4 4"/><path d="M4.5 11.5h10a5 5 0 0 1 0 10h-3"/>',
  box: '<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13.4 4.6"/><path d="M4.5 12A7.5 7.5 0 0 1 17.9 7.4"/><path d="M18.5 3.5v4.2h-4.2M5.5 20.5v-4.2h4.2"/>',
  upload: '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 19.5h14"/>',
  sheet: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M4 9h16M4 14.5h16M10 9v11.5"/>',
  star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
};

export function Icon({ name, size = 22, class: cls = '', stroke = 1.75 }) {
  return html`<svg class=${'ic ' + cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" dangerouslySetInnerHTML=${{ __html: P[name] || '' }}></svg>`;
}

// ---------- layout ----------

export function TopBar({ title, sub, onBack, right, tone = 'light' }) {
  return html`<header class=${'topbar topbar--' + tone}>
    ${onBack
      ? html`<button class="iconbtn" onClick=${onBack} aria-label="Back"><${Icon} name="back" /></button>`
      : html`<span class="topbar__spacer"></span>`}
    <div class="topbar__titles">
      <div class="topbar__title">${title}</div>
      ${sub && html`<div class="topbar__sub">${sub}</div>`}
    </div>
    <div class="topbar__right">${right || html`<span class="topbar__spacer"></span>`}</div>
  </header>`;
}

export function Section({ id, title, aside, children, note }) {
  return html`<section class="sec" id=${id} data-sec=${id}>
    <div class="sec__head">
      <h2 class="sec__title">${title}</h2>
      ${aside && html`<div class="sec__aside">${aside}</div>`}
    </div>
    ${note && html`<p class="sec__note">${note}</p>`}
    <div class="sec__body">${children}</div>
  </section>`;
}

// ---------- inputs ----------

// A labelled field. Single inputs sit inside <label>; groups of buttons use a role=group div
// so tapping the heading never presses the first button.
export function Field({ label, hint, children, wide, group, class: cls = '' }) {
  const c = 'field ' + (wide ? 'field--wide ' : '') + cls;
  const inner = html`${label && html`<span class="field__label">${label}</span>`}${children}${hint && html`<span class="field__hint">${hint}</span>`}`;
  return group
    ? html`<div class=${c} role="group" aria-label=${label}>${inner}</div>`
    : html`<label class=${c}>${inner}</label>`;
}

export function Input({ label, value, onChange, type = 'text', placeholder, inputmode, suffix, hint, wide, autocomplete = 'off', enterkeyhint, class: cls }) {
  return html`<${Field} label=${label} hint=${hint} wide=${wide} class=${cls}>
    <span class=${'inp' + (suffix ? ' inp--suffix' : '')}>
      <input type=${type} value=${value ?? ''} placeholder=${placeholder || ''} inputmode=${inputmode}
        autocomplete=${autocomplete} enterkeyhint=${enterkeyhint}
        onInput=${(e) => onChange(e.currentTarget.value)} />
      ${suffix && html`<span class="inp__suffix">${suffix}</span>`}
    </span>
  </${Field}>`;
}

export function TextArea({ label, value, onChange, placeholder, rows = 3, hint }) {
  const ref = useRef();
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, rows * 24 + 24) + 'px';
  };
  useEffect(fit, [value]);
  return html`<${Field} label=${label} hint=${hint} wide>
    <textarea ref=${ref} class="ta" rows=${rows} placeholder=${placeholder || ''} value=${value ?? ''}
      onInput=${(e) => { onChange(e.currentTarget.value); fit(); }}></textarea>
  </${Field}>`;
}

// Small inline box for typing your own option, used by every "Other" / "Add" button.
export function AddInline({ placeholder = 'Type your own', onAdd, onCancel, list }) {
  const [v, setV] = useState('');
  const ref = useRef();
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  const submit = () => { if (v.trim()) { vibrate(12); onAdd(v.trim()); } };
  return html`<span class="addinline">
    <input ref=${ref} value=${v} placeholder=${placeholder} enterkeyhint="done" autocomplete="off" list=${list}
      aria-label=${placeholder}
      onInput=${(e) => setV(e.currentTarget.value)}
      onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') onCancel(); }} />
    <button type="button" class="addinline__ok" disabled=${!v.trim()} onClick=${submit}>Add</button>
    <button type="button" class="iconbtn iconbtn--muted" onClick=${onCancel} aria-label="Cancel"><${Icon} name="x" size=${18} /></button>
  </span>`;
}

const AddPill = ({ onClick, label = 'Other', cls = 'chip' }) => html`<button type="button" class=${cls + ' addpill'} onClick=${onClick}>
  <${Icon} name="plus" size=${16} stroke=${2.2} />${label}</button>`;

// Text box that suggests from a list as you type. With listKey, things you've added before are suggested too.
export function Suggest({ label, value, onChange, options = [], onPick, placeholder, hint, wide, renderOption, inputmode, listKey }) {
  const [open, setOpen] = useState(false);
  const custom = useList(listKey);
  const all = listKey ? merge(options, custom) : options;
  const q = (value || '').toLowerCase().trim();
  const list = all
    .filter((o) => {
      const text = (typeof o === 'string' ? o : o.label).toLowerCase();
      return text !== q && (!q || text.includes(q));
    })
    .slice(0, 6);
  return html`<${Field} label=${label} hint=${hint} wide=${wide}>
    <span class="inp suggest">
      <input type="text" value=${value ?? ''} placeholder=${placeholder || ''} autocomplete="off" inputmode=${inputmode}
        onInput=${(e) => { onChange(e.currentTarget.value); setOpen(true); }}
        onFocus=${() => setOpen(true)} onBlur=${() => setTimeout(() => setOpen(false), 150)} />
      ${open && list.length > 0 && html`<span class="suggest__list" role="listbox">
        ${list.map((o) => html`<button type="button" class="suggest__opt"
          onMouseDown=${(e) => e.preventDefault()}
          onClick=${() => { setOpen(false); onPick ? onPick(o) : onChange(typeof o === 'string' ? o : o.label); }}>
          ${renderOption ? renderOption(o) : typeof o === 'string' ? o : o.label}
        </button>`)}
      </span>`}
    </span>
  </${Field}>`;
}

// Pick one. With listKey there's an "Other" button to type your own, which is remembered.
export function Segmented({ label, options, value, onChange, small, listKey, addLabel = 'Other' }) {
  const custom = useList(listKey);
  const [adding, setAdding] = useState(false);
  const opts = listKey ? merge(options, custom, value ? [value] : []) : options;
  const wrap = !!listKey || opts.length > 4;
  const add = async (text) => { const v = await addToList(listKey, text, options); onChange(v); setAdding(false); };
  return html`<${Field} label=${label} wide group>
    <span class=${'seg' + (small ? ' seg--small' : '') + (wrap ? ' seg--wrap' : '')} role="radiogroup">
      ${opts.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return html`<button type="button" role="radio" aria-checked=${value === v}
          class=${'seg__opt' + (value === v ? ' is-on' : '')}
          onClick=${() => { vibrate(); onChange(v); }}>${l}</button>`;
      })}
      ${listKey && !adding && html`<${AddPill} cls="seg__opt seg__opt--add" label=${addLabel} onClick=${() => setAdding(true)} />`}
    </span>
    ${adding && html`<${AddInline} placeholder=${'Type your own ' + (label || '').toLowerCase()} onAdd=${add} onCancel=${() => setAdding(false)} />`}
  </${Field}>`;
}

export function Toggle({ label, checked, onChange, hint }) {
  return html`<button type="button" role="switch" aria-checked=${!!checked}
    class=${'toggle' + (checked ? ' is-on' : '')} onClick=${() => { vibrate(); onChange(!checked); }}>
    <span class="toggle__text"><span class="toggle__label">${label}</span>${hint && html`<span class="toggle__hint">${hint}</span>`}</span>
    <span class="toggle__track"><span class="toggle__thumb"></span></span>
  </button>`;
}

// Pick several. With listKey there's an "Add" button to type your own, which is remembered.
export function Chips({ options, value = [], onChange, label, listKey, addLabel = 'Add' }) {
  const custom = useList(listKey);
  const [adding, setAdding] = useState(false);
  const opts = merge(options, custom, value);
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const add = async (text) => {
    const v = await addToList(listKey, text, options);
    if (!value.includes(v)) onChange([...value, v]);
    setAdding(false);
  };
  return html`<${Field} label=${label} wide group>
    <span class="chips">
      ${opts.map((o) => html`<button type="button" class=${'chip' + (value.includes(o) ? ' is-on' : '')}
        aria-pressed=${value.includes(o)} onClick=${() => { vibrate(); toggle(o); }}>
        ${value.includes(o) && html`<${Icon} name="check" size=${16} stroke=${2.4} />`}${o}</button>`)}
      ${listKey && !adding && html`<${AddPill} label=${addLabel} onClick=${() => setAdding(true)} />`}
    </span>
    ${adding && html`<${AddInline} placeholder=${'Type your own'} onAdd=${add} onCancel=${() => setAdding(false)} />`}
  </${Field}>`;
}

// Dropdown. With listKey the last option lets you type your own, which is remembered.
export function Select({ label, value, options, onChange, wide, listKey }) {
  const custom = useList(listKey);
  const [adding, setAdding] = useState(false);
  const opts = listKey ? merge(options, custom, value ? [value] : []) : options;
  const add = async (text) => { const v = await addToList(listKey, text, options); onChange(v); setAdding(false); };
  return html`<${Field} label=${label} wide=${wide} group=${!!listKey}>
    ${adding
      ? html`<${AddInline} placeholder=${'Type your own'} onAdd=${add} onCancel=${() => setAdding(false)} />`
      : html`<span class="inp inp--select">
        <select value=${value} aria-label=${label} onChange=${(e) => {
          const v = e.currentTarget.value;
          if (v === '__add__') { e.currentTarget.value = value; setAdding(true); } else onChange(v);
        }}>
          ${opts.map((o) => html`<option value=${o}>${o}</option>`)}
          ${listKey && html`<option value="__add__">Add your own…</option>`}
        </select>
        <${Icon} name="down" size=${18} class="inp__chev" />
      </span>`}
  </${Field}>`;
}

export function Stepper({ value, onChange, min = 1, max = 5, label }) {
  return html`<span class="stepper" aria-label=${label}>
    <button type="button" class="stepper__btn" disabled=${value <= min} onClick=${() => { vibrate(); onChange(Math.max(min, value - 1)); }} aria-label=${'Lower ' + label}>−</button>
    <span class="stepper__val">${value}</span>
    <button type="button" class="stepper__btn" disabled=${value >= max} onClick=${() => { vibrate(); onChange(Math.min(max, value + 1)); }} aria-label=${'Raise ' + label}>+</button>
  </span>`;
}

// ---------- sheets & dialogs ----------

export function Sheet({ open, onClose, title, children, tall }) {
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setShown(true); setClosing(false); document.body.classList.add('noscroll'); }
    else if (shown) {
      setClosing(true);
      const t = setTimeout(() => { setShown(false); setClosing(false); }, 220);
      document.body.classList.remove('noscroll');
      return () => clearTimeout(t);
    }
  }, [open]);
  useEffect(() => () => document.body.classList.remove('noscroll'), []);
  if (!shown) return null;
  return html`<div class=${'sheet-wrap' + (closing ? ' is-closing' : '')}>
    <div class="sheet-backdrop" onClick=${onClose}></div>
    <div class=${'sheet' + (tall ? ' sheet--tall' : '')} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="sheet__grip"></div>
      ${title && html`<div class="sheet__head"><h3>${title}</h3>
        <button class="iconbtn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button></div>`}
      <div class="sheet__body">${children}</div>
    </div>
  </div>`;
}

// Promise based confirm dialog, rendered by <DialogHost/>.
let dialogSetter = null;
export function ask({ title, body, ok = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    if (!dialogSetter) return resolve(window.confirm(title));
    dialogSetter({ title, body, ok, cancel, danger, resolve });
  });
}
export function DialogHost() {
  const [d, setD] = useState(null);
  dialogSetter = setD;
  const close = (v) => { d && d.resolve(v); setD(null); };
  return html`<${Sheet} open=${!!d} onClose=${() => close(false)}>
    ${d && html`<div class="dialog">
      <h3 class="dialog__title">${d.title}</h3>
      ${d.body && html`<p class="dialog__body">${d.body}</p>`}
      <div class="dialog__actions">
        <button class="btn btn--ghost" onClick=${() => close(false)}>${d.cancel}</button>
        <button class=${'btn ' + (d.danger ? 'btn--danger' : 'btn--primary')} onClick=${() => close(true)}>${d.ok}</button>
      </div>
    </div>`}
  </${Sheet}>`;
}

// ---------- toast ----------
let toastSetter = null;
export function toast(msg, opts = {}) {
  toastSetter && toastSetter({ msg, id: Date.now(), ...opts });
}
export function ToastHost() {
  const [t, setT] = useState(null);
  toastSetter = setT;
  useEffect(() => {
    if (!t || t.sticky) return;
    const h = setTimeout(() => setT(null), t.ms || 2600);
    return () => clearTimeout(h);
  }, [t]);
  if (!t) return null;
  return html`<div class="toast" role="status" key=${t.id}>
    ${t.icon && html`<${Icon} name=${t.icon} size=${20} />`}
    <span>${t.msg}</span>
    ${t.action && html`<button class="toast__btn" onClick=${() => { t.action.fn(); setT(null); }}>${t.action.label}</button>`}
  </div>`;
}

export function Empty({ icon, title, body, action }) {
  return html`<div class="empty">
    <span class="empty__icon"><${Icon} name=${icon} size=${28} /></span>
    <h3>${title}</h3>
    ${body && html`<p>${body}</p>`}
    ${action}
  </div>`;
}
