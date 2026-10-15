// Builds the branded Comfyair PDFs on the phone with pdfmake.

import {
  JOB_TYPES, SERVICE_CHECKS, VRF_CHECKS, AT_RISK, riskBand, SEVERITY, PROBABILITY,
} from './schema.js';
import { fmtDateUK, fmtDuration, safeFileName, onSiteMinutes } from './util.js';

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

function timeRow(job) {
  const t = job.time || {};
  const mins = onSiteMinutes(t);
  return [
    ['Arrived', v(t.arrived)], ['Left', v(t.left)],
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

const BUILDERS = { service: serviceContent, vrf: vrfContent, commissioning: commissioningContent, rams: ramsContent };

// ---------- document ----------

export function docDefinition(job, settings) {
  const t = JOB_TYPES[job.type];
  const co = settings.company;
  const footerLine = [co.address, co.tel && 'Tel: ' + co.tel, co.fgas && 'F-Gas No: ' + co.fgas, co.email].filter(Boolean).join('   |   ');
  return {
    pageSize: 'A4',
    pageMargins: [36, 90, 36, 48],
    info: { title: `${t.pdfTitle} ${job.jobNo}`, author: co.name, subject: job.client.name, creator: 'Comfyair Job Sheets' },
    header: (page, pages, size) => ({
      margin: [36, 26, 36, 0],
      stack: [
        {
          columns: [
            { image: logoData, width: 112 },
            {
              stack: [
                { text: t.pdfTitle, font: 'ArchivoX', fontSize: size.orientation === 'landscape' ? 15 : 13.5, color: C.navy, alignment: 'right', characterSpacing: 0.1 },
                { text: [{ text: 'Job ' }, { text: job.jobNo || '', bold: true }, { text: '    ' + fmtDateUK(job.date) }], alignment: 'right', fontSize: 9, color: C.muted, margin: [0, 3, 0, 0] },
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
    content: BUILDERS[job.type](job),
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
  const dd = docDefinition(job, settings);
  const blob = await new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(dd).getBlob((b) => resolve(b));
    } catch (e) {
      reject(e);
    }
  });
  return new File([blob], pdfFileName(job), { type: 'application/pdf' });
}
