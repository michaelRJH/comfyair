// App shell: loads settings, routes between screens, bottom navigation, offline support.

import { html, render, useState, useEffect } from '../vendor/preact-htm.js';
import { Icon, DialogHost, ToastHost, toast } from './ui.js';
import { getSettings, onSettings } from './store.js';
import { requestPersistence } from './db.js';
import { useRoute, go } from './router.js';
import { Home, Jobs, Sites, Site, Settings, Welcome } from './screens.js';
import { Editor, Send } from './editor.js';
import { TimeScreen } from './timescreen.js';
import { SendTimesheet } from './senddoc.js';
import { ComfyPopup, useComfyOnce } from './mascot.js';
import { firstName } from './util.js';
import { configureSync, onSync, newArrivals } from './sync.js';

const TABS = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/jobs', label: 'Jobs', icon: 'jobs' },
  { path: '/time', label: 'Time', icon: 'clock' },
  { path: '/sites', label: 'Sites', icon: 'sites' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

function BottomNav({ path }) {
  const [fresh, setFresh] = useState(0);
  useEffect(() => { const refresh = () => newArrivals().then(setFresh); refresh(); return onSync(refresh); }, [path]);
  const active = path === '/' ? '/' : '/' + path.split('/')[1];
  const map = { '/site': '/sites', '/job': '/jobs', '/timesheet': '/time' };
  const cur = map[active] || active;
  return html`<nav class="tabbar" aria-label="Main">
    ${TABS.map((t) => html`<button class=${'tabbar__btn' + (cur === t.path ? ' is-on' : '')} aria-current=${cur === t.path ? 'page' : undefined}
      onClick=${() => go(t.path, null, cur === t.path)}>
      <${Icon} name=${t.icon} size=${23} stroke=${cur === t.path ? 2.1 : 1.75} />
      ${t.path === '/jobs' && fresh > 0 && html`<span class="tabbar__badge">${fresh}</span>`}
      <span>${t.label}</span>
    </button>`)}
  </nav>`;
}

function App() {
  const [settings, setSettings] = useState(null);
  const route = useRoute();

  useEffect(() => {
    getSettings().then((s) => { setSettings(s); configureSync(s); });
    return onSettings((s) => { setSettings(s); configureSync(s); });
  }, []);

  const [comfy, hideComfy] = useComfyOnce(settings);
  if (!settings) return html`<div class="boot"><span class="spinner"></span></div>`;
  if (!settings.onboarded || !settings.currentEngineer) {
    return html`<${Welcome} settings=${settings} onDone=${setSettings} /><${ToastHost} />`;
  }

  const [a, b, c] = route.parts;
  let screen;
  let tabs = true;
  if (!a) screen = html`<${Home} settings=${settings} />`;
  else if (a === 'jobs') screen = html`<${Jobs} filter=${route.query.type} shared=${route.query.shared === '1'} />`;
  else if (a === 'job' && b && c === 'send') { screen = html`<${Send} key=${b} id=${b} done=${route.query.done === '1'} settings=${settings} />`; tabs = false; }
  else if (a === 'job' && b) { screen = html`<${Editor} key=${b} id=${b} settings=${settings} />`; tabs = false; }
  else if (a === 'time') screen = html`<${TimeScreen} settings=${settings} />`;
  else if (a === 'timesheet' && b && c === 'send') { screen = html`<${SendTimesheet} key=${b + (route.query.eng || '')} weekStart=${b} eng=${route.query.eng || ''} done=${route.query.done === '1'} settings=${settings} />`; tabs = false; }
  else if (a === 'sites') screen = html`<${Sites} />`;
  else if (a === 'site' && b) screen = html`<${Site} key=${b} id=${b} />`;
  else if (a === 'settings') screen = html`<${Settings} settings=${settings} />`;
  else screen = html`<${Home} settings=${settings} />`;

  return html`<div class=${'app' + (tabs ? ' has-tabs' : '')}>
    <main key=${route.path} class="view">${screen}</main>
    ${tabs && html`<${BottomNav} path=${route.path} />`}
    <${DialogHost} />
    <${ToastHost} />
    ${comfy && html`<${ComfyPopup} name=${firstName(settings.currentEngineer)} onClose=${hideComfy} />`}
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
requestPersistence();

// ---------- install + offline ----------

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event('installready'));
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const offer = (w) => toast('A new version is ready', {
        sticky: true, icon: 'refresh',
        action: { label: 'Update', fn: () => w.postMessage('skipWaiting') },
      });
      const announce = (w) => {
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => reg.installing && announce(reg.installing));
      // Only reload when an update replaces a running version, never on the very first install.
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded || !hadController) return;
        reloaded = true;
        location.reload();
      });
    } catch (e) { /* offline support unavailable */ }
  });
}
