// Quote engine: price book, systems (indoor + outdoor), cooling load, cost build-up, options and margins.

import { uid } from './util.js';

// ---------- tiers & types ----------

export const TIERS = [
  { id: 'good', label: 'Good', blurb: 'Reliable and keeps the cost down' },
  { id: 'better', label: 'Better', blurb: 'Quieter and more efficient, the one most people choose' },
  { id: 'best', label: 'Best', blurb: 'Top of the range: quietest, Wi-Fi, best air quality' },
];
export const INDOOR_TYPES = ['Wall mounted', 'Cassette', 'Ducted', 'Floor standing', 'Under ceiling'];
export const SYSTEM_KINDS = [
  { id: 'split', label: 'Single split', blurb: 'One indoor, one outdoor' },
  { id: 'multi', label: 'Multi-split', blurb: 'Two to five indoors on one outdoor' },
  { id: 'cold', label: 'Cold room / cellar', blurb: 'Condensing unit and evaporator' },
];

// 3D model used for AR and the photo drawing, by type and size.
export function modelFor(unit) {
  if (!unit) return 'wall-m';
  const t = unit.type || 'Wall mounted', kw = unit.kwCool || 3.5;
  if (t === 'Cassette') return kw > 5 ? 'cassette-840' : 'cassette-600';
  if (t === 'Floor standing') return 'floor';
  if (t === 'Ducted' || t === 'Under ceiling') return 'cassette-840';
  return kw <= 3.5 ? 'wall-s' : kw <= 5 ? 'wall-m' : 'wall-l';
}
export function outdoorModelFor(kw) { return kw <= 3.5 ? 'outdoor-s' : kw <= 5 ? 'outdoor-m' : kw <= 8 ? 'outdoor-l' : 'outdoor-xl'; }
// Real sizes in metres (w, h, d) matching the models.
export const MODEL_SIZE = {
  'wall-s': [0.80, 0.29, 0.23], 'wall-m': [0.92, 0.30, 0.24], 'wall-l': [1.10, 0.33, 0.27],
  'cassette-600': [0.62, 0.25, 0.62], 'cassette-840': [0.95, 0.29, 0.95], floor: [0.75, 0.60, 0.22],
  'outdoor-s': [0.78, 0.55, 0.29], 'outdoor-m': [0.87, 0.65, 0.32], 'outdoor-l': [0.95, 0.83, 0.33], 'outdoor-xl': [0.95, 1.33, 0.33],
};

// ---------- price book ----------

const U = (tier, type, kwCool, kwHeat, cost, multiCost, make, model, seer, scop, dbIn, dbOut, feat) =>
  ({ id: uid(), tier, type, kwCool, kwHeat, cost: String(cost), multiCost: String(multiCost), make, model, seer, scop, dbIn, dbOut, refrigerant: 'R32', features: feat, example: true });
const M = (kw, maxIndoors, cost, make, model) => ({ id: uid(), kw, maxIndoors, cost: String(cost), make, model, refrigerant: 'R32', example: true });
const CR = (kind, kw, cost, make, model, tempC) => ({ id: uid(), kind, kw, cost: String(cost), make, model, tempC, example: true });

