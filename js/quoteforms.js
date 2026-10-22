// Quote builder screens: survey, rooms, photo overlays, options and acceptance.

import { html, useState, useRef } from '../vendor/preact-htm.js';
import { Icon, Input, TextArea, Segmented, Toggle, Field, Chips, Sheet, Select, ask, toast } from './ui.js';
import { ClientSite, Photos, SignatureBox, compress } from './components.js';
import { OverlayEditor, SHAPES } from './overlay.js';
import {
  TIERS, UNIT_TYPES_Q, ROOM_USES, GLAZING, ASPECT, blankRoom, roomLoad, roomKw, priceQuote, priceRoom, fmtGBP, fmtGBP0, getPrice,
} from './quote.js';
import { uid, vibrate, fmtDate, addMonthsISO } from './util.js';

const UNIT_SHAPE = { 'Wall mounted': 'wall', Cassette: 'cassette', Ducted: 'cassette', 'Floor standing': 'floor', 'Multi-split': 'wall' };

// ---------- room photos with overlays ----------

function RoomPhotos({ room, onChange }) {
  const camRef = useRef(), libRef = useRef();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const photos = room.photos || [];
  const set = (p) => onChange({ ...room, photos: p });
  const add = async (files) => {
    const list = [...(files || [])].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setBusy(true);
    const added = [];
    for (const f of list) {
      try { const r = await compress(f, 1400, 0.82); added.push({ id: uid(), dataUrl: r.dataUrl, overlayUrl: '', place: null, caption: '' }); } catch (e) { /* skip */ }
    }
    setBusy(false);
    set([...photos, ...added]);
    if (added.length === 1) setEdit({ id: added[0].id, outdoor: false });
  };
  const current = edit && photos.find((p) => p.id === edit.id);
  const label = edit && edit.outdoor ? 'Outdoor unit' : `${room.name || 'Indoor unit'}`;
  return html`<div class="photos">
    <div class="photos__actions">
      <button type="button" class="tile-btn" onClick=${() => camRef.current.click()}><${Icon} name="camera" size=${26} /><span>Photo the wall</span></button>
      <button type="button" class="tile-btn" onClick=${() => libRef.current.click()}><${Icon} name="image" size=${26} /><span>From library</span></button>
    </div>
    <input ref=${camRef} type="file" accept="image/*" capture="environment" hidden onChange=${(e) => { add(e.currentTarget.files); e.currentTarget.value = ''; }} />
    <input ref=${libRef} type="file" accept="image/*" multiple hidden onChange=${(e) => { add(e.currentTarget.files); e.currentTarget.value = ''; }} />
    ${busy && html`<p class="hint"><span class="spinner spinner--small"></span> Loading photo</p>`}
    ${photos.length > 0 && html`<div class="qphotos">
      ${photos.map((p) => html`<div class="qphoto" key=${p.id}>
        <img src=${p.overlayUrl || p.dataUrl} alt=${p.caption || 'Room photo'} />
        <div class="qphoto__bar">
          <button type="button" class="qphoto__btn" onClick=${() => setEdit({ id: p.id, outdoor: false })}><${Icon} name="layers" size=${16} /> ${p.overlayUrl ? 'Move unit' : 'Place unit'}</button>
          <button type="button" class="qphoto__btn" onClick=${() => setEdit({ id: p.id, outdoor: true })}>Outdoor</button>
          <button type="button" class="iconbtn iconbtn--muted" aria-label="Delete photo" onClick=${async () => { if (await ask({ title: 'Delete this photo?', ok: 'Delete', danger: true })) set(photos.filter((x) => x.id !== p.id)); }}><${Icon} name="trash" size=${17} /></button>
        </div>
        <input class="qphoto__cap" placeholder="Caption, e.g. Living room, unit above the sofa" value=${p.caption} onInput=${(e) => set(photos.map((x) => (x.id === p.id ? { ...x, caption: e.currentTarget.value } : x)))} />
      </div>`)}
    </div>`}
    ${current && html`<${OverlayEditor} photoUrl=${current.dataUrl} label=${label}
      initial=${current.place || { shape: edit.outdoor ? 'outdoor' : UNIT_SHAPE[room.unitType] || 'wall', x: 0.3, y: 0.18, w: 0.42 }}
      onCancel=${() => setEdit(null)}
      onDone=${({ place, url }) => { set(photos.map((x) => (x.id === current.id ? { ...x, place, overlayUrl: url } : x))); setEdit(null); toast('Unit placed on the photo', { icon: 'check' }); }} />`}
  </div>`;
}

