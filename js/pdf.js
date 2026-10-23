// Builds the branded Comfyair PDFs on the phone with pdfmake.

import {
  JOB_TYPES, SERVICE_CHECKS, VRF_CHECKS, AT_RISK, riskBand, SEVERITY, PROBABILITY,
} from './schema.js';
import { fmtDateUK, fmtDuration, safeFileName, onSiteMinutes, parseISO } from './util.js';
import { hasFix, describe, mapsLink, statusLabel } from './geo.js';
import { allSites } from './store.js';
import { jobFile, packJob } from './share.js';
import { norm } from './util.js';
import { fmtMoney } from './timesheet.js';
import { SYSTEM_KINDS, ROOM_USES, roomLoad, roomKw, priceQuote, fmtGBP, fmtGBP0, getPrice, runningCost, soundWords, migrateQuote } from './quote.js';

const C = {
  navy: '#004684',
  navyDeep: '#00294F',
  orange: '#F79239',
  ink: '#152536',
  muted: '#5E6E80',
  line: '#D3DDE8',
  frost: '#F0F5FA',
  pass: '#11795A',
  fail: '#C2352B',
  na: '#7C8896',
  low: '#DDF2E8',
  med: '#FCEBCF',
  high: '#F9D9D5',
  amber: '#A86200',
  sky: '#1A78B0',
};

// ---------- library loading ----------

let libPromise = null;
const loadScript = (src) =>
  new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });

let logoData = null;
async function toDataURL(url) {
  const r = await fetch(url);
  const b = await r.blob();
  return new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(b);
  });
}

export function loadPdfLib() {
  if (!libPromise) {
    libPromise = (async () => {
      if (!window.pdfMake || !window.pdfMake.createPdf) await loadScript('vendor/pdfmake.min.js');
      const vfsBefore = window.pdfMake.vfs;
      await loadScript('vendor/pdf-fonts.js');
      if (!window.pdfMake.vfs || window.pdfMake.vfs === vfsBefore) throw new Error('Fonts did not load');
      window.pdfMake.fonts = {
        Archivo: { normal: 'Archivo-Regular.ttf', bold: 'Archivo-Bold.ttf', italics: 'Archivo-Regular.ttf', bolditalics: 'Archivo-Bold.ttf' },
        ArchivoMed: { normal: 'Archivo-Medium.ttf', bold: 'Archivo-Bold.ttf', italics: 'Archivo-Medium.ttf', bolditalics: 'Archivo-Bold.ttf' },
        ArchivoX: { normal: 'Archivo-XBold.ttf', bold: 'Archivo-XBold.ttf', italics: 'Archivo-XBold.ttf', bolditalics: 'Archivo-XBold.ttf' },
      };
      logoData = await toDataURL('assets/logo.png');
      return window.pdfMake;
    })().catch((e) => {
      libPromise = null;
      throw e;
    });
  }
  return libPromise;
}

// ---------- small builders ----------

const v = (x, unit = '') => (x === undefined || x === null || String(x).trim() === '' ? '' : String(x).trim() + unit);
const dash = (x) => (x ? x : { text: 'Not recorded', color: C.na, italics: true });
const lines = (s) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean);

const H = (text, extra = {}) => ({
  table: { widths: [3, '*'], body: [[{ text: '', fillColor: C.orange }, { text, style: 'h2', margin: [8, 1, 0, 1] }]] },
  layout: 'noBorders',
  margin: [0, 13, 0, 6],
  headlineLevel: 1,
  ...extra,
});

const zebra = (header = true) => ({
  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.6),
  vLineWidth: () => 0,
  hLineColor: () => C.line,
  fillColor: (row) => (header && row === 0 ? C.navy : row % 2 === 0 ? C.frost : null),
  paddingLeft: () => 7,
  paddingRight: () => 7,
  paddingTop: () => 4,
  paddingBottom: () => 4,
});

const thin = {
  hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => C.line, vLineColor: () => C.line,
  paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 4, paddingBottom: () => 4,
};

const th = (t, align = 'left') => ({ text: t, style: 'th', alignment: align });

// Key/value grid, two pairs per row.
function infoGrid(pairs) {
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i], b = pairs[i + 1];
    rows.push([
      { text: a[0], style: 'k' }, { text: a[1] || '', style: 'val' },
      b ? { text: b[0], style: 'k' } : '', b ? { text: b[1] || '', style: 'val' } : '',
    ]);
  }
  return {
    table: { widths: [76, '*', 76, '*'], body: rows },
    layout: {
      ...thin,
      fillColor: (r, n, col) => (col === 0 || col === 2 ? C.frost : null),
    },
  };
}

function statusText(st, note) {
  if (!st) return { text: 'Not checked', color: C.na, italics: true };
  const standard = ['Pass', 'Cleaned', 'Replaced', 'Adjusted'];
  const color = st === 'Fail' ? C.fail : st === 'N/A' ? C.na : standard.includes(st) ? C.pass : C.navy;
  return { text: [{ text: st, color, bold: true }, note ? { text: '  ' + note, color: C.ink } : ''] };
}

function checklist(list, checks) {
  return {
    table: {
      widths: ['*', 150],
      body: [
        [th('Check'), th('Result')],
        ...list.map((c) => [{ text: c.label }, statusText(checks[c.id]?.status, checks[c.id]?.note)]),
      ],
    },
    layout: zebra(),
  };
}

function photoBlock(photos) {
  if (!photos || !photos.length) return [];
  const cells = photos.map((p, i) => ({
    stack: [
      { image: p.dataUrl, fit: [250, 200], alignment: 'center' },
      { text: p.caption || `Photo ${i + 1}`, style: 'caption', margin: [0, 5, 0, 0], alignment: 'center' },
    ],
    margin: [0, 0, 0, 12],
    unbreakable: true,
  }));
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) rows.push([cells[i], cells[i + 1] || '']);
  return [
    H('Photos', { pageBreak: photos.length > 2 ? 'before' : undefined }),
    { table: { widths: ['*', '*'], body: rows, dontBreakRows: true }, layout: 'noBorders' },
  ];
}

function sigCell(title, sig, { allowUnavailable } = {}) {
  const body = [];
  body.push({ text: title, style: 'k', margin: [0, 0, 0, 4] });
  if (allowUnavailable && sig.unavailable) {
    body.push({ text: 'Not available to sign', italics: true, color: C.muted, margin: [0, 18, 0, 4] });
    if (sig.reason) body.push({ text: sig.reason, fontSize: 8.5, color: C.muted });
  } else if (sig.img) {
    body.push({ image: sig.img, fit: [200, 50], margin: [0, 0, 0, 2] });
  } else {
    body.push({ text: ' ', margin: [0, 22, 0, 0] });
  }
  body.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.7, lineColor: C.line }], margin: [0, 2, 0, 4] });
  body.push({
    columns: [
      { text: sig.name || '', bold: true, fontSize: 9.5 },
      { text: sig.at ? fmtDateUK(new Date(sig.at).toISOString().slice(0, 10)) : '', alignment: 'right', fontSize: 8.5, color: C.muted },
    ],
  });
  return { stack: body, unbreakable: true };
}

