// Offline support: keeps the whole app on the phone so it works in plant rooms with no signal.
// Bump VERSION whenever any file changes so phones pick up the update.

const VERSION = 'comfyair-v1.9.1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/router.js',
  'js/ui.js',
  'js/util.js',
  'js/db.js',
  'js/store.js',
  'js/schema.js',
  'js/components.js',
  'js/forms.js',
  'js/editor.js',
  'js/screens.js',
  'js/pdf.js',
  'js/share.js',
  'js/lists.js',
  'js/geo.js',
  'js/timesheet.js',
  'js/timescreen.js',
  'js/senddoc.js',
  'js/mascot.js',
  'js/quote.js',
  'js/quoteforms.js',
  'js/overlay.js',
  'js/ar.js',
  'js/pipeline.js',
  'js/sync.js',
  'js/syncsettings.js',
  'vendor/preact-htm.js',
  'vendor/pdfmake.min.js',
  'vendor/pdf-fonts.js',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'vendor/model-viewer.min.js',
  'assets/models/wall-s.glb',
  'assets/models/wall-m.glb',
  'assets/models/wall-l.glb',
  'assets/models/cassette-600.glb',
  'assets/models/cassette-840.glb',
  'assets/models/floor.glb',
  'assets/models/outdoor-s.glb',
  'assets/models/outdoor-m.glb',
  'assets/models/outdoor-l.glb',
  'assets/models/outdoor-xl.glb',
  'assets/logo.png',
  'assets/logo-white.png',
  'assets/fonts/archivo-wdth.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// A job file shared straight into the app (Android share sheet): stash it, then open the app to import it.
const SHARE = 'comfyair-share';
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const files = fd.getAll('file');
        const c = await caches.open(SHARE);
        for (const f of files) await c.put(new Request('./shared/' + Date.now() + '-' + encodeURIComponent(f.name || 'job.json')), new Response(f, { headers: { 'Content-Type': 'application/json', 'X-Name': f.name || 'job.json' } }));
      } catch (err) { /* nothing to stash */ }
      return Response.redirect('./#/jobs?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
