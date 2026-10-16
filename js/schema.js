// Job types, checklists, default wording and the risk assessment hazard library.
// Wording is taken from Comfyair's existing paperwork, tidied up.

import { uid, todayISO } from './util.js';

export const COMPANY_DEFAULT = {
  name: 'Comfyair',
  address: 'Unit 2 Laurel Street, Bradford, West Yorkshire, BD3 9TP',
  tel: '08445 610 023',
  email: 'contact@comfyair.co.uk',
  fgas: 'Ref1013901',
  website: '',
};

export const JOB_TYPES = {
  service: {
    id: 'service',
    label: 'Service sheet',
    blurb: 'Services, call outs and repairs on one unit',
    pdfTitle: 'Service / Maintenance Sheet',
    fileLabel: 'Service Sheet',
    icon: 'fan',
    tone: 'orange',
  },
  vrf: {
    id: 'vrf',
    label: 'Multi-unit report',
    blurb: 'VRF and whole-site services, every unit listed',
    pdfTitle: 'VRF Service and Maintenance Report',
    fileLabel: 'Service Report',
    icon: 'grid',
    tone: 'navy',
  },
  commissioning: {
    id: 'commissioning',
    label: 'Commissioning',
    blurb: 'New installs: pressures, vacuum, gas and readings',
    pdfTitle: 'Air Conditioning Commissioning Report',
    fileLabel: 'Commissioning Report',
    icon: 'gauge',
    tone: 'sky',
  },
  rams: {
    id: 'rams',
    label: 'RAMS',
    blurb: 'Method statement and risk assessment together',
    pdfTitle: 'Method Statement & Risk Assessment',
    fileLabel: 'RAMS',
    icon: 'shield',
    tone: 'slate',
  },
};

export const TYPE_ORDER = ['service', 'vrf', 'commissioning', 'rams'];

// Not a job, but shares the PDF and sharing machinery.
JOB_TYPES.timesheet = {
  id: 'timesheet', label: 'Timesheet', blurb: '', pdfTitle: 'Weekly Timesheet', fileLabel: 'Timesheet', icon: 'clock', tone: 'navy',
};

export const SERVICE_TYPES = ['Service', 'Call out', 'Repair', 'Installation', 'Survey'];
export const VRF_JOB_TYPES = ['Service', 'Repair', 'Call out'];
export const COMPLETION = ['Complete', 'Ongoing', 'Return visit needed'];
export const UNIT_TYPES = ['Wall mounted', 'Cassette', 'Ducted', 'Floor / ceiling', 'AHU', 'Outdoor unit', 'Other'];
export const MAKES = [
  'Mitsubishi Electric', 'Mitsubishi Heavy', 'Daikin', 'Fujitsu', 'Toshiba', 'Samsung',
  'LG', 'Hitachi', 'Panasonic', 'Midea', 'Gree', 'Carrier', 'Sanyo',
];
export const GASES = ['R32', 'R410A', 'R22', 'R407C', 'R134a', 'R290', 'R454B'];
export const PIPE_SIZES = ['1/4', '3/8', '1/2', '5/8', '3/4', '7/8', '1 1/8'];

export const CHECK_STATUSES = ['Pass', 'Fail', 'Cleaned', 'Replaced', 'Adjusted', 'N/A'];

export const SERVICE_CHECKS = [
  { id: 'coils', label: 'Check cooling and coils are free from obstruction, clean as required' },
  { id: 'filters', label: 'Filters have been cleaned or replaced' },
  { id: 'fans', label: 'Ensure fans are free and lubricated where possible' },
  { id: 'drains', label: 'Check condensate drains and pumps' },
  { id: 'casing', label: 'Check exterior casing for rust, corrosion or damage' },
  { id: 'leaks', label: 'Check the refrigerant system for evidence of leaks' },
  { id: 'wiring', label: 'Check the wiring circuit for deterioration and/or loose connections' },
  { id: 'controls', label: 'Carry out operational check of all controls, adjust as necessary' },
  { id: 'belts', label: 'Inspect and adjust drive belts' },
  { id: 'cutouts', label: 'Check the operation of safety cut outs' },
  { id: 'headpressure', label: 'Check operation of the head pressure control system if fitted' },
];

