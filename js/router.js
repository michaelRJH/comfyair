// Hash router: #/path?query

import { useState, useEffect } from '../vendor/preact-htm.js';

export function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path, query, parts: path.split('/').filter(Boolean) };
}

export function go(path, query, replace = false) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString() : '';
  const hash = '#' + path + (qs.length > 1 ? qs : '');
  // remember where we came from so Back buttons can behave like the phone's own back
  if (replace) history.replaceState({ from: (history.state && history.state.from) || null }, '', hash);
  else history.pushState({ from: parse().path }, '', hash);
  window.dispatchEvent(new Event('routechange'));
}

export const cameFrom = () => (history.state && history.state.from) || null;

export function useRoute() {
  const [r, setR] = useState(parse());
  useEffect(() => {
    const on = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    window.addEventListener('routechange', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
      window.removeEventListener('routechange', on);
    };
  }, []);
  return r;
}
