// The job forms. Each returns a list of sections for the editor to lay out.

import { html, useState } from '../vendor/preact-htm.js';
import { Icon, Input, TextArea, Suggest, Segmented, Toggle, Field, Chips, Stepper, Sheet, Select, AddInline, ask, toast } from './ui.js';
import { useList, merge, addToList, useCustomHazards, saveCustomHazard } from './lists.js';
import { ClientSite, TimeBlock, Photos, SignatureBox, MaterialsList, NextService } from './components.js';
import {
  SERVICE_TYPES, VRF_JOB_TYPES, COMPLETION, UNIT_TYPES, MAKES, GASES, PIPE_SIZES, CHECK_STATUSES,
  SERVICE_CHECKS, VRF_CHECKS, blankUnit, MS_TOOLS, AT_RISK, SEVERITY, PROBABILITY, riskBand,
  HAZARD_LIBRARY, hazardFromLibrary, blankHazard,
} from './schema.js';
import { uid, vibrate } from './util.js';

// Immutable deep set: setIn(obj, ['data','unit','make'], 'Daikin')
export function setIn(obj, path, value) {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const base = Array.isArray(obj) ? [...obj] : { ...obj };
  base[k] = setIn(obj ? obj[k] : undefined, rest, value);
  return base;
}

export { Select };

// ---------- shared sections ----------

function JobDetails({ job, set, engineers, extra }) {
  return html`<div class="grid2">
    <${Input} label="Date" type="date" value=${job.date} onChange=${(v) => set(['date'], v)} />
    <${Input} label="Job number" value=${job.jobNo} inputmode="numeric" onChange=${(v) => set(['jobNo'], v)} />
    <${Suggest} label="Engineer" value=${job.engineer} options=${engineers} wide
      onChange=${(v) => { set(['engineer'], v); }} />
    ${extra}
  </div>`;
}

const clientSiteSection = (job, set, patch, onLoadUnits) => ({
  id: 'client', nav: 'Client', title: 'Client and site',
  body: html`<${ClientSite} job=${job} onChange=${patch} onLoadUnits=${onLoadUnits} />`,
});

const timeSection = (job, set) => ({
  id: 'time', nav: 'Time', title: 'Time and travel',
  body: html`<${TimeBlock} time=${job.time} onChange=${(t) => set(['time'], t)} />`,
});

const photoSection = (job, set) => ({
  id: 'photos', nav: 'Photos', title: 'Photos',
  aside: job.photos.length ? html`<span class="count">${job.photos.length}</span>` : null,
  body: html`<${Photos} photos=${job.photos} onChange=${(p) => set(['photos'], p)} />`,
});

const signSection = (job, set, { nextService = true } = {}) => ({
  id: 'sign', nav: 'Sign off', title: 'Sign off',
  body: html`<div class="signoff">
    ${nextService && html`<${NextService} value=${job.nextService} baseDate=${job.date} onChange=${(v) => set(['nextService'], v)} />`}
    <${SignatureBox} title="Engineer" sig=${job.sign.engineer} namePlaceholder="Engineer name"
      onChange=${(s) => set(['sign', 'engineer'], s)} />
    <${SignatureBox} title="Customer" sig=${job.sign.customer} namePlaceholder="Print name" allowUnavailable
      onChange=${(s) => set(['sign', 'customer'], s)} />
  </div>`,
});

// ---------- checklist ----------

const statusTone = (st) => (st === 'Fail' ? 'bad' : st === 'N/A' ? 'na' : !st ? '' : CHECK_STATUSES.includes(st) ? 'good' : 'custom');

