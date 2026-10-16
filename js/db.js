// Tiny IndexedDB wrapper. Everything lives on the phone.

const DB_NAME = 'comfyair';
const DB_VERSION = 2;
const STORES = ['jobs', 'clients', 'sites', 'kv', 'shifts', 'timesheets'];

let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, s === 'kv' ? undefined : { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result;
        Promise.resolve(fn(s)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const reqP = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const db = {
  get: (store, key) => tx(store, 'readonly', (s) => reqP(s.get(key))),
  all: (store) => tx(store, 'readonly', (s) => reqP(s.getAll())),
  put: (store, value, key) => tx(store, 'readwrite', (s) => reqP(key !== undefined ? s.put(value, key) : s.put(value))),
  del: (store, key) => tx(store, 'readwrite', (s) => reqP(s.delete(key))),
  clear: (store) => tx(store, 'readwrite', (s) => reqP(s.clear())),
  putMany: (store, values) =>
    tx(store, 'readwrite', (s) => Promise.all(values.map((v) => reqP(s.put(v))))),
};

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch (e) { /* best effort */ }
}
