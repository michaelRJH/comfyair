// Settings block: Team sync. Set up once with the database link, then share the team code with the other phones.

import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { Icon, Input, TextArea, Toggle, Sheet, ask, toast } from './ui.js';
import { onSync, syncState, newTeamCode, parseSetup, testSync, pullNow, flush, RULES_JSON } from './sync.js';
import { fmtDate, vibrate } from './util.js';

const ago = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtDate(new Date(t).toISOString().slice(0, 10)); };

export function SyncSettings({ settings, save }) {
  const sync = settings.sync || { url: '', team: '', enabled: false };
  const [st, setSt] = useState(syncState());
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => onSync(setSt), []);
  const setSync = (patch) => save({ ...settings, sync: { ...sync, ...patch } });

  const turnOn = async (url, team) => {
    if (!url || !team) return toast('Need the database link and a team code first.', { icon: 'alert' });
    setBusy(true);
    try { await testSync(url, team); setSync({ url, team, enabled: true }); toast('Team sync is on', { icon: 'check' }); }
    catch (e) { toast(e.message, { icon: 'alert', ms: 6000 }); }
    finally { setBusy(false); }
  };
  const usePaste = () => {
    const { url, code } = parseSetup(paste);
    if (!url && !code) return toast('Nothing in there I recognise. It should have the database link and the team code.', { icon: 'alert', ms: 5000 });
    setPaste('');
    if (!(code || sync.team)) { setSync({ url }); toast('Database linked. Now make a team code, or paste the setup from the first phone.', { icon: 'check', ms: 5000 }); return; }
    turnOn(url || sync.url, code || sync.team);
  };
  const shareSetup = async () => {
    vibrate();
    const text = `Comfyair team sync setup. In the app go to Settings, Team sync, paste this whole message into the box and tap Join.\n\n${sync.url}\n${sync.team}`;
    if (navigator.share) { try { await navigator.share({ title: 'Comfyair team sync', text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    await navigator.clipboard.writeText(text); toast('Setup copied. Paste it to the other phone.', { icon: 'check' });
  };

  if (sync.enabled) {
    return html`<section class="setblock">
      <h2 class="setblock__title">Team sync</h2>
      <div class="syncstat">
        <span class=${'syncstat__dot is-' + (st.error ? 'err' : st.status)}></span>
        <span class="syncstat__text"><b>${st.error ? 'Problem syncing' : st.status === 'offline' ? 'Offline, will catch up' : st.status === 'pushing' || st.status === 'pulling' ? 'Syncing' : 'On'}</b>
          <small>${st.error ? st.error : `Last checked ${ago(st.lastPull)}${st.pending ? `, ${st.pending} waiting to go up` : ''}`}</small></span>
        <button class="btn btn--small btn--soft" onClick=${async () => { const n = await pullNow(); await flush(); toast(n ? `${n} update${n === 1 ? '' : 's'} came in` : 'Up to date', { icon: 'check' }); }}><${Icon} name="refresh" size=${16} /> Sync now</button>
      </div>
      <p class="hint">Jobs, sites and timesheets on this phone go up to the team as they change, and the other phones' work comes down. Finished jobs go straight away; drafts a few seconds after you stop typing.</p>
      <div class="setactions">
        <button class="setaction" onClick=${shareSetup}><${Icon} name="share" /><span><b>Send setup to another phone</b><small>WhatsApp them the link and team code. They paste it in and they're on the team.</small></span></button>
        <button class="setaction" onClick=${async () => { if (await ask({ title: 'Turn team sync off?', body: 'Nothing is deleted. This phone just stops sending and receiving.', ok: 'Turn off', danger: true })) setSync({ enabled: false }); }}><${Icon} name="x" /><span><b>Turn off</b><small>Team code ${sync.team}</small></span></button>
      </div>
    </section>`;
  }

  return html`<section class="setblock">
    <h2 class="setblock__title">Team sync</h2>
    <p class="hint">Share jobs between phones automatically. Archie finishes a job, it appears on Elliott's phone. Free, using a Google Firebase database that Comfyair owns.</p>
    ${sync.url ? html`
      <p class="hint"><${Icon} name="check" size=${14} /> Database linked.</p>
      <div class="grid2">
        <${Input} label="Team code" value=${sync.team} placeholder="From the first phone, or make one" onChange=${(v) => setSync({ team: v.trim().toLowerCase() })} wide />
      </div>
      <div class="setactions">
        <button class="setaction" onClick=${() => setSync({ team: newTeamCode() })}><${Icon} name="bolt" /><span><b>Make a new team code</b><small>Only on the first phone. Other phones join with the same code.</small></span></button>
        <button class="setaction" disabled=${busy} onClick=${() => turnOn(sync.url, sync.team)}><${Icon} name="refresh" /><span><b>${busy ? 'Checking' : 'Turn on team sync'}</b><small>Checks the database answers, then starts syncing.</small></span></button>
      </div>
    ` : ''}
    <${TextArea} label=${sync.url ? 'Or paste a setup message from another phone' : 'Paste the setup message, or the database link'} value=${paste} rows=${3} placeholder="https://....firebasedatabase.app
abc123..." onChange=${setPaste} />
    <div class="setactions">
      <button class="setaction" disabled=${busy || !paste.trim()} onClick=${usePaste}><${Icon} name="download" /><span><b>${busy ? 'Checking' : 'Join'}</b><small>Uses the link and code in the box above</small></span></button>
      <button class="setaction" onClick=${() => setHelp(true)}><${Icon} name="shield" /><span><b>Setting up the database (one-off, 5 minutes)</b><small>Step by step, for whoever owns the Google account</small></span></button>
    </div>
    <${Sheet} open=${help} onClose=${() => setHelp(false)} title="Set up the database" tall>
      <div class="stack synchelp">
        <ol>
          <li>On a computer go to <b>console.firebase.google.com</b> and sign in with a Google account. Tap <b>Create a project</b>, call it Comfyair, turn Analytics off, create it.</li>
          <li>In the left menu open <b>Build, Realtime Database</b>, tap <b>Create database</b>. Pick <b>Belgium (europe-west1)</b>, choose <b>locked mode</b>, enable.</li>
          <li>Open the <b>Rules</b> tab, delete what's there, paste the rules below, tap <b>Publish</b>.</li>
          <li>Back on the <b>Data</b> tab, copy the link at the top (it ends in <b>firebasedatabase.app</b>). Paste it into the box in this app, tap Join, then <b>Make a new team code</b> and <b>Turn on</b>.</li>
          <li>On each other phone: <b>Send setup to another phone</b>, and on that phone paste the message in and tap Join.</li>
        </ol>
        <p class="hint">The team code is the only thing protecting the data, so don't post it anywhere public. Free tier: 1 GB stored, which is thousands of job sheets.</p>
        <pre class="synchelp__rules">${RULES_JSON}</pre>
        <button class="btn btn--soft btn--block" onClick=${async () => { await navigator.clipboard.writeText(RULES_JSON); toast('Rules copied', { icon: 'check' }); }}><${Icon} name="copy" size=${18} /> Copy the rules</button>
      </div>
    </${Sheet}>
  </section>`;
}
