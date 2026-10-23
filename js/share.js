// Getting PDFs off the phone: share sheet, email, WhatsApp, save, open. Plus the in-app preview.

import { JOB_TYPES } from './schema.js';
import { isMobile } from './util.js';

export const canShareFiles = (file) => {
  try {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
  } catch (e) {
    return false;
  }
};

export function messageFor(job, settings) {
  const t = JOB_TYPES[job.type];
  const site = job.site.name || job.site.address || job.client.name || 'your site';
  return (settings.emailBody || '')
    .replace(/{doc}/g, t.pdfTitle.toLowerCase().replace('vrf', 'VRF'))
    .replace(/{site}/g, site)
    .replace(/{tel}/g, settings.company.tel || '')
    .replace(/{engineer}/g, job.engineer || settings.currentEngineer || '')
    .replace(/{jobno}/g, job.jobNo || '');
}

export function subjectFor(job) {
  const t = JOB_TYPES[job.type];
  const where = job.site.name || job.site.address || job.client.name;
  return `${t.pdfTitle}${job.jobNo ? ' ' + job.jobNo : ''}${where ? ', ' + where : ''}`;
}

async function systemShare(file, { title, text }) {
  try {
    await navigator.share({ files: [file], title, text });
    return 'shared';
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
    throw e;
  }
}

export function saveFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function openFile(file) {
  const url = URL.createObjectURL(file);
  const w = window.open(url, '_blank');
  if (!w) location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

// Each returns a short message for a toast, or '' for nothing.
export async function shareAny(file, job, settings) {
  if (canShareFiles(file)) {
    const r = await systemShare(file, { title: subjectFor(job), text: messageFor(job, settings) });
    return r === 'shared' ? 'Sent' : '';
  }
  saveFile(file);
  return 'Sharing isn’t available here, so the PDF has been saved instead';
}

export async function shareEmail(file, job, settings) {
  const to = job.client.email || '';
  const subject = subjectFor(job);
  const body = messageFor(job, settings);
  if (canShareFiles(file) && isMobile()) {
    const copied = to ? await copyText(to) : false;
    const r = await systemShare(file, { title: subject, text: body });
    if (r !== 'shared') return copied ? `${to} copied, paste it into the To box` : '';
    return 'Sent';
  }
  // Desktop: save the PDF and open a ready-made email to attach it to.
  saveFile(file);
  setTimeout(() => {
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '\n\n(PDF attached)')}`;
  }, 400);
  return 'PDF saved. Attach it to the email that just opened';
}

export async function shareWhatsApp(file, job, settings) {
  if (canShareFiles(file)) {
    const r = await systemShare(file, { title: subjectFor(job), text: subjectFor(job) });
    return r === 'shared' ? 'Sent' : '';
  }
  saveFile(file);
  const phone = (job.client.phone || '').replace(/[^\d+]/g, '').replace(/^0/, '44').replace(/^\+/, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(subjectFor(job) + ' (PDF attached)')}`, '_blank');
  return 'PDF saved. Attach it in WhatsApp';
}

// ---------- in-app preview with pdf.js ----------

let pdfjsPromise = null;
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((res, rej) => {
      if (window.pdfjsLib) return res(window.pdfjsLib);
      const s = document.createElement('script');
      s.src = 'vendor/pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        res(window.pdfjsLib);
      };
      s.onerror = () => { pdfjsPromise = null; rej(new Error('Preview could not load')); };
      document.head.appendChild(s);
    });
  }
  return pdfjsPromise;
}

export async function renderPreview(file, container, { isCancelled = () => false } = {}) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  container.innerHTML = '';
  const width = container.clientWidth || 340;
  const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
  for (let i = 1; i <= doc.numPages; i++) {
    if (isCancelled()) return doc.numPages;
    const page = await doc.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = (width / vp1.width) * ratio;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.className = 'preview__page';
    canvas.setAttribute('aria-label', `Page ${i} of ${doc.numPages}`);
    canvas.style.aspectRatio = `${vp.width} / ${vp.height}`;
    container.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  }
  return doc.numPages;
}

// ---------- job files: send a whole job to another Comfyair phone ----------

export function jobFileName(job) {
  const who = job.client.name || job.site.name || '';
  return (`Comfyair Job ${job.jobNo}${who ? ' - ' + who : ''}.json`).replace(/[\\/:*?"<>|]+/g, '');
}

export function jobFile(job, site, fromEngineer) {
  const data = { app: 'comfyair', kind: 'job', version: 1, exportedAt: new Date().toISOString(), from: fromEngineer || job.engineer || '', job, site: site || null };
  return new File([JSON.stringify(data)], jobFileName(job), { type: 'application/json' });
}

// ---------- job data inside a PDF ----------
// Packs the job file as base64 (gzipped where the phone can) for the PDF's info dictionary, and finds it again on import.
const b64 = (bytes) => { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const unb64 = (str) => { const bin = atob(str); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
export async function packJob(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (typeof CompressionStream === 'function') {
    try {
      const gz = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      return 'CAZ1:' + b64(new Uint8Array(await new Response(gz).arrayBuffer()));
    } catch (e) { /* fall through */ }
  }
  return 'CAJ1:' + b64(bytes);
}
export async function unpackJobFromPdf(file) {
  const buf = await file.arrayBuffer();
  const head = new TextDecoder('latin1').decode(buf.slice(0, 8));
  if (!head.startsWith('%PDF')) return null;
  const text = new TextDecoder('latin1').decode(buf);
  // pdfkit writes the value as an indirect object: "/ComfyairJob 28 0 R" then "28 0 obj (CAZ1:...)"
  let m = text.match(/\/ComfyairJob\s*\((CA[ZJ]1:[A-Za-z0-9+\/=]+)\)/);
  if (!m) { const r = text.match(/\/ComfyairJob\s+(\d+)\s+0\s+R/); if (r) m = text.match(new RegExp('\\n' + r[1] + ' 0 obj\\s*\\((CA[ZJ]1:[A-Za-z0-9+\\/=]+)\\)')); }
  if (!m) return { none: true };
  const [kind, data] = m[1].split(':');
  let bytes = unb64(data);
  if (kind === 'CAZ1') {
    if (typeof DecompressionStream !== 'function') throw new Error('This phone cannot unpack that PDF. Ask for the job file instead.');
    const un = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(un).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Shares the job file through the phone's share sheet (WhatsApp, email, AirDrop...). Falls back to a download.
export async function shareJobFile(file, job, toName) {
  const title = `Job ${job.jobNo} for the Comfyair app`;
  const text = `Job ${job.jobNo}${job.client.name ? ', ' + job.client.name : ''} for the Comfyair app. Android: tap the file, then Share, then Comfyair. iPhone: tap the file, Share, Save to Files, then in Comfyair tap Import on the Jobs screen.`;
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'Sent';
    } catch (e) {
      if (e && e.name === 'AbortError') return '';
      throw e;
    }
  }
  saveFile(file);
  return `Job file saved. Send it to ${toName || 'the boss'} and they tap Import a job`;
}
