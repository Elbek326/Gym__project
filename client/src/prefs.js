export var PREFS = { lang: 'uz', mode: 'auto', look: 'elegant', side: 'shown' };
export var LOOK_KEYS = ['elegant', 'osmon', 'zumrad', 'qum'];
export function loadPrefs() {
  try {
    var raw = localStorage.getItem('gym_prefs');
    if (raw) {
      var o = JSON.parse(raw);
      if (o.lang === 'uz' || o.lang === 'en') PREFS.lang = o.lang;
      if (o.mode === 'auto' || o.mode === 'light' || o.mode === 'dark') PREFS.mode = o.mode;
      if (LOOK_KEYS.indexOf(o.look) >= 0) PREFS.look = o.look;
      if (o.side === 'shown' || o.side === 'hidden') PREFS.side = o.side;
    } else {
      var old = localStorage.getItem('gym_theme');           /* version 2 stored just light or dark */
      if (old === 'dark' || old === 'light') PREFS.mode = old;
    }
  } catch (e) { /* storage unavailable: defaults */ }
}
export function savePrefs() { try { localStorage.setItem('gym_prefs', JSON.stringify(PREFS)); } catch (e) { /* ignore */ } }
export function effectiveTheme() {
  if (PREFS.mode === 'dark' || PREFS.mode === 'light') return PREFS.mode;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