export const PRICE_DEFAULT = () => ({
  markupEquip: '22', markupSundries: '35', labourRate: '45', dayHours: '8', overhead: '8', contingency: '0', vat: '20',
  validityDays: '30', deposit: '25', tariff: '0.27', warrantyYears: '5', workmanshipYears: '2',
  hours: { firstIndoor: '7', extraIndoor: '4', cassette: '3', ducted: '6', floor: '1', multiOutdoor: '2', coldRoom: '16', serviceVisitPerUnit: '0.75' },
  units: [
    U('good', 'Wall mounted', 2.5, 3.2, 470, 280, 'Midea', 'Xtreme Save 2.5', 6.9, 4.2, 21, 51, 'A++ cooling, A+ heating, basic remote'),
    U('good', 'Wall mounted', 3.5, 3.8, 520, 320, 'Midea', 'Xtreme Save 3.5', 6.8, 4.1, 23, 52, 'A++ cooling, A+ heating, basic remote'),
    U('good', 'Wall mounted', 5.0, 5.4, 690, 430, 'Midea', 'Xtreme Save 5.0', 6.4, 4.0, 28, 54, 'A++ cooling, A+ heating, basic remote'),
    U('good', 'Wall mounted', 7.1, 7.3, 950, 600, 'Midea', 'Xtreme Save 7.1', 6.2, 3.9, 31, 57, 'A++ cooling, A+ heating, basic remote'),
    U('better', 'Wall mounted', 2.5, 3.2, 690, 360, 'Mitsubishi Electric', 'MSZ-AP25VGK', 8.6, 4.7, 19, 46, 'Very quiet, Wi-Fi built in, 7-day timer'),
    U('better', 'Wall mounted', 3.5, 4.0, 760, 410, 'Mitsubishi Electric', 'MSZ-AP35VGK', 8.6, 4.6, 19, 47, 'Very quiet, Wi-Fi built in, 7-day timer'),
    U('better', 'Wall mounted', 5.0, 5.8, 1020, 560, 'Mitsubishi Electric', 'MSZ-AP50VGK', 7.6, 4.4, 24, 50, 'Very quiet, Wi-Fi built in, 7-day timer'),
    U('better', 'Wall mounted', 7.1, 8.1, 1390, 760, 'Mitsubishi Electric', 'MSZ-AP71VGK', 7.0, 4.3, 30, 53, 'Very quiet, Wi-Fi built in, 7-day timer'),
    U('best', 'Wall mounted', 2.5, 3.4, 860, 440, 'Daikin', 'Perfera FTXM25A', 8.7, 5.1, 19, 44, 'Whisper quiet, Wi-Fi, Flash Streamer air purification, 2-area motion sensor'),
    U('best', 'Wall mounted', 3.5, 4.0, 960, 500, 'Daikin', 'Perfera FTXM35A', 8.7, 5.1, 19, 45, 'Whisper quiet, Wi-Fi, Flash Streamer air purification, 2-area motion sensor'),
    U('best', 'Wall mounted', 5.0, 5.8, 1250, 660, 'Daikin', 'Perfera FTXM50A', 7.5, 4.8, 22, 46, 'Whisper quiet, Wi-Fi, Flash Streamer air purification, 2-area motion sensor'),
    U('best', 'Wall mounted', 7.1, 8.2, 1690, 880, 'Daikin', 'Perfera FTXM71A', 7.0, 4.6, 29, 50, 'Whisper quiet, Wi-Fi, Flash Streamer air purification'),
    U('good', 'Cassette', 5.0, 5.6, 1250, 820, 'Midea', 'Compact cassette 5.0 (600x600)', 6.1, 4.0, 30, 55, 'Fits a ceiling tile, 4-way airflow'),
    U('good', 'Cassette', 7.1, 8.0, 1550, 980, 'Midea', 'Compact cassette 7.1 (600x600)', 5.9, 3.9, 33, 57, 'Fits a ceiling tile, 4-way airflow'),
    U('better', 'Cassette', 5.0, 5.6, 1720, 1050, 'Mitsubishi Electric', 'SLZ-M50FA', 6.5, 4.1, 28, 50, 'Fits a ceiling tile, quiet, wired controller'),
    U('better', 'Cassette', 7.1, 8.0, 2250, 1350, 'Mitsubishi Electric', 'PLA-M71EA', 6.4, 4.1, 31, 52, '840 cassette, round-flow airflow, wired controller'),
    U('best', 'Cassette', 5.0, 5.6, 1990, 1180, 'Daikin', 'FFA50A', 6.9, 4.5, 27, 49, 'Fully flat panel, Wi-Fi, auto-clean filter'),
    U('best', 'Cassette', 7.1, 8.0, 2600, 1500, 'Daikin', 'FCAG71B', 6.7, 4.4, 30, 51, 'Round-flow cassette, Wi-Fi, auto-clean filter'),
    U('better', 'Floor standing', 3.5, 4.5, 1050, 620, 'Mitsubishi Electric', 'MFZ-KT35', 7.8, 4.6, 22, 48, 'Low wall floor unit, good for conservatories'),
    U('better', 'Ducted', 7.1, 8.0, 1900, 1250, 'Mitsubishi Electric', 'SEZ-M71DA', 6.2, 4.2, 30, 53, 'Hidden in the ceiling void, grilles in the room'),
  ],
  multis: [
    M(4.2, 2, 890, 'Mitsubishi Electric', 'MXZ-2F42VF'),
    M(5.3, 2, 1050, 'Mitsubishi Electric', 'MXZ-2F53VF'),
    M(5.4, 3, 1350, 'Mitsubishi Electric', 'MXZ-3F54VF'),
    M(6.8, 3, 1560, 'Mitsubishi Electric', 'MXZ-3F68VF'),
    M(7.2, 4, 1890, 'Mitsubishi Electric', 'MXZ-4F72VF'),
    M(8.3, 4, 2150, 'Mitsubishi Electric', 'MXZ-4F83VF'),
    M(10.2, 5, 2690, 'Mitsubishi Electric', 'MXZ-5F102VF'),
  ],
  coldUnits: [
    CR('condensing', 2.0, 980, 'Tecumseh', 'Silensys 2kW', 2), CR('condensing', 3.5, 1450, 'Tecumseh', 'Silensys 3.5kW', 2),
    CR('condensing', 5.5, 2100, 'Tecumseh', 'Silensys 5.5kW', 2), CR('evaporator', 2.0, 420, 'Searle', 'Cubic 2kW', 2),
    CR('evaporator', 3.5, 560, 'Searle', 'Cubic 3.5kW', 2), CR('evaporator', 5.5, 780, 'Searle', 'Cubic 5.5kW', 2),
    CR('cellar', 2.6, 1650, 'Blue Star', 'Cellar cooler 2.6kW', 12), CR('cellar', 3.8, 1990, 'Blue Star', 'Cellar cooler 3.8kW', 12),
  ],
  items: [
    { id: 'pipe-small', label: 'Pipework 1/4" + 3/8" insulated', unit: 'm', cost: '16', example: true },
    { id: 'pipe-med', label: 'Pipework 1/4" + 1/2" insulated', unit: 'm', cost: '20', example: true },
    { id: 'pipe-large', label: 'Pipework 3/8" + 5/8" insulated', unit: 'm', cost: '26', example: true },
    { id: 'trunking', label: 'White trunking', unit: 'm', cost: '9', example: true },
    { id: 'drain', label: 'Condensate drain pipe', unit: 'm', cost: '4', example: true },
    { id: 'core', label: 'Core drill through wall', unit: 'each', cost: '30', example: true },
    { id: 'bracket', label: 'Outdoor wall bracket', unit: 'each', cost: '38', example: true },
    { id: 'feet', label: 'Outdoor ground feet', unit: 'each', cost: '28', example: true },
    { id: 'avm', label: 'Anti-vibration mounts', unit: 'set', cost: '14', example: true },
    { id: 'guard', label: 'Outdoor unit guard / cage', unit: 'each', cost: '160', example: true },
    { id: 'pump', label: 'Condensate pump', unit: 'each', cost: '95', example: true },
    { id: 'wifi', label: 'Wi-Fi adaptor', unit: 'each', cost: '65', example: true },
    { id: 'controller', label: 'Wired wall controller', unit: 'each', cost: '85', example: true },
    { id: 'isolator', label: 'Rotary isolator', unit: 'each', cost: '22', example: true },
    { id: 'cable', label: 'Power and interconnect cable', unit: 'm', cost: '4', example: true },
    { id: 'spur', label: 'Fused spur from existing circuit', unit: 'each', cost: '45', example: true },
    { id: 'circuit', label: 'New circuit from consumer unit, with test certificate', unit: 'each', cost: '220', example: true },
    { id: 'nitrogen', label: 'Nitrogen, brazing and pressure test consumables', unit: 'each', cost: '28', example: true },
    { id: 'consumables', label: 'Fixings, sealant and sundries', unit: 'each', cost: '25', example: true },
    { id: 'disposal', label: 'Recover refrigerant and dispose of old unit', unit: 'each', cost: '75', example: true },
    { id: 'access', label: 'Tower / platform hire', unit: 'day', cost: '150', example: true },
    { id: 'scaffold', label: 'Scaffold', unit: 'each', cost: '450', example: true },
    { id: 'mewp', label: 'MEWP / cherry picker hire', unit: 'day', cost: '280', example: true },
    { id: 'making-good', label: 'Making good and decoration allowance', unit: 'each', cost: '0', example: true },
    { id: 'panels', label: 'Cold room insulated panels (per m²)', unit: 'm²', cost: '55', example: true },
    { id: 'colddoor', label: 'Cold room door', unit: 'each', cost: '650', example: true },
    { id: 'coldcontrol', label: 'Cold room controller and defrost', unit: 'each', cost: '190', example: true },
  ],
  service: {
    bronze: { perVisit: '55', visits: '1', callout: '0', parts: '0', response: '48 hours' },
    silver: { perVisit: '50', visits: '2', callout: '10', parts: '5', response: '24 hours' },
    gold: { perVisit: '48', visits: '3', callout: '25', parts: '10', response: 'Same day' },
    minimum: '180',
  },
  terms:
    'Price includes supply and installation of the equipment listed, pipework and trunking as shown, commissioning, an F-Gas record and a demonstration of the controls.\n' +
    'Electrical supply is as stated in the build-up. Any upgrade to the consumer unit is extra.\n' +
    'Builders work, making good and decoration are not included unless listed. Pipework is surface mounted in white trunking unless stated.\n' +
    'Equipment carries the manufacturer\'s warranty when serviced annually. Workmanship is guaranteed for the period shown.\n' +
    'Deposit on acceptance, balance on completion. Quote valid for the period shown.',
  exclusions: 'Asbestos survey or removal. Structural alterations. Work outside normal hours unless priced. Parking and congestion charges.',
});

