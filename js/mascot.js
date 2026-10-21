// Comfy, the Comfyair engineer. Pops up once when the app is first opened, just for fun.

import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { getSettings, saveSettings } from './store.js';
import { firstName, vibrate } from './util.js';

export function ComfySvg({ size = 240 }) {
  return html`<svg class="comfy" width=${size} height=${size * 1.1} viewBox="0 0 200 220" aria-label="Comfy the engineer giving a thumbs up">
    <defs>
      <clipPath id="comfy-face"><ellipse cx="100" cy="86" rx="38" ry="40" /></clipPath>
    </defs>
    <!-- shadow -->
    <ellipse cx="100" cy="210" rx="52" ry="7" fill="#002B52" opacity=".18" />
    <!-- legs -->
    <rect x="76" y="166" width="20" height="40" rx="8" fill="#003A6E" />
    <rect x="104" y="166" width="20" height="40" rx="8" fill="#003A6E" />
    <rect x="72" y="198" width="28" height="12" rx="6" fill="#132639" />
    <rect x="100" y="198" width="28" height="12" rx="6" fill="#132639" />
    <!-- body: overalls + hi-vis -->
    <rect x="62" y="120" width="76" height="56" rx="18" fill="#004684" />
    <path d="M70 124 h60 v44 a14 14 0 0 1 -14 14 h-32 a14 14 0 0 1 -14 -14z" fill="#F79239" />
    <rect x="70" y="140" width="60" height="7" fill="#F5F5F5" opacity=".9" />
    <rect x="70" y="156" width="60" height="7" fill="#F5F5F5" opacity=".9" />
    <path d="M86 124 l14 18 l14 -18" fill="none" stroke="#004684" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <!-- left arm with wrench -->
    <g class="comfy__arm-wrench">
      <path d="M68 134 q-26 10 -22 44" fill="none" stroke="#F79239" stroke-width="14" stroke-linecap="round" />
      <circle cx="46" cy="178" r="9" fill="#F3C9A0" />
      <g transform="translate(46 178) rotate(-30)">
        <rect x="-4" y="-6" width="8" height="46" rx="3" fill="#8A97A6" />
        <path d="M-11 -4 a11 11 0 1 1 22 0 l-5 0 l0 -5 l-12 0 l0 5z" fill="#8A97A6" />
        <circle cx="0" cy="40" r="7" fill="#8A97A6" />
      </g>
    </g>
    <!-- right arm thumbs up -->
    <g class="comfy__arm-thumb">
      <path d="M132 134 q24 2 28 -18" fill="none" stroke="#F79239" stroke-width="14" stroke-linecap="round" />
      <g transform="translate(160 112)">
        <rect x="-11" y="-6" width="22" height="20" rx="7" fill="#F3C9A0" />
        <rect x="-3" y="-24" width="9" height="22" rx="4.5" fill="#F3C9A0" transform="rotate(-12)" />
      </g>
    </g>
    <!-- head -->
    <ellipse cx="100" cy="86" rx="38" ry="40" fill="#F3C9A0" />
    <ellipse cx="62" cy="88" rx="6" ry="8" fill="#F3C9A0" />
    <ellipse cx="138" cy="88" rx="6" ry="8" fill="#F3C9A0" />
    <!-- cap -->
    <path d="M60 72 a40 34 0 0 1 80 0 z" fill="#004684" />
    <path d="M56 72 h96 a6 6 0 0 1 0 12 h-96 a6 6 0 0 1 0 -12z" fill="#003A6E" />
    <path d="M100 38 a40 34 0 0 1 40 34 h-40z" fill="#0A5AA3" />
    <path d="M90 60 l5 -14 l5 14z M103 60 l4 -14 l5 14z" fill="#F79239" />
    <!-- face -->
    <g clip-path="url(#comfy-face)">
      <ellipse cx="80" cy="100" rx="7" ry="5" fill="#F7A27A" opacity=".55" />
      <ellipse cx="120" cy="100" rx="7" ry="5" fill="#F7A27A" opacity=".55" />
    </g>
    <circle cx="84" cy="90" r="5.5" fill="#132639" />
    <g class="comfy__wink">
      <circle cx="116" cy="90" r="5.5" fill="#132639" class="comfy__eye-open" />
      <path d="M108 91 q8 6 16 0" fill="none" stroke="#132639" stroke-width="3.5" stroke-linecap="round" class="comfy__eye-shut" />
    </g>
    <path d="M78 82 q6 -5 12 -1" fill="none" stroke="#132639" stroke-width="3" stroke-linecap="round" />
    <path d="M110 81 q6 -4 12 0" fill="none" stroke="#132639" stroke-width="3" stroke-linecap="round" />
    <path d="M84 108 q16 14 32 0" fill="none" stroke="#132639" stroke-width="3.5" stroke-linecap="round" />
    <path d="M90 110 q10 7 20 0" fill="#fff" />
  </svg>`;
}

const LINES = [
  'Sorted. Job sheets, done on site.',
  'Nice one. Everything saves as you go.',
  'All set. Tap me to crack on.',
];

// Shows once after the first sign-in; Settings can bring him back.
export function ComfyPopup({ name, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const line = LINES[Math.floor(Math.random() * LINES.length)];
  const close = () => { if (leaving) return; setLeaving(true); setTimeout(onClose, 260); };
  useEffect(() => { vibrate(10); const t = setTimeout(close, 5200); return () => clearTimeout(t); }, []);
  return html`<div class=${'comfywrap' + (leaving ? ' is-leaving' : '')} onClick=${close} role="dialog" aria-label="Comfy says hello">
    <div class="comfypop">
      <div class="comfypop__bubble"><b>Alright${name ? ', ' + name : ''}!</b><span>${line}</span></div>
      <${ComfySvg} size=${220} />
      <span class="comfypop__tap">Tap anywhere</span>
    </div>
  </div>`;
}

export function useComfyOnce(settings) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!settings || !settings.onboarded || settings.comfySeen) return;
    setShow(true);
    saveSettings({ ...settings, comfySeen: true });
  }, [settings && settings.onboarded]);
  return [show, () => setShow(false)];
}