// Check list with your own results ("Other") and your own extra checks ("Add a check").
function Checklist({ list, checks, onChange, extra = [], onExtra, listKey }) {
  const statuses = merge(CHECK_STATUSES, useList('checkStatus'));
  const remembered = useList(listKey);
  const [addingStatus, setAddingStatus] = useState(null);
  const [addingCheck, setAddingCheck] = useState(false);
  const all = [...list, ...extra.map((e) => ({ ...e, extra: true }))];
  const setOne = (id, patch) => onChange({ ...checks, [id]: { status: '', note: '', ...checks[id], ...patch } });
  const dl = 'dl-' + listKey;
  const offered = remembered.filter((r) => !all.some((c) => c.label.toLowerCase() === r.toLowerCase()));
  const addCheck = async (text) => {
    const label = await addToList(listKey, text, list.map((c) => c.label));
    onExtra([...extra, { id: 'x-' + uid(), label }]);
    setAddingCheck(false);
  };
  return html`<div class="stack stack--tight">
    <ol class="checks">
      ${all.map((c) => {
        const v = checks[c.id] || { status: '', note: '' };
        const tone = statusTone(v.status);
        const opts = merge(statuses, v.status ? [v.status] : []);
        return html`<li class=${'check' + (tone ? ' check--' + tone : '')} key=${c.id}>
          <div class="check__label">${c.label}
            ${c.extra && html`<button type="button" class="check__remove" aria-label=${'Remove check: ' + c.label}
              onClick=${() => onExtra(extra.filter((e) => e.id !== c.id))}><${Icon} name="x" size=${16} /></button>`}
          </div>
          <div class="check__opts" role="radiogroup" aria-label=${c.label}>
            ${opts.map((st) => html`<button type="button" role="radio" aria-checked=${v.status === st}
              class=${'pill' + (v.status === st ? ' is-on pill--' + statusTone(st) : '')}
              onClick=${() => { vibrate(); setOne(c.id, { status: v.status === st ? '' : st }); }}>${st}</button>`)}
            ${addingStatus !== c.id && html`<button type="button" class="pill addpill" onClick=${() => setAddingStatus(c.id)}>
              <${Icon} name="plus" size=${15} stroke=${2.2} />Other</button>`}
          </div>
          ${addingStatus === c.id && html`<${AddInline} placeholder="Your own result, e.g. Topped up"
            onCancel=${() => setAddingStatus(null)}
            onAdd=${async (t) => { const st = await addToList('checkStatus', t, CHECK_STATUSES); setOne(c.id, { status: st }); setAddingStatus(null); }} />`}
          ${(v.status === 'Fail' || v.note) && html`<input class="check__note" placeholder="What did you find?"
            value=${v.note} onInput=${(e) => setOne(c.id, { note: e.currentTarget.value })} aria-label="Note" />`}
        </li>`;
      })}
    </ol>
    ${addingCheck
      ? html`<${AddInline} placeholder="Describe the check" list=${dl} onAdd=${addCheck} onCancel=${() => setAddingCheck(false)} />`
      : html`<button type="button" class="addrow" onClick=${() => setAddingCheck(true)}><${Icon} name="plus" size=${18} /> Add a check</button>`}
    ${offered.length > 0 && !addingCheck && html`<span class="chips chips--recent">
      <span class="chips__label">Used before</span>
      ${offered.slice(0, 6).map((t) => html`<button type="button" class="chip chip--small" onClick=${() => addCheck(t)}><${Icon} name="plus" size=${14} stroke=${2.2} />${t}</button>`)}
    </span>`}
    <datalist id=${dl}>${offered.map((t) => html`<option value=${t} />`)}</datalist>
  </div>`;
}

const allPass = (list, checks, status = 'Pass') =>
  Object.fromEntries(list.map((c) => [c.id, { note: '', ...(checks[c.id] || {}), status: checks[c.id]?.status || status }]));

// ---------- SERVICE SHEET ----------

export function serviceSections(job, { set, patch, engineers }) {
  const d = job.data;
  const sd = (k, v) => set(['data', k], v);
  return [
    {
      id: 'job', nav: 'Job', title: 'Job details',
      body: html`<${JobDetails} job=${job} set=${set} engineers=${engineers} extra=${html`
        <${Segmented} label="Visit type" options=${SERVICE_TYPES} listKey="serviceTypes" value=${d.serviceType} onChange=${(v) => sd('serviceType', v)} small />
        <div class="toggles field--wide">
          <${Toggle} label="Emergency" checked=${d.emergency} onChange=${(v) => sd('emergency', v)} />
          <${Toggle} label="Under warranty" checked=${d.warranty} onChange=${(v) => sd('warranty', v)} />
        </div>`} />`,
    },
    clientSiteSection(job, set, patch, (units) => {
      const u = units[0];
      sd('unit', { ...d.unit, make: u.make, model: u.model, serial: u.serial, location: u.location });
    }),
    {
      id: 'unit', nav: 'Unit', title: 'Unit',
      body: html`<div class="grid2">
        <${Suggest} label="Make" value=${d.unit.make} options=${MAKES} listKey="makes" onChange=${(v) => sd('unit', { ...d.unit, make: v })} />
        <${Input} label="Model" value=${d.unit.model} onChange=${(v) => sd('unit', { ...d.unit, model: v })} />
        <${Input} label="Serial number" value=${d.unit.serial} onChange=${(v) => sd('unit', { ...d.unit, serial: v })} />
        <${Input} label="Unit number" value=${d.unit.unitNo} placeholder="If labelled" onChange=${(v) => sd('unit', { ...d.unit, unitNo: v })} />
        <${Input} label="Unit location" value=${d.unit.location} placeholder="e.g. Server room" onChange=${(v) => sd('unit', { ...d.unit, location: v })} wide />
        <${Segmented} label="Refrigerant" options=${GASES} listKey="gases" value=${d.unit.gas} onChange=${(v) => sd('unit', { ...d.unit, gas: v })} small />
      </div>`,
    },
    {
      id: 'work', nav: 'Work', title: 'Work carried out',
      body: html`<div class="stack">
        <${TextArea} label="What did you find and do?" value=${d.workDone} rows=${4}
          placeholder="e.g. Noisy pump on the indoor unit. Swapped for a new pump. Tested, all working."
          onChange=${(v) => sd('workDone', v)} />
        <${Field} label="Materials used" wide group><${MaterialsList} items=${d.materials} onChange=${(v) => sd('materials', v)} /></${Field}>
        <${Segmented} label="Job status" options=${COMPLETION} listKey="completion" value=${d.completion} onChange=${(v) => sd('completion', v)} />
        <${TextArea} label="Recommendations or further work" value=${d.recommendations} rows=${2}
          placeholder="Optional, e.g. Outdoor unit casing corroding, quote to follow" onChange=${(v) => sd('recommendations', v)} />
      </div>`,
    },
    {
      id: 'checks', nav: 'Checks', title: 'Check list',
      aside: html`<button class="link" onClick=${() => { vibrate(); sd('checks', { ...d.checks, ...allPass([...SERVICE_CHECKS, ...(d.extraChecks || [])], d.checks) }); }}>Mark rest as Pass</button>`,
      body: html`<div class="stack">
        <${Checklist} list=${SERVICE_CHECKS} checks=${d.checks} onChange=${(v) => sd('checks', v)}
          extra=${d.extraChecks || []} onExtra=${(v) => sd('extraChecks', v)} listKey="serviceChecks" />
        <${Input} label="Running temperatures" value=${d.runningTemp} suffix="°C" inputmode="decimal" placeholder="e.g. 7"
          onChange=${(v) => sd('runningTemp', v)} />
      </div>`,
    },
    timeSection(job, set),
    photoSection(job, set),
    signSection(job, set),
  ];
}

