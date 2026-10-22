// Quote builder: price list, room survey, cooling load and the three-option pricing.

import { uid } from './util.js';

// ---------- price list (lives in Settings; these are starting figures to change) ----------

export const TIERS = [
  { id: 'good', label: 'Good', blurb: 'Reliable, keeps the cost down' },
  { id: 'better', label: 'Better', blurb: 'Quieter, more efficient, the one most people pick' },
  { id: 'best', label: 'Best', blurb: 'Top of the range: quietest, Wi-Fi, best filtration' },
];

export const UNIT_TYPES_Q = ['Wall mounted', 'Cassette', 'Ducted', 'Floor standing', 'Multi-split'];

const u = (tier, kw, cost, make, model, feat) => ({ id: uid(), tier, kw, cost: String(cost), make, model, type: 'Wall mounted', features: feat, example: true });

export const PRICE_DEFAULT = () => ({
  markup: '25',        // % added to all materials
  labourRate: '45',    // £ per hour per engineer
  hoursFirst: '7',     // hours for the first unit on a job
  hoursExtra: '4',     // hours for each extra unit
  vat: '20',
  validityDays: '30',
  deposit: '25',       // % deposit on acceptance
  units: [
    u('good', 2.5, 420, 'Midea', 'Breezeless 2.5kW', 'A++ cooling, basic remote'),
    u('good', 3.5, 480, 'Midea', 'Breezeless 3.5kW', 'A++ cooling, basic remote'),
    u('good', 5.0, 640, 'Midea', 'Breezeless 5.0kW', 'A++ cooling, basic remote'),
    u('good', 7.1, 880, 'Midea', 'Breezeless 7.1kW', 'A++ cooling, basic remote'),
    u('better', 2.5, 620, 'Mitsubishi Electric', 'MSZ-AP25', 'Very quiet, A+++ cooling, Wi-Fi ready'),
    u('better', 3.5, 690, 'Mitsubishi Electric', 'MSZ-AP35', 'Very quiet, A+++ cooling, Wi-Fi ready'),
    u('better', 5.0, 920, 'Mitsubishi Electric', 'MSZ-AP50', 'Very quiet, A+++ cooling, Wi-Fi ready'),
    u('better', 7.1, 1250, 'Mitsubishi Electric', 'MSZ-AP71', 'Very quiet, A+++ cooling, Wi-Fi ready'),
    u('best', 2.5, 790, 'Daikin', 'Perfera FTXM25', 'Whisper quiet, Wi-Fi built in, Flash Streamer air purification'),
    u('best', 3.5, 880, 'Daikin', 'Perfera FTXM35', 'Whisper quiet, Wi-Fi built in, Flash Streamer air purification'),
    u('best', 5.0, 1150, 'Daikin', 'Perfera FTXM50', 'Whisper quiet, Wi-Fi built in, Flash Streamer air purification'),
    u('best', 7.1, 1540, 'Daikin', 'Perfera FTXM71', 'Whisper quiet, Wi-Fi built in, Flash Streamer air purification'),
  ],
  items: [
    { id: 'pipe-small', label: 'Pipework 1/4" + 3/8" (per metre, insulated)', unit: 'm', cost: '16', example: true },
    { id: 'pipe-med', label: 'Pipework 1/4" + 1/2" (per metre, insulated)', unit: 'm', cost: '20', example: true },
    { id: 'pipe-large', label: 'Pipework 3/8" + 5/8" (per metre, insulated)', unit: 'm', cost: '26', example: true },
    { id: 'trunking', label: 'Trunking (per metre)', unit: 'm', cost: '9', example: true },
    { id: 'bracket', label: 'Outdoor wall bracket', unit: 'each', cost: '38', example: true },
    { id: 'feet', label: 'Outdoor ground feet', unit: 'each', cost: '28', example: true },
    { id: 'pump', label: 'Condensate pump', unit: 'each', cost: '95', example: true },
    { id: 'electrics', label: 'Electrical supply (isolator, cable, fused spur)', unit: 'each', cost: '110', example: true },
    { id: 'consumables', label: 'Consumables, fixings, sealant', unit: 'each', cost: '25', example: true },
    { id: 'disposal', label: 'Remove and dispose of old unit', unit: 'each', cost: '60', example: true },
    { id: 'access', label: 'Access equipment (tower / platform) per day', unit: 'day', cost: '150', example: true },
  ],
  terms:
    'Price includes supply and installation of the equipment listed, pipework and trunking as shown, commissioning and a demonstration of the controls.\n' +
    'Electrical supply is a fused spur from an existing circuit within 5 metres unless stated. Any upgrades to the consumer unit are extra.\n' +
    'Builders work, making good and decoration are not included. Pipework is surface mounted in white trunking unless stated.\n' +
    'Equipment carries the manufacturer\'s warranty. Workmanship is guaranteed for 12 months. An annual service keeps the warranty valid.\n' +
    'Deposit on acceptance, balance on completion. Quote valid for the period shown.',
});