export const VRF_CHECKS = [
  { id: 'coils', label: 'Check cooling and coils are free from obstruction, clean as required' },
  { id: 'filters', label: 'Filters have been cleaned or replaced' },
  { id: 'fans', label: 'Ensure fans are free and lubricated where possible' },
  { id: 'drains', label: 'Check condensate drains and pumps' },
  { id: 'casing', label: 'Check exterior casing for rust, corrosion or damage' },
  { id: 'leaks', label: 'Check the refrigeration system for evidence of leaks' },
  { id: 'wiring', label: 'Check the wiring circuit for deterioration and/or loose connections' },
];

// ---------- RAMS ----------

export const MS_TOOLS = [
  'Wrenches and spanners', 'Screwdrivers (Phillips and flathead)', 'Electric drill', 'Pressure gauges',
  'Electrical testing equipment', 'Ladders', 'Vacuum pump', 'Recovery machine', 'Nitrogen kit',
  'Brazing kit', 'Leak detector', 'Refrigerant scales', 'Harness and lanyard',
];

export const MS_DEFAULT = () => ({
  project: '',
  operation: '',
  revision: '1',
  description: '',
  sequence: [''],
  duration: 'It is anticipated that the works will last for approximately one day. Progress will be continually monitored.',
  gases: ['R22', 'R410A', 'R32'],
  controls:
    'In addition to the control measures identified in the risk assessment, all site rules required by the client will be followed, including any site induction before work starts, guidance for working safely on roofs where applicable, and sign in procedures.\nComfyair employees will continually monitor the work area to make sure suitable signage, warning signs and lighting are in place.',
  permits: 'Any permits required will be obtained from the on site H&S officer before work starts.',
  security: 'The client will provide security to the site. Their arrangements will not be undermined by the activities of Comfyair.',
  operatives: 'Comfyair engineers. Any other employees or contractors employed by Comfyair will report to the on site H&S contact before work starts.',
  plant: 'Refrigeration systems',
  tools: ['Wrenches and spanners', 'Screwdrivers (Phillips and flathead)', 'Electric drill', 'Pressure gauges', 'Electrical testing equipment', 'Ladders'],
  welfare: 'Welfare facilities to be made available to Comfyair employees by the client.',
  ppe: 'Comfyair employees will wear safety footwear and high visibility vests. Any other PPE needed will be assessed for each task on site.',
  evacuation: 'As set out during the site induction at the start of the project.',
  firstAid: 'Each engineer has a first aid kit in their vehicle for minor incidents. Any accidents will be reported and recorded in the site accident book as per site requirements.',
  amendmentsContact: 'Elliott Taylor',
  signoff: [{ id: uid(), role: 'Engineer', name: '' }],
});

export const AT_RISK = [
  { id: 'E', label: 'Employees' },
  { id: 'C', label: 'Contractors' },
  { id: 'V', label: 'Visitors' },
  { id: 'P', label: 'Public' },
  { id: 'A', label: 'All' },
];

export const SEVERITY = ['No injury', 'Minor injury', '3+ day absence', 'Major injury', 'Death'];
export const PROBABILITY = ['Very unlikely', 'Unlikely', 'Likely', 'Very likely', 'Virtually certain'];

export const riskBand = (score) => {
  if (!score) return { band: '', label: '', ok: '' };
  if (score <= 5) return { band: 'low', label: 'Low', ok: 'Y' };
  if (score <= 14) return { band: 'med', label: 'Medium', ok: 'Y' };
  return { band: 'high', label: 'High', ok: 'N' };
};