function signatures(job) {
  return [{
    stack: [
      H('Sign off'),
      {
        columns: [
          sigCell('Engineer', job.sign.engineer),
          sigCell('Customer', job.sign.customer, { allowUnavailable: true }),
        ],
        columnGap: 30,
      },
    ],
    unbreakable: true,
  }];
}

let sitesCache = [];
function pinFor(job) {
  const key = (job.site.address || job.site.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const s = sitesCache.find((x) => (x.address || x.name || '').toLowerCase().replace(/\s+/g, ' ').trim() === key);
  return s && s.pin && hasFix(s.pin) ? s.pin : null;
}
function stampText(t, loc, edited, pin) {
  if (!t) return '';
  const parts = [{ text: t }];
  if (loc && loc.status !== 'pending') {
    const d = describe(loc, pin, 'site');
    const color = d.level === 'far' ? C.fail : d.level === 'off' ? C.na : C.muted;
    parts.push({ text: '  ' + d.text, color, fontSize: 8 });
    if (hasFix(loc)) parts.push({ text: '  map', link: mapsLink(loc), color: C.sky, fontSize: 8, decoration: 'underline' });
  }
  if (edited) parts.push({ text: '  edited', color: C.amber, fontSize: 8 });
  return { text: parts };
}
function timeRow(job) {
  const t = job.time || {};
  const mins = onSiteMinutes(t);
  const pin = pinFor(job);
  return [
    ['Arrived', stampText(t.arrived, t.arrivedLoc, t.arrivedEdited, pin)], ['Left', stampText(t.left, t.leftLoc, t.leftEdited, pin)],
    ['Time on site', mins != null ? fmtDuration(mins) : ''], ['Travel', v(t.travelMins, ' mins')],
    ['Mileage', v(t.miles, ' miles')], ['Engineer', job.engineer],
  ];
}

function clientPairs(job) {
  const contact = [job.client.contact, job.client.phone].filter(Boolean).join(', ');
  return [
    ['Client', job.client.name], ['Date', fmtDateUK(job.date)],
    ['Site', [job.site.name, job.site.address].filter(Boolean).join('\n')], ['Job number', job.jobNo],
    ...(contact || job.client.email ? [['Contact', contact], ['Email', job.client.email]] : []),
  ];
}

function textBox(text, empty = 'None') {
  return {
    table: { widths: ['*'], body: [[{ text: text || empty, color: text ? C.ink : C.na, italics: !text, lineHeight: 1.3 }]] },
    layout: { ...thin, fillColor: () => null, paddingTop: () => 8, paddingBottom: () => 8, paddingLeft: () => 9 },
  };
}

// ---------- per type ----------

function serviceContent(job) {
  const d = job.data;
  const flags = [d.emergency && 'Emergency', d.warranty && 'Warranty'].filter(Boolean).join(', ') || 'No';
  const out = [
    infoGrid([
      ...clientPairs(job),
      ['Visit type', d.serviceType], ['Emergency / warranty', flags],
      ['Status', d.completion], ['Next service', job.nextService ? fmtDateUK(job.nextService) : ''],
    ]),
    H('Unit'),
    infoGrid([
      ['Make', d.unit.make], ['Model', d.unit.model],
      ['Serial no', d.unit.serial], ['Unit no', d.unit.unitNo],
      ['Location', d.unit.location], ['Refrigerant', d.unit.gas],
    ]),
    H('Work carried out'),
    textBox(d.workDone, 'Not recorded'),
  ];
  if (d.materials.filter((m) => m.item).length) {
    out.push(H('Materials'), {
      table: {
        widths: ['*', 60],
        body: [[th('Item'), th('Qty', 'right')], ...d.materials.filter((m) => m.item).map((m) => [m.item, { text: m.qty, alignment: 'right' }])],
      },
      layout: zebra(),
    });
  }
  if (d.recommendations) out.push(H('Recommendations'), textBox(d.recommendations));
  out.push(H('Check list'), checklist([...SERVICE_CHECKS, ...(d.extraChecks || [])], d.checks), {
    table: { widths: ['*', 150], body: [[{ text: 'Running temperatures' }, { text: v(d.runningTemp, '°C') || '', bold: true }]] },
    layout: { ...zebra(false), fillColor: () => C.frost },
  });
  out.push(H('Time and travel'), infoGrid(timeRow(job)));
  out.push(...signatures(job));
  out.push(...photoBlock(job.photos));
  return out;
}

function vrfContent(job) {
  const d = job.data;
  const units = d.units.filter((u) => u.model || u.location || u.comment);
  const out = [
    infoGrid([
      ...clientPairs(job),
      ['Job type', d.jobType], ['Status', d.completion],
      ['Location', d.locationDesc], ['Next service', job.nextService ? fmtDateUK(job.nextService) : ''],
    ]),
    H(`Units (${units.length})`),
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [16, '*', 82, 62, '*', 38],
        body: [
          [th('#'), th('Make / model'), th('Location'), th('Type'), th('Comment'), th('Temp', 'right')],
          ...units.map((u, i) => [
            { text: String(i + 1), color: C.muted },
            { text: [{ text: u.model || '', bold: true }, u.make ? { text: '\n' + u.make, color: C.muted, fontSize: 8.5 } : ''] },
            u.location || '',
            { text: u.type || '', fontSize: 8.5 },
            u.comment || '',
            { text: v(u.temp, '°C'), alignment: 'right', bold: true },
          ]),
        ],
      },
      layout: zebra(),
    },
    H('Engineer check list'),
    checklist([...VRF_CHECKS, ...(d.extraChecks || [])], d.checks),
    {
      table: { widths: ['*', 150], body: [[{ text: 'Running temperature range' }, { text: v(d.tempRange, '°C'), bold: true }]] },
      layout: { ...zebra(false), fillColor: () => C.frost },
    },
    H("Engineer's notes"),
    textBox(d.notes, 'None'),
  ];
  if (d.recommendations) out.push(H('Recommendations'), textBox(d.recommendations));
  out.push(H('Time and travel'), infoGrid(timeRow(job)));
  out.push(...signatures(job));
  out.push(...photoBlock(job.photos));
  return out;
}