// ---------- MULTI-UNIT / VRF ----------

const QUICK = ['Cleaned', 'Pump working', 'Filters replaced'];

function UnitCard({ u, i, onChange, onRemove, onCopy }) {
  const s = (k, v) => onChange({ ...u, [k]: v });
  const quick = merge(QUICK, useList('quickComments'));
  const [adding, setAdding] = useState(false);
  const addPhrase = (t) => s('comment', u.comment ? (u.comment.toLowerCase().includes(t.toLowerCase()) ? u.comment : u.comment + ', ' + t.charAt(0).toLowerCase() + t.slice(1)) : t);
  return html`<div class="unit">
    <div class="unit__head">
      <span class="unit__num">${i + 1}</span>
      <span class="unit__title">${[u.make, u.model].filter(Boolean).join(' ') || 'New unit'}</span>
      <button type="button" class="iconbtn iconbtn--muted" onClick=${onCopy} aria-label="Duplicate unit"><${Icon} name="copy" size=${19} /></button>
      <button type="button" class="iconbtn iconbtn--muted" onClick=${onRemove} aria-label="Remove unit"><${Icon} name="trash" size=${19} /></button>
    </div>
    <div class="grid2">
      <${Suggest} label="Make" value=${u.make} options=${MAKES} listKey="makes" onChange=${(v) => s('make', v)} />
      <${Input} label="Indoor model" value=${u.model} onChange=${(v) => s('model', v)} />
      <${Input} label="Location" value=${u.location} placeholder="e.g. Reception" onChange=${(v) => s('location', v)} />
      <${Select} label="Unit type" value=${u.type} options=${UNIT_TYPES} listKey="unitTypes" onChange=${(v) => s('type', v)} />
      <${Input} label="Comment" value=${u.comment} placeholder="e.g. Cleaned, pump working" onChange=${(v) => s('comment', v)} wide />
      <${Input} label="Temperature" value=${u.temp} suffix="°C" inputmode="decimal" onChange=${(v) => s('temp', v)} />
      <span class="unit__quick field">
        <span class="field__label">Quick add</span>
        <span class="chips">
          ${quick.map((t) => html`<button type="button" class="chip chip--small" onClick=${() => { vibrate(); addPhrase(t); }}>${t}</button>`)}
          ${!adding && html`<button type="button" class="chip chip--small addpill" onClick=${() => setAdding(true)}><${Icon} name="plus" size=${14} stroke=${2.2} />Add phrase</button>`}
        </span>
        ${adding && html`<${AddInline} placeholder="e.g. Drain flushed" onCancel=${() => setAdding(false)}
          onAdd=${async (t) => { const v = await addToList('quickComments', t, QUICK); addPhrase(v); setAdding(false); }} />`}
      </span>
    </div>
  </div>`;
}