export function getPrice(s) {
  const d = PRICE_DEFAULT();
  const p = (s && s.price) || {};
  const out = { ...d, ...p, hours: { ...d.hours, ...(p.hours || {}) }, service: { ...d.service, ...(p.service || {}) } };
  for (const k of ['units', 'multis', 'coldUnits', 'items']) if (!p[k] || !p[k].length) out[k] = d[k];
  // old single-list price books carried kw/cost only; make them usable
  out.units = out.units.map((x) => ({ kwCool: x.kwCool ?? x.kw ?? 0, kwHeat: x.kwHeat ?? (x.kw ? Math.round(x.kw * 1.15 * 10) / 10 : 0), multiCost: x.multiCost ?? '', seer: x.seer ?? '', scop: x.scop ?? '', dbIn: x.dbIn ?? '', dbOut: x.dbOut ?? '', type: x.type || 'Wall mounted', ...x }));
  return out;
}

export const hasExamples = (price) => [...price.units, ...price.multis, ...price.coldUnits, ...price.items].some((x) => x.example);

// Reads a wholesaler price sheet (CSV). Columns are matched by name, any order.
export function parsePriceCSV(text) {
  const rows = text.split(/\r?\n/).filter((r) => r.trim());
  if (rows.length < 2) return { units: [], errors: ['Nothing to import'] };
  const split = (r) => r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()).filter((_, i, a) => i < a.length - 1 || _ !== '');
  const head = split(rows[0]).map((h) => h.toLowerCase());
  const col = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const c = { make: col('make', 'brand'), model: col('model'), type: col('type'), tier: col('tier', 'range'), kw: col('kw cool', 'cooling', 'kw'), kwh: col('kw heat', 'heating'),
    cost: col('cost', 'price', 'trade'), multi: col('multi'), seer: col('seer'), scop: col('scop'), dbin: col('db in', 'indoor db', 'sound in'), dbout: col('db out', 'outdoor db', 'sound out'), feat: col('feature', 'notes') };
  if (c.model < 0 || c.cost < 0) return { units: [], errors: ['Need at least Model and Cost columns'] };
  const units = [];
  for (const r of rows.slice(1)) {
    const v = split(r);
    const g = (i) => (i >= 0 && v[i] !== undefined ? v[i] : '');
    const tierRaw = g(c.tier).toLowerCase();
    const tier = tierRaw.includes('best') || tierRaw.includes('prem') ? 'best' : tierRaw.includes('good') || tierRaw.includes('basic') || tierRaw.includes('budget') ? 'good' : 'better';
    const typeRaw = g(c.type).toLowerCase();
    const type = typeRaw.includes('cass') ? 'Cassette' : typeRaw.includes('duct') ? 'Ducted' : typeRaw.includes('floor') ? 'Floor standing' : typeRaw.includes('ceil') ? 'Under ceiling' : 'Wall mounted';
    const kw = parseFloat(g(c.kw)) || 0;
    if (!g(c.model) || !kw) continue;
    units.push({ id: uid(), tier, type, kwCool: kw, kwHeat: parseFloat(g(c.kwh)) || Math.round(kw * 1.15 * 10) / 10, cost: g(c.cost).replace(/[£,]/g, ''), multiCost: g(c.multi).replace(/[£,]/g, ''),
      make: g(c.make), model: g(c.model), seer: parseFloat(g(c.seer)) || '', scop: parseFloat(g(c.scop)) || '', dbIn: parseFloat(g(c.dbin)) || '', dbOut: parseFloat(g(c.dbout)) || '', refrigerant: 'R32', features: g(c.feat), example: false });
  }
  return { units, errors: units.length ? [] : ['No rows with a model and a kW figure'] };
}

