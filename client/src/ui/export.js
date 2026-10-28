import G from '../core/gym.js';
import I18N from '../i18n/i18n.js';

/* exported files follow the interface language: headings, statuses, month names */
export function lcell(c) { return typeof c === 'string' ? I18N.tr(c) : (c == null ? '' : c); }
export function csvText(rows) {
  return '﻿' + rows.map(function (r) {
    return r.map(function (c) { var s = lcell(c); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
  }).join('\r\n');
}
function sheet(XLSX, rows, widths) {
  var ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map(function (w) { return { wch: w }; });
  return ws;
}
/* the Excel library is loaded only when a file is exported, so it stays out of the main bundle */
export async function saveXlsx(name, sheets) {
  var XLSX;
  try { XLSX = await import('xlsx'); } catch (e) { throw new G.AppError('The Excel library could not be loaded.'); }
  var wb = XLSX.utils.book_new();
  sheets.forEach(function (s) { XLSX.utils.book_append_sheet(wb, sheet(XLSX, s.rows.map(function (r) { return r.map(lcell); }), s.widths), I18N.tr(s.name)); });
  var buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return downloadFile(name, buf);
}

/* a normal browser download: Blob -> object URL -> <a download> click, then the URL is revoked */
var MIME = { csv: 'text/csv;charset=utf-8', json: 'application/json', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
export function downloadFile(filename, data) {
  var ext = String(filename).split('.').pop().toLowerCase();
  var blob = new Blob([data], { type: MIME[ext] || 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  return true;
}