export const getPrice = (s) => {
  const d = PRICE_DEFAULT();
  const p = s.price || {};
  return { ...d, ...p, units: p.units && p.units.length ? p.units : d.units, items: p.items && p.items.length ? p.items : d.items };
};

// ---------- rooms ----------

export const ROOM_USES = [
  { id: 'bedroom', label: 'Bedroom', wm2: 80 },
  { id: 'living', label: 'Living room', wm2: 100 },
  { id: 'office', label: 'Office', wm2: 120 },
  { id: 'meeting', label: 'Meeting room', wm2: 140 },
  { id: 'shop', label: 'Shop / salon', wm2: 160 },
  { id: 'kitchen', label: 'Kitchen / café', wm2: 200 },
  { id: 'server', label: 'Server / comms room', wm2: 60 },
  { id: 'other', label: 'Other', wm2: 120 },
];
export const GLAZING = [
  { id: 'low', label: 'Little glass', f: 1 },
  { id: 'medium', label: 'Normal windows', f: 1.15 },
  { id: 'high', label: 'Lots of glass', f: 1.35 },
];
export const ASPECT = [
  { id: 'north', label: 'North / east', f: 1 },
  { id: 'south', label: 'South / west', f: 1.12 },
  { id: 'unknown', label: 'Not sure', f: 1.06 },
];
export const PIPE_FOR_KW = (kw) => (kw <= 3.5 ? 'pipe-small' : kw <= 5 ? 'pipe-med' : 'pipe-large');

export const blankRoom = () => ({
  id: uid(), name: '', length: '', width: '', height: '2.4', use: 'office', glazing: 'medium', aspect: 'unknown',
  people: '2', equipmentW: '300', unitType: 'Wall mounted', indoorSpot: '', outdoorSpot: '',
  pipeM: '5', trunkingM: '3', mount: 'bracket', pump: false, electrics: true, disposal: false, accessDays: '0',
  photos: [], notes: '', kwOverride: '',
});

export function roomLoad(r) {
  const L = parseFloat(r.length) || 0, W = parseFloat(r.width) || 0, H = parseFloat(r.height) || 2.4;
  const area = L * W;
  if (!area) return { area: 0, watts: 0, kw: 0 };
  const use = ROOM_USES.find((x) => x.id === r.use) || ROOM_USES[2];
  const g = GLAZING.find((x) => x.id === r.glazing) || GLAZING[1];
  const a = ASPECT.find((x) => x.id === r.aspect) || ASPECT[2];
  let watts = area * use.wm2 * g.f * a.f;
  if (H > 2.7) watts *= 1 + (H - 2.7) * 0.1;
  watts += (parseInt(r.people, 10) || 0) * 100;
  watts += parseFloat(r.equipmentW) || 0;
  if (r.use === 'server') watts = Math.max(watts, (parseFloat(r.equipmentW) || 0) * 1.3 + area * 40);
  const kw = Math.ceil((watts / 1000) * 10) / 10;
  return { area: Math.round(area * 10) / 10, watts: Math.round(watts), kw };
}

export const roomKw = (r) => (parseFloat(r.kwOverride) > 0 ? parseFloat(r.kwOverride) : roomLoad(r).kw);