// ---------- rooms & load ----------

export const ROOM_USES = [
  { id: 'bedroom', label: 'Bedroom', wm2: 80 }, { id: 'living', label: 'Living room', wm2: 100 }, { id: 'conservatory', label: 'Conservatory', wm2: 220 },
  { id: 'office', label: 'Office', wm2: 120 }, { id: 'meeting', label: 'Meeting room', wm2: 140 }, { id: 'shop', label: 'Shop / salon', wm2: 160 },
  { id: 'kitchen', label: 'Kitchen / café', wm2: 200 }, { id: 'gym', label: 'Gym / studio', wm2: 180 }, { id: 'server', label: 'Server / comms room', wm2: 60 }, { id: 'other', label: 'Other', wm2: 120 },
];
export const GLAZING = [{ id: 'low', label: 'Little glass', f: 1 }, { id: 'medium', label: 'Normal windows', f: 1.15 }, { id: 'high', label: 'Lots of glass', f: 1.35 }];
export const ASPECT = [{ id: 'north', label: 'North / east', f: 1 }, { id: 'south', label: 'South / west', f: 1.12 }, { id: 'unknown', label: 'Not sure', f: 1.06 }];

export const blankRoom = () => ({
  name: '', length: '', width: '', height: '2.4', use: 'office', glazing: 'medium', aspect: 'unknown', people: '2', equipmentW: '300', kwOverride: '',
});

export function roomLoad(r) {
  const L = parseFloat(r.length) || 0, W = parseFloat(r.width) || 0, H = parseFloat(r.height) || 2.4;
  const area = L * W;
  if (!area) return { area: 0, watts: 0, kw: 0 };
  const use = ROOM_USES.find((x) => x.id === r.use) || ROOM_USES[3];
  const g = GLAZING.find((x) => x.id === r.glazing) || GLAZING[1];
  const a = ASPECT.find((x) => x.id === r.aspect) || ASPECT[2];
  let watts = area * use.wm2 * g.f * a.f;
  if (H > 2.7) watts *= 1 + (H - 2.7) * 0.1;
  watts += (parseInt(r.people, 10) || 0) * 100 + (parseFloat(r.equipmentW) || 0);
  if (r.use === 'server') watts = Math.max(watts, (parseFloat(r.equipmentW) || 0) * 1.3 + area * 40);
  return { area: Math.round(area * 10) / 10, watts: Math.round(watts), kw: Math.ceil((watts / 1000) * 10) / 10 };
}
export const roomKw = (r) => (parseFloat(r.kwOverride) > 0 ? parseFloat(r.kwOverride) : roomLoad(r).kw);

// ---------- systems ----------

export const blankIndoor = (room) => ({
  id: uid(), room: room || blankRoom(), unitType: 'Wall mounted', pick: 'auto', spot: '', pipeM: '5', trunkingM: '3', drain: 'gravity', drainM: '2', coreDrills: '1',
  wifi: false, controller: false, photos: [], notes: '',
});
export const blankSystem = (kind = 'split') => ({
  id: uid(), name: '', kind, indoors: [blankIndoor()], outdoor: { pick: 'auto', spot: '', mount: 'bracket', avm: true, guard: false, cableM: '8', supply: 'spur', disposal: false, photos: [] },
  access: { kind: 'none', days: '1' }, hoursOverride: '', engineers: '', cold: { kw: '', tempC: '2', panelsM2: '', door: false },
  overrides: {}, custom: [],
});

