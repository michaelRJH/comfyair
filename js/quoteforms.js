// Quote builder screens: template, survey, systems, build-up, options, acceptance. Plus the price book in Settings.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon, Input, TextArea, Segmented, Toggle, Field, Chips, Sheet, Select, ask, toast } from './ui.js';
import { ClientSite, SignatureBox, compress } from './components.js';
import { OverlayEditor } from './overlay.js';
import { ARView } from './ar.js';
import {
  TIERS, INDOOR_TYPES, SYSTEM_KINDS, ROOM_USES, migrateQuote, GLAZING, ASPECT, TEMPLATES, applyTemplate, blankSystem, blankIndoor, blankRoom,
  roomLoad, roomKw, priceQuote, buildSystem, getPrice, hasExamples, parsePriceCSV, modelFor, outdoorModelFor, fmtGBP, fmtGBP0, runningCost, soundWords, pickList,
} from './quote.js';
import { allJobs, allSites } from './store.js';
import { quotedVsActual } from './pipeline.js';
import { uid, vibrate, fmtDate, norm } from './util.js';

const GROUPS = { equipment: 'Equipment', pipework: 'Pipework and drains', electrics: 'Electrics', builders: 'Builders work', access: 'Access', other: 'Other' };

// ---------- photos with the unit placed in perspective ----------

