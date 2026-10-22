// Shows the customer where the unit will go, in true perspective.
// Step 1: drag four dots to the corners of the wall (or ceiling). Step 2: the unit appears at its real size as a 3D box
// on that wall; drag it about, add a trunking run, switch to the outdoor unit. Saves a flattened JPEG for the quote.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon } from './ui.js';
import { vibrate } from './util.js';
import { MODEL_SIZE } from './quote.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// ---------- maths: homography from wall metres to photo pixels, then a camera so the box has depth ----------

function solve(A, b) { // Gaussian elimination, n×n
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) throw new Error('degenerate');
    for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
// src: 4 points (metres), dst: 4 points (pixels), same order TL TR BR BL
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}
const inv3 = (m) => {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
};
const apply = (m, x, y) => { const w = m[2][0] * x + m[2][1] * y + m[2][2]; return { x: (m[0][0] * x + m[0][1] * y + m[0][2]) / w, y: (m[1][0] * x + m[1][1] * y + m[1][2]) / w }; };

// Builds a camera from the homography (assumes a normal phone lens) so we can project points off the wall.
export function makeCamera(corners, wallW, wallH, pw, ph) {
  const src = [{ x: 0, y: 0 }, { x: wallW, y: 0 }, { x: wallW, y: wallH }, { x: 0, y: wallH }];
  const dst = corners.map((c) => ({ x: c.x * pw, y: c.y * ph }));
  const H = homography(src, dst);
  const Hinv = inv3(H);
  const f = Math.max(pw, ph) * 0.95, cx = pw / 2, cy = ph / 2;
  // K^-1 H
  const a = [[(H[0][0] - cx * H[2][0]) / f, (H[0][1] - cx * H[2][1]) / f, (H[0][2] - cx * H[2][2]) / f], [(H[1][0] - cy * H[2][0]) / f, (H[1][1] - cy * H[2][1]) / f, (H[1][2] - cy * H[2][2]) / f], [H[2][0], H[2][1], H[2][2]]];
  const col = (j) => [a[0][j], a[1][j], a[2][j]];
  const norm = (v) => Math.hypot(v[0], v[1], v[2]);
  let r1 = col(0), r2 = col(1), t = col(2);
  const lam = 2 / (norm(r1) + norm(r2));
  r1 = r1.map((v) => v * lam); r2 = r2.map((v) => v * lam); t = t.map((v) => v * lam);
  if (t[2] < 0) { r1 = r1.map((v) => -v); r2 = r2.map((v) => -v); t = t.map((v) => -v); }
  // orthogonalise
  const d = r1[0] * r2[0] + r1[1] * r2[1] + r1[2] * r2[2];
  r2 = r2.map((v, i) => v - d * r1[i]); const n2 = norm(r2); r2 = r2.map((v) => v / n2);
  const n1 = norm(r1); r1 = r1.map((v) => v / n1);
  const r3 = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
  // camera position in wall coords: -R^T t ; its z tells which side of the wall the camera is
  const camZ = -(r3[0] * t[0] + r3[1] * t[1] + r3[2] * t[2]);
  const out = camZ >= 0 ? 1 : -1; // multiply depth by this so boxes come towards the camera
  const toCam = (X, Y, Z) => [r1[0] * X + r2[0] * Y + r3[0] * Z + t[0], r1[1] * X + r2[1] * Y + r3[1] * Z + t[1], r1[2] * X + r2[2] * Y + r3[2] * Z + t[2]];
  const project = (X, Y, Z = 0) => { const c = toCam(X, Y, Z); const z = Math.max(c[2], 1e-3); return { x: (f * c[0]) / z + cx, y: (f * c[1]) / z + cy }; };
  const toWall = (px, py) => apply(Hinv, px, py);
  return { project, toWall, toCam, out, H };
}

// ---------- drawing a unit as a shaded 3D box ----------

const FACE = { front: '#F5F7F9', side: '#D5DDE5', top: '#FBFCFD', bottom: '#C4CDD6' };

function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
function visible(cam, pts3) { // outward normal test in camera space
  const c = pts3.map((p) => cam.toCam(...p));
  const u = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], v = [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const centre = c[0];
  return n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2] < 0;
}