// ---------- one room ----------

function RoomCard({ room, i, price, onChange, onRemove, onCopy }) {
  const [open, setOpen] = useState(true);
  const s = (k, v) => onChange({ ...room, [k]: v });
  const load = roomLoad(room);
  const kw = roomKw(room);
  const better = kw ? priceRoom(room, 'better', price) : null;
  return html`<div class=${'unit room' + (open ? ' is-open' : '')}>
    <button type="button" class="unit__head room__head" onClick=${() => setOpen(!open)} aria-expanded=${open}>
      <span class="unit__num">${i + 1}</span>
      <span class="unit__title">${room.name || 'New room'}${kw ? html`<small> ${kw}kW${better && better.unit ? `, ${better.unit.make} ${better.unit.model}` : ''}</small>` : ''}</span>
      <${Icon} name="down" size=${20} class="hz__chev" />
    </button>
    ${open && html`<div class="stack">
      <div class="grid2">
        <${Input} label="Room" value=${room.name} placeholder="e.g. Living room, Office 2" onChange=${(v) => s('name', v)} wide />
        <${Select} label="What it's used for" value=${(ROOM_USES.find((x) => x.id === room.use) || ROOM_USES[2]).label} options=${ROOM_USES.map((x) => x.label)} onChange=${(v) => s('use', (ROOM_USES.find((x) => x.label === v) || ROOM_USES[2]).id)} wide />
      </div>
      <div class="subhead">Size</div>
      <div class="grid3">
        <${Input} label="Length" value=${room.length} suffix="m" inputmode="decimal" onChange=${(v) => s('length', v)} />
        <${Input} label="Width" value=${room.width} suffix="m" inputmode="decimal" onChange=${(v) => s('width', v)} />
        <${Input} label="Height" value=${room.height} suffix="m" inputmode="decimal" onChange=${(v) => s('height', v)} />
      </div>
      <${Segmented} label="Glazing" small options=${GLAZING.map((g) => ({ value: g.id, label: g.label }))} value=${room.glazing} onChange=${(v) => s('glazing', v)} />
      <${Segmented} label="Which way the windows face" small options=${ASPECT.map((g) => ({ value: g.id, label: g.label }))} value=${room.aspect} onChange=${(v) => s('aspect', v)} />
      <div class="grid2">
        <${Input} label="People usually in it" value=${room.people} inputmode="numeric" onChange=${(v) => s('people', v)} />
        <${Input} label="Equipment heat" value=${room.equipmentW} suffix="W" inputmode="numeric" hint="PCs ~150W each, servers much more" onChange=${(v) => s('equipmentW', v)} />
      </div>
      <div class="loadbox">
        <div><span>Floor area</span><b>${load.area ? load.area + ' m²' : '–'}</b></div>
        <div><span>Cooling needed</span><b>${load.kw ? load.kw + ' kW' : '–'}</b></div>
        <div class="loadbox__override">
          <span>Use instead</span>
          <span class="inp inp--suffix"><input value=${room.kwOverride} inputmode="decimal" placeholder=${load.kw || ''} onInput=${(e) => s('kwOverride', e.currentTarget.value.replace(/[^\d.]/g, ''))} aria-label="Override kW" /><span class="inp__suffix">kW</span></span>
        </div>
      </div>
      <div class="subhead">The install</div>
      <${Segmented} label="Indoor unit type" small options=${UNIT_TYPES_Q} value=${room.unitType} onChange=${(v) => s('unitType', v)} />
      <div class="grid2">
        <${Input} label="Indoor unit goes" value=${room.indoorSpot} placeholder="e.g. Above the door, high on the back wall" onChange=${(v) => s('indoorSpot', v)} wide />
        <${Input} label="Outdoor unit goes" value=${room.outdoorSpot} placeholder="e.g. Rear wall, bracket at 2m" onChange=${(v) => s('outdoorSpot', v)} wide />
        <${Input} label="Pipe run" value=${room.pipeM} suffix="m" inputmode="decimal" onChange=${(v) => s('pipeM', v)} />
        <${Input} label="Trunking" value=${room.trunkingM} suffix="m" inputmode="decimal" onChange=${(v) => s('trunkingM', v)} />
      </div>
      <${Segmented} label="Outdoor unit on" options=${[{ value: 'bracket', label: 'Wall bracket' }, { value: 'feet', label: 'Ground feet' }]} value=${room.mount} onChange=${(v) => s('mount', v)} />
      <div class="toggles">
        <${Toggle} label="Condensate pump" checked=${room.pump} onChange=${(v) => s('pump', v)} />
        <${Toggle} label="New electrical supply" checked=${room.electrics} onChange=${(v) => s('electrics', v)} />
        <${Toggle} label="Remove old unit" checked=${room.disposal} onChange=${(v) => s('disposal', v)} />
        <${Field} label="Access equipment"><span class="inp inp--suffix"><input value=${room.accessDays} inputmode="numeric" onInput=${(e) => s('accessDays', e.currentTarget.value.replace(/\D/g, ''))} aria-label="Access days" /><span class="inp__suffix">days</span></span></${Field}>
      </div>
      <${Field} label="Photos, with the unit drawn on" hint="Photo the wall, then tap Place unit and drag it where it's going. The customer sees exactly what they're getting." wide group>
        <${RoomPhotos} room=${room} onChange=${onChange} />
      </${Field}>
      <${TextArea} label="Notes for this room" value=${room.notes} rows=${2} placeholder="e.g. Core drill through cavity wall, cable route behind units" onChange=${(v) => s('notes', v)} />
      <div class="hz__actions">
        <button type="button" class="btn btn--soft btn--small" onClick=${onCopy}><${Icon} name="copy" size=${18} /> Copy room</button>
        <button type="button" class="btn btn--danger-ghost btn--small" onClick=${onRemove}><${Icon} name="trash" size=${18} /> Remove room</button>
      </div>
    </div>`}
  </div>`;
}