export function vrfSections(job, { set, patch, engineers }) {
  const d = job.data;
  const sd = (k, v) => set(['data', k], v);
  const units = d.units;
  const setUnit = (i, u) => sd('units', units.map((x, j) => (j === i ? u : x)));
  return [
    {
      id: 'job', nav: 'Job', title: 'Job details',
      body: html`<${JobDetails} job=${job} set=${set} engineers=${engineers} extra=${html`
        <${Segmented} label="Job type" options=${VRF_JOB_TYPES} listKey="vrfJobTypes" value=${d.jobType} onChange=${(v) => sd('jobType', v)} />
        <${Input} label="Location" value=${d.locationDesc} placeholder="e.g. School, whole site" onChange=${(v) => sd('locationDesc', v)} wide />`} />`,
    },
    clientSiteSection(job, set, patch, (saved) =>
      sd('units', saved.map((u) => ({ ...blankUnit(), make: u.make, model: u.model, serial: u.serial, location: u.location, type: u.type || 'Wall mounted' })))),
    {
      id: 'units', nav: 'Units', title: 'Units',
      aside: html`<span class="count">${units.length}</span>`,
      body: html`<div class="stack">
        ${units.map((u, i) => html`<${UnitCard} key=${u.id} u=${u} i=${i}
          onChange=${(nu) => setUnit(i, nu)}
          onCopy=${() => { const c = { ...u, id: uid(), location: '', comment: '', temp: '' }; sd('units', [...units.slice(0, i + 1), c, ...units.slice(i + 1)]); }}
          onRemove=${async () => {
            if (!u.model && !u.location && !u.comment) return sd('units', units.filter((_, j) => j !== i));
            if (await ask({ title: `Remove unit ${i + 1}?`, ok: 'Remove', danger: true })) sd('units', units.filter((_, j) => j !== i));
          }} />`)}
        <button type="button" class="addrow addrow--big" onClick=${() => sd('units', [...units, { ...blankUnit(), make: units[units.length - 1]?.make || '' }])}>
          <${Icon} name="plus" size=${20} /> Add unit</button>
      </div>`,
    },
    {
      id: 'checks', nav: 'Checks', title: 'Engineer check list',
      aside: html`<button class="link" onClick=${() => { vibrate(); sd('checks', { ...d.checks, ...allPass([...VRF_CHECKS, ...(d.extraChecks || [])], d.checks) }); }}>Mark rest as Pass</button>`,
      body: html`<div class="stack">
        <${Checklist} list=${VRF_CHECKS} checks=${d.checks} onChange=${(v) => sd('checks', v)}
          extra=${d.extraChecks || []} onExtra=${(v) => sd('extraChecks', v)} listKey="vrfChecks" />
        <${Input} label="Running temperature range" value=${d.tempRange} suffix="°C" placeholder="e.g. 5 to 49" onChange=${(v) => sd('tempRange', v)} />
      </div>`,
    },
    {
      id: 'notes', nav: 'Notes', title: "Engineer's notes",
      body: html`<div class="stack">
        <${Segmented} label="Job status" options=${COMPLETION} listKey="completion" value=${d.completion} onChange=${(v) => sd('completion', v)} />
        <${TextArea} label="Notes" value=${d.notes} rows=${3} placeholder="e.g. Cleaned and tested all systems on site, all working."
          onChange=${(v) => sd('notes', v)} />
        <${TextArea} label="Recommendations or further work" value=${d.recommendations} rows=${2}
          placeholder="e.g. Server room Fujitsu: solenoid not opening, liquid line icing. Quote to follow." onChange=${(v) => sd('recommendations', v)} />
      </div>`,
    },
    timeSection(job, set),
    photoSection(job, set),
    signSection(job, set),
  ];
}

// ---------- COMMISSIONING ----------