// Draws a box with its back face on the wall plane. x,y = top-left on the wall (m), w,h = face size, d = depth. scale = px scale factor.
function drawBox(ctx, cam, x, y, w, h, d, scale, colours = FACE, draft) {
  const D = d * cam.out;
  const P = (X, Y, Z) => { const p = cam.project(X, Y, Z); return { x: p.x * scale, y: p.y * scale }; };
  const b = [[x, y, 0], [x + w, y, 0], [x + w, y + h, 0], [x, y + h, 0]];
  const fr = [[x, y, D], [x + w, y, D], [x + w, y + h, D], [x, y + h, D]];
  const faces = [
    { pts: [b[0], b[1], fr[1], fr[0]], fill: colours.top },
    { pts: [b[3], fr[3], fr[2], b[2]], fill: colours.bottom },
    { pts: [b[0], fr[0], fr[3], b[3]], fill: colours.side },
    { pts: [b[1], b[2], fr[2], fr[1]], fill: colours.side },
  ];
  const lw = Math.max(1, scale * Math.min(1, w) * 1.2);
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = draft ? 'rgba(0,70,132,.5)' : '#AEB9C4';
  faces.forEach((f) => { if (visible(cam, f.pts)) { poly(ctx, f.pts.map((p) => P(...p))); ctx.fillStyle = f.fill; ctx.fill(); ctx.stroke(); } });
  poly(ctx, fr.map((p) => P(...p))); ctx.fillStyle = colours.front; ctx.fill(); ctx.stroke();
  return { front: fr.map((p) => P(...p)), D };
}

// Rectangle on the front face given fractions of the face (u0..u1, v0..v1)
function faceRect(ctx, cam, x, y, w, h, D, scale, u0, v0, u1, v1, fill) {
  const P = (X, Y) => { const p = cam.project(X, Y, D); return { x: p.x * scale, y: p.y * scale }; };
  poly(ctx, [P(x + w * u0, y + h * v0), P(x + w * u1, y + h * v0), P(x + w * u1, y + h * v1), P(x + w * u0, y + h * v1)]);
  ctx.fillStyle = fill; ctx.fill();
}

