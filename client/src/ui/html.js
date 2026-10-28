export const $ = function (s, r) { return (r || document).querySelector(s); };
export const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