// ---------- options preview ----------

function OptionsPreview({ q, price }) {
  const p = priceQuote(q, price);
  if (!p.rooms.length) return html`<p class="block__empty">Add a room with its size and the three prices appear here.</p>`;
  return html`<div class="opts">
    ${p.options.filter((o) => q.offered.includes(o.tier.id)).map((o) => html`<div class=${'opt' + (q.recommended === o.tier.id ? ' is-rec' : '') + (o.available ? '' : ' is-na')} key=${o.tier.id}>
      <div class="opt__head"><b>${o.tier.label}</b>${q.recommended === o.tier.id && html`<span class="opt__rec">Recommended</span>`}</div>
      <div class="opt__total">${o.available ? fmtGBP0(o.total) : 'No unit'}<small>inc VAT</small></div>
      <ul class="opt__units">${o.perRoom.map((r) => html`<li>${r.room.name || 'Room'}: ${r.unit ? `${r.unit.make} ${r.unit.model}` : 'no unit this size'}</li>`)}</ul>
      <div class="opt__breakdown"><span>Materials ${fmtGBP0(o.materials)}</span><span>Labour ${fmtGBP0(o.labour)} (${p.hours}h)</span>${o.extras ? html`<span>Extras ${fmtGBP0(o.extras)}</span>` : ''}${o.discount ? html`<span>Discount −${fmtGBP0(o.discount)}</span>` : ''}</div>
    </div>`)}
  </div>`;
}

// ---------- sections ----------