export const TEMPLATES = [
  { id: 'domestic-single', label: 'Home, single room', blurb: 'One wall unit, one outdoor. The everyday job.', kind: 'install', systems: [{ kind: 'split', use: 'living' }] },
  { id: 'domestic-multi', label: 'Home, several rooms', blurb: 'Two or three rooms off one outdoor unit.', kind: 'install', systems: [{ kind: 'multi', use: 'bedroom', n: 2 }] },
  { id: 'office', label: 'Office or shop', blurb: 'Cassettes or wall units, commercial build-up.', kind: 'install', systems: [{ kind: 'split', use: 'office', type: 'Cassette' }] },
  { id: 'server', label: 'Server room', blurb: 'Two units, one running and one on standby.', kind: 'install', systems: [{ kind: 'split', use: 'server' }, { kind: 'split', use: 'server' }] },
  { id: 'cold', label: 'Cold room or cellar', blurb: 'Condensing unit, evaporator, controls.', kind: 'install', systems: [{ kind: 'cold' }] },
  { id: 'replace', label: 'Replace an old unit', blurb: 'Like for like, with removal priced in.', kind: 'install', systems: [{ kind: 'split', use: 'living', disposal: true }] },
  { id: 'service', label: 'Service contract', blurb: 'Annual maintenance, three levels.', kind: 'service' },
  { id: 'repair', label: 'Repair or small works', blurb: 'Parts and labour, from a job sheet or from scratch.', kind: 'works' },
];

export function applyTemplate(q, t) {
  q.template = t.id;
  q.kind = t.kind;
  if (t.kind === 'install') {
    q.systems = t.systems.map((s, i) => {
      const sys = blankSystem(s.kind);
      sys.name = t.systems.length > 1 ? `System ${i + 1}` : '';
      if (s.kind === 'multi') sys.indoors = Array.from({ length: s.n || 2 }, () => blankIndoor({ ...blankRoom(), use: s.use || 'bedroom' }));
      else if (s.kind === 'cold') sys.indoors = [];
      else { sys.indoors[0].room.use = s.use || 'office'; if (s.type) sys.indoors[0].unitType = s.type; }
      if (s.disposal) sys.outdoor.disposal = true;
      return sys;
    });
  }
  if (t.kind === 'service') q.service = { tier: 'silver', units: [], visits: '', notes: '' };
  if (t.kind === 'works') q.works = { lines: [{ id: uid(), label: '', qty: '1', each: '' }], hours: '', engineers: '1', fromJob: '' };
  return q;
}

export const QUOTE_DEFAULT = () => ({
  kind: 'install', template: '', title: '', summary: '', systems: [], extras: [], discount: '', offered: ['good', 'better', 'best'], recommended: 'better',
  accepted: { tier: '', at: null }, survey: { parking: '', access: '', power: 'Existing supply nearby', notes: '' },
  pipeline: { status: 'draft', sentAt: null, chaseAt: null, lostReason: '', revision: 1, parentId: '' },
  service: null, works: null,
});

// Quotes made with the first version had rooms, not systems. Bring them across.
export function migrateQuote(q) {
  if (!q || q.systems) return q;
  const d = QUOTE_DEFAULT();
  const rooms = q.rooms || [];
  d.systems = rooms.map((r) => { const s = blankSystem('split'); s.indoors = [{ ...blankIndoor({ ...blankRoom(), ...r, name: r.name || '' }), unitType: r.unitType || 'Wall mounted', spot: r.indoorSpot || '', pipeM: r.pipeM || '5', trunkingM: r.trunkingM || '3', photos: r.photos || [] }]; s.outdoor.spot = r.outdoorSpot || ''; return s; });
  Object.assign(d, { template: rooms.length ? 'domestic-single' : '', title: q.title || '', summary: q.summary || '', extras: q.extras || [], discount: q.discount || '', offered: q.offered || d.offered, recommended: q.recommended || 'better', accepted: q.accepted || d.accepted, survey: q.survey || d.survey });
  return d;
}

// ---------- pricing ----------

const money = (n) => Math.round(n * 100) / 100;
const PIPE_FOR_KW = (kw) => (kw <= 3.5 ? 'pipe-small' : kw <= 5 ? 'pipe-med' : 'pipe-large');

export function pickUnit(units, tier, kw, type) {
  const list = units.filter((x) => x.tier === tier && (x.type || 'Wall mounted') === type).sort((a, b) => a.kwCool - b.kwCool);
  if (!list.length) return null;
  return list.find((x) => x.kwCool >= kw) || list[list.length - 1];
}
export function pickMulti(multis, totalKw, n) {
  const list = multis.filter((m) => m.maxIndoors >= n).sort((a, b) => a.kw - b.kw);
  // Multi outdoors are normally allowed to run up to about 130% connected capacity.
  return list.find((m) => m.kw * 1.3 >= totalKw) || list[list.length - 1] || null;
}