export function PlacePhotos({ photos, onChange, model, label, wall, outdoorModel }) {
  const camRef = useRef(), libRef = useRef();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const add = async (files) => {
    const list = [...(files || [])].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setBusy(true);
    const added = [];
    for (const f of list) { try { const r = await compress(f, 1600, 0.84); added.push({ id: uid(), dataUrl: r.dataUrl, w: r.w, h: r.h, overlayUrl: '', place: null, caption: '' }); } catch (e) { /* skip */ } }
    setBusy(false);
    onChange([...photos, ...added]);
    if (added.length === 1) setEdit(added[0].id);
  };
  const current = edit && photos.find((p) => p.id === edit);
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
        <img src=${p.overlayUrl || p.dataUrl} alt=${p.caption || 'Photo'} />
        <div class="qphoto__bar">
          <button type="button" class="qphoto__btn" onClick=${() => setEdit(p.id)}><${Icon} name="layers" size=${16} /> ${p.overlayUrl ? 'Adjust' : 'Place the unit'}</button>
          <button type="button" class="iconbtn iconbtn--muted" aria-label="Delete photo" onClick=${async () => { if (await ask({ title: 'Delete this photo?', ok: 'Delete', danger: true })) onChange(photos.filter((x) => x.id !== p.id)); }}><${Icon} name="trash" size=${17} /></button>
        </div>
        <input class="qphoto__cap" placeholder="Caption for the quote" value=${p.caption} onInput=${(e) => onChange(photos.map((x) => (x.id === p.id ? { ...x, caption: e.currentTarget.value } : x)))} />
      </div>`)}
    </div>`}
    ${current && html`<${OverlayEditor} photo=${current} model=${model} outdoorModel=${outdoorModel} label=${label} wall=${wall}
      onCancel=${() => setEdit(null)}
      onDone=${({ place, url }) => { onChange(photos.map((x) => (x.id === current.id ? { ...x, place, overlayUrl: url } : x))); setEdit(null); toast('Placed. That photo goes in the quote.', { icon: 'check' }); }} />`}
  </div>`;
}

// ---------- indoor unit ----------

function IndoorCard({ ind, i, sys, price, built, onChange, onRemove, quick }) {
  const [open, setOpen] = useState(true);
  const r = ind.room;
  const s = (k, v) => onChange({ ...ind, [k]: v });
  const sr = (k, v) => onChange({ ...ind, room: { ...r, [k]: v } });
  const load = roomLoad(r), kw = roomKw(r);
  const chosen = built && built.units.find((u) => u.role === 'indoor' && u.indoor && u.indoor.id === ind.id);
  const options = price.units.filter((u) => (u.type || 'Wall mounted') === ind.unitType).sort((a, b) => a.kwCool - b.kwCool || a.tier.localeCompare(b.tier));
  const wall = { w: parseFloat(r.length) || 4, h: parseFloat(r.height) || 2.4 };
  return html`<div class=${'unit room' + (open ? ' is-open' : '')}>
    <button type="button" class="unit__head room__head" onClick=${() => setOpen(!open)} aria-expanded=${open}>
      <span class="unit__num">${i + 1}</span>
      <span class="unit__title">${r.name || (sys.kind === 'cold' ? 'Cold room' : 'Room')}${kw ? html`<small>${kw}kW${chosen ? `, ${chosen.unit.make} ${chosen.unit.model}` : ''}</small>` : ''}</span>
      <${Icon} name="down" size=${20} class="hz__chev" />
    </button>
    ${open && html`<div class="stack">
      <div class="grid2">
        <${Input} label="Room" value=${r.name} placeholder="e.g. Living room" onChange=${(v) => sr('name', v)} wide />
        <${Select} label="Used for" value=${(ROOM_USES.find((x) => x.id === r.use) || ROOM_USES[3]).label} options=${ROOM_USES.map((x) => x.label)} onChange=${(v) => sr('use', (ROOM_USES.find((x) => x.label === v) || ROOM_USES[3]).id)} wide />
      </div>
      <div class="grid3">
        <${Input} label="Length" value=${r.length} suffix="m" inputmode="decimal" onChange=${(v) => sr('length', v)} />
        <${Input} label="Width" value=${r.width} suffix="m" inputmode="decimal" onChange=${(v) => sr('width', v)} />
        <${Input} label="Height" value=${r.height} suffix="m" inputmode="decimal" onChange=${(v) => sr('height', v)} />
      </div>
      <${Segmented} label="Glazing" small options=${GLAZING.map((g) => ({ value: g.id, label: g.label }))} value=${r.glazing} onChange=${(v) => sr('glazing', v)} />
      <${Segmented} label="Windows face" small options=${ASPECT.map((g) => ({ value: g.id, label: g.label }))} value=${r.aspect} onChange=${(v) => sr('aspect', v)} />
      <div class="grid2">
        <${Input} label="People" value=${r.people} inputmode="numeric" onChange=${(v) => sr('people', v)} />
        <${Input} label="Equipment heat" value=${r.equipmentW} suffix="W" inputmode="numeric" onChange=${(v) => sr('equipmentW', v)} />
      </div>
      <div class="loadbox">
        <div><span>Floor area</span><b>${load.area ? load.area + ' m²' : '–'}</b></div>
        <div><span>Cooling needed</span><b>${load.kw ? load.kw + ' kW' : '–'}</b></div>
        <div class="loadbox__override"><span>Use instead</span>
          <span class="inp inp--suffix"><input value=${r.kwOverride} inputmode="decimal" placeholder=${load.kw || ''} onInput=${(e) => sr('kwOverride', e.currentTarget.value.replace(/[^\d.]/g, ''))} aria-label="Override kW" /><span class="inp__suffix">kW</span></span></div>
      </div>
      <div class="subhead">Indoor unit</div>
      <${Segmented} label="Type" small options=${INDOOR_TYPES} value=${ind.unitType} onChange=${(v) => s('unitType', v)} />
      <${Field} label="Which unit" hint=${ind.pick === 'auto' ? 'Picked for you in each option from the price book' : 'This exact unit in every option'}>
        <span class="inp inp--select"><select value=${ind.pick} onChange=${(e) => s('pick', e.currentTarget.value)} aria-label="Which unit">
          <option value="auto">Best fit for each option (${kw ? kw + 'kW' : 'size the room first'})</option>
          ${options.map((u) => html`<option value=${u.id}>${u.make} ${u.model}, ${u.kwCool}kW (${u.tier})</option>`)}
        </select><${Icon} name="down" size=${18} class="inp__chev" /></span>
      </${Field}>
      ${!quick && html`<${Input} label="Where it goes" value=${ind.spot} placeholder="e.g. High on the back wall, above the door" onChange=${(v) => s('spot', v)} wide />`}
      <div class="grid2">
        <${Input} label="Pipe run to outdoor" value=${ind.pipeM} suffix="m" inputmode="decimal" onChange=${(v) => s('pipeM', v)} />
        <${Input} label="Trunking" value=${ind.trunkingM} suffix="m" inputmode="decimal" onChange=${(v) => s('trunkingM', v)} />
        <${Input} label="Core drills" value=${ind.coreDrills} inputmode="numeric" onChange=${(v) => s('coreDrills', v)} />
        <${Input} label="Drain run" value=${ind.drainM} suffix="m" inputmode="decimal" onChange=${(v) => s('drainM', v)} />
      </div>
      <${Segmented} label="Condensate" options=${[{ value: 'gravity', label: 'Gravity drain' }, { value: 'pump', label: 'Pump' }]} value=${ind.drain} onChange=${(v) => s('drain', v)} />
      ${!quick && html`<div class="toggles">
        <${Toggle} label="Wi-Fi adaptor" checked=${ind.wifi} onChange=${(v) => s('wifi', v)} />
        <${Toggle} label="Wired controller" checked=${ind.controller} onChange=${(v) => s('controller', v)} />
      </div>`}
      ${!quick && html`<${Field} label="Photo the wall and place the unit" hint="Tap the four corners of the wall, then drag the unit. It's drawn at the real size for this room." wide group>
        <${PlacePhotos} photos=${ind.photos || []} onChange=${(p) => s('photos', p)} model=${modelFor(chosen ? chosen.unit : { type: ind.unitType, kwCool: kw })} outdoorModel=${outdoorModelFor(kw)} label=${chosen ? `${chosen.unit.make} ${chosen.unit.model}` : ind.unitType} wall=${wall} />
      </${Field}>`}
      ${!quick && chosen && html`<${ARView} model=${modelFor(chosen.unit)} label=${`${chosen.unit.make} ${chosen.unit.model}`} />`}
      ${!quick && html`<${TextArea} label="Notes" value=${ind.notes} rows=${2} placeholder="e.g. Cable route behind the units, listed building" onChange=${(v) => s('notes', v)} />`}
      ${sys.indoors.length > 1 && html`<button type="button" class="btn btn--danger-ghost btn--small" onClick=${onRemove}><${Icon} name="trash" size=${18} /> Remove room</button>`}
    </div>`}
  </div>`;
}

// ---------- build-up table ----------

function BuildUp({ sys, built, onChange, showCost }) {
  const [editKey, setEditKey] = useState(null);
  const groups = Object.keys(GROUPS).filter((g) => built.lines.some((l) => l.group === g));
  const line = editKey && built.lines.find((l) => l.key === editKey);
  const ov = line && (sys.overrides[line.key] || {});
  const setOv = (patch) => onChange({ ...sys, overrides: { ...sys.overrides, [line.key]: { ...(sys.overrides[line.key] || {}), ...patch } } });
  return html`<div class="buildup">
    ${groups.map((g) => html`<div class="buildup__group" key=${g}>
      <div class="buildup__gh">${GROUPS[g]}</div>
      ${built.lines.filter((l) => l.group === g).map((l) => html`<button type="button" class=${'bline' + (l.overridden ? ' is-edited' : '')} key=${l.key} onClick=${() => (l.custom ? null : setEditKey(l.key))}>
        <span class="bline__label">${l.label}${l.overridden && html`<em> edited</em>`}</span>
        <span class="bline__qty">${l.qty}${l.unit === 'm' ? 'm' : l.unit === 'm²' ? 'm²' : l.unit === 'day' ? ' day' + (l.qty === 1 ? '' : 's') : ''}</span>
        <span class="bline__total">${fmtGBP0(l.total)}${showCost && html`<small>cost ${fmtGBP0(l.cost)}</small>`}</span>
      </button>`)}
    </div>`)}
    <div class="buildup__group">
      <div class="buildup__gh">Labour</div>
      <div class="bline"><span class="bline__label">${built.hours} hours × ${built.engineers} engineer${built.engineers > 1 ? 's' : ''}</span><span class="bline__qty"></span><span class="bline__total">${fmtGBP0(built.labour)}</span></div>
    </div>
    ${(sys.custom || []).length > 0 && html`<div class="buildup__group"><div class="buildup__gh">Your own lines</div>
      ${sys.custom.map((c, i) => html`<div class="materials__row" key=${c.id}>
        <input class="materials__item" placeholder="Description" value=${c.label} onInput=${(e) => onChange({ ...sys, custom: sys.custom.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)) })} aria-label="Line" />
        <input class="materials__qty" placeholder="Qty" inputmode="decimal" value=${c.qty} onInput=${(e) => onChange({ ...sys, custom: sys.custom.map((x, j) => (j === i ? { ...x, qty: e.currentTarget.value } : x)) })} aria-label="Qty" />
        <input class="materials__qty" placeholder="£ each" inputmode="decimal" value=${c.each} onInput=${(e) => onChange({ ...sys, custom: sys.custom.map((x, j) => (j === i ? { ...x, each: e.currentTarget.value } : x)) })} aria-label="Price each" />
        <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove" onClick=${() => onChange({ ...sys, custom: sys.custom.filter((_, j) => j !== i) })}><${Icon} name="x" size=${18} /></button>
      </div>`)}</div>`}
    <button type="button" class="addrow" onClick=${() => onChange({ ...sys, custom: [...(sys.custom || []), { id: uid(), label: '', qty: '1', each: '', cost: '' }] })}><${Icon} name="plus" size=${18} /> Add a line</button>
    <${Sheet} open=${!!line} onClose=${() => setEditKey(null)} title="Edit line">
      ${line && html`<div class="stack">
        <${Input} label="Description" value=${ov.label ?? line.label} onChange=${(v) => setOv({ label: v })} wide />
        <div class="grid2">
          <${Input} label="Quantity" value=${ov.qty ?? String(line.qty)} inputmode="decimal" suffix=${line.unit} onChange=${(v) => setOv({ qty: v })} />
          <${Input} label="Price each (to customer)" value=${ov.each ?? String(line.each)} inputmode="decimal" suffix="£" onChange=${(v) => setOv({ each: v })} />
        </div>
        <p class="hint">Price book says ${fmtGBP(line.each)} each. Changing it here affects this quote only.</p>
        <div class="dialog__actions">
          <button class="btn btn--danger-ghost" onClick=${() => { setOv({ off: true }); setEditKey(null); }}>Remove from quote</button>
          <button class="btn btn--ghost" onClick=${() => { onChange({ ...sys, overrides: Object.fromEntries(Object.entries(sys.overrides).filter(([k]) => k !== line.key)) }); setEditKey(null); }}>Reset</button>
        </div>
        <button class="btn btn--primary btn--block" onClick=${() => setEditKey(null)}>Done</button>
      </div>`}
    </${Sheet}>
    ${Object.values(sys.overrides).some((o) => o.off) && html`<button type="button" class="link" onClick=${() => onChange({ ...sys, overrides: Object.fromEntries(Object.entries(sys.overrides).filter(([, o]) => !o.off)) })}>Put removed lines back</button>`}
  </div>`;
}

// ---------- a system ----------

function SystemCard({ sys, i, n, price, tier, onChange, onRemove, showCost, quick }) {
  const built = buildSystem(sys, tier, price);
  const s = (k, v) => onChange({ ...sys, [k]: v });
  const so = (k, v) => onChange({ ...sys, outdoor: { ...sys.outdoor, [k]: v } });
  const kindLabel = SYSTEM_KINDS.find((k) => k.id === sys.kind).label;
  const outUnit = built.units.find((u) => u.role === 'outdoor');
  const totalKw = sys.indoors.reduce((a, x) => a + roomKw(x.room), 0);
  return html`<div class="syscard">
    <div class="syscard__head">
      <span class="syscard__badge">${kindLabel}</span>
      <input class="syscard__name" value=${sys.name} placeholder=${n > 1 ? `System ${i + 1}` : 'Name (optional)'} onInput=${(e) => s('name', e.currentTarget.value)} aria-label="System name" />
      ${n > 1 && html`<button type="button" class="iconbtn iconbtn--muted" aria-label="Remove system" onClick=${onRemove}><${Icon} name="trash" size=${19} /></button>`}
    </div>
    <${Segmented} label="System" small options=${SYSTEM_KINDS.map((k) => ({ value: k.id, label: k.label }))} value=${sys.kind}
      onChange=${(v) => onChange({ ...sys, kind: v, indoors: v === 'cold' ? [] : sys.indoors.length ? sys.indoors : [blankIndoor()] })} />

    ${sys.kind === 'cold' ? html`<div class="stack">
      <div class="grid2">
        <${Input} label="Cooling duty" value=${sys.cold.kw} suffix="kW" inputmode="decimal" hint="From the room size and what's stored" onChange=${(v) => s('cold', { ...sys.cold, kw: v })} />
        <${Input} label="Room temperature" value=${sys.cold.tempC} suffix="°C" inputmode="decimal" hint="2 for chilled, 12 for a cellar" onChange=${(v) => s('cold', { ...sys.cold, tempC: v })} />
        <${Input} label="Panels to supply" value=${sys.cold.panelsM2} suffix="m²" inputmode="decimal" placeholder="None" onChange=${(v) => s('cold', { ...sys.cold, panelsM2: v })} />
        <div class="toggles"><${Toggle} label="Cold room door" checked=${sys.cold.door} onChange=${(v) => s('cold', { ...sys.cold, door: v })} /></div>
      </div>
      <${Input} label="Pipe run" value=${sys.indoors[0] ? sys.indoors[0].pipeM : '6'} suffix="m" inputmode="decimal" onChange=${(v) => s('indoors', [{ ...(sys.indoors[0] || blankIndoor()), pipeM: v }])} />
    </div>` : html`
      <div class="stack">
        ${sys.indoors.map((ind, j) => html`<${IndoorCard} key=${ind.id} ind=${ind} i=${j} sys=${sys} price=${price} built=${built} quick=${quick}
          onChange=${(ni) => s('indoors', sys.indoors.map((x) => (x.id === ind.id ? ni : x)))}
          onRemove=${() => s('indoors', sys.indoors.filter((x) => x.id !== ind.id))} />`)}
        ${(sys.kind === 'multi' || sys.indoors.length === 0) && html`<button type="button" class="addrow" onClick=${() => s('indoors', [...sys.indoors, blankIndoor()])}><${Icon} name="plus" size=${18} /> Add a room to this outdoor unit</button>`}
        ${sys.kind === 'multi' && built.capacity && html`<p class=${'warnline ' + (built.capacity.ok ? 'warnline--ok' : '')}><${Icon} name=${built.capacity.ok ? 'check' : 'alert'} size=${18} /> ${built.capacity.text}</p>`}
      </div>
      ${quick ? html`<div class="toggles">
        <${Toggle} label="Remove old unit" checked=${sys.outdoor.disposal} onChange=${(v) => so('disposal', v)} />
        <${Toggle} label="New electrical circuit" checked=${sys.outdoor.supply === 'circuit'} onChange=${(v) => so('supply', v ? 'circuit' : 'spur')} />
      </div>` : html`
      <div class="subhead">Outdoor unit</div>
      ${sys.kind === 'multi' && html`<${Field} label="Which outdoor unit">
        <span class="inp inp--select"><select value=${sys.outdoor.pick} onChange=${(e) => so('pick', e.currentTarget.value)} aria-label="Outdoor unit">
          <option value="auto">Best fit (${totalKw}kW over ${sys.indoors.length} room${sys.indoors.length === 1 ? '' : 's'})</option>
          ${price.multis.map((m) => html`<option value=${m.id}>${m.make} ${m.model}, ${m.kw}kW, up to ${m.maxIndoors}</option>`)}
        </select><${Icon} name="down" size=${18} class="inp__chev" /></span>
      </${Field}>`}
      ${outUnit && html`<p class="hint">${outUnit.unit.make} ${outUnit.unit.model}</p>`}
      <${Input} label="Where it goes" value=${sys.outdoor.spot} placeholder="e.g. Rear wall on a bracket at 2m, out of sight from the garden" onChange=${(v) => so('spot', v)} wide />
      <${Segmented} label="Mounted on" options=${[{ value: 'bracket', label: 'Wall bracket' }, { value: 'feet', label: 'Ground feet' }]} value=${sys.outdoor.mount} onChange=${(v) => so('mount', v)} />
      <div class="toggles">
        <${Toggle} label="Anti-vibration mounts" checked=${sys.outdoor.avm} onChange=${(v) => so('avm', v)} />
        <${Toggle} label="Guard / cage" checked=${sys.outdoor.guard} onChange=${(v) => so('guard', v)} />
        <${Toggle} label="Remove old unit" checked=${sys.outdoor.disposal} onChange=${(v) => so('disposal', v)} />
      </div>
      <div class="subhead">Electrics</div>
      <${Segmented} label="Supply" options=${[{ value: 'spur', label: 'Fused spur' }, { value: 'circuit', label: 'New circuit' }, { value: 'existing', label: 'Already there' }]} value=${sys.outdoor.supply} onChange=${(v) => so('supply', v)} />
      <${Input} label="Cable run" value=${sys.outdoor.cableM} suffix="m" inputmode="decimal" onChange=${(v) => so('cableM', v)} />
      <${Field} label="Photo where the outdoor unit goes" wide group>
        <${PlacePhotos} photos=${sys.outdoor.photos || []} onChange=${(p) => so('photos', p)} model=${outUnit && outUnit.unit.kw ? outdoorModelFor(outUnit.unit.kw) : outdoorModelFor(totalKw)} label="Outdoor unit" wall=${{ w: 4, h: 2.4 }} />
      </${Field}>`}
    `}
    ${!quick && html`
    <div class="subhead">Access and labour</div>
    <${Segmented} label="Access equipment" small options=${[{ value: 'none', label: 'Ladders' }, { value: 'tower', label: 'Tower' }, { value: 'scaffold', label: 'Scaffold' }, { value: 'mewp', label: 'MEWP' }]} value=${sys.access.kind} onChange=${(v) => s('access', { ...sys.access, kind: v })} />
    ${(sys.access.kind === 'tower' || sys.access.kind === 'mewp') && html`<${Input} label="Days" value=${sys.access.days} inputmode="numeric" onChange=${(v) => s('access', { ...sys.access, days: v })} />`}
    <div class="grid2">
      <${Input} label="Hours" value=${sys.hoursOverride} placeholder=${String(built.hours)} inputmode="decimal" hint="Worked out from the rules in Settings" onChange=${(v) => s('hoursOverride', v.replace(/[^\d.]/g, ''))} />
      <${Input} label="Engineers" value=${sys.engineers} placeholder=${String(built.engineers)} inputmode="numeric" onChange=${(v) => s('engineers', v.replace(/\D/g, ''))} />
    </div>
    <div class="subhead">Build-up (${TIERS.find((t) => t.id === tier).label} option)</div>
    <${BuildUp} sys=${sys} built=${built} onChange=${onChange} showCost=${showCost} />`}
  </div>`;
}

// ---------- service contract ----------

function ServiceBlock({ job, q, price, sq }) {
  const [sites, setSites] = useState([]);
  useEffect(() => { allSites().then(setSites); }, []);
  const svc = q.service;
  const set = (k, v) => sq('service', { ...svc, [k]: v });
  const site = sites.find((x) => norm(x.address || x.name) === norm(job.site.address || job.site.name));
  const p = priceQuote(q, price);
  return html`<div class="stack">
    ${site && site.units.length > 0 && !svc.units.length && html`<button class="btn btn--soft btn--block" onClick=${() => set('units', site.units.map((u) => ({ id: uid(), label: [u.make, u.model, u.location].filter(Boolean).join(', ') })))}>
      <${Icon} name="download" size=${18} /> Load the ${site.units.length} units we've recorded at this site</button>`}
    <${Field} label="Units covered" wide group>
      <div class="materials">
        ${svc.units.map((u, i) => html`<div class="materials__row" key=${u.id}>
          <input class="materials__item" placeholder="e.g. Daikin FTXM35, reception" value=${u.label} onInput=${(e) => set('units', svc.units.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)))} aria-label="Unit" />
          <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove" onClick=${() => set('units', svc.units.filter((_, j) => j !== i))}><${Icon} name="x" size=${18} /></button>
        </div>`)}
        <button type="button" class="addrow" onClick=${() => set('units', [...svc.units, { id: uid(), label: '' }])}><${Icon} name="plus" size=${18} /> Add unit</button>
      </div>
    </${Field}>
    <${Input} label="Visits a year" value=${svc.visits} inputmode="numeric" placeholder="As per level" onChange=${(v) => set('visits', v.replace(/\D/g, ''))} />
    <div class="opts">
      ${p.options.map((o) => { const l = o.systems[0].serviceLevel; return html`<div class=${'opt' + (q.recommended === o.tier.id ? ' is-rec' : '')} key=${o.tier.id}>
        <div class="opt__head"><b>${o.tier.id === 'good' ? 'Bronze' : o.tier.id === 'better' ? 'Silver' : 'Gold'}</b>${q.recommended === o.tier.id && html`<span class="opt__rec">Recommended</span>`}</div>
        <div class="opt__total">${fmtGBP0(o.total)}<small>a year inc VAT</small></div>
        <ul class="opt__units"><li>${l.visits} visit${l.visits > 1 ? 's' : ''} a year, ${l.n} unit${l.n === 1 ? '' : 's'}</li><li>${l.response} call-out response</li>${parseFloat(l.callout) > 0 && html`<li>${l.callout}% off call-outs</li>`}${parseFloat(l.parts) > 0 && html`<li>${l.parts}% off parts</li>`}</ul>
      </div>`; })}
    </div>
    <${TextArea} label="Notes" value=${svc.notes} rows=${2} onChange=${(v) => set('notes', v)} />
  </div>`;
}

// ---------- repair / small works ----------

function WorksBlock({ q, price, sq }) {
  const [jobs, setJobs] = useState([]);
  const [pick, setPick] = useState(false);
  useEffect(() => { allJobs().then((j) => setJobs(j.filter((x) => x.type !== 'quote' && x.type !== 'rams' && (x.data?.recommendations || x.data?.workDone)))); }, []);
  const w = q.works;
  const set = (k, v) => sq('works', { ...w, [k]: v });
  const fromJob = (j) => {
    const text = j.data.recommendations || j.data.workDone || '';
    const lines = text.split(/\n|\. /).map((t) => t.trim()).filter(Boolean).map((t) => ({ id: uid(), label: t, qty: '1', each: '', cost: '' }));
    sq('works', { ...w, lines: [...w.lines.filter((l) => l.label), ...lines], fromJob: j.jobNo });
    setPick(false);
    toast(`${lines.length} line${lines.length === 1 ? '' : 's'} from job ${j.jobNo}`, { icon: 'check' });
  };
  return html`<div class="stack">
    <button class="btn btn--soft btn--block" onClick=${() => setPick(true)}><${Icon} name="jobs" size=${18} /> Pull the recommendations from a job sheet</button>
    ${w.fromJob && html`<p class="hint">From job ${w.fromJob}</p>`}
    <${Field} label="Parts and work" wide group>
      <div class="materials">
        ${w.lines.map((l, i) => html`<div class="materials__row" key=${l.id}>
          <input class="materials__item" placeholder="e.g. Replace condensate pump" value=${l.label} onInput=${(e) => set('lines', w.lines.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)))} aria-label="Line" />
          <input class="materials__qty" placeholder="Qty" inputmode="decimal" value=${l.qty} onInput=${(e) => set('lines', w.lines.map((x, j) => (j === i ? { ...x, qty: e.currentTarget.value } : x)))} aria-label="Qty" />
          <input class="materials__qty" placeholder="£ each" inputmode="decimal" value=${l.each} onInput=${(e) => set('lines', w.lines.map((x, j) => (j === i ? { ...x, each: e.currentTarget.value } : x)))} aria-label="Price" />
          <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove" onClick=${() => set('lines', w.lines.filter((_, j) => j !== i))}><${Icon} name="x" size=${18} /></button>
        </div>`)}
        <button type="button" class="addrow" onClick=${() => set('lines', [...w.lines, { id: uid(), label: '', qty: '1', each: '', cost: '' }])}><${Icon} name="plus" size=${18} /> Add line</button>
      </div>
    </${Field}>
    <div class="grid2">
      <${Input} label="Labour hours" value=${w.hours} inputmode="decimal" onChange=${(v) => set('hours', v.replace(/[^\d.]/g, ''))} />
      <${Input} label="Engineers" value=${w.engineers} inputmode="numeric" onChange=${(v) => set('engineers', v.replace(/\D/g, ''))} />
    </div>
    <${Sheet} open=${pick} onClose=${() => setPick(false)} title="Which job?" tall>
      <div class="libpick">${jobs.map((j) => html`<button type="button" class="libpick__item" onClick=${() => fromJob(j)}>
        <span class="libpick__name">${j.jobNo}, ${j.client.name || j.site.name}</span><span class="libpick__meta">${(j.data.recommendations || j.data.workDone || '').slice(0, 90)}</span></button>`)}
        ${!jobs.length && html`<p class="hint">No job sheets with recommendations yet.</p>`}</div>
    </${Sheet}>
  </div>`;
}

// ---------- options ----------

function OptionsPanel({ q, price, sq, showCost, setShowCost }) {
  const p = priceQuote(q, price);
  if (q.kind === 'install' && !q.systems.some((s) => s.kind === 'cold' || s.indoors.some((i) => roomKw(i.room) > 0))) return html`<p class="block__empty">Size a room and the prices appear here.</p>`;
  return html`<div class="stack">
    <div class="opts">
      ${p.offered.map((o) => html`<div class=${'opt' + (q.recommended === o.tier.id ? ' is-rec' : '') + (o.available ? '' : ' is-na')} key=${o.tier.id}>
        <div class="opt__head"><b>${o.tier.label}</b>${q.recommended === o.tier.id && html`<span class="opt__rec">Recommended</span>`}</div>
        <div class="opt__total">${o.available ? fmtGBP0(o.total) : 'No unit'}<small>inc VAT</small></div>
        ${q.kind === 'install' && html`<ul class="opt__units">${o.systems.flatMap((s) => s.units.filter((u) => u.role !== 'outdoor').map((u) => html`<li>${u.indoor ? (u.indoor.room.name || 'Room') + ': ' : ''}${u.unit.make} ${u.unit.model}</li>`))}</ul>`}
        <div class="opt__breakdown"><span>Materials ${fmtGBP0(o.materials)}</span><span>Labour ${fmtGBP0(o.labour)}</span>${o.extras ? html`<span>Extras ${fmtGBP0(o.extras)}</span>` : ''}${o.discount ? html`<span>Discount −${fmtGBP0(o.discount)}</span>` : ''}</div>
        ${showCost && html`<div class="opt__margin"><span>Your cost ${fmtGBP0(o.costTotal)}</span><b>Profit ${fmtGBP0(o.profit)} (${o.marginPct}%)</b></div>`}
      </div>`)}
    </div>
    <${Toggle} label="Show my costs and margin" hint="Never printed on the quote" checked=${showCost} onChange=${setShowCost} />
  </div>`;
}

// ---------- template chooser ----------

function TemplatePicker({ onPick }) {
  return html`<div class="tpl">
    <h3 class="tpl__title">What are we quoting?</h3>
    ${TEMPLATES.map((t) => html`<button type="button" class="tpl__item" key=${t.id} onClick=${() => { vibrate(); onPick(t); }}>
      <span><b>${t.label}</b><small>${t.blurb}</small></span><${Icon} name="chevron" size=${18} class="typepick__chev" />
    </button>`)}
  </div>`;
}

function QuotedVsActual({ job, settings }) {
  const [jobs, setJobs] = useState(null);
  useEffect(() => { allJobs().then(setJobs); }, []);
  if (!jobs) return null;
  const r = quotedVsActual(job, jobs, settings);
  if (!r) return null;
  const over = r.actualHours > r.quotedHours;
  return html`<div class=${'loadbox' + (over ? ' loadbox--warn' : '')}>
    <div><span>Hours priced</span><b>${r.quotedHours}</b></div>
    <div><span>Hours on site</span><b>${r.actualHours}</b></div>
    <div><span>From ${r.jobs} job sheet${r.jobs === 1 ? '' : 's'}</span><b>${over ? `${Math.round((r.actualHours - r.quotedHours) * 10) / 10} over` : 'on track'}</b></div>
  </div>`;
}

function Migrate({ q, set }) {
  useEffect(() => { set(['data'], migrateQuote(q)); }, []);
  return html`<p class="hint">Bringing this quote up to date.</p>`;
}

// ---------- sections ----------

export function quoteSections(job, { set, patch, settings }) {
  const q = job.data;
  if (!q.systems) return [{ id: 'tpl', nav: 'Start', title: 'Updating quote', body: html`<${Migrate} q=${q} set=${set} />` }];
  const price = getPrice(settings);
  const sq = (k, v) => set(['data', k], v);
  const showCost = !!q.showCost, setShowCost = (v) => sq('showCost', v);
  const validUntil = (() => { const d = new Date(job.date); d.setDate(d.getDate() + (parseInt(price.validityDays, 10) || 30)); return d.toISOString().slice(0, 10); })();

  if (!q.template) {
    return [{ id: 'tpl', nav: 'Start', title: 'New quote', body: html`<${TemplatePicker} onPick=${(t) => set(['data'], applyTemplate({ ...q }, t))} />` }];
  }
  const tpl = TEMPLATES.find((t) => t.id === q.template);
  const secs = [
    {
      id: 'job', nav: 'Quote', title: tpl ? tpl.label : 'Quote',
      body: html`<div class="stack">
        <div class="grid2">
          <${Input} label="Date" type="date" value=${job.date} onChange=${(v) => set(['date'], v)} />
          <${Input} label="Quote number" value=${job.jobNo} inputmode="numeric" onChange=${(v) => set(['jobNo'], v)} />
          <${Input} label="Title" value=${q.title} placeholder=${tpl && tpl.kind === 'service' ? 'e.g. Annual maintenance, All Saints Primary' : 'e.g. Air conditioning for the ground floor offices'} onChange=${(v) => sq('title', v)} wide />
          <${Input} label="Surveyed by" value=${job.engineer} onChange=${(v) => set(['engineer'], v)} wide />
        </div>
        <p class="hint">Valid until ${fmtDate(validUntil)}${q.pipeline.revision > 1 ? `. Revision ${q.pipeline.revision}` : ''}. <button class="link link--small" onClick=${async () => { if (await ask({ title: 'Start again with a different template?', body: 'Rooms and systems entered so far will be cleared.', ok: 'Start again', danger: true })) sq('template', ''); }}>Change template</button></p>
        ${hasExamples(price) && html`<p class="warnline warnline--amber"><${Icon} name="alert" size=${18} /> The price book still has example prices. Put yours in under Settings, Quotes and prices, before this goes to a customer.</p>`}
      </div>`,
    },
    { id: 'client', nav: 'Client', title: 'Client and site', body: html`<${ClientSite} job=${job} onChange=${patch} />` },
    q.quick ? { id: 'survey', nav: 'Summary', title: 'Summary', body: html`<${TextArea} label="One line for the customer" value=${q.summary} rows=${2} placeholder="e.g. Wall-mounted unit in the living room, outdoor on the side wall." onChange=${(v) => sq('summary', v)} />` } : {
      id: 'survey', nav: 'Survey', title: 'Survey',
      body: html`<div class="stack">
        <${TextArea} label="Summary for the customer" value=${q.summary} rows=${3} placeholder="Two or three lines in plain English about what you're proposing and why." onChange=${(v) => sq('summary', v)} />
        <div class="grid2">
          <${Input} label="Parking" value=${q.survey.parking} placeholder="e.g. On the drive" onChange=${(v) => sq('survey', { ...q.survey, parking: v })} />
          <${Input} label="Access" value=${q.survey.access} placeholder="e.g. Side gate, flat roof via ladder" onChange=${(v) => sq('survey', { ...q.survey, access: v })} />
          <${Input} label="Power" value=${q.survey.power} onChange=${(v) => sq('survey', { ...q.survey, power: v })} wide />
        </div>
        <${TextArea} label="Survey notes" value=${q.survey.notes} rows=${2} placeholder="Anything else you spotted" onChange=${(v) => sq('survey', { ...q.survey, notes: v })} />
      </div>`,
    },
  ];
  if (q.kind === 'install') secs.push({
    id: 'systems', nav: 'Systems', title: 'Systems',
    aside: html`<span class="count">${q.systems.length}</span>`,
    body: html`<div class="stack">
      ${q.quick && html`<p class="hint">Quick price: just the room and the basics. <button class="link link--small" onClick=${() => sq('quick', false)}>Firm it up</button> for photos, outdoor unit, electrics and the full build-up.</p>`}
      ${q.systems.map((sys, i) => html`<${SystemCard} key=${sys.id} sys=${sys} i=${i} n=${q.systems.length} price=${price} tier=${q.recommended} showCost=${showCost} quick=${!!q.quick}
        onChange=${(ns) => sq('systems', q.systems.map((x) => (x.id === sys.id ? ns : x)))}
        onRemove=${async () => { if (await ask({ title: `Remove ${sys.name || 'this system'}?`, ok: 'Remove', danger: true })) sq('systems', q.systems.filter((x) => x.id !== sys.id)); }} />`)}
      <button type="button" class="addrow addrow--big" onClick=${() => sq('systems', [...q.systems, blankSystem('split')])}><${Icon} name="plus" size=${20} /> Add another system</button>
    </div>`,
  });
  if (q.kind === 'service') secs.push({ id: 'systems', nav: 'Contract', title: 'Maintenance contract', body: html`<${ServiceBlock} job=${job} q=${q} price=${price} sq=${sq} />` });
  if (q.kind === 'works') secs.push({ id: 'systems', nav: 'Works', title: 'Parts and labour', body: html`<${WorksBlock} q=${q} price=${price} sq=${sq} />` });
  secs.push({
    id: 'options', nav: 'Price', title: q.kind === 'service' ? 'Levels and price' : 'Options and price',
    body: html`<div class="stack">
      ${q.kind !== 'service' && html`<${Chips} label="Options to offer" options=${TIERS.map((t) => t.id)} value=${q.offered} onChange=${(v) => sq('offered', v.length ? TIERS.map((t) => t.id).filter((x) => v.includes(x)) : q.offered)} />`}
      <${Segmented} label="Recommend" options=${TIERS.filter((t) => q.offered.includes(t.id)).map((t) => ({ value: t.id, label: q.kind === 'service' ? (t.id === 'good' ? 'Bronze' : t.id === 'better' ? 'Silver' : 'Gold') : t.label }))} value=${q.recommended} onChange=${(v) => sq('recommended', v)} />
      <${Input} label="Discount" value=${q.discount} suffix="%" inputmode="decimal" placeholder="None" onChange=${(v) => sq('discount', v.replace(/[^\d.]/g, ''))} />
      <${Field} label="Extras on the whole quote" hint="e.g. weekend working, parking, waste skip" wide group>
        <div class="materials">
          ${(q.extras || []).map((e, i) => html`<div class="materials__row" key=${e.id}>
            <input class="materials__item" placeholder="Description" value=${e.label} onInput=${(ev) => sq('extras', q.extras.map((x, j) => (j === i ? { ...x, label: ev.currentTarget.value } : x)))} aria-label="Extra" />
            <input class="materials__qty" placeholder="£" inputmode="decimal" value=${e.price} onInput=${(ev) => sq('extras', q.extras.map((x, j) => (j === i ? { ...x, price: ev.currentTarget.value } : x)))} aria-label="Price" />
            <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove" onClick=${() => sq('extras', q.extras.filter((_, j) => j !== i))}><${Icon} name="x" size=${18} /></button>
          </div>`)}
          <button type="button" class="addrow" onClick=${() => sq('extras', [...(q.extras || []), { id: uid(), label: '', price: '' }])}><${Icon} name="plus" size=${18} /> Add extra</button>
        </div>
      </${Field}>
      <${OptionsPanel} q=${q} price=${price} sq=${sq} showCost=${showCost} setShowCost=${setShowCost} />
    </div>`,
  });
  secs.push({
    id: 'sign', nav: 'Accept', title: 'Acceptance',
    body: html`<div class="signoff">
      <p class="hint">When the customer says yes, pick the option and get them to sign. The quote shows it as accepted, and the menu lets you start the install job and print the pick list.</p>
      <${Segmented} label="Customer accepted" options=${[{ value: '', label: 'Not yet' }, ...TIERS.filter((t) => q.offered.includes(t.id)).map((t) => ({ value: t.id, label: t.label }))]} value=${q.accepted.tier}
        onChange=${(v) => { sq('accepted', { ...q.accepted, tier: v, at: v ? Date.now() : null }); if (v) sq('pipeline', { ...q.pipeline, status: 'accepted' }); }} />
      ${q.accepted.tier && html`<${QuotedVsActual} job=${job} settings=${settings} />`}
      ${q.accepted.tier && html`<${QuotedVsActual} job=${job} settings=${settings} />`}
      ${q.accepted.tier && html`<${SignatureBox} title="Customer" sig=${job.sign.customer} namePlaceholder="Print name" onChange=${(s2) => set(['sign', 'customer'], s2)} />`}
      <${SignatureBox} title="Surveyed and priced by" sig=${job.sign.engineer} namePlaceholder="Your name" onChange=${(s2) => set(['sign', 'engineer'], s2)} />
    </div>`,
  });
  return secs;
}

export function checkQuote(job) {
  const w = [];
  const q = migrateQuote(job.data);
  if (!q.template) return ['Pick what you are quoting first'];
  if (!job.client.name) w.push('No client name');
  if (!job.site.address) w.push('No site address');
  if (!q.summary) w.push('No summary for the customer');
  if (q.kind === 'install') {
    q.systems.forEach((s) => {
      if (s.kind === 'cold' && !(parseFloat(s.cold.kw) > 0)) w.push('Cold room has no cooling duty');
      s.indoors.forEach((i) => { if (!(roomKw(i.room) > 0)) w.push(`${i.room.name || 'A room'} has no size yet`); });
    });
    if (!q.quick && !q.systems.some((s) => s.indoors.some((i) => (i.photos || []).some((p) => p.overlayUrl)) || (s.outdoor.photos || []).some((p) => p.overlayUrl))) w.push('No photo with a unit placed on it');
  }
  if (q.kind === 'service' && !(q.service && q.service.units.length)) w.push('No units on the contract');
  if (q.kind === 'works' && !(q.works && q.works.lines.some((l) => l.label))) w.push('No lines on the quote');
  return w;
}

// ---------- Settings: price book ----------

export function PriceSettings({ settings, save }) {
  const price = getPrice(settings);
  const setP = (patch) => save({ ...settings, price: { ...price, ...patch } });
  const setUnit = (id, patch) => setP({ units: price.units.map((x) => (x.id === id ? { ...x, ...patch, example: false } : x)) });
  const setMulti = (id, patch) => setP({ multis: price.multis.map((x) => (x.id === id ? { ...x, ...patch, example: false } : x)) });
  const setItem = (id, patch) => setP({ items: price.items.map((x) => (x.id === id ? { ...x, ...patch, example: false } : x)) });
  const setH = (k, v) => setP({ hours: { ...price.hours, [k]: v.replace(/[^\d.]/g, '') } });
  const [tier, setTier] = useState('better');
  const [tab, setTab] = useState('units');
  const csvRef = useRef();
  const importCSV = async (files) => {
    const f = files && files[0]; if (!f) return;
    const r = parsePriceCSV(await f.text());
    if (r.errors.length) return toast(r.errors[0], { icon: 'alert', ms: 4500 });
    const ok = await ask({ title: `Import ${r.units.length} units?`, body: 'They are added to your price book. Units with the same make and model are replaced.', ok: 'Import' });
    if (!ok) return;
    const keep = price.units.filter((u) => !r.units.some((n) => norm(n.make + n.model) === norm(u.make + u.model)));
    setP({ units: [...keep, ...r.units] });
    toast(`${r.units.length} units imported`, { icon: 'check' });
  };
  const money = (k, label, suffix, hint) => html`<${Input} label=${label} value=${price[k]} suffix=${suffix} inputmode="decimal" hint=${hint} onChange=${(v) => setP({ [k]: v.replace(/[^\d.]/g, '') })} />`;
  return html`<section class="setblock">
    <h2 class="setblock__title">Quotes and prices</h2>
    ${hasExamples(price) ? html`<p class="warnline warnline--amber"><${Icon} name="alert" size=${18} /> Example prices to get you started. Edit a line and it stops being an example. Or import your wholesaler's sheet below.</p>` : html`<p class="hint">Your price book. Every quote is built from it.</p>`}
    <div class="filters" role="tablist">
      ${[['units', 'Units'], ['multis', 'Multi outdoors'], ['items', 'Materials'], ['rates', 'Rates and labour'], ['service', 'Service levels'], ['terms', 'Terms']].map(([k, l]) => html`<button role="tab" class=${'filter' + (tab === k ? ' is-on' : '')} onClick=${() => setTab(k)}>${l}</button>`)}
    </div>
    ${tab === 'units' && html`<div class="stack">
      <div class="setactions"><button class="setaction" onClick=${() => csvRef.current.click()}><${Icon} name="sheet" /><span><b>Import a price sheet (CSV)</b><small>Columns: Make, Model, Type, Tier, kW cool, kW heat, Cost, Multi cost, SEER, SCOP, dB in, dB out, Features. Any order, extra columns ignored.</small></span></button></div>
      <input type="file" accept=".csv,text/csv" hidden ref=${csvRef} onChange=${(e) => { importCSV(e.currentTarget.files); e.currentTarget.value = ''; }} />
      <${Segmented} label="" small options=${TIERS.map((t) => ({ value: t.id, label: t.label }))} value=${tier} onChange=${setTier} />
      <p class="hint">${TIERS.find((t) => t.id === tier).blurb}. Cost is the system price you pay (indoor and outdoor). Multi cost is the indoor on its own for multi-splits.</p>
      ${price.units.filter((x) => x.tier === tier).sort((a, b) => (a.type || '').localeCompare(b.type || '') || a.kwCool - b.kwCool).map((x) => html`<div class="ucard" key=${x.id}>
        <div class="ucard__row">
          <input class="ucard__kw" value=${x.kwCool} inputmode="decimal" aria-label="kW cooling" onInput=${(e) => setUnit(x.id, { kwCool: parseFloat(e.currentTarget.value) || 0 })} /><span class="ucard__u">kW</span>
          <input class="ucard__make" value=${x.make} placeholder="Make" aria-label="Make" onInput=${(e) => setUnit(x.id, { make: e.currentTarget.value })} />
          <input class="ucard__model" value=${x.model} placeholder="Model" aria-label="Model" onInput=${(e) => setUnit(x.id, { model: e.currentTarget.value })} />
          <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove unit" onClick=${() => setP({ units: price.units.filter((y) => y.id !== x.id) })}><${Icon} name="x" size=${18} /></button>
        </div>
        <div class="ucard__row ucard__row--small">
          <select value=${x.type || 'Wall mounted'} aria-label="Type" onChange=${(e) => setUnit(x.id, { type: e.currentTarget.value })}>${INDOOR_TYPES.map((t) => html`<option>${t}</option>`)}</select>
          <label>£<input value=${x.cost} inputmode="decimal" placeholder="cost" aria-label="Cost" onInput=${(e) => setUnit(x.id, { cost: e.currentTarget.value.replace(/[^\d.]/g, '') })} /></label>
          <label>multi £<input value=${x.multiCost} inputmode="decimal" placeholder="indoor" aria-label="Multi cost" onInput=${(e) => setUnit(x.id, { multiCost: e.currentTarget.value.replace(/[^\d.]/g, '') })} /></label>
          <label>heat<input value=${x.kwHeat} inputmode="decimal" aria-label="kW heating" onInput=${(e) => setUnit(x.id, { kwHeat: parseFloat(e.currentTarget.value) || 0 })} /></label>
        </div>
        <div class="ucard__row ucard__row--small">
          <label>SEER<input value=${x.seer} inputmode="decimal" aria-label="SEER" onInput=${(e) => setUnit(x.id, { seer: e.currentTarget.value })} /></label>
          <label>SCOP<input value=${x.scop} inputmode="decimal" aria-label="SCOP" onInput=${(e) => setUnit(x.id, { scop: e.currentTarget.value })} /></label>
          <label>dB in<input value=${x.dbIn} inputmode="decimal" aria-label="dB indoor" onInput=${(e) => setUnit(x.id, { dbIn: e.currentTarget.value })} /></label>
          <label>dB out<input value=${x.dbOut} inputmode="decimal" aria-label="dB outdoor" onInput=${(e) => setUnit(x.id, { dbOut: e.currentTarget.value })} /></label>
        </div>
        <input class="ucard__feat" value=${x.features} placeholder="Selling points, printed on the quote" aria-label="Features" onInput=${(e) => setUnit(x.id, { features: e.currentTarget.value })} />
      </div>`)}
      <button type="button" class="addrow" onClick=${() => setP({ units: [...price.units, { id: uid(), tier, kwCool: 3.5, kwHeat: 4, cost: '', multiCost: '', make: '', model: '', type: 'Wall mounted', seer: '', scop: '', dbIn: '', dbOut: '', refrigerant: 'R32', features: '' }] })}><${Icon} name="plus" size=${18} /> Add a ${tier} unit</button>
    </div>`}
    ${tab === 'multis' && html`<div class="stack stack--tight">
      <p class="hint">Outdoor units for multi-splits. The app picks the smallest that takes the number of rooms at up to 130% connected capacity.</p>
      ${price.multis.sort((a, b) => a.kw - b.kw).map((m) => html`<div class="unitrow" key=${m.id}>
        <input class="unitrow__kw" value=${m.kw} inputmode="decimal" aria-label="kW" onInput=${(e) => setMulti(m.id, { kw: parseFloat(e.currentTarget.value) || 0 })} />
        <input class="unitrow__make" value=${m.make} placeholder="Make" aria-label="Make" onInput=${(e) => setMulti(m.id, { make: e.currentTarget.value })} />
        <input class="unitrow__model" value=${m.model} placeholder="Model" aria-label="Model" onInput=${(e) => setMulti(m.id, { model: e.currentTarget.value })} />
        <input class="unitrow__cost" value=${m.cost} inputmode="decimal" placeholder="£" aria-label="Cost" onInput=${(e) => setMulti(m.id, { cost: e.currentTarget.value.replace(/[^\d.]/g, '') })} />
        <input class="unitrow__feat" value=${m.maxIndoors} inputmode="numeric" placeholder="Max rooms" aria-label="Max indoors" onInput=${(e) => setMulti(m.id, { maxIndoors: parseInt(e.currentTarget.value, 10) || 2 })} />
        <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove" onClick=${() => setP({ multis: price.multis.filter((y) => y.id !== m.id) })}><${Icon} name="x" size=${18} /></button>
      </div>`)}
      <button type="button" class="addrow" onClick=${() => setP({ multis: [...price.multis, { id: uid(), kw: 5, maxIndoors: 2, cost: '', make: '', model: '', refrigerant: 'R32' }] })}><${Icon} name="plus" size=${18} /> Add outdoor unit</button>
    </div>`}
    ${tab === 'items' && html`<div class="stack stack--tight">
      ${price.items.map((x) => html`<div class="materials__row" key=${x.id}>
        <input class="materials__item" value=${x.label} aria-label="Item" onInput=${(e) => setItem(x.id, { label: e.currentTarget.value })} />
        <span class="hint">${x.unit}</span>
        <input class="materials__qty" value=${x.cost} inputmode="decimal" aria-label="Cost" placeholder="£" onInput=${(e) => setItem(x.id, { cost: e.currentTarget.value.replace(/[^\d.]/g, '') })} />
      </div>`)}
      <div class="subhead">Cold room kit</div>
      ${price.coldUnits.map((x) => html`<div class="materials__row" key=${x.id}>
        <input class="materials__item" value=${`${x.make} ${x.model}`} aria-label="Unit" onInput=${(e) => { const [make, ...rest] = e.currentTarget.value.split(' '); setP({ coldUnits: price.coldUnits.map((y) => (y.id === x.id ? { ...y, make, model: rest.join(' '), example: false } : y)) }); }} />
        <span class="hint">${x.kind} ${x.kw}kW</span>
        <input class="materials__qty" value=${x.cost} inputmode="decimal" aria-label="Cost" onInput=${(e) => setP({ coldUnits: price.coldUnits.map((y) => (y.id === x.id ? { ...y, cost: e.currentTarget.value.replace(/[^\d.]/g, ''), example: false } : y)) })} />
      </div>`)}
    </div>`}
    ${tab === 'rates' && html`<div class="stack">
      <div class="grid2">
        ${money('markupEquip', 'Mark-up on units', '%')}${money('markupSundries', 'Mark-up on materials', '%')}
        ${money('labourRate', 'Labour rate charged', '£/hr')}${money('overhead', 'Overhead and profit', '%', 'Added on top of everything')}
        ${money('contingency', 'Contingency', '%')}${money('vat', 'VAT', '%')}
        ${money('validityDays', 'Quote valid for', 'days')}${money('deposit', 'Deposit on acceptance', '%')}
        ${money('tariff', 'Electricity price', '£/kWh', 'For the running cost line')}${money('warrantyYears', 'Parts warranty', 'yrs')}${money('workmanshipYears', 'Workmanship guarantee', 'yrs')}
      </div>
      <div class="subhead">Labour rules (hours)</div>
      <div class="grid2">
        ${[['firstIndoor', 'First indoor unit'], ['extraIndoor', 'Each extra indoor'], ['cassette', 'Extra for a cassette'], ['ducted', 'Extra for ducted'], ['floor', 'Extra for floor unit'], ['multiOutdoor', 'Extra for multi outdoor'], ['coldRoom', 'Cold room install'], ['serviceVisitPerUnit', 'Service visit, per unit']].map(([k, l]) => html`<${Input} label=${l} value=${price.hours[k]} suffix="hrs" inputmode="decimal" onChange=${(v) => setH(k, v)} />`)}
      </div>
    </div>`}
    ${tab === 'service' && html`<div class="stack">
      <p class="hint">Per unit, per visit. The quote offers all three levels.</p>
      ${['bronze', 'silver', 'gold'].map((lvl) => html`<div class="stack stack--tight" key=${lvl}>
        <div class="subhead">${lvl[0].toUpperCase() + lvl.slice(1)}</div>
        <div class="grid2">
          ${[['perVisit', 'Per unit per visit', '£'], ['visits', 'Visits a year', ''], ['callout', 'Call-out discount', '%'], ['parts', 'Parts discount', '%']].map(([k, l, suf]) => html`<${Input} label=${l} value=${price.service[lvl][k]} suffix=${suf} inputmode="decimal" onChange=${(v) => setP({ service: { ...price.service, [lvl]: { ...price.service[lvl], [k]: v.replace(/[^\d.]/g, '') } } })} />`)}
          <${Input} label="Response" value=${price.service[lvl].response} onChange=${(v) => setP({ service: { ...price.service, [lvl]: { ...price.service[lvl], response: v } } })} wide />
        </div>
      </div>`)}
      <${Input} label="Minimum annual charge" value=${price.service.minimum} suffix="£" inputmode="decimal" onChange=${(v) => setP({ service: { ...price.service, minimum: v.replace(/[^\d.]/g, '') } })} />
    </div>`}
    ${tab === 'terms' && html`<div class="stack">
      <${TextArea} label="Terms printed on every quote" value=${price.terms} rows=${7} onChange=${(v) => setP({ terms: v })} />
      <${TextArea} label="Exclusions" value=${price.exclusions} rows=${3} onChange=${(v) => setP({ exclusions: v })} />
    </div>`}
  </section>`;
}
