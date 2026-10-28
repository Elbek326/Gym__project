import G from '../core/gym.js';
import I18N from '../i18n/i18n.js';
import Persist from '../persist.js';

/* exported files follow the interface language: headings, statuses, month names */
export function lcell(c) { return typeof c === 'string' ? I18N.tr(c) : (c == null ? '' : c); }
export function csvText(rows) {
  return '﻿' + rows.map(function (r) {
    return r.map(function (c) { var s = lcell(c); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
  }).join('\r\n');
}
export function sheet(rows, widths) {
  var ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map(function (w) { return { wch: w }; });
  return ws;
}
export async function saveXlsx(name, sheets) {
  if (typeof XLSX === 'undefined') throw new G.AppError('The Excel library could not be loaded.');
  var wb = XLSX.utils.book_new();
  sheets.forEach(function (s) { XLSX.utils.book_append_sheet(wb, sheet(s.rows.map(function (r) { return r.map(lcell); }), s.widths), I18N.tr(s.name)); });
  var buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return Persist.saveFile(name, buf);
}