export function commissioningSections(job, { set, patch, engineers }) {
  const d = job.data;
  const sd = (k, v) => set(['data', k], v);
  const dT = d.airOn !== '' && d.airOff !== '' && !isNaN(d.airOn) && !isNaN(d.airOff) ? Math.abs(Number(d.airOff) - Number(d.airOn)) : null;
  return [
    { id: 'job', nav: 'Job', title: 'Job details', body: html`<${JobDetails} job=${job} set=${set} engineers=${engineers} />` },
    clientSiteSection(job, set, patch),
    {
      id: 'system', nav: 'System', title: 'System information',
      body: html`<div class="stack">
        <div class="grid2">
          <${Suggest} label="Make" value=${d.make} options=${MAKES} listKey="makes" onChange=${(v) => sd('make', v)} wide />
        </div>
        <div class="subhead">Indoor unit</div>
        <div class="grid2">
          <${Input} label="Model" value=${d.indoor.model} onChange=${(v) => sd('indoor', { ...d.indoor, model: v })} />
          <${Input} label="Serial number" value=${d.indoor.serial} onChange=${(v) => sd('indoor', { ...d.indoor, serial: v })} />
          <${Input} label="Location" value=${d.indoor.location} placeholder="e.g. Living room" onChange=${(v) => sd('indoor', { ...d.indoor, location: v })} wide />
        </div>
        <div class="subhead">Outdoor unit</div>
        <div class="grid2">
          <${Input} label="Model" value=${d.outdoor.model} onChange=${(v) => sd('outdoor', { ...d.outdoor, model: v })} />
          <${Input} label="Serial number" value=${d.outdoor.serial} onChange=${(v) => sd('outdoor', { ...d.outdoor, serial: v })} />
          <${Input} label="Location" value=${d.outdoor.location} placeholder="e.g. External wall, bottom" onChange=${(v) => sd('outdoor', { ...d.outdoor, location: v })} wide />
        </div>
        <div class="subhead">Capacity</div>
        <div class="grid2">
          <${Input} label="Cooling" value=${d.coolKw} suffix="kW" inputmode="decimal" onChange=${(v) => sd('coolKw', v)} />
          <${Input} label="Heating" value=${d.heatKw} suffix="kW" inputmode="decimal" onChange=${(v) => sd('heatKw', v)} />
        </div>
      </div>`,
    },
    {
      id: 'refrigerant', nav: 'Refrigerant', title: 'Refrigerant',
      body: html`<div class="stack">
        <${Segmented} label="Type of gas" options=${GASES} listKey="gases" value=${d.gasType} onChange=${(v) => sd('gasType', v)} small />
        <div class="grid2">
          <${Input} label="Pressure tested to" value=${d.pressureTest} suffix="bar" inputmode="decimal" onChange=${(v) => sd('pressureTest', v)} />
          <${Input} label="Held on vacuum" value=${d.vacuumHrs} suffix="hrs" inputmode="decimal" onChange=${(v) => sd('vacuumHrs', v)} />
          <${Input} label="Vacuum reached" value=${d.vacuumMicrons} suffix="microns" inputmode="numeric" placeholder="Optional" onChange=${(v) => sd('vacuumMicrons', v)} />
          <${Input} label="Factory charge" value=${d.factoryCharge} suffix="kg" inputmode="decimal" placeholder="From data plate" onChange=${(v) => sd('factoryCharge', v)} />
          <${Input} label="Gas charge added" value=${d.gasAdded} suffix="g" inputmode="decimal" onChange=${(v) => sd('gasAdded', v)} />
          <${Input} label="Pipe length" value=${d.pipeLength} suffix="m" inputmode="decimal" onChange=${(v) => sd('pipeLength', v)} />
          <${Select} label="Suction pipe" value=${d.suction} options=${PIPE_SIZES} listKey="pipeSizes" onChange=${(v) => sd('suction', v)} />
          <${Select} label="Liquid pipe" value=${d.liquid} options=${PIPE_SIZES} listKey="pipeSizes" onChange=${(v) => sd('liquid', v)} />
        </div>
        <p class="hint">Pipe sizes in inches.</p>
      </div>`,
    },
    {
      id: 'readings', nav: 'Readings', title: 'Readings',
      body: html`<div class="stack">
        <div class="grid3">
          <${Input} label="Air on" value=${d.airOn} suffix="°C" inputmode="decimal" onChange=${(v) => sd('airOn', v)} />
          <${Input} label="Air off" value=${d.airOff} suffix="°C" inputmode="decimal" onChange=${(v) => sd('airOff', v)} />
          <div class="readout"><span class="readout__label">Difference</span><span class="readout__val">${dT != null ? dT.toFixed(1).replace(/\.0$/, '') + '°C' : '–'}</span></div>
        </div>
        <div class="grid2">
          <${Input} label="Suction pressure" value=${d.suctionPressure} suffix="bar" inputmode="decimal" onChange=${(v) => sd('suctionPressure', v)} />
          <${Input} label="Discharge pressure" value=${d.dischargePressure} suffix="bar" inputmode="decimal" placeholder="Optional" onChange=${(v) => sd('dischargePressure', v)} />
        </div>
        <${Segmented} label="Drain" options=${['Gravity', 'Pumped']} listKey="drain" value=${d.drain} onChange=${(v) => sd('drain', v)} />
        <${Segmented} label="Supply" options=${['Single phase', '3 phase']} listKey="supply" value=${d.phase} onChange=${(v) => sd('phase', v)} />
        <div class="grid2">
          <${Input} label="Voltage" value=${d.voltage} suffix="V" inputmode="numeric" onChange=${(v) => sd('voltage', v)} />
          <${Input} label="Full load amps" value=${d.flAmps} suffix="A" inputmode="decimal" onChange=${(v) => sd('flAmps', v)} />
        </div>
      </div>`,
    },
    {
      id: 'notes', nav: 'Notes', title: 'Handover',
      body: html`<div class="stack">
        <${Toggle} label="Controls and operation explained to the customer" checked=${d.handover} onChange=${(v) => sd('handover', v)} />
        <${TextArea} label="Notes" value=${d.notes} rows=${2} placeholder="Optional" onChange=${(v) => sd('notes', v)} />
      </div>`,
    },
    photoSection(job, set),
    signSection(job, set),
  ];
}

// ---------- RAMS ----------

const STD_KEYS = new Set(HAZARD_LIBRARY.map((h) => h.key));