export function systemHours(sys, price) {
  if (sys.hoursOverride !== '' && !isNaN(parseFloat(sys.hoursOverride))) return parseFloat(sys.hoursOverride);
  const h = price.hours;
  if (sys.kind === 'cold') return parseFloat(h.coldRoom) || 16;
  let hrs = 0;
  sys.indoors.forEach((ind, i) => {
    hrs += i === 0 ? parseFloat(h.firstIndoor) || 7 : parseFloat(h.extraIndoor) || 4;
    if (ind.unitType === 'Cassette' || ind.unitType === 'Under ceiling') hrs += parseFloat(h.cassette) || 3;
    if (ind.unitType === 'Ducted') hrs += parseFloat(h.ducted) || 6;
    if (ind.unitType === 'Floor standing') hrs += parseFloat(h.floor) || 1;
  });
  if (sys.kind === 'multi') hrs += parseFloat(h.multiOutdoor) || 2;
  return hrs;
}
export const systemEngineers = (sys) => (sys.engineers !== '' && parseInt(sys.engineers, 10) > 0 ? parseInt(sys.engineers, 10) : sys.kind === 'multi' || sys.kind === 'cold' || sys.indoors.some((i) => i.unitType !== 'Wall mounted') ? 2 : 1);

// The cost build-up for one system at one tier. Every line has a key so the user can override it.
export function buildSystem(sys, tier, price) {
  const item = (id) => price.items.find((x) => x.id === id);
  const mkE = 1 + (parseFloat(price.markupEquip) || 0) / 100, mkS = 1 + (parseFloat(price.markupSundries) || 0) / 100;
  const lines = [];
  const add = (key, group, label, qty, cost, unit, mk) => {
    const o = sys.overrides[key] || {};
    if (o.off) return;
    const q = o.qty !== undefined ? parseFloat(o.qty) || 0 : qty;
    const c = parseFloat(cost) || 0;
    const each = o.each !== undefined ? parseFloat(o.each) || 0 : money(c * mk);
    lines.push({ key, group, label: o.label || label, qty: q, unit, cost: money(c * q), each, total: money(each * q), overridden: !!(o.qty !== undefined || o.each !== undefined || o.label) });
  };
  const units = [];
  if (sys.kind === 'cold') {
    const kw = parseFloat(sys.cold.kw) || 0;
    const pick = (kind) => { const l = price.coldUnits.filter((x) => x.kind === kind).sort((a, b) => a.kw - b.kw); return l.find((x) => x.kw >= kw) || l[l.length - 1]; };
    const isCellar = parseFloat(sys.cold.tempC) >= 8;
    if (isCellar) { const c = pick('cellar'); if (c) { units.push({ role: 'cellar', unit: c }); add('u-cellar', 'equipment', `${c.make} ${c.model}`, 1, c.cost, 'each', mkE); } }
    else {
      const cu = pick('condensing'), ev = pick('evaporator');
      if (cu) { units.push({ role: 'condensing', unit: cu }); add('u-cu', 'equipment', `${cu.make} ${cu.model} condensing unit`, 1, cu.cost, 'each', mkE); }
      if (ev) { units.push({ role: 'evaporator', unit: ev }); add('u-ev', 'equipment', `${ev.make} ${ev.model} evaporator`, 1, ev.cost, 'each', mkE); }
      if (item('coldcontrol')) add('coldcontrol', 'equipment', item('coldcontrol').label, 1, item('coldcontrol').cost, 'each', mkS);
    }
    if (parseFloat(sys.cold.panelsM2) > 0 && item('panels')) add('panels', 'builders', 'Insulated panels', parseFloat(sys.cold.panelsM2), item('panels').cost, 'm²', mkS);
    if (sys.cold.door && item('colddoor')) add('colddoor', 'builders', item('colddoor').label, 1, item('colddoor').cost, 'each', mkS);
    if (item('pipe-med')) add('pipe', 'pipework', 'Refrigeration pipework insulated', parseFloat(sys.indoors[0]?.pipeM) || 6, item('pipe-med').cost, 'm', mkS);
  } else {
    let multi = null;
    if (sys.kind === 'multi') {
      // size the outdoor on the indoor units actually picked, not the raw room loads
      const connected = sys.indoors.reduce((a, ind) => { const u = ind.pick !== 'auto' ? price.units.find((x) => x.id === ind.pick) : pickUnit(price.units, tier, roomKw(ind.room), ind.unitType); return a + (u ? u.kwCool : roomKw(ind.room)); }, 0);
      multi = sys.outdoor.pick !== 'auto' ? price.multis.find((m) => m.id === sys.outdoor.pick) : pickMulti(price.multis, connected, sys.indoors.length);
      if (multi) { units.push({ role: 'outdoor', unit: multi }); add('u-out', 'equipment', `${multi.make} ${multi.model} outdoor unit (${multi.kw}kW, up to ${multi.maxIndoors} rooms)`, 1, multi.cost, 'each', mkE); }
    }
    sys.indoors.forEach((ind, i) => {
      const kw = roomKw(ind.room);
      const u = ind.pick !== 'auto' ? price.units.find((x) => x.id === ind.pick) : pickUnit(price.units, tier, kw, ind.unitType);
      const rn = ind.room.name || `Room ${i + 1}`;
      if (u) {
        units.push({ role: 'indoor', unit: u, indoor: ind, kw });
        const cost = sys.kind === 'multi' ? (u.multiCost || u.cost) : u.cost;
        add(`u-${ind.id}`, 'equipment', `${rn}: ${u.make} ${u.model} (${u.kwCool}kW)${sys.kind === 'multi' ? '' : ' with outdoor unit'}`, 1, cost, 'each', mkE);
      }
      const pipe = item(PIPE_FOR_KW(u ? u.kwCool : kw));
      if (pipe && parseFloat(ind.pipeM) > 0) add(`pipe-${ind.id}`, 'pipework', `${rn}: ${pipe.label}`, parseFloat(ind.pipeM), pipe.cost, 'm', mkS);
      if (item('trunking') && parseFloat(ind.trunkingM) > 0) add(`trunk-${ind.id}`, 'pipework', `${rn}: trunking`, parseFloat(ind.trunkingM), item('trunking').cost, 'm', mkS);
      if (item('core') && parseInt(ind.coreDrills, 10) > 0) add(`core-${ind.id}`, 'builders', `${rn}: core drill`, parseInt(ind.coreDrills, 10), item('core').cost, 'each', mkS);
      if (ind.drain === 'pump' && item('pump')) add(`pump-${ind.id}`, 'equipment', `${rn}: condensate pump`, 1, item('pump').cost, 'each', mkS);
      else if (item('drain') && parseFloat(ind.drainM) > 0) add(`drain-${ind.id}`, 'pipework', `${rn}: condensate drain`, parseFloat(ind.drainM), item('drain').cost, 'm', mkS);
      if (ind.wifi && item('wifi')) add(`wifi-${ind.id}`, 'equipment', `${rn}: Wi-Fi adaptor`, 1, item('wifi').cost, 'each', mkS);
      if (ind.controller && item('controller')) add(`ctrl-${ind.id}`, 'equipment', `${rn}: wired controller`, 1, item('controller').cost, 'each', mkS);
    });
    const o = sys.outdoor;
    if (item(o.mount === 'feet' ? 'feet' : 'bracket')) add('mount', 'equipment', item(o.mount === 'feet' ? 'feet' : 'bracket').label, 1, item(o.mount === 'feet' ? 'feet' : 'bracket').cost, 'each', mkS);
    if (o.avm && item('avm')) add('avm', 'equipment', item('avm').label, 1, item('avm').cost, 'set', mkS);
    if (o.guard && item('guard')) add('guard', 'equipment', item('guard').label, 1, item('guard').cost, 'each', mkS);
    if (item('isolator')) add('isolator', 'electrics', item('isolator').label, 1, item('isolator').cost, 'each', mkS);
    if (item('cable') && parseFloat(o.cableM) > 0) add('cable', 'electrics', item('cable').label, parseFloat(o.cableM), item('cable').cost, 'm', mkS);
    if (o.supply === 'spur' && item('spur')) add('spur', 'electrics', item('spur').label, 1, item('spur').cost, 'each', mkS);
    if (o.supply === 'circuit' && item('circuit')) add('circuit', 'electrics', item('circuit').label, 1, item('circuit').cost, 'each', mkS);
    if (o.disposal && item('disposal')) add('disposal', 'other', item('disposal').label, 1, item('disposal').cost, 'each', mkS);
  }
  if (item('nitrogen')) add('nitrogen', 'other', item('nitrogen').label, 1, item('nitrogen').cost, 'each', mkS);
  if (item('consumables')) add('consumables', 'other', item('consumables').label, 1, item('consumables').cost, 'each', mkS);
  const acc = sys.access || { kind: 'none' };
  if (acc.kind === 'tower' && item('access')) add('access', 'access', item('access').label, parseFloat(acc.days) || 1, item('access').cost, 'day', mkS);
  if (acc.kind === 'scaffold' && item('scaffold')) add('access', 'access', item('scaffold').label, 1, item('scaffold').cost, 'each', mkS);
  if (acc.kind === 'mewp' && item('mewp')) add('access', 'access', item('mewp').label, parseFloat(acc.days) || 1, item('mewp').cost, 'day', mkS);
  (sys.custom || []).forEach((c) => { if (c.label) lines.push({ key: c.id, group: 'other', label: c.label, qty: parseFloat(c.qty) || 1, unit: 'each', cost: money((parseFloat(c.cost) || 0) * (parseFloat(c.qty) || 1)), each: parseFloat(c.each) || 0, total: money((parseFloat(c.each) || 0) * (parseFloat(c.qty) || 1)), custom: true }); });
  const hours = systemHours(sys, price), eng = systemEngineers(sys);
  const rate = parseFloat(price.labourRate) || 0;
  const labourCost = money(hours * eng * rate * 0.55); // what the engineers cost him, for the margin view
  const labour = money(hours * eng * rate);
  const materials = money(lines.reduce((a, l) => a + l.total, 0));
  const materialsCost = money(lines.reduce((a, l) => a + l.cost, 0));
  const capacity = sys.kind === 'multi' ? multiCheck(units) : null;
  return { units, lines, hours, engineers: eng, labour, labourCost, materials, materialsCost, capacity };
}