// Library: first eight are from Comfyair's own risk assessment, the rest are common extras.
export const HAZARD_LIBRARY = [
  { key: 'hotworks', hazard: 'Hot works', cause: 'Brazing of copper pipework', effect: 'Burns, fire', atRisk: 'A',
    existing: 'Fire extinguisher at point of work\nWet towel / heat mat behind joints', s: 3, p: 2,
    further: 'Follow site hot works rules and permits', rs: 2, rp: 2, standard: true },
  { key: 'access', hazard: 'Access to the work area', cause: 'A site with various tasks being carried out in different areas', effect: 'Personal injury', atRisk: 'E',
    existing: 'Follow the rules as per site induction', s: 3, p: 3,
    further: 'Follow access and egress routes as set out in the site induction', rs: 3, rp: 2, standard: true },
  { key: 'plantaccess', hazard: 'Access / egress to the plant area', cause: 'Slips and trips', effect: 'Personal injury', atRisk: 'E',
    existing: 'Stairways to be clear of any obstructions before work starts', s: 3, p: 2,
    further: 'Employees to monitor access areas so there are no obstacles or debris', rs: 3, rp: 1, standard: true },
  { key: 'ladders', hazard: 'Use of step ladders / roof access', cause: 'Fall from height', effect: 'Personal injury', atRisk: 'E',
    existing: 'All step ladders suitable for the task\nOn roofs, engineers use harnesses fastened to a safe anchor point', s: 3, p: 2,
    further: 'Users to check the condition and suitability of ladders, harnesses and scaffolding before use', rs: 3, rp: 1, standard: true },
  { key: 'tools', hazard: 'Use of hand tools, drills and cutting tools', cause: 'Dust and debris', effect: 'Eye injuries', atRisk: 'E',
    existing: 'All employees wear suitable PPE when carrying out works', s: 2, p: 2,
    further: 'User to check the operation of the equipment before use', rs: 2, rp: 1, standard: true },
  { key: 'refrigerants', hazard: 'Refrigerants', cause: 'Refrigerant losses', effect: 'Asphyxiation', atRisk: 'E',
    existing: 'Areas of use to be well ventilated', s: 4, p: 2,
    further: 'Engineer to monitor the process so no leaks are present\nCOSHH sheets available on request', rs: 4, rp: 1, standard: true },
  { key: 'leaktest', hazard: 'Use of leak testing equipment', cause: 'Noise if system leaks', effect: 'Personal injury', atRisk: 'E',
    existing: 'Equipment to be fit for purpose\nPPE to be used while the task is carried out', s: 3, p: 3,
    further: 'Other persons in the area to be informed\n6 metre exclusion zone while the task is carried out', rs: 3, rp: 1, standard: true },
  { key: 'electrical', hazard: 'Electrical connections', cause: 'Electric shock', effect: 'Personal injury', atRisk: 'E',
    existing: 'Qualified persons only to connect to the distribution board', s: 5, p: 2,
    further: 'No unqualified persons to attempt any electrical connections to live mains electricity', rs: 5, rp: 1, standard: true },
  { key: 'nitrogen', hazard: 'Nitrogen pressure testing', cause: 'Over pressurisation or hose failure', effect: 'Impact injury', atRisk: 'E',
    existing: 'Regulator used and set to the system test pressure\nHoses and gauges in good condition', s: 4, p: 2,
    further: 'Raise pressure in stages\nExclusion zone kept during the test', rs: 4, rp: 1 },
  { key: 'manual', hazard: 'Manual handling', cause: 'Lifting condensing units and materials', effect: 'Back and muscle injury', atRisk: 'E',
    existing: 'Two person lift for heavy units\nEngineers trained in manual handling', s: 3, p: 3,
    further: 'Use lifting aids or a trolley where possible', rs: 3, rp: 2 },
  { key: 'mewp', hazard: 'Working at height from a MEWP or tower', cause: 'Fall from height', effect: 'Major injury', atRisk: 'E',
    existing: 'IPAF / PASMA trained operators only\nEquipment inspected before use', s: 5, p: 2,
    further: 'Harness worn in MEWP basket\nExclusion zone kept below the work area', rs: 5, rp: 1 },
  { key: 'lone', hazard: 'Lone working', cause: 'Injury with nobody on hand to help', effect: 'Delay in treatment', atRisk: 'E',
    existing: 'Engineer carries a charged mobile phone', s: 3, p: 2,
    further: 'Check in by phone at the start and end of the job', rs: 3, rp: 1 },
  { key: 'asbestos', hazard: 'Asbestos', cause: 'Drilling or disturbing asbestos containing materials', effect: 'Lung disease', atRisk: 'A',
    existing: "Check the client's asbestos register before drilling", s: 5, p: 2,
    further: 'Stop work straight away if suspect material is found and inform the client', rs: 5, rp: 1 },
  { key: 'public', hazard: 'Working in an occupied building', cause: 'Members of the public near tools and materials', effect: 'Trips, struck by objects', atRisk: 'P',
    existing: 'Work area cordoned off with signage', s: 3, p: 2,
    further: 'Tools and materials kept tidy and never left unattended', rs: 3, rp: 1 },
  { key: 'cylinders', hazard: 'Refrigerant and nitrogen cylinders', cause: 'Cylinder falling or being damaged', effect: 'Crush injury, gas release', atRisk: 'E',
    existing: 'Cylinders secured upright in the van and on site', s: 3, p: 2,
    further: 'Cylinders moved on a trolley over longer distances', rs: 3, rp: 1 },
];