export function drawUnit3D(ctx, cam, model, x, y, scale, label, opts = {}) {
  const [w, h, d] = MODEL_SIZE[model] || MODEL_SIZE['wall-m'];
  const isOut = model.startsWith('outdoor'), isCas = model.startsWith('cassette'), isFloor = model === 'floor';
  ctx.save();
  // soft shadow on the wall
  const P0 = (X, Y, Z) => { const p = cam.project(X, Y, Z); return { x: p.x * scale, y: p.y * scale }; };
  ctx.save(); ctx.filter = `blur(${Math.max(2, scale * 0.02)}px)`; ctx.fillStyle = 'rgba(0,0,0,.28)';
  poly(ctx, [P0(x + 0.03, y + 0.04, 0), P0(x + w + 0.05, y + 0.04, 0), P0(x + w + 0.05, y + h + 0.06, 0), P0(x + 0.03, y + h + 0.06, 0)]); ctx.fill(); ctx.restore();
  const depth = isCas ? 0.04 : d;
  const { D } = drawBox(ctx, cam, x, y, w, h, depth, scale);
  if (isOut) {
    // fan: a circle on the front face, projected point by point
    const pts = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const p = cam.project(x + w * 0.3 + Math.cos(a) * h * 0.34, y + h * 0.5 + Math.sin(a) * h * 0.34, D); pts.push({ x: p.x * scale, y: p.y * scale }); }
    poly(ctx, pts); ctx.fillStyle = '#C9D2DB'; ctx.fill();
    for (let i = 0; i < 7; i++) faceRect(ctx, cam, x, y, w, h, D, scale, 0.64, 0.1 + i * 0.12, 0.95, 0.14 + i * 0.12, '#C9D2DB');
    faceRect(ctx, cam, x, y, w, h, D, scale, 0.28, 0.47, 0.32, 0.53, '#F5F7F9');
  } else if (isCas) {
    faceRect(ctx, cam, x, y, w, h, D, scale, 0.17, 0.17, 0.83, 0.83, '#DAE1E8');
    faceRect(ctx, cam, x, y, w, h, D, scale, 0.3, 0.3, 0.7, 0.7, '#F5F7F9');
    faceRect(ctx, cam, x, y, w, h, D, scale, 0.08, 0.08, 0.92, 0.13, '#DAE1E8'); faceRect(ctx, cam, x, y, w, h, D, scale, 0.08, 0.87, 0.92, 0.92, '#DAE1E8');
    faceRect(ctx, cam, x, y, w, h, D, scale, 0.08, 0.08, 0.13, 0.92, '#DAE1E8'); faceRect(ctx, cam, x, y, w, h, D, scale, 0.87, 0.08, 0.92, 0.92, '#DAE1E8');
  } else if (isFloor) {
    faceRect(ctx, cam, x, y, w, h, D, scale, 0.06, 0.1, 0.94, 0.45, '#DAE1E8');
    for (let i = 0; i < 5; i++) faceRect(ctx, cam, x, y, w, h, D, scale, 0.1, 0.58 + i * 0.07, 0.9, 0.6 + i * 0.07, '#DAE1E8');
  } else {
    faceRect(ctx, cam, x, y, w, h, D, scale, 0.04, 0.72, 0.96, 0.9, '#DAE1E8');
    faceRect(ctx, cam, x, y, w, h, D, scale, 0.78, 0.3, 0.92, 0.36, '#004684');
  }
  if (label) {
    const p = P0(x + w / 2, y + h + 0.12, D);
    const a = P0(x, y + h, D), b2 = P0(x + w, y + h, D);
    const fs = clamp(Math.hypot(b2.x - a.x, b2.y - a.y) * 0.1, 10, 44);
    ctx.font = `600 ${fs}px Archivo, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + fs;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; roundRect(ctx, p.x - tw / 2, p.y - fs * 0.75, tw, fs * 1.5, fs * 0.4); ctx.fill();
    ctx.fillStyle = '#004684'; ctx.fillText(label, p.x, p.y);
  }
  ctx.restore();
  return { w, h };
}

// Trunking: an L-shaped run on the wall from the nearest bottom corner of the unit to the end point. 60mm wide, 50mm deep.
// bend 'v' drops down first then runs along; 'h' runs along first then drops.
export function trunkStart(place) {
  const [w, h] = MODEL_SIZE[place.model] || MODEL_SIZE['wall-m'];
  const t = place.trunk;
  const left = t && t.x < place.x + w / 2;
  return { x: left ? place.x + 0.06 : place.x + w - 0.06, y: place.y + h };
}
function drawTrunking(ctx, cam, from, to, bend, scale) {
  const colours = { front: '#EEF1F4', side: '#D5DDE5', top: '#F7F9FA', bottom: '#C4CDD6' };
  const W = 0.06, D = 0.05;
  const dx = to.x - from.x, dy = to.y - from.y;
  const horiz = (y, x0, x1) => { if (Math.abs(x1 - x0) > W / 2) drawBox(ctx, cam, Math.min(x0, x1) - W / 2, y - W / 2, Math.abs(x1 - x0) + W, W, D, scale, colours); };
  const vert = (x, y0, y1) => { if (Math.abs(y1 - y0) > W / 2) drawBox(ctx, cam, x - W / 2, Math.min(y0, y1) - W / 2, W, Math.abs(y1 - y0) + W, D, scale, colours); };
  if (bend === 'h') { horiz(from.y, from.x, to.x); vert(to.x, from.y, to.y); }
  else { vert(from.x, from.y, to.y); horiz(to.y, from.x, to.x); }
  // small end cap where it goes through the wall
  ctx.save(); const p = cam.project(to.x, to.y, 0.02); ctx.beginPath(); ctx.arc(p.x * scale, p.y * scale, Math.max(2, scale * 14), 0, Math.PI * 2); ctx.fillStyle = '#3A4A5C'; ctx.fill(); ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Draws the whole scene: wall guide (optional), unit, trunking. pw/ph = photo pixels; scale = canvas px per photo px.
export function renderScene(ctx, place, pw, ph, scale, label, { guide = false } = {}) {
  let cam;
  try { cam = makeCamera(place.corners, place.wallW, place.wallH, pw, ph); } catch (e) { return null; }
  if (guide) {
    ctx.save(); ctx.strokeStyle = 'rgba(247,146,57,.9)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    poly(ctx, place.corners.map((c) => ({ x: c.x * pw * scale, y: c.y * ph * scale }))); ctx.stroke();
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(247,146,57,.35)'; ctx.lineWidth = 1;
    const step = 0.5;
    for (let gx = step; gx < place.wallW; gx += step) { const a = cam.project(gx, 0), b = cam.project(gx, place.wallH); ctx.beginPath(); ctx.moveTo(a.x * scale, a.y * scale); ctx.lineTo(b.x * scale, b.y * scale); ctx.stroke(); }
    for (let gy = step; gy < place.wallH; gy += step) { const a = cam.project(0, gy), b = cam.project(place.wallW, gy); ctx.beginPath(); ctx.moveTo(a.x * scale, a.y * scale); ctx.lineTo(b.x * scale, b.y * scale); ctx.stroke(); }
    ctx.restore();
  }
  const [w, h] = MODEL_SIZE[place.model] || MODEL_SIZE['wall-m'];
  if (place.trunk) drawTrunking(ctx, cam, trunkStart(place), place.trunk, place.trunk.bend || 'v', scale);
  drawUnit3D(ctx, cam, place.model, place.x, place.y, scale, label);
  return cam;
}

export async function flatten(photoUrl, place, label) {
  const img = await loadImg(photoUrl);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  renderScene(ctx, place, c.width, c.height, 1, label);
  return c.toDataURL('image/jpeg', 0.86);
}

const defaultCorners = () => [{ x: 0.12, y: 0.12 }, { x: 0.88, y: 0.12 }, { x: 0.88, y: 0.88 }, { x: 0.12, y: 0.88 }];

// ---------- the editor ----------

export function OverlayEditor({ photo, model, outdoorModel, label, wall, onDone, onCancel }) {
  const canvasRef = useRef();
  const imgRef = useRef(null);
  const [ready, setReady] = useState(false);
  const isCeiling = (m) => m.startsWith('cassette');
  const [place, setPlace] = useState(photo.place || {
    corners: defaultCorners(), wallW: wall && wall.w ? +wall.w : 4, wallH: wall && wall.h ? +wall.h : 2.4,
    model, x: 0, y: 0, trunk: null, placed: false,
  });
  const [step, setStep] = useState(photo.place ? 'place' : 'corners');
  const [drag, setDrag] = useState(null);
  const fit = useRef({ x: 0, y: 0, w: 1, h: 1, s: 1 });

  useEffect(() => { loadImg(photo.dataUrl).then((i) => { imgRef.current = i; setReady(true); }); }, [photo.dataUrl]);

  // Put the unit in a sensible spot the first time: wall unit high and central, cassette in the middle, outdoor low.
  useEffect(() => {
    if (place.placed) return;
    const [w, h] = MODEL_SIZE[place.model] || MODEL_SIZE['wall-m'];
    const m = place.model;
    const y = m.startsWith('outdoor') ? place.wallH - h - 0.5 : m === 'floor' ? place.wallH - h - 0.1 : isCeiling(m) ? (place.wallH - h) / 2 : 0.25;
    setPlace((p) => ({ ...p, x: (p.wallW - w) / 2, y: clamp(y, 0, p.wallH - h), placed: true }));
  }, [place.model]);

  const draw = () => {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img) return;
    const box = c.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = box.width * ratio; c.height = box.height * ratio;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0B1A2A'; ctx.fillRect(0, 0, c.width, c.height);
    const s = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    const x = (c.width - w) / 2, y = (c.height - h) / 2;
    fit.current = { x, y, w, h, s };
    ctx.drawImage(img, x, y, w, h);
    ctx.save(); ctx.translate(x, y);
    if (step === 'corners') {
      renderScene(ctx, { ...place }, img.naturalWidth, img.naturalHeight, s, '', { guide: true });
      place.corners.forEach((p, i) => {
        const px = p.x * w, py = p.y * h;
        ctx.beginPath(); ctx.arc(px, py, 26 * ratio, 0, Math.PI * 2); ctx.fillStyle = 'rgba(247,146,57,.25)'; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 11 * ratio, 0, Math.PI * 2); ctx.fillStyle = '#F79239'; ctx.fill(); ctx.lineWidth = 3 * ratio; ctx.strokeStyle = '#fff'; ctx.stroke();
      });
    } else {
      const cam = renderScene(ctx, place, img.naturalWidth, img.naturalHeight, s, label);
      if (cam && place.trunk) {
        const p = cam.project(place.trunk.x, place.trunk.y);
        ctx.beginPath(); ctx.arc(p.x * s, p.y * s, 24 * ratio, 0, Math.PI * 2); ctx.fillStyle = 'rgba(247,146,57,.25)'; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x * s, p.y * s, 11 * ratio, 0, Math.PI * 2); ctx.fillStyle = '#F79239'; ctx.fill(); ctx.lineWidth = 3 * ratio; ctx.strokeStyle = '#fff'; ctx.stroke();
      }
    }
    ctx.restore();
  };
  useEffect(draw, [place, ready, label, step]);
  useEffect(() => { window.addEventListener('resize', draw); return () => window.removeEventListener('resize', draw); }, []);

  // pointer position as photo fraction
  const toFrac = (e) => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const ratio = c.width / r.width, f = fit.current;
    return { x: ((e.clientX - r.left) * ratio - f.x) / f.w, y: ((e.clientY - r.top) * ratio - f.y) / f.h };
  };
  const cam = () => { const img = imgRef.current; if (!img) return null; try { return makeCamera(place.corners, place.wallW, place.wallH, img.naturalWidth, img.naturalHeight); } catch (e) { return null; } };
  const toWall = (fr) => { const c = cam(), img = imgRef.current; if (!c) return null; return c.toWall(fr.x * img.naturalWidth, fr.y * img.naturalHeight); };

  const down = (e) => {
    e.preventDefault(); canvasRef.current.setPointerCapture(e.pointerId);
    const fr = toFrac(e);
    if (step === 'corners') {
      let best = 0, bd = 1e9;
      place.corners.forEach((c, i) => { const d = Math.hypot((c.x - fr.x) * fit.current.w, (c.y - fr.y) * fit.current.h); if (d < bd) { bd = d; best = i; } });
      setDrag({ kind: 'corner', i: best });
    } else {
      const wpt = toWall(fr); if (!wpt) return;
      const [w, h] = MODEL_SIZE[place.model] || MODEL_SIZE['wall-m'];
      const c = cam(), img = imgRef.current;
      // the trunking dot is grabbed by screen distance, so it's easy to hit on a phone
      if (place.trunk && c) {
        const p = c.project(place.trunk.x, place.trunk.y);
        const dpx = Math.hypot((p.x / img.naturalWidth - fr.x) * fit.current.w, (p.y / img.naturalHeight - fr.y) * fit.current.h) / (canvasRef.current.width / canvasRef.current.getBoundingClientRect().width);
        if (dpx < 34) { setDrag({ kind: 'trunk', moved: false }); return; }
      }
      const inside = wpt.x >= place.x - 0.15 && wpt.x <= place.x + w + 0.15 && wpt.y >= place.y - 0.15 && wpt.y <= place.y + h + 0.15;
      if (inside) setDrag({ kind: 'unit', off: { x: wpt.x - place.x, y: wpt.y - place.y } });
      else if (place.trunk) { vibrate(8); setPlace((p) => ({ ...p, trunk: { ...p.trunk, x: wpt.x, y: wpt.y } })); setDrag({ kind: 'trunk', moved: false }); }
      else setDrag({ kind: 'none' });
    }
  };
  const move = (e) => {
    if (!drag) return; e.preventDefault();
    const fr = toFrac(e);
    if (drag.kind === 'corner') {
      setPlace((p) => ({ ...p, corners: p.corners.map((c, i) => (i === drag.i ? { x: clamp(fr.x, -0.2, 1.2), y: clamp(fr.y, -0.2, 1.2) } : c)) }));
    } else {
      const wpt = toWall(fr); if (!wpt) return;
      if (drag.kind === 'trunk') setPlace((p) => ({ ...p, trunk: { ...p.trunk, x: clamp(wpt.x, -0.5, p.wallW + 0.5), y: clamp(wpt.y, -0.5, p.wallH + 0.5) } }));
      else if (drag.kind === 'unit') {
        const [w, h] = MODEL_SIZE[place.model] || MODEL_SIZE['wall-m'];
        setPlace((p) => ({ ...p, x: clamp(wpt.x - drag.off.x, -w, p.wallW), y: clamp(wpt.y - drag.off.y, -h, p.wallH) }));
      }
    }
  };
  const up = () => setDrag(null);

  const switchModel = (m) => { vibrate(); setPlace((p) => ({ ...p, model: m, placed: false })); };
  const toggleTrunk = () => { vibrate(); setPlace((p) => { if (p.trunk) return { ...p, trunk: null }; const [w, h] = MODEL_SIZE[p.model]; return { ...p, trunk: { x: clamp(p.x + w + 0.5, 0, p.wallW), y: clamp(p.y + h + 0.6, 0, p.wallH), bend: 'v' } }; }); };
  const flipBend = () => { vibrate(); setPlace((p) => ({ ...p, trunk: { ...p.trunk, bend: p.trunk.bend === 'h' ? 'v' : 'h' } })); };
  const done = async () => { vibrate(15); const url = await flatten(photo.dataUrl, place, label); onDone({ place, url }); };

  const models = [{ id: model, label: label || 'Indoor unit' }];
  if (outdoorModel) models.push({ id: outdoorModel, label: 'Outdoor unit' });
  const ceiling = isCeiling(place.model);

  return html`<div class="ovl">
    <div class="ovl__head">
      <button class="btn btn--ghost btn--small" onClick=${step === 'place' && !photo.place ? () => setStep('corners') : onCancel}>${step === 'place' && !photo.place ? 'Corners' : 'Cancel'}</button>
      <span class="ovl__title">${step === 'corners' ? (ceiling ? 'Mark the ceiling' : 'Mark the wall') : 'Where will it go?'}</span>
      ${step === 'corners'
        ? html`<button class="btn btn--primary btn--small" disabled=${!ready} onClick=${() => { vibrate(); setStep('place'); }}>Next</button>`
        : html`<button class="btn btn--primary btn--small" disabled=${!ready} onClick=${done}>Done</button>`}
    </div>
    <canvas ref=${canvasRef} class="ovl__canvas" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}></canvas>
    <div class="ovl__tools">
      ${step === 'corners' ? html`
        <p class="ovl__hint">Drag the four dots to the corners of the ${ceiling ? 'ceiling' : 'wall'}. Then tell it how big the ${ceiling ? 'ceiling' : 'wall'} is, so the unit is drawn at its real size.</p>
        <div class="ovl__dims">
          <label>Wide <input value=${place.wallW} inputmode="decimal" onInput=${(e) => setPlace((p) => ({ ...p, wallW: parseFloat(e.currentTarget.value) || p.wallW }))} /> m</label>
          <label>${ceiling ? 'Deep' : 'High'} <input value=${place.wallH} inputmode="decimal" onInput=${(e) => setPlace((p) => ({ ...p, wallH: parseFloat(e.currentTarget.value) || p.wallH }))} /> m</label>
          <button type="button" class="link link--small" onClick=${() => setPlace((p) => ({ ...p, corners: defaultCorners() }))}>Reset dots</button>
        </div>
      ` : html`
        <div class="chips">
          ${models.map((m) => html`<button type="button" class=${'chip chip--small' + (place.model === m.id ? ' is-on' : '')} onClick=${() => switchModel(m.id)}>${m.label}</button>`)}
          <button type="button" class=${'chip chip--small' + (place.trunk ? ' is-on' : '')} onClick=${toggleTrunk}><${Icon} name="pen" size=${14} /> Trunking run</button>
          ${place.trunk && html`<button type="button" class="chip chip--small" onClick=${flipBend}><${Icon} name="refresh" size=${14} /> ${place.trunk.bend === 'h' ? 'Along, then down' : 'Down, then along'}</button>`}
        </div>
        <p class="ovl__hint">Drag the unit along the ${ceiling ? 'ceiling' : 'wall'}. It's ${(MODEL_SIZE[place.model] || [0.9])[0]}m wide, to scale.${place.trunk ? ' Tap or drag the orange dot to where the pipes go through the wall.' : ''}</p>
      `}
    </div>
  </div>`;
}
