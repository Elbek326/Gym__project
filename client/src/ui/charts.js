import { esc } from './html.js';

/* ----- charts (drawn to one scale; text uses theme tokens) ----- */
export function niceMax(v) {
  var m = 4; while (m < v) m = m < 20 ? m + 4 : (m < 100 ? m + 20 : m * 2);
  return m;
}
export function barChart(data, o) {
  o = o || {};
  var w = o.w || 640, h = o.h || 220, padL = 34, padR = 8, padT = 20, padB = 26;
  var iw = w - padL - padR, ih = h - padT - padB, n = data.length;
  var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1])));
  var s = '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || 'Bar chart') + '">';
  for (var i = 0; i <= 4; i++) {
    var y = padT + ih - ih * i / 4;
    s += '<line class="gl" x1="' + padL + '" x2="' + (w - padR) + '" y1="' + y + '" y2="' + y + '"/>';
    s += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + (max * i / 4) + '</text>';
  }
  var slot = iw / n, bw = Math.min(40, slot * 0.62);
  data.forEach(function (d, k) {
    var bh = ih * d.value / max, x = padL + k * slot + (slot - bw) / 2, y2 = padT + ih - bh;
    var hi = o.hiLast !== false && k === n - 1;
    if (d.value > 0) s += '<rect class="cb' + (hi ? ' hi' : '') + '" x="' + x.toFixed(1) + '" y="' + y2.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="2"><title>' + esc(d.title || d.label) + ': ' + d.value + '</title></rect>';
    if (d.value > 0 && n <= 16) s += '<text class="val" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y2 - 5).toFixed(1) + '" text-anchor="middle">' + d.value + '</text>';
    var every = o.labelEvery || 1;
    if (k % every === 0 || k === n - 1) s += '<text x="' + (padL + k * slot + slot / 2).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>';
  });
  return s + '</svg>';
}
export function hbars(items, fmt) {
  var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
  if (!items.length) return '<div class="empty">Nothing recorded this month.</div>';
  return '<div class="hbars">' + items.map(function (i) {
    return '<div class="row"><span class="small">' + esc(i.label) + '</span><div class="bar"><i style="width:' + Math.max(2, Math.round(100 * i.value / max)) + '%"></i></div><b class="num small">' + (fmt ? fmt(i.value) : i.value) + '</b></div>';
  }).join('') + '</div>';
}
export function lineSpark(vals) {
  if (vals.length < 2) return '';
  var w = 140, h = 36, p = 4, mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
  var pts = vals.map(function (v, i) { return [p + i * (w - 2 * p) / (vals.length - 1), h - p - (v - mn) / rg * (h - 2 * p)]; });
  var last = pts[pts.length - 1];
  return '<svg class="chart" style="width:140px" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Weight trend"><polyline fill="none" stroke="var(--bar)" stroke-width="2" stroke-linejoin="round" points="' + pts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.5" fill="var(--bar-hi)"/></svg>';
}
