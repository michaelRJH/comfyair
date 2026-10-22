// "See it on your wall": real AR with the phone's own viewer (Scene Viewer on Android, Quick Look on iPhone),
// via Google's model-viewer. The 3D models live in assets/models and are made at real size.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon, toast } from './ui.js';
import { MODEL_SIZE } from './quote.js';
import { vibrate } from './util.js';

let loading = null;
const loadViewer = () => (loading ||= import('../vendor/model-viewer.min.js').catch((e) => { loading = null; throw e; }));

export function ARView({ model, label }) {
  const [open, setOpen] = useState(false);
  return html`<div class="arrow">
    <button type="button" class="btn btn--soft btn--block" onClick=${() => { vibrate(); setOpen(true); }}><${Icon} name="box" size=${20} /> See it on the wall in 3D / AR</button>
    ${open && html`<${ARSheet} model=${model} label=${label} onClose=${() => setOpen(false)} />`}
  </div>`;
}

function ARSheet({ model, label, onClose }) {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef();
  const [w, h, d] = MODEL_SIZE[model] || MODEL_SIZE['wall-m'];
  const wallMounted = !model.startsWith('outdoor') && model !== 'floor';
  useEffect(() => { loadViewer().then(() => setReady(true)).catch(() => setErr('The 3D viewer could not load. Try again with signal.')); }, []);
  useEffect(() => {
    const el = ref.current; if (!el || !ready) return;
    const onStatus = (e) => { if (e.detail.status === 'failed') toast('AR is not available on this phone. You can still spin the unit here.', { icon: 'alert', ms: 4000 }); };
    el.addEventListener('ar-status', onStatus);
    return () => el.removeEventListener('ar-status', onStatus);
  }, [ready]);
  return html`<div class="arsheet">
    <div class="ovl__head">
      <button class="btn btn--ghost btn--small" onClick=${onClose}>Close</button>
      <span class="ovl__title">${label}</span>
      <span class="arsheet__size">${Math.round(w * 100)} × ${Math.round(h * 100)} × ${Math.round(d * 100)} cm</span>
    </div>
    ${err ? html`<p class="hint arsheet__err">${err}</p>` : !ready ? html`<div class="arsheet__loading"><span class="spinner"></span></div>` : html`
      <model-viewer ref=${ref} class="arsheet__mv"
        src=${`assets/models/${model}.glb`} ios-src=${`assets/models/${model}.usdz`}
        alt=${label} ar ar-modes="scene-viewer quick-look webxr" ar-placement=${wallMounted ? 'wall' : 'floor'} ar-scale="fixed"
        camera-controls auto-rotate shadow-intensity="1" exposure="1.05" environment-image="neutral"
        camera-orbit="-25deg 80deg auto" min-camera-orbit="auto auto 0.8m" max-camera-orbit="auto auto 6m" interaction-prompt="none">
        <button slot="ar-button" class="btn btn--primary arsheet__arbtn"><${Icon} name="camera" size=${20} /> Put it on ${wallMounted ? 'the wall' : 'the ground'} with the camera</button>
      </model-viewer>
      <p class="hint arsheet__hint">Spin it with a finger. The camera button opens your phone's AR viewer and places it ${wallMounted ? 'flat on a wall' : 'on the ground'} at its real size. Works on most Android phones and iPhones from the last few years.</p>
    `}
  </div>`;
}
