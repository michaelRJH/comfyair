// "See it on your wall": a spinnable 3D model, and real AR through the phone's own viewer
// (Quick Look on iPhone, Scene Viewer on Android). The AR launch uses the phone's native links directly,
// so it works even where model-viewer's own detection gives up. Models live in assets/models at real size.

import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon, toast } from './ui.js';
import { MODEL_SIZE } from './quote.js';
import { vibrate, isIOS, isStandalone } from './util.js';

let loading = null;
const loadViewer = () => (loading ||= import('../vendor/model-viewer.min.js').catch((e) => { loading = null; throw e; }));

// Absolute URLs: Scene Viewer and Quick Look fetch the file themselves, so relative paths won't do.
const base = () => location.href.split('#')[0].replace(/[^/]*$/, '');
export const glbUrl = (model) => `${base()}assets/models/${model}.glb`;
export const usdzUrl = (model) => `${base()}assets/models/${model}.usdz`;
const isAndroid = () => /android/i.test(navigator.userAgent);

// Android: launch Google's Scene Viewer in AR straight away, falling back to the page if ARCore isn't there.
export function sceneViewerUrl(model, title, wall) {
  const file = encodeURIComponent(glbUrl(model));
  const fallback = encodeURIComponent(location.href.split('#')[0]);
  const q = `file=${file}&mode=ar_preferred&title=${encodeURIComponent(title)}&resizable=false${wall ? '&enable_vertical_placement=true' : ''}`;
  return `intent://arvr.google.com/scene-viewer/1.1?${q}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`;
}

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
  const [progress, setProgress] = useState(0);
  const ref = useRef();
  const arLink = useRef();
  const [w, h, d] = MODEL_SIZE[model] || MODEL_SIZE['wall-m'];
  const wallMounted = !model.startsWith('outdoor') && model !== 'floor';
  const ios = isIOS(), android = isAndroid();
  useEffect(() => { loadViewer().then(() => setReady(true)).catch(() => setErr('The 3D viewer could not load. Try again with signal, then it works offline.')); }, []);
  useEffect(() => {
    const el = ref.current; if (!el || !ready) return;
    const onProgress = (e) => setProgress(e.detail.totalProgress);
    const onErr = () => setErr('The 3D model could not load. Check signal and try again.');
    el.addEventListener('progress', onProgress); el.addEventListener('error', onErr);
    return () => { el.removeEventListener('progress', onProgress); el.removeEventListener('error', onErr); };
  }, [ready]);

  const launchAR = () => {
    vibrate(12);
    if (ios) {
      // Safari launches Quick Look from a link with rel="ar" that wraps an image. allowsContentScaling=0 keeps it real size.
      arLink.current.click();
      if (isStandalone()) setTimeout(() => toast('If nothing opened, open the app link in Safari and try again. Home-screen apps sometimes block AR.', { ms: 6000 }), 1500);
      return;
    }
    if (android) { location.href = sceneViewerUrl(model, label, wallMounted); return; }
    // anything else: let model-viewer have a go (WebXR), or explain
    const mv = ref.current;
    if (mv && mv.canActivateAR) mv.activateAR();
    else toast('AR needs a phone. On a computer you can still spin it here.', { icon: 'alert', ms: 4500 });
  };

  return html`<div class="arsheet">
    <div class="ovl__head">
      <button class="btn btn--ghost btn--small" onClick=${onClose}>Close</button>
      <span class="ovl__title">${label}</span>
      <span class="arsheet__size">${Math.round(w * 100)} × ${Math.round(h * 100)} × ${Math.round(d * 100)} cm</span>
    </div>
    ${err ? html`<p class="hint arsheet__err">${err}</p>` : !ready ? html`<div class="arsheet__loading"><span class="spinner"></span></div>` : html`
      <model-viewer ref=${ref} class="arsheet__mv"
        src=${glbUrl(model)} ios-src=${usdzUrl(model)} loading="eager" reveal="auto"
        alt=${label} ar ar-modes="webxr scene-viewer quick-look" ar-placement=${wallMounted ? 'wall' : 'floor'} ar-scale="fixed"
        camera-controls auto-rotate shadow-intensity="1" exposure="1.05" environment-image="neutral"
        camera-orbit="-25deg 80deg auto" min-camera-orbit="auto auto 0.8m" max-camera-orbit="auto auto 6m" interaction-prompt="none">
        <div slot="ar-button" style="display:none"></div>
        <div slot="progress-bar" class="arsheet__bar" style=${`width:${Math.round(progress * 100)}%;opacity:${progress < 1 ? 1 : 0}`}></div>
      </model-viewer>
      <a ref=${arLink} rel="ar" href=${usdzUrl(model) + '#allowsContentScaling=0&canonicalWebPageURL=' + encodeURIComponent(location.href.split('#')[0])} class="arsheet__qlink" aria-hidden="true" tabindex="-1"><img src="assets/icons/icon-192.png" alt="" width="1" height="1" /></a>
      <button class="btn btn--primary btn--block arsheet__arbtn" onClick=${launchAR}><${Icon} name="camera" size=${20} /> Put it ${wallMounted ? 'on the wall' : 'on the ground'} with the camera</button>
      <p class="hint arsheet__hint">Spin it with a finger. The camera button opens your phone's AR viewer${ios ? ' (Quick Look)' : android ? ' (Google Scene Viewer)' : ''} and places it ${wallMounted ? 'on a wall' : 'on the ground'} at its real size. ${ios ? 'Point the phone at the wall, then tap to place.' : android ? 'Needs Google Play Services for AR, which most phones already have.' : 'AR needs a phone.'}</p>
    `}
  </div>`;
}