function commissioningContent(job) {
  const d = job.data;
  const dT = d.airOn !== '' && d.airOff !== '' && !isNaN(d.airOn) && !isNaN(d.airOff)
    ? Math.abs(Number(d.airOff) - Number(d.airOn)).toFixed(1).replace(/\.0$/, '') + '°C' : '';
  const unitTable = {
    table: {
      widths: [80, '*', '*'],
      body: [
        [th(''), th('Indoor'), th('Outdoor')],
        [{ text: 'Make', style: 'k' }, { text: d.make, colSpan: 2 }, ''],
        [{ text: 'Model', style: 'k' }, d.indoor.model, d.outdoor.model],
        [{ text: 'Serial no', style: 'k' }, d.indoor.serial, d.outdoor.serial],
        [{ text: 'Location', style: 'k' }, d.indoor.location, d.outdoor.location],
        [{ text: 'Capacity', style: 'k' }, { text: [v(d.coolKw) && `Cooling ${d.coolKw}kW`, v(d.heatKw) && `Heating ${d.heatKw}kW`].filter(Boolean).join('   '), colSpan: 2 }, ''],
      ],
    },
    layout: zebra(),
  };
  return [
    infoGrid([...clientPairs(job)]),
    H('System information'),
    unitTable,
    H('Refrigerant'),
    infoGrid([
      ['Type of gas', d.gasType], ['Pressure tested to', v(d.pressureTest, ' bar')],
      ['Held on vacuum', v(d.vacuumHrs, Number(d.vacuumHrs) === 1 ? ' hr' : ' hrs')], ['Vacuum reached', v(d.vacuumMicrons, ' microns')],
      ['Factory charge', v(d.factoryCharge, ' kg')], ['Gas charge added', v(d.gasAdded, ' g')],
      ['Pipe length', v(d.pipeLength, ' m')], ['Pipe sizes', `Suction ${d.suction}"   Liquid ${d.liquid}"`],
    ]),
    H('Readings'),
    infoGrid([
      ['Air on', v(d.airOn, '°C')], ['Air off', v(d.airOff, '°C')],
      ['Difference', dT], ['Suction pressure', v(d.suctionPressure, ' bar')],
      ['Discharge pressure', v(d.dischargePressure, ' bar')], ['Drain', d.drain],
      ['Supply', `${d.phase}${d.voltage ? ', ' + d.voltage + 'V' : ''}`], ['Full load amps', v(d.flAmps, ' A')],
    ]),
    H('Handover and time'),
    infoGrid([
      ['Operation explained', d.handover ? 'Yes' : 'No'], ['Next service', job.nextService ? fmtDateUK(job.nextService) : ''],
      ...timeRow(job),
    ]),
    d.notes ? { stack: [{ text: '', margin: [0, 4] }, textBox(d.notes)] } : '',
    ...signatures(job),
    ...photoBlock(job.photos),
  ];
}

function bullets(arr) {
  return arr.length ? { ul: arr, markerColor: C.orange, margin: [0, 0, 0, 0] } : { text: '' };
}

function msRow(label, content) {
  return [{ text: label, style: 'k', margin: [0, 1, 0, 1] }, content];
}

function ramsContent(job) {
  const ms = job.data.ms, ra = job.data.ra;
  const seq = ms.sequence.filter((s) => s.trim());
  const msTable = {
    table: {
      widths: [108, '*'],
      dontBreakRows: true,
      body: [
        msRow('Project', { text: ms.project, bold: true }),
        msRow('Operation', ms.operation),
        msRow('Description of works', { text: ms.description, lineHeight: 1.25 }),
        msRow('Sequence of works', seq.length ? { ol: seq, lineHeight: 1.25 } : ''),
        msRow('Risk assessment', 'A risk assessment is provided with this method statement.'),
        msRow('COSHH assessment', ms.gases.length ? `COSHH sheets for the following gases will be made available: ${ms.gases.join(' / ')}` : 'Not applicable'),
        msRow('Control measures', { stack: lines(ms.controls).map((l) => ({ text: l, margin: [0, 0, 0, 4] })) }),
        msRow('Duration', ms.duration),
        msRow('Permits required', ms.permits),
        msRow('Security', ms.security),
        msRow('Operatives', ms.operatives),
        msRow('Plant', ms.plant),
        msRow('Materials and tools', bullets(ms.tools)),
        msRow('Welfare', ms.welfare),
        msRow('PPE', ms.ppe),
      ],
    },
    layout: { ...thin, fillColor: (r, n, col) => (col === 0 ? C.frost : null), paddingTop: () => 7, paddingBottom: () => 7 },
  };
  const emergency = {
    table: {
      widths: [108, '*'],
      body: [msRow('Site evacuation', ms.evacuation), msRow('First aid', ms.firstAid)],
    },
    layout: { ...thin, fillColor: (r, n, col) => (col === 0 ? C.frost : null), paddingTop: () => 7, paddingBottom: () => 7 },
  };
  const signRows = ms.signoff.filter((r) => r.role || r.name);
  const signTable = {
    table: {
      widths: [90, '*', '*', 80],
      heights: (r) => (r === 0 ? 'auto' : 26),
      body: [
        [th('Role'), th('Print name'), th('Sign'), th('Date')],
        ...signRows.map((r) => [{ text: r.role, style: 'k' }, r.name, '', '']),
        ...Array.from({ length: Math.max(0, 3 - signRows.length) }).map(() => ['', '', '', '']),
      ],
    },
    layout: { ...thin, fillColor: (r) => (r === 0 ? C.navy : null) },
  };

  // Risk assessment, landscape
  const band = (s) => riskBand(s);
  const riskCell = (s) => ({ text: String(s), alignment: 'center', bold: true, fillColor: C[band(s).band] });
  const raHead = [
    th('Hazard'), th('Cause'), th('Effect'), th('At risk', 'center'), th('Existing control measures'),
    th('S', 'center'), th('P', 'center'), th('Risk', 'center'), th('Further control measures'),
    th('S', 'center'), th('P', 'center'), th('Risk', 'center'), th('OK', 'center'),
  ];
  const raRows = ra.hazards.map((h) => {
    const r1 = h.s * h.p, r2 = h.rs * h.rp;
    return [
      { text: h.hazard, bold: true }, h.cause, h.effect,
      { text: h.atRisk, alignment: 'center' },
      bullets(lines(h.existing)),
      { text: String(h.s), alignment: 'center' }, { text: String(h.p), alignment: 'center' }, riskCell(r1),
      bullets(lines(h.further)),
      { text: String(h.rs), alignment: 'center' }, { text: String(h.rp), alignment: 'center' }, riskCell(r2),
      { text: band(r2).ok, alignment: 'center', bold: true, color: band(r2).ok === 'N' ? C.fail : C.pass },
    ];
  });
  const raTable = {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [70, 72, 58, 30, '*', 14, 14, 26, '*', 14, 14, 26, 22],
      body: [raHead, ...raRows],
    },
    layout: { ...zebra(), vLineWidth: () => 0, paddingLeft: () => 4, paddingRight: () => 4 },
    fontSize: 8.2,
  };
  const keyCol = (title, items) => ({
    stack: [{ text: title, style: 'k', margin: [0, 0, 0, 3] }, ...items.map((t) => ({ text: t, fontSize: 7.6, color: C.ink }))],
  });
  const key = {
    columns: [
      keyCol('At risk', AT_RISK.map((a) => `${a.id}  ${a.label}`)),
      keyCol('Severity (S)', SEVERITY.map((s, i) => `${i + 1}  ${s}`)),
      keyCol('Probability (P)', PROBABILITY.map((s, i) => `${i + 1}  ${s}`)),
      {
        stack: [
          { text: 'Risk = S x P', style: 'k', margin: [0, 0, 0, 3] },
          { table: { widths: [34, '*'], body: [
            [{ text: '1 to 5', fillColor: C.low, fontSize: 7.6, bold: true }, { text: 'Low. Acceptable, work can start', fontSize: 7.6 }],
            [{ text: '6 to 14', fillColor: C.med, fontSize: 7.6, bold: true }, { text: 'Medium. May need further consideration', fontSize: 7.6 }],
            [{ text: '15 to 25', fillColor: C.high, fontSize: 7.6, bold: true }, { text: 'High. Unacceptable, do not start work', fontSize: 7.6 }],
          ] }, layout: { ...thin, paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4 } },
        ],
        width: 220,
      },
    ],
    columnGap: 18,
    margin: [0, 12, 0, 0],
    unbreakable: true,
  };

  const raInfo = infoGrid([
    ['Customer', job.client.name], ['Job number', job.jobNo],
    ['Site', [job.site.name, job.site.address].filter(Boolean).join(', ')], ['Date conducted', fmtDateUK(job.date)],
    ['Assessment team', ra.team], ['Review by', ra.reviewDate ? fmtDateUK(ra.reviewDate) : ''],
  ]);

  return [
    infoGrid([
      ['Project', ms.project], ['Job ref', job.jobNo],
      ['Operation', ms.operation], ['Revision', ms.revision],
      ['Client', job.client.name], ['Date', fmtDateUK(job.date)],
      ['Site', [job.site.name, job.site.address].filter(Boolean).join(', ')], ['Compiled by', job.sign.engineer.name || job.engineer],
    ]),
    H('Method statement'),
    msTable,
    H('Emergency procedures'),
    emergency,
    H('Amendments'),
    { text: `Any change to the operation, or any departure from the method and system of work above found by personnel on site, is to be discussed with ${ms.amendmentsContact || 'the responsible manager'}. Amendments are to be confirmed by them and the document recirculated to the people below.`, lineHeight: 1.25 },
    H('Read and understood'),
    { text: 'Sign to confirm that the contents of this method statement and the attached risk assessment have been read and understood.', margin: [0, 0, 0, 8], color: C.muted },
    signTable,
    { columns: [sigCell('Compiled by', job.sign.engineer), { text: '' }], columnGap: 30, margin: [0, 14, 0, 0] },

    { text: 'Risk Assessment', style: 'pageTitle', pageBreak: 'before', pageOrientation: 'landscape' },
    raInfo,
    { text: '', margin: [0, 6] },
    raTable,
    key,
    H('Further actions'),
    textBox(ra.furtherActions, 'None'),
    {
      columns: [
        { stack: [{ text: 'Authorised by the responsible manager', style: 'k', margin: [0, 14, 0, 4] }, { text: ra.authorisedBy || ' ', bold: true }] },
        { stack: [{ text: 'Signed', style: 'k', margin: [0, 14, 0, 30] }, { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.7, lineColor: C.line }] }] },
        { stack: [{ text: 'Date', style: 'k', margin: [0, 14, 0, 30] }, { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 0.7, lineColor: C.line }] }] },
      ],
      unbreakable: true,
    },
  ];
}

