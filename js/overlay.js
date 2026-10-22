// Shows the customer where the unit will go: a drawing of the unit laid over a photo of the wall.
// One finger moves it, two fingers resize it, buttons nudge. Saves a flattened image for the quote.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon } from './ui.js';
import { vibrate } from './util.js';

export const SHAPES = [
  { id: 'wall', label: 'Wall unit', ratio: 0.3 },
  { id: 'cassette', label: 'Cassette', ratio: 1 },
  { id: 'floor', label: 'Floor unit', ratio: 0.9 },
  { id: 'outdoor', label: 'Outdoor unit', ratio: 0.72 },
  { id: 'trunking', label: 'Trunking run', ratio: 0.06 },
];

// Draws the unit at (x, y) with width w, in canvas pixels. Looks like a clean white product render.
export function drawUnit(ctx, shape, x, y, w, label) {
  const h = w * shape.ratio;
  const r = Math.min(14, w * 0.06);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = w * 0.06; ctx.shadowOffsetY = w * 0.02;
  ctx.fillStyle = '#F7F8FA';
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1.5, w * 0.008); ctx.strokeStyle = '#B8C2CC';
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
  ctx.fillStyle = '#DCE3EA';
  if (shape.id === 'wall') {
    // louvre along the bottom and a soft top curve
    roundRect(ctx, x + w * 0.04, y + h * 0.72, w * 0.92, h * 0.16, r / 2); ctx.fill();
    ctx.fillStyle = '#004684'; ctx.fillRect(x + w * 0.78, y + h * 0.3, w * 0.14, h * 0.05);
  } else if (shape.id === 'cassette') {
    ctx.fillRect(x + w * 0.18, y + h * 0.18, w * 0.64, h * 0.64);
    ctx.fillStyle = '#F7F8FA'; ctx.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4);
    ctx.fillStyle = '#DCE3EA';
    ctx.fillRect(x + w * 0.08, y + h * 0.1, w * 0.84, h * 0.06); ctx.fillRect(x + w * 0.08, y + h * 0.84, w * 0.84, h * 0.06);
    ctx.fillRect(x + w * 0.1, y + h * 0.08, w * 0.06, h * 0.84); ctx.fillRect(x + w * 0.84, y + h * 0.08, w * 0.06, h * 0.84);
  } else if (shape.id === 'floor') {
    roundRect(ctx, x + w * 0.06, y + h * 0.12, w * 0.88, h * 0.4, r / 2); ctx.fill();
    for (let i = 0; i < 5; i++) ctx.fillRect(x + w * 0.1, y + h * (0.6 + i * 0.07), w * 0.8, h * 0.025);
  } else if (shape.id === 'outdoor') {
    // fan grille
    const cx = x + w * 0.3, cy = y + h * 0.5, rad = h * 0.36;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#B8C2CC'; ctx.lineWidth = Math.max(1, w * 0.004);
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (rad * i) / 4, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 6; i++) ctx.fillRect(x + w * 0.62, y + h * (0.12 + i * 0.13), w * 0.32, h * 0.05);
  } else if (shape.id === 'trunking') {
    ctx.fillStyle = '#EEF1F4'; ctx.fillRect(x, y + h * 0.3, w, h * 0.4);
  }
  if (label && shape.id !== 'trunking') {
    ctx.font = `600 ${Math.max(10, w * 0.055)}px Archivo, system-ui, sans-serif`;
    ctx.fillStyle = '#004684'; ctx.textAlign = 'center';
    const ty = y + h + Math.max(14, w * 0.08);
    const tw = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; roundRect(ctx, x + w / 2 - tw / 2, ty - Math.max(10, w * 0.055), tw, Math.max(16, w * 0.08), 6); ctx.fill();
    ctx.fillStyle = '#004684'; ctx.fillText(label, x + w / 2, ty);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// Flattens photo + unit into one JPEG at the photo's own size.
export async function flatten(photoUrl, place, label) {
  const img = await loadImg(photoUrl);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const shape = SHAPES.find((s) => s.id === place.shape) || SHAPES[0];
  drawUnit(ctx, shape, place.x * c.width, place.y * c.height, place.w * c.width, label);
  return c.toDataURL('image/jpeg', 0.85);
}

// Full-screen editor. place is { shape, x, y, w } as fractions of the photo.
export function OverlayEditor({ photoUrl, initial, label, onDone, onCancel }) {
  const canvasRef = useRef();
  const imgRef = useRef(null);
  const [place, setPlace] = useState(initial || { shape: 'wall', x: 0.3, y: 0.2, w: 0.4 });
  const [ready, setReady] = useState(false);
  const ptrs = useRef(new Map());
  const gesture = useRef(null);

  useEffect(() => { loadImg(photoUrl).then((i) => { imgRef.current = i; setReady(true); }); }, [photoUrl]);

  // Fit the photo inside the canvas, remembering the drawn rect for hit-testing.
  const fit = useRef({ x: 0, y: 0, w: 1, h: 1 });
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
    fit.current = { x, y, w, h };
    ctx.drawImage(img, x, y, w, h);
    const shape = SHAPES.find((z) => z.id === place.shape) || SHAPES[0];
    drawUnit(ctx, shape, x + place.x * w, y + place.y * h, place.w * w, label);
  };
  useEffect(draw, [place, ready, label]);
  useEffect(() => { window.addEventListener('resize', draw); return () => window.removeEventListener('resize', draw); }, []);

  const toFrac = (e) => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const ratio = c.width / r.width;
    const f = fit.current;
    return { x: ((e.clientX - r.left) * ratio - f.x) / f.w, y: ((e.clientY - r.top) * ratio - f.y) / f.h };
  };
  const down = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, toFrac(e));
    const pts = [...ptrs.current.values()];
    gesture.current = pts.length === 1
      ? { kind: 'move', start: pts[0], base: { ...place } }
      : { kind: 'pinch', d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mid0: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, base: { ...place } };
  };
  const move = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    e.preventDefault();
    ptrs.current.set(e.pointerId, toFrac(e));
    const g = gesture.current; if (!g) return;
    const pts = [...ptrs.current.values()];
    if (g.kind === 'move' && pts.length === 1) {
      setPlace({ ...g.base, x: clamp(g.base.x + pts[0].x - g.start.x, -0.3, 1), y: clamp(g.base.y + pts[0].y - g.start.y, -0.3, 1) });
    } else if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const k = g.d0 ? d / g.d0 : 1;
      const w = clamp(g.base.w * k, 0.05, 1.5);
      setPlace({ ...g.base, w, x: g.base.x + (mid.x - g.mid0.x) - (w - g.base.w) / 2, y: g.base.y + (mid.y - g.mid0.y) });
    }
  };
  const up = (e) => { ptrs.current.delete(e.pointerId); gesture.current = null; };
  const nudge = (dw) => setPlace((p) => ({ ...p, w: clamp(p.w * dw, 0.05, 1.5), x: p.x - (p.w * dw - p.w) / 2 }));

  const done = async () => {
    vibrate(15);
    const url = await flatten(photoUrl, place, label);
    onDone({ place, url });
  };

  return html`<div class="ovl">
    <div class="ovl__head">
      <button class="btn btn--ghost btn--small" onClick=${onCancel}>Cancel</button>
      <span class="ovl__title">Where will it go?</span>
      <button class="btn btn--primary btn--small" disabled=${!ready} onClick=${done}>Done</button>
    </div>
    <canvas ref=${canvasRef} class="ovl__canvas" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}></canvas>
    <div class="ovl__tools">
      <div class="chips">
        ${SHAPES.map((s) => html`<button type="button" class=${'chip chip--small' + (place.shape === s.id ? ' is-on' : '')} onClick=${() => { vibrate(); setPlace({ ...place, shape: s.id }); }}>${s.label}</button>`)}
      </div>
      <div class="ovl__size">
        <button type="button" class="stepper__btn" onClick=${() => nudge(0.9)} aria-label="Smaller">−</button>
        <span>Drag to move, pinch or tap to size</span>
        <button type="button" class="stepper__btn" onClick=${() => nudge(1.1)} aria-label="Bigger">+</button>
      </div>
    </div>
  </div>`;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