function multiCheck(units) {
  const out = units.find((u) => u.role === 'outdoor');
  const ind = units.filter((u) => u.role === 'indoor');
  if (!out) return { ok: false, text: 'No outdoor unit big enough in the price book' };
  const connected = ind.reduce((a, u) => a + u.unit.kwCool, 0);
  const pct = Math.round((connected / out.unit.kw) * 100);
  if (ind.length > out.unit.maxIndoors) return { ok: false, text: `${ind.length} rooms but the outdoor takes ${out.unit.maxIndoors}` };
  if (pct > 130) return { ok: false, text: `${pct}% connected, too much for this outdoor` };
  return { ok: true, text: `${pct}% connected (${connected}kW on a ${out.unit.kw}kW outdoor)` };
}

export function priceQuote(q, price) {
  const vat = (parseFloat(price.vat) || 0) / 100;
  const oh = (parseFloat(price.overhead) || 0) / 100, cont = (parseFloat(price.contingency) || 0) / 100;
  const options = TIERS.map((t) => {
    let systems = [], materials = 0, materialsCost = 0, labour = 0, labourCost = 0, hours = 0;
    if (q.kind === 'install') {
      systems = q.systems.map((s) => ({ sys: s, ...buildSystem(s, t.id, price) }));
      systems.forEach((s) => { materials += s.materials; materialsCost += s.materialsCost; labour += s.labour; labourCost += s.labourCost; hours += s.hours * s.engineers; });
    } else if (q.kind === 'works' && q.works) {
      const lines = q.works.lines.filter((l) => l.label).map((l) => ({ key: l.id, group: 'other', label: l.label, qty: parseFloat(l.qty) || 1, unit: 'each', cost: money((parseFloat(l.cost) || 0) * (parseFloat(l.qty) || 1)), each: parseFloat(l.each) || 0, total: money((parseFloat(l.each) || 0) * (parseFloat(l.qty) || 1)) }));
      const h = parseFloat(q.works.hours) || 0, e = parseInt(q.works.engineers, 10) || 1;
      materials = money(lines.reduce((a, l) => a + l.total, 0)); materialsCost = money(lines.reduce((a, l) => a + l.cost, 0));
      labour = money(h * e * (parseFloat(price.labourRate) || 0)); labourCost = money(labour * 0.55); hours = h * e;
      systems = [{ sys: null, lines, hours: h, engineers: e, labour, materials, units: [] }];
    } else if (q.kind === 'service' && q.service) {
      const lvl = price.service[t.id === 'good' ? 'bronze' : t.id === 'better' ? 'silver' : 'gold'];
      const n = q.service.units.length || 0, visits = parseInt(q.service.visits, 10) || parseInt(lvl.visits, 10) || 1;
      const perVisit = parseFloat(lvl.perVisit) || 0;
      const annual = Math.max(parseFloat(price.service.minimum) || 0, n * visits * perVisit);
      materials = 0; labour = money(annual); hours = n * visits * (parseFloat(price.hours.serviceVisitPerUnit) || 0.75);
      labourCost = money(hours * (parseFloat(price.labourRate) || 0) * 0.55);
      systems = [{ sys: null, lines: [], hours, engineers: 1, labour, materials, units: [], serviceLevel: { ...lvl, visits, n, perVisit } }];
    }
    const extras = money((q.extras || []).reduce((a, e) => a + (parseFloat(e.price) || 0), 0));
    const net = money((materials + labour + extras) * (1 + oh) * (1 + cont));
    const disc = money(net * ((parseFloat(q.discount) || 0) / 100));
    const subtotal = money(net - disc), vatAmt = money(subtotal * vat);
    const costTotal = money(materialsCost + labourCost + extras * 0.7);
    const profit = money(subtotal - costTotal);
    const available = q.kind !== 'install' || systems.every((s) => s.units.length > 0 || s.sys.kind === 'cold');
    return { tier: t, systems, materials, labour, hours, extras, net, discount: disc, subtotal, vat: vatAmt, total: money(subtotal + vatAmt), costTotal, profit, marginPct: subtotal ? Math.round((profit / subtotal) * 100) : 0, available };
  });
  return { options, offered: options.filter((o) => q.offered.includes(o.tier.id)) };
}