function HazardCard({ h, i, onChange, onRemove }) {
  const [open, setOpen] = useState(!h.hazard);
  const s = (k, v) => onChange({ ...h, [k]: v });
  const r1 = h.s * h.p, r2 = h.rs * h.rp;
  const b1 = riskBand(r1), b2 = riskBand(r2);
  return html`<div class=${'hz' + (open ? ' is-open' : '')}>
    <button type="button" class="hz__head" onClick=${() => setOpen(!open)} aria-expanded=${open}>
      <span class="hz__title">${h.hazard || 'New hazard'}</span>
      <span class="hz__scores">
        <span class=${'risk risk--' + b1.band} title="Risk before controls">${r1}</span>
        <${Icon} name="chevron" size=${14} class="hz__arrow" />
        <span class=${'risk risk--' + b2.band} title="Residual risk">${r2}</span>
      </span>
      <${Icon} name="down" size=${20} class="hz__chev" />
    </button>
    ${open && html`<div class="hz__body">
      <div class="grid2">
        <${Input} label="Hazard" value=${h.hazard} placeholder="Something with the potential to cause harm" onChange=${(v) => s('hazard', v)} wide />
        <${Input} label="Cause" value=${h.cause} placeholder="How the hazard happens" onChange=${(v) => s('cause', v)} />
        <${Input} label="Effect" value=${h.effect} placeholder="Injury it could cause" onChange=${(v) => s('effect', v)} />
      </div>
      <${Segmented} label="Who's at risk" small options=${AT_RISK.map((a) => ({ value: a.id, label: a.label }))} value=${h.atRisk} onChange=${(v) => s('atRisk', v)} />
      <${TextArea} label="Existing control measures" value=${h.existing} rows=${2} hint="One per line" onChange=${(v) => s('existing', v)} />
      <div class="riskrow">
        <div class="riskrow__item"><span class="field__label">Severity</span><${Stepper} label="severity" value=${h.s} onChange=${(v) => s('s', v)} /><span class="riskrow__hint">${SEVERITY[h.s - 1]}</span></div>
        <div class="riskrow__item"><span class="field__label">Probability</span><${Stepper} label="probability" value=${h.p} onChange=${(v) => s('p', v)} /><span class="riskrow__hint">${PROBABILITY[h.p - 1]}</span></div>
        <div class=${'riskrow__score risk--' + b1.band}><span>${r1}</span><small>${b1.label}</small></div>
      </div>
      <${TextArea} label="Further control measures" value=${h.further} rows=${2} hint="One per line" onChange=${(v) => s('further', v)} />
      <div class="riskrow">
        <div class="riskrow__item"><span class="field__label">Severity</span><${Stepper} label="residual severity" value=${h.rs} onChange=${(v) => s('rs', v)} /><span class="riskrow__hint">${SEVERITY[h.rs - 1]}</span></div>
        <div class="riskrow__item"><span class="field__label">Probability</span><${Stepper} label="residual probability" value=${h.rp} onChange=${(v) => s('rp', v)} /><span class="riskrow__hint">${PROBABILITY[h.rp - 1]}</span></div>
        <div class=${'riskrow__score risk--' + b2.band}><span>${r2}</span><small>${b2.label}</small></div>
      </div>
      ${b2.ok === 'N' && html`<p class="warnline"><${Icon} name="alert" size=${18} /> Residual risk is high. Work should not start until it's brought down.</p>`}
      <div class="hz__actions">
        ${!STD_KEYS.has(h.libKey) && html`<button type="button" class="btn btn--soft btn--small" disabled=${!h.hazard}
          onClick=${async () => {
            const key = h.libKey && h.libKey.startsWith('my-') ? h.libKey : 'my-' + uid();
            await saveCustomHazard(h, key);
            onChange({ ...h, libKey: key });
            toast(h.libKey === key ? 'Your saved hazard is updated' : 'Saved to your hazards, ready for next time', { icon: 'check' });
          }}><${Icon} name="star" size=${18} /> ${h.libKey && h.libKey.startsWith('my-') ? 'Update my saved hazard' : 'Save to my hazards'}</button>`}
        <button type="button" class="btn btn--danger-ghost btn--small" onClick=${onRemove}><${Icon} name="trash" size=${18} /> Remove hazard</button>
      </div>
    </div>`}
  </div>`;
}

function HazardPicker({ open, onClose, existing, onAdd }) {
  const have = new Set(existing.map((h) => h.libKey).filter(Boolean));
  const mine = useCustomHazards();
  return html`<${Sheet} open=${open} onClose=${onClose} title="Add a hazard" tall>
    <div class="libpick">
      <button type="button" class="libpick__item libpick__item--blank" onClick=${() => { onAdd(blankHazard()); onClose(); }}>
        <span class="libpick__name"><${Icon} name="plus" size=${18} /> Write your own</span>
      </button>
      ${mine.length > 0 && html`<div class="libpick__group">Your hazards</div>`}
      ${mine.map((h) => html`<button type="button" class="libpick__item" disabled=${have.has(h.key)}
        onClick=${() => { onAdd(hazardFromLibrary(h)); onClose(); }}>
        <span class="libpick__name">${h.hazard}</span>
        <span class="libpick__meta">${have.has(h.key) ? 'Already added' : h.cause}</span>
      </button>`)}
      ${mine.length > 0 && html`<div class="libpick__group">Standard hazards</div>`}
      ${[...HAZARD_LIBRARY].sort((a, b) => have.has(a.key) - have.has(b.key)).map((h) => html`<button type="button" class="libpick__item" disabled=${have.has(h.key)}
        onClick=${() => { onAdd(hazardFromLibrary(h)); onClose(); }}>
        <span class="libpick__name">${h.hazard}</span>
        <span class="libpick__meta">${have.has(h.key) ? 'Already added' : `${h.cause}`}</span>
      </button>`)}
    </div>
  </${Sheet}>`;
}