export function quoteSections(job, { set, patch, engineers, settings }) {
  const q = job.data;
  const price = getPrice(settings);
  const sq = (k, v) => set(['data', k], v);
  const rooms = q.rooms;
  const setRoom = (i, r) => sq('rooms', rooms.map((x, j) => (j === i ? r : x)));
  const validUntil = addMonthsISO(job.date, 0) && (() => { const d = new Date(job.date); d.setDate(d.getDate() + (parseInt(price.validityDays, 10) || 30)); return d.toISOString().slice(0, 10); })();
  const examples = price.units.some((x) => x.example) || price.items.some((x) => x.example);

  return [
    {
      id: 'job', nav: 'Job', title: 'Quote details',
      body: html`<div class="stack">
        <div class="grid2">
          <${Input} label="Date" type="date" value=${job.date} onChange=${(v) => set(['date'], v)} />
          <${Input} label="Quote number" value=${job.jobNo} inputmode="numeric" onChange=${(v) => set(['jobNo'], v)} />
          <${Input} label="Title" value=${q.title} placeholder="e.g. Air conditioning for the ground floor office" onChange=${(v) => sq('title', v)} wide />
          <${Input} label="Surveyed by" value=${job.engineer} onChange=${(v) => set(['engineer'], v)} wide />
        </div>
        <p class="hint">Valid until ${fmtDate(validUntil)}. Change the validity in Settings, Quotes and prices.</p>
        ${examples && html`<p class="warnline warnline--amber"><${Icon} name="alert" size=${18} /> The price list still has example prices in it. Put your own in under Settings, Quotes and prices, before this goes to a customer.</p>`}
      </div>`,
    },
    {
      id: 'client', nav: 'Client', title: 'Client and site',
      body: html`<${ClientSite} job=${job} onChange=${patch} />`,
    },
    {
      id: 'survey', nav: 'Survey', title: 'Site survey',
      body: html`<div class="stack">
        <${TextArea} label="Summary for the customer" value=${q.summary} rows=${3} placeholder="e.g. Cooling and heating for the two ground floor offices, with the outdoor unit on the rear wall out of sight." onChange=${(v) => sq('summary', v)} />
        <div class="grid2">
          <${Input} label="Parking" value=${q.survey.parking} placeholder="e.g. On the drive" onChange=${(v) => sq('survey', { ...q.survey, parking: v })} />
          <${Input} label="Access" value=${q.survey.access} placeholder="e.g. Side gate, ladder to flat roof" onChange=${(v) => sq('survey', { ...q.survey, access: v })} />
          <${Input} label="Power" value=${q.survey.power} onChange=${(v) => sq('survey', { ...q.survey, power: v })} wide />
        </div>
        <${TextArea} label="Survey notes" value=${q.survey.notes} rows=${2} placeholder="Anything else you spotted" onChange=${(v) => sq('survey', { ...q.survey, notes: v })} />
      </div>`,
    },
    {
      id: 'rooms', nav: 'Rooms', title: 'Rooms',
      aside: html`<span class="count">${rooms.length}</span>`,
      body: html`<div class="stack">
        ${rooms.map((r, i) => html`<${RoomCard} key=${r.id} room=${r} i=${i} price=${price}
          onChange=${(nr) => setRoom(i, nr)}
          onCopy=${() => sq('rooms', [...rooms.slice(0, i + 1), { ...r, id: uid(), name: '', photos: [] }, ...rooms.slice(i + 1)])}
          onRemove=${async () => { if (rooms.length === 1 || (await ask({ title: `Remove ${r.name || 'this room'}?`, ok: 'Remove', danger: true }))) sq('rooms', rooms.length === 1 ? [blankRoom()] : rooms.filter((_, j) => j !== i)); }} />`)}
        <button type="button" class="addrow addrow--big" onClick=${() => sq('rooms', [...rooms, blankRoom()])}><${Icon} name="plus" size=${20} /> Add room</button>
      </div>`,
    },
    {
      id: 'options', nav: 'Options', title: 'Options and price',
      body: html`<div class="stack">
        <${Chips} label="Options to offer" options=${TIERS.map((t) => t.id)} value=${q.offered} onChange=${(v) => sq('offered', v.length ? TIERS.map((t) => t.id).filter((x) => v.includes(x)) : q.offered)} />
        <${Segmented} label="Recommend" options=${TIERS.map((t) => ({ value: t.id, label: t.label }))} value=${q.recommended} onChange=${(v) => sq('recommended', v)} />
        <div class="grid2">
          <${Input} label="Engineers on the job" value=${String(q.engineers)} inputmode="numeric" onChange=${(v) => sq('engineers', parseInt(v, 10) || 1)} />
          <${Input} label="Discount" value=${q.discount} suffix="%" inputmode="decimal" placeholder="None" onChange=${(v) => sq('discount', v.replace(/[^\d.]/g, ''))} />
        </div>
        <${Field} label="Extras" hint="Anything not in the price list, e.g. core drilling, scaffold, weekend working" wide group>
          <div class="materials">
            ${(q.extras || []).map((e, i) => html`<div class="materials__row" key=${e.id}>
              <input class="materials__item" placeholder="Description" value=${e.label} onInput=${(ev) => sq('extras', q.extras.map((x, j) => (j === i ? { ...x, label: ev.currentTarget.value } : x)))} aria-label="Extra" />
              <input class="materials__qty" placeholder="£" inputmode="decimal" value=${e.price} onInput=${(ev) => sq('extras', q.extras.map((x, j) => (j === i ? { ...x, price: ev.currentTarget.value } : x)))} aria-label="Price" />
              <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove" onClick=${() => sq('extras', q.extras.filter((_, j) => j !== i))}><${Icon} name="x" size=${18} /></button>
            </div>`)}
            <button type="button" class="addrow" onClick=${() => sq('extras', [...(q.extras || []), { id: uid(), label: '', price: '' }])}><${Icon} name="plus" size=${18} /> Add extra</button>
          </div>
        </${Field}>
        <${OptionsPreview} q=${q} price=${price} />
      </div>`,
    },
    {
      id: 'sign', nav: 'Accept', title: 'Acceptance',
      body: html`<div class="signoff">
        <p class="hint">When the customer says yes, pick the option they went for and get them to sign. The quote PDF then shows it as accepted and you can start the commissioning sheet from it.</p>
        <${Segmented} label="Customer accepted" options=${[{ value: '', label: 'Not yet' }, ...TIERS.filter((t) => q.offered.includes(t.id)).map((t) => ({ value: t.id, label: t.label }))]} value=${q.accepted.tier}
          onChange=${(v) => sq('accepted', { ...q.accepted, tier: v, at: v ? Date.now() : null })} />
        ${q.accepted.tier && html`<${SignatureBox} title="Customer" sig=${job.sign.customer} namePlaceholder="Print name" onChange=${(s2) => set(['sign', 'customer'], s2)} />`}
        <${SignatureBox} title="Surveyed and priced by" sig=${job.sign.engineer} namePlaceholder="Your name" onChange=${(s2) => set(['sign', 'engineer'], s2)} />
      </div>`,
    },
  ];
}