export const hazardFromLibrary = (h) => ({
  id: uid(), libKey: h.key, hazard: h.hazard, cause: h.cause, effect: h.effect, atRisk: h.atRisk,
  existing: h.existing, s: h.s, p: h.p, further: h.further, rs: h.rs, rp: h.rp,
});

export const blankHazard = () => ({
  id: uid(), libKey: '', hazard: '', cause: '', effect: '', atRisk: 'E', existing: '', s: 3, p: 2, further: '', rs: 3, rp: 1,
});

export const RA_DEFAULT = () => ({
  reviewDate: '',
  team: '',
  hazards: HAZARD_LIBRARY.filter((h) => h.standard).map(hazardFromLibrary),
  furtherActions: 'The work is to be continually monitored to make sure there are no additional hazards.',
  comments: '',
  authorisedBy: '',
});

// ---------- Job factory ----------

const blankChecks = (list) => Object.fromEntries(list.map((c) => [c.id, { status: '', note: '' }]));

export const blankUnit = () => ({ id: uid(), make: '', model: '', serial: '', location: '', type: 'Wall mounted', comment: '', temp: '' });

export function newJob(type, { jobNo, engineer }) {
  const base = {
    id: uid(),
    type,
    jobNo: String(jobNo || ''),
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    date: todayISO(),
    engineer: engineer || '',
    client: { name: '', contact: '', email: '', phone: '' },
    site: { name: '', address: '' },
    photos: [],
    time: { arrived: '', left: '', travelMins: '', miles: '' },
    sign: {
      engineer: { name: engineer || '', img: '', at: null },
      customer: { name: '', img: '', at: null, unavailable: false, reason: '' },
    },
    nextService: '',
    data: {},
  };

  if (type === 'service') {
    base.data = {
      serviceType: 'Service', emergency: false, warranty: false, completion: 'Complete',
      unit: { make: '', model: '', serial: '', location: '', unitNo: '', gas: '' },
      workDone: '', recommendations: '', materials: [],
      checks: blankChecks(SERVICE_CHECKS), runningTemp: '',
    };
  }
  if (type === 'vrf') {
    base.data = {
      jobType: 'Service', completion: 'Complete', locationDesc: '',
      units: [blankUnit()],
      checks: blankChecks(VRF_CHECKS), tempRange: '',
      notes: '', recommendations: '',
    };
  }
  if (type === 'commissioning') {
    base.data = {
      make: '',
      indoor: { model: '', serial: '', location: '' },
      outdoor: { model: '', serial: '', location: '' },
      coolKw: '', heatKw: '',
      pressureTest: '', vacuumHrs: '', vacuumMicrons: '', gasAdded: '', gasType: 'R32', factoryCharge: '',
      pipeLength: '', suction: '3/8', liquid: '1/4',
      airOn: '', airOff: '', suctionPressure: '', dischargePressure: '',
      drain: 'Gravity', phase: 'Single phase', voltage: '240', flAmps: '',
      handover: true, notes: '',
    };
  }
  if (type === 'rams') {
    base.data = { ms: MS_DEFAULT(), ra: RA_DEFAULT() };
    base.data.ms.signoff[0].name = engineer || '';
    base.data.ra.team = engineer || '';
    base.time = null;
    base.sign.customer = { name: '', img: '', at: null, unavailable: true, reason: 'Not required' };
  }
  return base;
}

export const jobTitle = (job) => {
  if (job.type === 'rams') return job.data?.ms?.project || job.client.name || job.site.name || 'Untitled RAMS';
  return job.client.name || job.site.name || 'New job';
};