// ---------- quote ----------

let priceCache = null;

function quoteContent(job) {
  const q = migrateQuote(job.data);
  const price = priceCache || getPrice({});
  const p = priceQuote(q, price);
  const offered = p.offered.length ? p.offered : p.options;
  const validUntil = (() => { const d = new Date(job.date); d.setDate(d.getDate() + (parseInt(price.validityDays, 10) || 30)); return d.toISOString().slice(0, 10); })();
  const accepted = q.accepted.tier ? p.options.find((o) => o.tier.id === q.accepted.tier) : null;
  const G = '#11785A';
  const isService = q.kind === 'service', isWorks = q.kind === 'works';
  const tierName = (t) => (isService ? ({ good: 'Bronze', better: 'Silver', best: 'Gold' })[t.id] : t.label);
  const allPics = q.kind === 'install'
    ? q.systems.flatMap((s) => [...s.indoors.flatMap((i) => (i.photos || []).map((x) => ({ ...x, where: i.room.name }))), ...(s.outdoor.photos || []).map((x) => ({ ...x, where: 'Outdoor unit' }))]).filter((x) => x.overlayUrl || x.dataUrl)
    : [];
  const hero = allPics.find((x) => x.overlayUrl) || allPics[0];

  const out = [];
  // ---- cover ----
  const title = q.title || (isService ? 'Maintenance proposal' : isWorks ? 'Quotation for works' : 'Air conditioning proposal');
  out.push({ text: isService ? 'PROPOSAL' : 'QUOTATION', font: 'ArchivoX', fontSize: 9, color: C.orange, characterSpacing: 2, margin: [0, 20, 0, 6] });
  out.push({ text: title, font: 'ArchivoX', fontSize: 26, color: C.navyDeep, lineHeight: 1.05 });
  out.push({ text: `Prepared for ${[job.client.name, job.client.contact].filter(Boolean).join(', ') || 'you'}${job.site.address ? ', ' + job.site.address.split('\n')[0] : ''}`, fontSize: 11, color: C.muted, margin: [0, 8, 0, 18] });
  if (hero) out.push({ image: hero.overlayUrl || hero.dataUrl, fit: [523, 330], alignment: 'center', margin: [0, 0, 0, 6] });
  if (hero && hero.caption) out.push({ text: hero.caption, style: 'caption', alignment: 'center' });
  if (q.summary) out.push({ text: q.summary, fontSize: 11, lineHeight: 1.4, margin: [0, hero ? 16 : 0, 0, 0] });
  // headline price block on the cover
  const rec = offered.find((o) => o.tier.id === (accepted ? accepted.tier.id : q.recommended)) || offered[0];
  if (rec && rec.available) {
    out.push({
      margin: [0, 18, 0, 0],
      table: { widths: ['*', 'auto'], body: [[
        { stack: [{ text: accepted ? 'Accepted option' : offered.length > 1 ? `Our recommendation: ${tierName(rec.tier)}` : 'Price', style: 'k', color: C.orange },
          { text: isService ? 'Per year, including VAT' : 'Fully installed, including VAT', fontSize: 8.5, color: C.muted, margin: [0, 2, 0, 0] }], border: [false, false, false, false] },
        { text: fmtGBP0(rec.total), font: 'ArchivoX', fontSize: 22, color: accepted ? G : C.navyDeep, alignment: 'right', border: [false, false, false, false], margin: [0, 2, 0, 0] },
      ]] },
      layout: { fillColor: () => '#F4F7FA', paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10 },
    });
  }
  out.push({ columns: [
    { text: [{ text: 'Quote ', style: 'k' }, { text: job.jobNo || '', bold: true }, { text: q.pipeline && q.pipeline.revision > 1 ? `  rev ${q.pipeline.revision}` : '' }], fontSize: 9 },
    { text: [{ text: 'Date ', style: 'k' }, fmtDateUK(job.date)], fontSize: 9, alignment: 'center' },
    { text: [{ text: 'Valid until ', style: 'k' }, fmtDateUK(validUntil)], fontSize: 9, alignment: 'center' },
    { text: [{ text: 'Surveyed by ', style: 'k' }, job.engineer || ''], fontSize: 9, alignment: 'right' },
  ], margin: [0, 14, 0, 0], pageBreak: 'after' });

  // ---- install: what we surveyed ----
  if (q.kind === 'install') {
    out.push(H('What we surveyed'));
    const body = [[th('System / room'), th('Size', 'center'), th('Cooling', 'center'), th('Unit'), th('Where it goes')]];
    q.systems.forEach((s) => {
      const built = rec ? rec.systems.find((x) => x.sys.id === s.id) : null;
      const kind = SYSTEM_KINDS.find((k) => k.id === s.kind).label;
      if (s.kind === 'cold') {
        body.push([{ text: [{ text: s.name || 'Cold room', bold: true }, { text: '\n' + kind, color: C.muted, fontSize: 8 }] }, { text: s.cold.panelsM2 ? `${s.cold.panelsM2} m² panels` : '', alignment: 'center' }, { text: `${s.cold.kw || '–'} kW at ${s.cold.tempC}°C`, alignment: 'center', bold: true },
          { text: built ? built.units.map((u) => `${u.unit.make} ${u.unit.model}`).join('\n') : '', fontSize: 8.5 }, { text: s.outdoor.spot, fontSize: 8.5 }]);
        return;
      }
      s.indoors.forEach((ind, i) => {
        const l = roomLoad(ind.room), use = ROOM_USES.find((x) => x.id === ind.room.use);
        const u = built && built.units.find((x) => x.role === 'indoor' && x.indoor.id === ind.id);
        body.push([
          { text: [{ text: ind.room.name || `Room ${i + 1}`, bold: true }, { text: '\n' + [q.systems.length > 1 || s.kind === 'multi' ? (s.name || kind) : '', use && use.label].filter(Boolean).join(', '), color: C.muted, fontSize: 8 }] },
          { text: l.area ? `${l.area} m²` : '', alignment: 'center' },
          { text: `${roomKw(ind.room)} kW`, alignment: 'center', bold: true },
          { text: u ? `${u.unit.make} ${u.unit.model}` : ind.unitType, fontSize: 8.5 },
          { text: ind.spot, fontSize: 8.5 },
        ]);
      });
      const o = built && built.units.find((x) => x.role === 'outdoor');
      if (s.kind === 'multi' || s.outdoor.spot) body.push([{ text: `${s.name || kind}: outdoor unit`, color: C.muted, fontSize: 8.5 }, '', '', { text: o ? `${o.unit.make} ${o.unit.model}` : '', fontSize: 8.5 }, { text: s.outdoor.spot, fontSize: 8.5 }]);
    });
    out.push({ table: { headerRows: 1, dontBreakRows: true, widths: ['*', 44, 56, 110, '*'], body }, layout: zebra() });

    const rest = allPics.filter((x) => x !== hero);
    if (rest.length) {
      const cells = rest.map((x) => ({ stack: [{ image: x.overlayUrl || x.dataUrl, fit: [250, 190], alignment: 'center' }, { text: x.caption || x.where || '', style: 'caption', alignment: 'center', margin: [0, 4, 0, 0] }], margin: [0, 0, 0, 10], unbreakable: true }));
      const rows = []; for (let i = 0; i < cells.length; i += 2) rows.push([cells[i], cells[i + 1] || '']);
      out.push(H('Where the units will go'));
      out.push({ text: 'Drawn to scale in the photos. Final positions are agreed with you on the day.', color: C.muted, fontSize: 8.5, margin: [0, 0, 0, 8] });
      out.push({ table: { widths: ['*', '*'], body: rows, dontBreakRows: true }, layout: 'noBorders' });
    }
  }

  // ---- works: the lines ----
  if (isWorks && rec) {
    out.push(H('The work'));
    const body = [[th('Item'), th('Qty', 'center'), th('Each', 'right'), th('Total', 'right')]];
    rec.systems[0].lines.forEach((l) => body.push([l.label, { text: String(l.qty), alignment: 'center' }, { text: fmtGBP(l.each), alignment: 'right' }, { text: fmtGBP(l.total), alignment: 'right' }]));
    body.push([{ text: `Labour: ${rec.systems[0].hours} hours${rec.systems[0].engineers > 1 ? ` × ${rec.systems[0].engineers} engineers` : ''}` }, '', '', { text: fmtGBP(rec.labour), alignment: 'right' }]);
    out.push({ table: { headerRows: 1, widths: ['*', 40, 70, 80], body }, layout: zebra() });
  }

  // ---- options ----
  out.push(H(isService ? 'Levels of cover' : offered.length > 1 ? 'Your options' : 'Your price'));
  const colW = offered.map(() => '*');
  const isRec = (o) => (accepted ? accepted.tier.id === o.tier.id : q.recommended === o.tier.id && offered.length > 1);
  const head = offered.map((o) => ({ stack: [
    { text: tierName(o.tier), font: 'ArchivoX', fontSize: 12, color: isRec(o) ? C.orange : C.navyDeep },
    isService ? '' : { text: o.tier.blurb, fontSize: 8, color: C.muted, margin: [0, 2, 0, 0] },
    isRec(o) ? { text: accepted ? 'ACCEPTED' : 'RECOMMENDED', fontSize: 7, bold: true, color: accepted ? G : C.orange, margin: [0, 3, 0, 0] } : '',
  ] }));
  const rows = [];
  if (q.kind === 'install') {
    q.systems.forEach((s) => {
      const indoorIds = s.kind === 'cold' ? ['cold'] : s.indoors.map((i) => i.id);
      indoorIds.forEach((id) => rows.push(offered.map((o) => {
        const bs = o.systems.find((x) => x.sys.id === s.id);
        if (id === 'cold') { const us = bs ? bs.units : []; return us.length ? { stack: [{ text: s.name || 'Cold room', style: 'k' }, ...us.map((u) => ({ text: `${u.unit.make} ${u.unit.model}`, bold: true, fontSize: 9 }))] } : { text: 'No suitable kit in the range', color: C.na, italics: true, fontSize: 8.5 }; }
        const u = bs && bs.units.find((x) => x.role === 'indoor' && x.indoor.id === id);
        if (!u) return { text: 'No unit of this size in the range', color: C.na, italics: true, fontSize: 8.5 };
        const rc = runningCost(u.unit, price.tariff);
        return { stack: [
          { text: u.indoor.room.name || 'Room', style: 'k' },
          { text: `${u.unit.make} ${u.unit.model}`, bold: true, fontSize: 9 },
          { text: `${u.unit.kwCool} kW cooling${u.unit.kwHeat ? `, ${u.unit.kwHeat} kW heating` : ''}`, fontSize: 8, color: C.muted },
          u.unit.dbIn ? { text: `${u.unit.dbIn} dB indoors, ${soundWords(u.unit.dbIn)}`, fontSize: 7.8, color: C.muted } : '',
          rc && u.unit.seer ? { text: `About ${Math.round(rc.coolPerHour * 100)}p an hour to cool, heating ${rc.heatSavingPct}% cheaper than electric heaters`, fontSize: 7.8, color: C.muted } : '',
          u.unit.features ? { text: u.unit.features, fontSize: 7.8, color: C.muted, margin: [0, 2, 0, 0] } : '',
        ] };
      })));
      if (s.kind === 'multi') rows.push(offered.map((o) => { const bs = o.systems.find((x) => x.sys.id === s.id); const u = bs && bs.units.find((x) => x.role === 'outdoor'); return u ? { stack: [{ text: `${s.name || 'Multi-split'} outdoor`, style: 'k' }, { text: `${u.unit.make} ${u.unit.model}`, bold: true, fontSize: 9 }, bs.capacity && bs.capacity.ok ? { text: bs.capacity.text, fontSize: 7.8, color: C.muted } : ''] } : { text: 'No outdoor unit big enough', color: C.na, italics: true, fontSize: 8.5 }; }));
    });
    rows.push(offered.map((o) => ({ text: `${price.warrantyYears || 5} year parts warranty, ${price.workmanshipYears || 2} year workmanship guarantee`, fontSize: 8, color: C.muted })));
  }
  if (isService) {
    rows.push(offered.map((o) => { const l = o.systems[0].serviceLevel; return { ul: [`${l.visits} visit${l.visits > 1 ? 's' : ''} a year to ${l.n} unit${l.n === 1 ? '' : 's'}`, `${l.response} call-out response`, parseFloat(l.callout) > 0 ? `${l.callout}% off call-out charges` : 'Standard call-out charges', parseFloat(l.parts) > 0 ? `${l.parts}% off parts` : 'Parts at list price', 'F-Gas leak check and certificate', 'Filters cleaned, coils washed, drains cleared'], fontSize: 8.5, markerColor: C.orange, lineHeight: 1.25 }; }));
  }
  const totalRow = offered.map((o) => ({ stack: [
    { text: o.available ? fmtGBP0(o.total) : '–', font: 'ArchivoX', fontSize: 17, color: accepted && accepted.tier.id === o.tier.id ? G : C.navyDeep },
    { text: `${isService ? 'a year ' : ''}inc VAT   (${fmtGBP(o.subtotal)} + VAT)`, fontSize: 7.5, color: C.muted },
  ] }));
  out.push({
    table: { widths: colW, headerRows: 1, body: [head, ...rows, totalRow], dontBreakRows: true },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.6), vLineWidth: () => 0.6,
      hLineColor: () => C.line, vLineColor: () => C.line,
      fillColor: (row, node, col) => (isRec(offered[col]) ? '#FFF6EC' : null),
      paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 7, paddingBottom: () => 7,
    },
  });

  // ---- included ----
  if (rec && q.kind === 'install') {
    out.push(H(`What's included${offered.length > 1 ? ` (${tierName(rec.tier)} option)` : ''}`));
    const inc = [];
    rec.systems.forEach((bs) => {
      const pre = q.systems.length > 1 ? `${bs.sys.name || SYSTEM_KINDS.find((k) => k.id === bs.sys.kind).label}: ` : '';
      const grp = (g) => bs.lines.filter((l) => l.group === g);
      const say = (l) => `${l.label}${l.qty !== 1 && l.unit !== 'each' ? ` (${l.qty}${l.unit === 'm' ? 'm' : l.unit === 'm²' ? ' m²' : l.unit === 'day' ? ' days' : ''})` : l.qty !== 1 ? ` × ${l.qty}` : ''}`;
      grp('equipment').forEach((l) => inc.push(pre + say(l)));
      const pw = grp('pipework'); if (pw.length) inc.push(pre + 'Insulated refrigerant pipework, trunking and condensate drain: ' + pw.map(say).join(', '));
      const el = grp('electrics'); if (el.length) inc.push(pre + 'Electrics: ' + el.map(say).join(', '));
      const bw = grp('builders'); if (bw.length) inc.push(pre + 'Builders work: ' + bw.map(say).join(', '));
      const ac = grp('access'); if (ac.length) inc.push(pre + ac.map(say).join(', '));
      grp('other').forEach((l) => inc.push(pre + say(l)));
      inc.push(`${pre}Labour: ${bs.hours} hours${bs.engineers > 1 ? ` × ${bs.engineers} engineers` : ''}, including pressure test, vacuum, commissioning and handover`);
    });
    (q.extras || []).filter((e) => e.label).forEach((e) => inc.push(`${e.label}: ${fmtGBP(parseFloat(e.price) || 0)}`));
    inc.push('F-Gas certificate and commissioning sheet on completion', 'All waste and packaging removed');
    out.push({ ul: inc, markerColor: C.orange, fontSize: 9, lineHeight: 1.25 });
    if (price.exclusions) { out.push({ text: 'Not included', style: 'k', margin: [0, 10, 0, 3] }); out.push({ text: price.exclusions, fontSize: 8.5, color: C.muted, lineHeight: 1.3 }); }
  }
  if (q.survey.notes || q.survey.access || q.survey.power || q.survey.parking) {
    out.push(H('Site notes'));
    out.push(infoGrid([['Access', q.survey.access], ['Parking', q.survey.parking], ['Power', q.survey.power], ['Notes', q.survey.notes]]));
  }

  out.push(H('Terms'));
  out.push({ stack: lines(price.terms).map((l) => ({ text: l, fontSize: 8.5, color: C.muted, margin: [0, 0, 0, 3], lineHeight: 1.25 })) });

  // ---- acceptance ----
  const dep = parseFloat(price.deposit) || 0;
  out.push({
    stack: [
      H('Acceptance'),
      {
        text: accepted
          ? [{ text: `Accepted: ${tierName(accepted.tier)} option, ${fmtGBP(accepted.total)} inc VAT. `, bold: true, color: G }, { text: dep && !isService ? `Deposit of ${fmtGBP(accepted.total * dep / 100)} (${dep}%) due now, balance on completion.` : '' }]
          : [{ text: 'To go ahead, pick an option, sign below and send it back, or just reply to the message this came with. ' }, { text: dep && !isService ? `A ${dep}% deposit is payable on acceptance.` : '' }],
        margin: [0, 0, 0, 10], lineHeight: 1.3,
      },
      {
        columns: [
          sigCell('Customer', accepted ? job.sign.customer : { name: '', img: '', at: null }),
          { stack: [{ text: 'Option chosen', style: 'k', margin: [0, 0, 0, 4] }, { text: accepted ? tierName(accepted.tier) : offered.map((o) => tierName(o.tier)).join('   /   '), margin: [0, 8, 0, 0], bold: !!accepted, color: accepted ? G : C.ink }] },
        ],
        columnGap: 30,
      },
      { columns: [sigCell('For Comfyair', job.sign.engineer), { text: '' }], columnGap: 30, margin: [0, 12, 0, 0] },
    ],
    unbreakable: true,
  });
  return out;
}

