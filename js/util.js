// Small helpers shared across the app.

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

export const todayISO = () => {
  const d = new Date();
  return toISODate(d);
};

export const toISODate = (d) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

// 15 Oct 2026
export const fmtDate = (iso) => {
  const d = parseISO(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
};

// 15/10/2026 (UK paperwork style)
export const fmtDateUK = (iso) => {
  const d = parseISO(iso);
  if (!d) return '';
  const z = (n) => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const fmtLongToday = () => {
  const d = new Date();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
};

export const monthLabel = (iso) => {
  const d = parseISO(iso);
  return d ? `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}` : 'No date';
};

export const addMonthsISO = (iso, months) => {
  const d = parseISO(iso) || new Date();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
};

export const daysBetween = (aISO, bISO) => {
  const a = parseISO(aISO), b = parseISO(bISO);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
};

// minutes between two HH:MM strings (handles past midnight)
export const minutesBetween = (a, b) => {
  if (!a || !b) return null;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  let m = bh * 60 + bm - (ah * 60 + am);
  if (m < 0) m += 24 * 60;
  return m;
};

export const fmtDuration = (mins) => {
  if (mins == null || isNaN(mins)) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const firstName = (name = '') => name.trim().split(/\s+/)[0] || '';

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase();

export const debounce = (fn, ms) => {
  let t;
  const d = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  d.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  return d;
};

export const clone = (o) => JSON.parse(JSON.stringify(o));

export const safeFileName = (s) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isMobile = () => isIOS() || /android/i.test(navigator.userAgent);

export const vibrate = (ms = 10) => {
  try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported */ }
};

export const norm = (s = '') => s.toLowerCase().replace(/\s+/g, ' ').trim();