// Running costs from the unit's efficiency figures.
export function runningCost(unit, tariff) {
  if (!unit || !unit.kwCool) return null;
  const t = parseFloat(tariff) || 0.27;
  const seer = parseFloat(unit.seer) || 6, scop = parseFloat(unit.scop) || 4;
  const coolPerHour = (unit.kwCool / seer) * t;
  const heatPerKwh = t / scop;
  return { coolPerHour, heatPerKwh, heatSavingPct: Math.round((1 - 1 / scop) * 100), seer, scop };
}
export function soundWords(db) {
  const d = parseFloat(db);
  if (!d) return '';
  if (d <= 21) return 'quieter than a whisper';
  if (d <= 28) return 'about as quiet as a library';
  if (d <= 36) return 'a quiet office';
  if (d <= 45) return 'a normal conversation';
  return 'noticeable';
}

export const fmtGBP = (n) => '£' + (Math.round(n * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const fmtGBP0 = (n) => '£' + Math.round(n).toLocaleString('en-GB');

// Materials to order for the accepted option.
export function pickList(q, price, tierId) {
  const p = priceQuote(q, price);
  const o = p.options.find((x) => x.tier.id === tierId);
  if (!o) return [];
  const rows = [];
  o.systems.forEach((s) => s.lines.forEach((l) => { if (l.group !== 'access') rows.push({ item: l.label, qty: l.qty, unit: l.unit }); }));
  return rows;
}