const BUILDERS = { service: serviceContent, vrf: vrfContent, commissioning: commissioningContent, rams: ramsContent, quote: quoteContent };

// ---------- document ----------

export function docDefinition(job, settings) {
  const t = JOB_TYPES[job.type];
  priceCache = getPrice(settings);
  return shell(settings, {
    title: t.pdfTitle,
    subtitle: [{ text: job.type === 'quote' ? 'Quote ' : 'Job ' }, { text: job.jobNo || '', bold: true }, { text: '    ' + fmtDateUK(job.date) }],
    info: { title: `${t.pdfTitle} ${job.jobNo}`, subject: job.client.name },
    content: BUILDERS[job.type](job),
  });
}

function shell(settings, { title, subtitle, info, content }) {
  const co = settings.company;
  const footerLine = [co.address, co.tel && 'Tel: ' + co.tel, co.fgas && 'F-Gas No: ' + co.fgas, co.email].filter(Boolean).join('   |   ');
  return {
    pageSize: 'A4',
    pageMargins: [36, 90, 36, 48],
    info: { author: co.name, creator: 'Comfyair Job Sheets', ...info },
    header: (page, pages, size) => ({
      margin: [36, 26, 36, 0],
      stack: [
        {
          columns: [
            { image: logoData, width: 112 },
            {
              stack: [
                { text: title, font: 'ArchivoX', fontSize: size.orientation === 'landscape' ? 15 : 13.5, color: C.navy, alignment: 'right', characterSpacing: 0.1 },
                { text: subtitle, alignment: 'right', fontSize: 9, color: C.muted, margin: [0, 3, 0, 0] },
              ],
              margin: [0, 6, 0, 0],
            },
          ],
        },
        {
          canvas: [
            { type: 'rect', x: 0, y: 0, w: size.width - 72, h: 1.4, color: C.navy },
            { type: 'rect', x: 0, y: 0, w: 64, h: 1.4, color: C.orange },
          ],
          margin: [0, 8, 0, 0],
        },
      ],
    }),
    footer: (page, pages, size) => ({
      margin: [36, 12, 36, 0],
      columns: [
        { text: footerLine, fontSize: 7, color: C.muted, width: '*' },
        { text: `Page ${page} of ${pages}`, fontSize: 7.5, color: C.muted, alignment: 'right', width: 70 },
      ],
    }),
    content,
    // never leave a section heading stranded at the bottom of a page
    pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.filter((n) => !n.headlineLevel).length < 2,
    defaultStyle: { font: 'Archivo', fontSize: 9.5, color: C.ink, lineHeight: 1.15 },
    styles: {
      h2: { font: 'ArchivoX', fontSize: 10.5, color: C.navyDeep, characterSpacing: 0.2 },
      th: { font: 'ArchivoMed', fontSize: 8.5, color: '#FFFFFF', bold: true },
      k: { font: 'ArchivoMed', fontSize: 8.3, color: C.muted },
      val: { fontSize: 9.5 },
      caption: { fontSize: 8.5, color: C.muted },
      pageTitle: { font: 'ArchivoX', fontSize: 12, color: C.navyDeep, margin: [0, 0, 0, 10] },
    },
  };
}

