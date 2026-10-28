import I18N from '../i18n/i18n.js';
import { esc } from './html.js';

/* ---------- translation helpers used by the pages ---------- */
export function lt(s) { return I18N.tr(s); }
/* a sentence with bold parts: tpl('Delete {0}?', [name]) -> html. The Uzbek word order lives in I18N.TPL. */
export function tpl(en, args) {
  var s = (I18N.lang() === 'uz' && I18N.TPL[en]) || en;
  return s.replace(/\{(\d)\}/g, function (_, i) { return '<b>' + esc(args[+i]) + '</b>'; });
}
