// Location stamps. The phone's position is recorded only when a button is tapped
// (clock in, clock out, arrived, left), never in the background.

export const LOC_TIMEOUT = 12000;

// Never rejects. Returns { status, lat, lng, acc, at }.
// status: ok | denied | off | timeout | unsupported
export function stamp() {
  return new Promise((resolve) => {
    const at = Date.now();
    if (!('geolocation' in navigator)) return resolve({ status: 'unsupported', at });
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve({ at, ...r }); } };
    const timer = setTimeout(() => finish({ status: 'timeout' }), LOC_TIMEOUT + 500);
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(timer);
          finish({ status: 'ok', lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy || 0) });
        },
        (e) => {
          clearTimeout(timer);
          finish({ status: e && e.code === 1 ? 'denied' : e && e.code === 3 ? 'timeout' : 'off' });
        },
        { enableHighAccuracy: true, timeout: LOC_TIMEOUT, maximumAge: 5000 }
      );
    } catch (e) {
      clearTimeout(timer);
      finish({ status: 'off' });
    }
  });
}

export const hasFix = (loc) => !!loc && loc.status === 'ok' && typeof loc.lat === 'number';

// Metres between two points.
export function distanceM(a, b) {
  if (!hasFix(a) || !hasFix(b)) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const metresToMiles = (m) => m / 1609.344;

export function fmtMiles(m) {
  if (m == null) return '';
  const mi = metresToMiles(m);
  if (mi < 0.1) return 'under 0.1 mi';
  if (mi < 10) return mi.toFixed(1) + ' mi';
  return Math.round(mi) + ' mi';
}

// Thresholds. Site stamps allow for parking and big sites; the accuracy reading is added so a poor fix isn't flagged.
export const NEAR_SITE_M = 400;
export const FAR_M = 1600;

export function nearness(loc, ref) {
  const d = distanceM(loc, ref);
  if (d == null) return null;
  const slack = Math.min(loc.acc || 0, 300);
  if (d <= NEAR_SITE_M + slack) return { d, level: 'near' };
  if (d <= FAR_M + slack) return { d, level: 'close' };
  return { d, level: 'far' };
}

export const mapsLink = (loc) => (hasFix(loc) ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : '');

export function statusLabel(loc) {
  if (!loc) return 'No location';
  switch (loc.status) {
    case 'ok': return 'Location saved';
    case 'denied': return 'Location not allowed';
    case 'off': return 'Location off';
    case 'timeout': return 'No GPS fix';
    case 'unsupported': return 'No GPS on this device';
    default: return 'No location';
  }
}

// One-line description for a stamp against a reference point (site pin or yard).
// Returns { text, level } where level is near | close | far | none | off.
export function describe(loc, ref, refName = 'site') {
  if (!hasFix(loc)) return { text: statusLabel(loc), level: 'off' };
  if (!hasFix(ref)) return { text: 'Location saved', level: 'none' };
  const n = nearness(loc, ref);
  if (n.level === 'near') return { text: `At ${refName}`, level: 'near' };
  return { text: `${fmtMiles(n.d)} from ${refName}`, level: n.level };
}