function HazardList({ hazards, onChange }) {
  const [pick, setPick] = useState(false);
  return html`<div class="stack">
    <div class="riskkey">
      <span><i class="risk risk--low">1–5</i> Low, work can start</span>
      <span><i class="risk risk--med">6–14</i> Medium, may need more thought</span>
      <span><i class="risk risk--high">15–25</i> High, do not start</span>
    </div>
    ${hazards.map((h, i) => html`<${HazardCard} key=${h.id} h=${h} i=${i}
      onChange=${(nh) => onChange(hazards.map((x) => (x.id === h.id ? nh : x)))}
      onRemove=${async () => { if (await ask({ title: `Remove "${h.hazard || 'this hazard'}"?`, ok: 'Remove', danger: true })) onChange(hazards.filter((x) => x.id !== h.id)); }} />`)}
    <button type="button" class="addrow addrow--big" onClick=${() => setPick(true)}><${Icon} name="plus" size=${20} /> Add hazard</button>
    <${HazardPicker} open=${pick} onClose=${() => setPick(false)} existing=${hazards} onAdd=${(h) => onChange([...hazards, h])} />
  </div>`;
}

function SequenceList({ steps, onChange }) {
  const set = (i, v) => onChange(steps.map((s, j) => (j === i ? v : s)));
  return html`<ol class="seq">
    ${steps.map((s, i) => html`<li class="seq__row" key=${i}>
      <span class="seq__n">${i + 1}</span>
      <textarea class="seq__text" rows="1" value=${s} placeholder=${i === 0 ? 'e.g. Fault find issues at the condensing unit' : 'Next step'}
        onInput=${(e) => { set(i, e.currentTarget.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}></textarea>
      ${steps.length > 1 && html`<button type="button" class="iconbtn iconbtn--muted" aria-label="Remove step" onClick=${() => onChange(steps.filter((_, j) => j !== i))}><${Icon} name="x" size=${18} /></button>`}
    </li>`)}
    <li><button type="button" class="addrow" onClick=${() => onChange([...steps, ''])}><${Icon} name="plus" size=${18} /> Add step</button></li>
  </ol>`;
}

function SignoffList({ rows, onChange }) {
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return html`<div class="stack stack--tight">
    ${rows.map((r, i) => html`<div class="materials__row" key=${r.id}>
      <input class="materials__qty materials__qty--role" value=${r.role} placeholder="Role" onInput=${(e) => set(i, { role: e.currentTarget.value })} aria-label="Role" />
      <input class="materials__item" value=${r.name} placeholder="Name" onInput=${(e) => set(i, { name: e.currentTarget.value })} aria-label="Name" />
      <button type="button" class="iconbtn iconbtn--muted" aria-label="Remove" onClick=${() => onChange(rows.filter((_, j) => j !== i))}><${Icon} name="x" size=${18} /></button>
    </div>`)}
    <button type="button" class="addrow" onClick=${() => onChange([...rows, { id: uid(), role: '', name: '' }])}><${Icon} name="plus" size=${18} /> Add person</button>
  </div>`;
}

export function ramsSections(job, { set, patch, engineers }) {
  const ms = job.data.ms, ra = job.data.ra;
  const sm = (k, v) => set(['data', 'ms', k], v);
  const sr = (k, v) => set(['data', 'ra', k], v);
  const worst = ra.hazards.reduce((m, h) => Math.max(m, h.rs * h.rp), 0);
  return [
    {
      id: 'job', nav: 'Job', title: 'Job details',
      body: html`<div class="stack">
        <${JobDetails} job=${job} set=${set} engineers=${engineers} extra=${html`
          <${Input} label="Revision" value=${ms.revision} inputmode="numeric" onChange=${(v) => sm('revision', v)} />
          <${Input} label="Review by" type="date" value=${ra.reviewDate} onChange=${(v) => sr('reviewDate', v)} />`} />
      </div>`,
    },
    clientSiteSection(job, set, patch),
    {
      id: 'works', nav: 'Works', title: 'The works',
      body: html`<div class="stack">
        <div class="grid2">
          <${Input} label="Project" value=${ms.project} placeholder="e.g. Toyland" onChange=${(v) => sm('project', v)} />
          <${Input} label="Operation" value=${ms.operation} placeholder="e.g. A/C repair" onChange=${(v) => sm('operation', v)} />
        </div>
        <${TextArea} label="Description of works" value=${ms.description} rows=${3}
          placeholder="e.g. Roof access will be needed to fault find and diagnose the issues with the A/C" onChange=${(v) => sm('description', v)} />
        <${Field} label="Sequence of works" wide group><${SequenceList} steps=${ms.sequence} onChange=${(v) => sm('sequence', v)} /></${Field}>
        <${TextArea} label="Duration" value=${ms.duration} rows=${2} onChange=${(v) => sm('duration', v)} />
      </div>`,
    },
    {
      id: 'hazards', nav: 'Hazards', title: 'Risk assessment',
      aside: worst ? html`<span class=${'risk risk--' + riskBand(worst).band}>Worst ${worst}</span>` : null,
      body: html`<div class="stack">
        <${Input} label="Assessment team" value=${ra.team} placeholder="Lead and assessors" onChange=${(v) => sr('team', v)} wide />
        <${HazardList} hazards=${ra.hazards} onChange=${(v) => sr('hazards', v)} />
        <${TextArea} label="Further actions" value=${ra.furtherActions} rows=${2} hint="Further control measures that could be put in place at the planning stage" onChange=${(v) => sr('furtherActions', v)} />
      </div>`,
    },
    {
      id: 'controls', nav: 'Controls', title: 'Controls and resources',
      body: html`<div class="stack">
        <${Chips} label="COSHH sheets for these gases" options=${GASES} listKey="gases" addLabel="Add gas" value=${ms.gases} onChange=${(v) => sm('gases', v)} />
        <${TextArea} label="Control measures" value=${ms.controls} rows=${4} onChange=${(v) => sm('controls', v)} />
        <${TextArea} label="Permits required" value=${ms.permits} rows=${2} onChange=${(v) => sm('permits', v)} />
        <${TextArea} label="Security" value=${ms.security} rows=${2} onChange=${(v) => sm('security', v)} />
        <${TextArea} label="Operatives" value=${ms.operatives} rows=${2} onChange=${(v) => sm('operatives', v)} />
        <${Input} label="Plant" value=${ms.plant} onChange=${(v) => sm('plant', v)} wide />
        <${Chips} label="Materials and tools" options=${MS_TOOLS} listKey="tools" addLabel="Add tool" value=${ms.tools} onChange=${(v) => sm('tools', v)} />
        <${TextArea} label="Welfare" value=${ms.welfare} rows=${2} onChange=${(v) => sm('welfare', v)} />
        <${TextArea} label="PPE" value=${ms.ppe} rows=${2} onChange=${(v) => sm('ppe', v)} />
      </div>`,
    },
    {
      id: 'emergency', nav: 'Emergency', title: 'Emergency procedures',
      body: html`<div class="stack">
        <${TextArea} label="Site evacuation" value=${ms.evacuation} rows=${2} onChange=${(v) => sm('evacuation', v)} />
        <${TextArea} label="First aid" value=${ms.firstAid} rows=${3} onChange=${(v) => sm('firstAid', v)} />
        <${Input} label="Changes to the method to be agreed with" value=${ms.amendmentsContact} onChange=${(v) => sm('amendmentsContact', v)} wide />
      </div>`,
    },
    {
      id: 'sign', nav: 'Sign off', title: 'Sign off',
      body: html`<div class="signoff">
        <${Field} label="Read and understood by" hint="Names print on the method statement for signing on site" wide group>
          <${SignoffList} rows=${ms.signoff} onChange=${(v) => sm('signoff', v)} />
        </${Field}>
        <${Input} label="Authorised by (responsible manager)" value=${ra.authorisedBy} onChange=${(v) => sr('authorisedBy', v)} wide />
        <${SignatureBox} title="Compiled by" sig=${job.sign.engineer} namePlaceholder="Your name" onChange=${(s) => set(['sign', 'engineer'], s)} />
      </div>`,
    },
  ];
}

export const SECTIONS = {
  service: serviceSections,
  vrf: vrfSections,
  commissioning: commissioningSections,
  rams: ramsSections,
};

// Things worth flagging before a job is finished.
export function checkJob(job) {
  const w = [];
  if (!job.jobNo) w.push('No job number');
  if (!job.client.name && job.type !== 'rams') w.push('No client name');
  if (!job.site.address) w.push('No site address');
  if (job.type === 'rams') {
    if (!job.data.ms.description) w.push('No description of works');
    if (!job.data.ra.hazards.length) w.push('No hazards in the risk assessment');
    const high = job.data.ra.hazards.filter((h) => h.rs * h.rp >= 15);
    if (high.length) w.push(`${high.length} hazard${high.length > 1 ? 's' : ''} still high risk after controls`);
    if (!job.sign.engineer.img) w.push('Not signed');
    return w;
  }
  if (job.type === 'service' && !job.data.workDone) w.push('Work carried out is empty');
  if (job.type === 'vrf' && !job.data.units.some((u) => u.model || u.location)) w.push('No units listed');
  if (job.type === 'commissioning' && !job.data.indoor.model) w.push('No indoor unit model');
  if (job.time && (!job.time.arrived || !job.time.left)) w.push('Arrival or leaving time missing');
  if (!job.sign.engineer.img) w.push('Engineer has not signed');
  const c = job.sign.customer;
  if (!c.img && !c.unavailable) w.push('Customer has not signed');
  if (c.unavailable && !c.reason) w.push('No reason given for missing customer signature');
  return w;
}
