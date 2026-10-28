import { LOOKS } from '../looks.js';
import { LOOK_KEYS, PREFS, effectiveTheme } from '../prefs.js';
import { esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';

/* ---------- settings: language, display mode, look ---------- */
export function pSettings() {
  var dark = effectiveTheme() === 'dark';
  function opt(act, v, on, icon, label, langAttr) {
    return '<button type="button" class="opt" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + on + '"' + (langAttr ? ' lang="' + langAttr + '"' : '') + '>' + (icon ? ic(icon) : '') + '<span>' + label + '</span></button>';
  }
  var looks = LOOK_KEYS.map(function (k) {
    var L = LOOKS[k], sw = dark ? L.dark : L.light;
    return '<button type="button" class="look" data-act="setLook" data-v="' + k + '" aria-pressed="' + (PREFS.look === k) + '">' +
      '<span class="chk">' + ic('check') + '</span><b>' + esc(L.name) + '</b><span class="d">' + esc(L.desc) + '</span>' +
      '<span class="sw" aria-hidden="true">' + sw.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span></button>';
  }).join('');
  return '<div class="set-wrap">' +
    '<section class="card set-card"><header><h3>Til / Language</h3></header><div class="body"><div class="opt-row" role="group" aria-label="Til / Language">' +
      opt('setLang', 'uz', PREFS.lang === 'uz', '', 'O‘zbekcha', 'uz') + opt('setLang', 'en', PREFS.lang === 'en', '', 'English', 'en') + '</div></div></section>' +
    '<section class="card set-card"><header><h3>Display mode</h3></header><div class="body"><div class="opt-row" role="group" aria-label="Display mode">' +
      opt('setMode', 'auto', PREFS.mode === 'auto', 'auto', 'Auto') + opt('setMode', 'light', PREFS.mode === 'light', 'sun', 'Light') + opt('setMode', 'dark', PREFS.mode === 'dark', 'moon', 'Night') + '</div>' +
      '<p class="small muted">Auto: follows your device setting.</p></div></section>' +
    '<section class="card set-card"><header><h3>Appearance</h3></header><div class="body"><div class="look-grid" role="group" aria-label="Appearance">' + looks + '</div>' +
      '<p class="small muted">Only colors and shapes change; your data is not affected.</p></div></section>' +
    '</div>';
}