export function checkQuote(job) {
  const w = [];
  const q = job.data;
  if (!job.client.name) w.push('No client name');
  if (!job.site.address) w.push('No site address');
  if (!q.rooms.some((r) => roomKw(r) > 0)) w.push('No room has a size yet, so there is no price');
  q.rooms.forEach((r) => { if (roomKw(r) > 0 && !r.name) w.push('A room has no name'); });
  if (!q.rooms.some((r) => (r.photos || []).some((p) => p.overlayUrl))) w.push('No photo with the unit drawn on it');
  if (!q.summary) w.push('No summary for the customer');
  return w;
}

// ---------- Settings: price list ----------

export function PriceSettings({ settings, save }) {
  const price = getPrice(settings);
  const setP = (patch) => save({ ...settings, price: { ...price, ...patch } });
  const setUnit = (id, patch) => setP({ units: price.units.map((x) => (x.id === id ? { ...x, ...patch, example: false } : x)) });
  const setItem = (id, patch) => setP({ items: price.items.map((x) => (x.id === id ? { ...x, ...patch, example: false } : x)) });
  const [tier, setTier] = useState('better');
  const examples = price.units.some((x) => x.example) || price.items.some((x) => x.example);
  return html`<section class="setblock">
    <h2 class="setblock__title">Quotes and prices</h2>
    ${examples ? html`<p class="warnline warnline--amber"><${Icon} name="alert" size=${18} /> These are example prices to get you started. Change them to yours; anything you edit stops being an example.</p>` : html`<p class="hint">Your price list. Quotes are built from it.</p>`}
    <div class="grid2">
      <${Input} label="Mark-up on materials" value=${price.markup} suffix="%" inputmode="decimal" onChange=${(v) => setP({ markup: v.replace(/[^\d.]/g, '') })} />
      <${Input} label="Labour rate" value=${price.labourRate} suffix="£/hr" inputmode="decimal" onChange=${(v) => setP({ labourRate: v.replace(/[^\d.]/g, '') })} />
      <${Input} label="Hours, first unit" value=${price.hoursFirst} suffix="hrs" inputmode="decimal" onChange=${(v) => setP({ hoursFirst: v.replace(/[^\d.]/g, '') })} />
      <${Input} label="Hours, each extra unit" value=${price.hoursExtra} suffix="hrs" inputmode="decimal" onChange=${(v) => setP({ hoursExtra: v.replace(/[^\d.]/g, '') })} />
      <${Input} label="VAT" value=${price.vat} suffix="%" inputmode="decimal" onChange=${(v) => setP({ vat: v.replace(/[^\d.]/g, '') })} />
      <${Input} label="Quote valid for" value=${price.validityDays} suffix="days" inputmode="numeric" onChange=${(v) => setP({ validityDays: v.replace(/\D/g, '') })} />
      <${Input} label="Deposit on acceptance" value=${price.deposit} suffix="%" inputmode="decimal" onChange=${(v) => setP({ deposit: v.replace(/[^\d.]/g, '') })} />
    </div>
    <div class="subhead">Units</div>
    <${Segmented} label="" small options=${TIERS.map((t) => ({ value: t.id, label: t.label }))} value=${tier} onChange=${setTier} />
    <p class="hint">${TIERS.find((t) => t.id === tier).blurb}. Cost is what you pay; the mark-up above goes on top.</p>
    <div class="stack stack--tight">
      ${price.units.filter((x) => x.tier === tier).sort((a, b) => a.kw - b.kw).map((x) => html`<div class="unitrow" key=${x.id}>
        <input class="unitrow__kw" value=${x.kw} inputmode="decimal" aria-label="kW" onInput=${(e) => setUnit(x.id, { kw: parseFloat(e.currentTarget.value) || 0 })} />
        <input class="unitrow__make" value=${x.make} placeholder="Make" aria-label="Make" onInput=${(e) => setUnit(x.id, { make: e.currentTarget.value })} />
        <input class="unitrow__model" value=${x.model} placeholder="Model" aria-label="Model" onInput=${(e) => setUnit(x.id, { model: e.currentTarget.value })} />
        <input class="unitrow__cost" value=${x.cost} inputmode="decimal" placeholder="£ cost" aria-label="Cost" onInput=${(e) => setUnit(x.id, { cost: e.currentTarget.value.replace(/[^\d.]/g, '') })} />
        <input class="unitrow__feat" value=${x.features} placeholder="Selling points" aria-label="Features" onInput=${(e) => setUnit(x.id, { features: e.currentTarget.value })} />
        <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove unit" onClick=${() => setP({ units: price.units.filter((y) => y.id !== x.id) })}><${Icon} name="x" size=${18} /></button>
      </div>`)}
      <button type="button" class="addrow" onClick=${() => setP({ units: [...price.units, { id: uid(), tier, kw: 3.5, cost: '', make: '', model: '', type: 'Wall mounted', features: '' }] })}><${Icon} name="plus" size=${18} /> Add a ${tier} unit</button>
    </div>
    <div class="subhead">Materials and extras</div>
    <div class="stack stack--tight">
      ${price.items.map((x) => html`<div class="materials__row" key=${x.id}>
        <input class="materials__item" value=${x.label} aria-label="Item" onInput=${(e) => setItem(x.id, { label: e.currentTarget.value })} />
        <input class="materials__qty" value=${x.cost} inputmode="decimal" aria-label="Cost" placeholder="£" onInput=${(e) => setItem(x.id, { cost: e.currentTarget.value.replace(/[^\d.]/g, '') })} />
      </div>`)}
    </div>
    <${TextArea} label="Terms printed on every quote" value=${price.terms} rows=${6} onChange=${(v) => setP({ terms: v })} />
  </section>`;
}
