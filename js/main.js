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

const TABS = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/jobs', label: 'Jobs', icon: 'jobs' },
  { path: '/time', label: 'Time', icon: 'clock' },
  { path: '/sites', label: 'Sites', icon: 'sites' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

function BottomNav({ path }) {
  const active = path === '/' ? '/' : '/' + path.split('/')[1];
  const map = { '/site': '/sites', '/job': '/jobs', '/timesheet': '/time' };
  const cur = map[active] || active;
  return html`<nav class="tabbar" aria-label="Main">
    ${TABS.map((t) => html`<button class=${'tabbar__btn' + (cur === t.path ? ' is-on' : '')} aria-current=${cur === t.path ? 'page' : undefined}
      onClick=${() => go(t.path, null, cur === t.path)}>
      <${Icon} name=${t.icon} size=${23} stroke=${cur === t.path ? 2.1 : 1.75} />
      <span>${t.label}</span>
    </button>`)}
  </nav>`;
}

function App() {
  const [settings, setSettings] = useState(null);
  const route = useRoute();

  useEffect(() => {
    getSettings().then(setSettings);
    return onSettings(setSettings);
  }, []);

  if (!settings) return html`<div class="boot"><span class="spinner"></span></div>`;
  if (!settings.onboarded || !settings.currentEngineer) {
    return html`<${Welcome} settings=${settings} onDone=${setSettings} /><${ToastHost} />`;
  }

  const [a, b, c] = route.parts;
  let screen;
  let tabs = true;
  if (!a) screen = html`<${Home} settings=${settings} />`;
  else if (a === 'jobs') screen = html`<${Jobs} />`;
  else if (a === 'job' && b && c === 'send') { screen = html`<${Send} key=${b} id=${b} done=${route.query.done === '1'} settings=${settings} />`; tabs = false; }
  else if (a === 'job' && b) { screen = html`<${Editor} key=${b} id=${b} settings=${settings} />`; tabs = false; }
  else if (a === 'time') screen = html`<${TimeScreen} settings=${settings} />`;
  else if (a === 'timesheet' && b && c === 'send') { screen = html`<${SendTimesheet} key=${b} weekStart=${b} done=${route.query.done === '1'} settings=${settings} />`; tabs = false; }
  else if (a === 'sites') screen = html`<${Sites} />`;
  else if (a === 'site' && b) screen = html`<${Site} key=${b} id=${b} />`;
  else if (a === 'settings') screen = html`<${Settings} settings=${settings} />`;
  else screen = html`<${Home} settings=${settings} />`;

  return html`<div class=${'app' + (tabs ? ' has-tabs' : '')}>
    <main key=${route.path} class="view">${screen}</main>
    ${tabs && html`<${BottomNav} path=${route.path} />`}
    <${DialogHost} />
    <${ToastHost} />
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
