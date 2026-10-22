// Quotes on the Home screen: what's waiting, what needs a chase, what's been won. Plus quoted-vs-actual once the job's done.

import { html, useState } from '../vendor/preact-htm.js';
import { Icon, Sheet, toast, ask } from './ui.js';
import { saveJob } from './store.js';
import { priceQuote, getPrice, fmtGBP0, TIERS } from './quote.js';
import { go } from './router.js';
import { vibrate, onSiteMinutes } from './util.js';

const DAY = 86400000;
export const quoteStatus = (j) => {
  const p = j.data.pipeline || { status: 'draft' };
  if (j.data.accepted && j.data.accepted.tier) return 'accepted';
  if (p.status === 'lost') return 'lost';
  if (p.status === 'sent' || j.sentAt) return (p.chaseAt || (j.sentAt || 0) + 5 * DAY) < Date.now() ? 'chase' : 'sent';
  return 'draft';
};
const STATUS = { draft: 'Drafting', sent: 'Waiting', chase: 'Chase', accepted: 'Won', lost: 'Lost' };

export function quoteValue(j, settings) {
  const p = priceQuote(j.data, getPrice(settings));
  const t = (j.data.accepted && j.data.accepted.tier) || j.data.recommended;
  const o = p.options.find((x) => x.tier.id === t) || p.offered[0];
  return o ? o.total : 0;
}

export function QuotesBlock({ jobs, settings, onChange }) {
  const quotes = jobs.filter((j) => j.type === 'quote');
  const [pick, setPick] = useState(null);
  if (!quotes.length) return null;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const by = (s) => quotes.filter((j) => quoteStatus(j) === s);
  const won = quotes.filter((j) => quoteStatus(j) === 'accepted' && (j.data.accepted.at || 0) >= monthStart.getTime());
  const wonValue = won.reduce((a, j) => a + quoteValue(j, settings), 0);
  const open = [...by('chase'), ...by('sent')].sort((a, b) => (a.data.pipeline.chaseAt || 0) - (b.data.pipeline.chaseAt || 0));
  const outValue = open.reduce((a, j) => a + quoteValue(j, settings), 0);
  const decided = quotes.filter((j) => ['accepted', 'lost'].includes(quoteStatus(j)));
  const winRate = decided.length >= 3 ? Math.round((quotes.filter((j) => quoteStatus(j) === 'accepted').length / decided.length) * 100) : null;

  const chase = (j) => {
    vibrate();
    const first = (j.data.title || 'the air conditioning quote').toLowerCase();
    const text = `Hi ${(j.client.contact || j.client.name || '').split(' ')[0]}, Elliott from Comfyair. Just checking you got quote ${j.jobNo} for ${first} and whether you had any questions. Happy to pop round or tweak anything. Thanks!`;
    const phone = (j.client.phone || '').replace(/[^\d+]/g, '').replace(/^0/, '44').replace(/^\+/, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    const d = { ...j.data, pipeline: { ...j.data.pipeline, chaseAt: Date.now() + 4 * DAY } };
    saveJob({ ...j, data: d }).then(onChange);
  };
  const markWon = async (j, tier) => {
    const d = { ...j.data, accepted: { tier, at: Date.now() }, pipeline: { ...j.data.pipeline, status: 'accepted' } };
    await saveJob({ ...j, data: d }); setPick(null); onChange();
    toast(`Quote ${j.jobNo} won. Open it to start the install job.`, { icon: 'check', ms: 4000 });
  };
  const markLost = async (j) => {
    if (!(await ask({ title: `Mark quote ${j.jobNo} as lost?`, body: 'It stays in your jobs, just stops nagging you to chase it.', ok: 'Lost it', danger: true }))) return;
    const d = { ...j.data, pipeline: { ...j.data.pipeline, status: 'lost' } };
    await saveJob({ ...j, data: d }); onChange();
  };

  return html`<section class="block">
    <div class="block__row"><h2 class="block__title">Quotes</h2><button class="link" onClick=${() => go('/jobs?type=quote')}>All quotes</button></div>
    <div class="pipe">
      <div class="pipe__stat"><b>${fmtGBP0(outValue)}</b><small>${open.length} out with customers</small></div>
      <div class="pipe__stat pipe__stat--won"><b>${fmtGBP0(wonValue)}</b><small>won this month</small></div>
      ${winRate !== null && html`<div class="pipe__stat"><b>${winRate}%</b><small>win rate</small></div>`}
    </div>
    ${open.length > 0 && html`<div class="list">
      ${open.slice(0, 5).map((j) => { const st = quoteStatus(j); const days = Math.round((Date.now() - (j.data.pipeline.sentAt || j.sentAt || Date.now())) / DAY); return html`<div class=${'qrow' + (st === 'chase' ? ' is-chase' : '')} key=${j.id}>
        <button class="qrow__main" onClick=${() => go(`/job/${j.id}`)}>
          <span class="jobrow__title">${j.client.name || j.site.name || 'Quote ' + j.jobNo}<small> ${fmtGBP0(quoteValue(j, settings))}</small></span>
          <span class="jobrow__sub">${st === 'chase' ? `Sent ${days} day${days === 1 ? '' : 's'} ago, worth a nudge` : `Sent ${days === 0 ? 'today' : days + ' day' + (days === 1 ? '' : 's') + ' ago'}`}${j.data.pipeline.revision > 1 ? `, rev ${j.data.pipeline.revision}` : ''}</span>
        </button>
        <div class="qrow__acts">
          ${j.client.phone && html`<button class="iconbtn iconbtn--soft" aria-label="Chase on WhatsApp" onClick=${() => chase(j)}><${Icon} name="chat" size=${18} /></button>`}
          <button class="iconbtn iconbtn--soft" aria-label="Won" onClick=${() => setPick(j)}><${Icon} name="check" size=${18} /></button>
          <button class="iconbtn iconbtn--muted" aria-label="Lost" onClick=${() => markLost(j)}><${Icon} name="x" size=${18} /></button>
        </div>
      </div>`; })}
    </div>`}
    <${Sheet} open=${!!pick} onClose=${() => setPick(null)} title="Which option did they go for?">
      ${pick && html`<div class="menu">
        ${(() => { const p = priceQuote(pick.data, getPrice(settings)); return p.offered.map((o) => html`<button class="menu__item" onClick=${() => markWon(pick, o.tier.id)}><${Icon} name="tag" /><span><b>${pick.data.kind === 'service' ? ({ good: 'Bronze', better: 'Silver', best: 'Gold' })[o.tier.id] : o.tier.label}</b><small>${fmtGBP0(o.total)} inc VAT</small></span></button>`); })()}
      </div>`}
    </${Sheet}>
  </section>`;
}

// Quoted vs actual: hours on job sheets started from this quote against the hours priced.
export function quotedVsActual(quote, jobs, settings) {
  const linked = jobs.filter((j) => j.fromQuote === quote.jobNo && j.type !== 'quote');
  if (!linked.length) return null;
  const p = priceQuote(quote.data, getPrice(settings));
  const o = p.options.find((x) => x.tier.id === quote.data.accepted.tier);
  if (!o) return null;
  const mins = linked.reduce((a, j) => a + (onSiteMinutes(j.time) || 0), 0);
  return { quotedHours: o.hours, actualHours: Math.round((mins / 60) * 10) / 10, jobs: linked.length };
}
export { STATUS as QUOTE_STATUS, TIERS };