export function pdfFileName(job) {
  const t = JOB_TYPES[job.type];
  const who = job.type === 'rams' ? job.data.ms.project || job.client.name : job.client.name || job.site.name;
  return safeFileName(`Comfyair ${t.fileLabel} ${job.jobNo}${who ? ' - ' + who : ''}.pdf`);
}

export async function buildPdf(job, settings) {
  const pdfMake = await loadPdfLib();
  try { sitesCache = await allSites(); } catch (e) { sitesCache = []; }
  const dd = docDefinition(job, settings);
  // The whole job rides inside the PDF, so sending the PDF to another phone is enough to import it there.
  try {
    const key = norm(job.site.address || job.site.name);
    const site = sitesCache.find((x) => norm(x.address || x.name) === key) || null;
    dd.info.ComfyairJob = await packJob(jobFile(job, site, settings.currentEngineer));
  } catch (e) { /* the PDF still works without it */ }
  const blob = await new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(dd).getBlob((b) => resolve(b));
    } catch (e) {
      reject(e);
    }
  });
  return new File([blob], pdfFileName(job), { type: 'application/pdf' });
}

// ---------- timesheet ----------

const fmtShort = (iso) => { const d = parseISO(iso); return d ? `${d.getDate()}/${d.getMonth() + 1}` : ''; };