// Smallest unit of the tier that covers the load (nearest below if nothing covers it).
export function pickUnit(units, tier, kw, type) {
  const list = units.filter((x) => x.tier === tier && (!type || !x.type || x.type === type || type === 'Multi-split')).sort((a, b) => a.kw - b.kw);
  if (!list.length) return null;
  return list.find((x) => x.kw >= kw) || list[list.length - 1];
}

const money = (n) => Math.round(n * 100) / 100;

export function priceRoom(room, tier, price) {
  const kw = roomKw(room);
  const unit = pickUnit(price.units, tier, kw, room.unitType);
  const mk = 1 + (parseFloat(price.markup) || 0) / 100;
  const item = (id) => price.items.find((x) => x.id === id);
  const line = (label, qty, cost, unitLabel) => ({ label, qty, each: money((parseFloat(cost) || 0) * mk), total: money(qty * (parseFloat(cost) || 0) * mk), unitLabel });
  const lines = [];
  if (unit) lines.push(line(`${unit.make} ${unit.model} (${unit.kw}kW)`, 1, unit.cost, 'each'));
  const pipe = item(PIPE_FOR_KW(unit ? unit.kw : kw));
  if (pipe && parseFloat(room.pipeM) > 0) lines.push(line(pipe.label.replace(/ \(per metre.*\)/, ''), parseFloat(room.pipeM), pipe.cost, 'm'));
  const tr = item('trunking');
  if (tr && parseFloat(room.trunkingM) > 0) lines.push(line('Trunking', parseFloat(room.trunkingM), tr.cost, 'm'));
  const mount = item(room.mount === 'feet' ? 'feet' : 'bracket');
  if (mount) lines.push(line(mount.label, 1, mount.cost, 'each'));
  if (room.pump && item('pump')) lines.push(line('Condensate pump', 1, item('pump').cost, 'each'));
  if (room.electrics && item('electrics')) lines.push(line('Electrical supply', 1, item('electrics').cost, 'each'));
  if (item('consumables')) lines.push(line('Consumables and fixings', 1, item('consumables').cost, 'each'));
  if (room.disposal && item('disposal')) lines.push(line('Remove old unit', 1, item('disposal').cost, 'each'));
  if (parseFloat(room.accessDays) > 0 && item('access')) lines.push(line('Access equipment', parseFloat(room.accessDays), item('access').cost, 'day'));
  const materials = money(lines.reduce((a, l) => a + l.total, 0));
  return { unit, kw, lines, materials };
}

export function priceQuote(q, price) {
  const rooms = q.rooms.filter((r) => roomKw(r) > 0);
  const rate = parseFloat(price.labourRate) || 0;
  const hours = rooms.length ? (parseFloat(price.hoursFirst) || 0) + Math.max(0, rooms.length - 1) * (parseFloat(price.hoursExtra) || 0) : 0;
  const labour = money(hours * rate * (q.engineers || 1));
  const vat = (parseFloat(price.vat) || 0) / 100;
  const options = TIERS.map((t) => {
    const perRoom = rooms.map((r) => ({ room: r, ...priceRoom(r, t.id, price) }));
    const materials = money(perRoom.reduce((a, x) => a + x.materials, 0));
    const extras = money((q.extras || []).reduce((a, e) => a + (parseFloat(e.price) || 0), 0));
    const net = money(materials + labour + extras);
    const disc = money(net * ((parseFloat(q.discount) || 0) / 100));
    const subtotal = money(net - disc);
    const vatAmt = money(subtotal * vat);
    return { tier: t, perRoom, materials, labour, extras, net, discount: disc, subtotal, vat: vatAmt, total: money(subtotal + vatAmt), available: perRoom.every((x) => x.unit) };
  });
  return { rooms, hours, labour, options };
}

export const fmtGBP = (n) => '£' + (Math.round(n * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const fmtGBP0 = (n) => '£' + Math.round(n).toLocaleString('en-GB');

export const QUOTE_DEFAULT = () => ({
  title: '', summary: '', rooms: [blankRoom()], extras: [], discount: '', engineers: 1,
  offered: ['good', 'better', 'best'], recommended: 'better',
  accepted: { tier: '', at: null, name: '' },
  survey: { parking: '', access: '', power: 'Existing supply nearby', notes: '' },
});