function timesheetContent(week, ts, pay) {
  const red = (t) => ({ text: t, color: C.fail, bold: true });
  const toName = pay.toName || 'Manager';
  const summary = {
    columns: [
      stat('Hours', fmtDuration(week.totalMins) || '0h'),
      stat('Days', String(week.daysWorked)),
      stat('Overtime', week.otMins ? fmtDuration(week.otMins) : 'None'),
      week.payTotal != null ? stat('Pay', fmtMoney(week.payTotal), true) : stat('Flags', String(week.flags.length), week.red > 0),
    ],
    columnGap: 10,
    margin: [0, 0, 0, 4],
  };
  function stat(label, value, hi) {
    return {
      table: { widths: ['*'], body: [[{ stack: [{ text: label, style: 'k' }, { text: value, font: 'ArchivoX', fontSize: 15, color: hi ? C.orange : C.navyDeep, margin: [0, 3, 0, 0] }], margin: [4, 2, 4, 2] }]] },
      layout: { ...thin, fillColor: () => C.frost, paddingTop: () => 6, paddingBottom: () => 6 },
    };
  }

  const dayRows = week.days.map((d) => {
    const segs = d.shift ? d.shift.segments : [];
    const ins = segs.map((g) => g.in.t + (g.in.edited ? '*' : '')).join('\n');
    const outs = segs.map((g) => (g.out ? g.out.t + (g.out.edited ? '*' : '') : 'open')).join('\n');
    const jobs = d.jobs.length
      ? { stack: d.jobs.map((r) => ({ text: [{ text: `${r.job.jobNo}  `, bold: true }, { text: r.where }, r.arrived ? { text: `  ${r.arrived} to ${r.left || '…'}`, color: C.muted } : ''], margin: [0, 0, 0, 2] })) }
      : { text: d.shift && d.shift.note ? d.shift.note : d.minutes ? 'No job sheets' : '', color: d.minutes && !d.jobs.length && !(d.shift && d.shift.note) ? C.amber : C.muted, italics: true };
    const flagMark = d.flags.some((f) => f.level === 'red') ? red('!') : d.flags.length ? { text: '!', color: C.amber, bold: true } : '';
    return [
      { text: [{ text: d.day + '\n', bold: true }, { text: fmtShort(d.date), color: C.muted, fontSize: 8 }] },
      { text: ins || '', alignment: 'center' }, { text: outs || '', alignment: 'center' },
      { text: d.breaks ? fmtDuration(d.breaks) : '', alignment: 'center', color: C.muted },
      { text: d.minutes ? fmtDuration(d.minutes) : d.date > new Date().toISOString().slice(0, 10) ? '' : '–', alignment: 'center', bold: !!d.minutes },
      jobs, { text: flagMark, alignment: 'center' },
    ];
  });
  const dayTable = {
    table: {
      headerRows: 1, dontBreakRows: true,
      widths: [36, 40, 40, 36, 42, '*', 12],
      body: [[th('Day'), th('In', 'center'), th('Out', 'center'), th('Break', 'center'), th('Hours', 'center'), th('Jobs'), th('', 'center')], ...dayRows,
        [{ text: 'Total', bold: true, colSpan: 4 }, '', '', '', { text: fmtDuration(week.totalMins) || '0h', bold: true, alignment: 'center' },
          { text: week.rate ? `${fmtDuration(week.stdMins)} at £${week.rate.toFixed(2)}${week.otMins ? ` + ${fmtDuration(week.otMins)} at £${(week.rate * week.mult).toFixed(2)}` : ''}  =  ${fmtMoney(week.payTotal)}` : '', bold: true }, ''],
      ],
    },
    layout: { ...zebra(), fillColor: (row, node) => (row === 0 ? C.navy : row === node.table.body.length - 1 ? C.frost : row % 2 === 0 ? C.frost : null) },
  };

  const stamps = week.days.flatMap((d) => d.stamps.map((s) => ({ ...s, day: d.day })));
  const evidence = stamps.length ? {
    table: {
      headerRows: 1, dontBreakRows: true,
      widths: [34, '*', 34, 120, 28],
      body: [[th('Day'), th('Event'), th('Time', 'center'), th('Where the phone was'), th('')],
        ...stamps.map((s) => {
          const lvl = s.note.level;
          const color = lvl === 'far' ? C.fail : lvl === 'off' ? C.na : lvl === 'close' ? C.amber : C.pass;
          return [
            { text: s.day, color: C.muted }, { text: [{ text: s.event }, s.edited ? { text: '  edited by hand', color: C.amber, fontSize: 8 } : ''] },
            { text: s.t, alignment: 'center' },
            { text: s.loc && s.loc.status === 'pending' ? 'Not recorded' : s.note.text, color, bold: lvl === 'far' },
            hasFix(s.loc) ? { text: 'map', link: mapsLink(s.loc), color: C.sky, decoration: 'underline', alignment: 'center' } : '',
          ];
        })],
    },
    layout: { ...zebra(), paddingTop: () => 3, paddingBottom: () => 3 },
    fontSize: 8.5,
  } : { text: 'No location stamps this week.', color: C.na, italics: true };

  const flags = week.flags.length
    ? { ul: week.flags.map((f) => ({ text: [{ text: f.day + '  ', bold: true }, { text: f.text }], color: f.level === 'red' ? C.fail : C.amber, margin: [0, 0, 0, 2] })), markerColor: C.orange }
    : { text: [{ text: 'Nothing flagged. ', color: C.pass, bold: true }, { text: 'Every stamp had a location and nothing was changed by hand.', color: C.muted }] };

  return [
    infoGrid([
      ['Engineer', week.engineer], ['Week commencing', fmtDateUK(week.weekStart)],
      ['Submitted', ts ? fmtDateUK(new Date(ts.submittedAt).toISOString().slice(0, 10)) : ''], ['For', toName],
    ]),
    { text: '', margin: [0, 5] },
    summary,
    H('Hours'),
    dayTable,
    { text: '* time entered or changed by hand rather than stamped by a tap', fontSize: 7.5, color: C.muted, margin: [0, 4, 0, 0] },
    H('Things to check'),
    flags,
    H('Where the phone was at each tap'),
    { text: `Each tap of Clock in, Clock out, Arrived or Left records the phone's position. "At site" means within about a quarter of a mile of the site's saved location. Tap "map" to see the exact spot.`, color: C.muted, fontSize: 8.5, margin: [0, 0, 0, 8] },
    evidence,
    {
      stack: [
        H('Sign off'),
        {
          columns: [
            sigCell('Engineer', ts ? ts.sign : { name: week.engineer, img: '', at: null }),
            { stack: [{ text: `Approved by ${toName}`, style: 'k', margin: [0, 0, 0, 4] }, { text: ' ', margin: [0, 22, 0, 0] },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.7, lineColor: C.line }], margin: [0, 2, 0, 4] },
              { columns: [{ text: 'Signed', fontSize: 8.5, color: C.muted }, { text: 'Date', fontSize: 8.5, color: C.muted, alignment: 'right' }] }] },
          ],
          columnGap: 30,
        },
      ],
      unbreakable: true,
    },
  ];
}

export function timesheetFileName(week) {
  return safeFileName(`Comfyair Timesheet ${week.engineer} w-c ${fmtDateUK(week.weekStart).replace(/\//g, '-')}.pdf`);
}

export async function buildTimesheetPdf(week, ts, settings, pay) {
  const pdfMake = await loadPdfLib();
  const dd = shell(settings, {
    title: 'Weekly Timesheet',
    subtitle: [{ text: week.engineer, bold: true }, { text: '    w/c ' + fmtDateUK(week.weekStart) }],
    info: { title: `Timesheet ${week.engineer} ${week.weekStart}`, subject: week.engineer },
    content: timesheetContent(week, ts, pay),
  });
  const blob = await new Promise((resolve, reject) => {
    try { pdfMake.createPdf(dd).getBlob((b) => resolve(b)); } catch (e) { reject(e); }
  });
  return new File([blob], timesheetFileName(week), { type: 'application/pdf' });
}
