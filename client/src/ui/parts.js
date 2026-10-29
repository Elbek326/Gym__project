import G from '../core/gym.js';
import { session } from '../state.js';
import { esc } from './html.js';
import { ic } from './icons.js';

export const money = G.fmtMoney;

export function initials(name) {
  var p = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return p.map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
}
export function avatar(c, big) {
  var cls = 'avatar' + (big ? ' lg' : '');
  if (c && c.image) return '<img class="' + cls + '" src="' + esc(c.image) + '" alt="">';
  return '<span class="' + cls + '" aria-hidden="true">' + esc(initials(c && c.name)) + '</span>';
}
export function statusChip(status, hasSub) {
  var label = { active: 'Active', frozen: 'Frozen', expired: 'Expired' }[status] || status;
  if (status === 'expired' && !hasSub) label = 'No plan';
  return '<span class="chip ' + status + '">' + label + '</span>';
}
export function planText(sub) {
  if (!sub) return '<span class="muted">No subscription</span>';
  var today = G.now().date; var rem = G.subRemaining(sub, today); var st = G.subState(sub, today);
  if (sub.sub_type === 'sessions') {
    var s = rem + ' of ' + sub.total_sessions + ' sessions left';
    if (st === 'expired') s += ' (expired ' + G.fmtDate(sub.end_date) + ')';
    else if (sub.end_date) s += ', until ' + G.fmtDate(sub.end_date);
    return s;
  }
  if (st === 'expired') return 'Expired ' + G.fmtDate(sub.end_date);
  return (rem === 0 ? 'Ends today' : rem + (rem === 1 ? ' day left' : ' days left')) + ' <span class="muted">(' + G.fmtDate(sub.end_date) + ')</span>';
}
export function daysText(c) { return c.days ? c.days.replace(/,/g, ', ') : 'Any day'; }
export function todayStr() { return G.now().date; }

export function fld(label, name, o) {
  o = o || {};
  return '<div class="field"><label for="f_' + name + '">' + label + '</label><input id="f_' + name + '" name="' + name + '" type="' + (o.type || 'text') + '" value="' + esc(o.value == null ? '' : o.value) + '" ' + (o.attrs || '') + '>' + (o.hint ? '<div class="hint">' + o.hint + '</div>' : '') + '</div>';
}
export function sel(label, name, opts, val, attrs) {
  return '<div class="field"><label for="f_' + name + '">' + label + '</label><select id="f_' + name + '" name="' + name + '" ' + (attrs || '') + '>' +
    opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select></div>';
}
export function cap1(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
/* role names for the screen; anything that is not admin or member is a role that was removed */
export function roleLabel(r) { return r === 'admin' ? 'Admin' : r === 'member' ? 'Member' : 'Removed role'; }
export function pager(pg, act) {
  if (!pg.total) return '';
  return '<div class="pager"><span class="muted small grow">Showing ' + pg.from + '–' + pg.to + ' of ' + pg.total + '</span>' +
    '<button class="btn btn-sm" data-act="' + act + '" data-page="' + (pg.page - 1) + '"' + (pg.page <= 1 ? ' disabled' : '') + '>Previous</button>' +
    '<span class="small num">Page ' + pg.page + ' of ' + pg.pages + '</span>' +
    '<button class="btn btn-sm" data-act="' + act + '" data-page="' + (pg.page + 1) + '"' + (pg.page >= pg.pages ? ' disabled' : '') + '>Next</button></div>';
}
export function memberLink(c) {
  if (!c) return '<span class="muted">(deleted member)</span>';
  return '<button class="link" data-act="open" data-id="' + esc(c.id) + '">' + esc(c.name) + '</button>';
}
export function tile(label, val, dot, sub, unit) {
  return '<div class="tile"><div class="cap"><i class="' + (dot || '') + '"></i>' + label + '</div><div class="v">' + val + (unit ? '<small>' + unit + '</small>' : '') + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
}

/* total = how many members there are, hasSample = the sample data is loaded (both come with the page's data) */
export function sampleBanner(n, hasSample) {
  var admin = session.user.role === 'admin';
  if (n === 0) {
    return '<section class="card"><div class="empty"><b>Your gym is empty</b>Add your first member, or load sample data to see how everything looks.<div class="row-actions" style="justify-content:center;margin-top:14px"><button class="btn btn-primary" data-act="addMember">' + ic('plus') + 'Add first member</button>' +
      (admin ? '<button class="btn" data-act="loadSample">Load sample data</button>' : '') + '</div></div></section>';
  }
  if (hasSample) {
    return '<div class="banner" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px">You are looking at sample data. Remove it before you start using the real thing.</span>' + (admin ? '<button class="btn btn-sm" data-act="removeSample">Remove sample data</button>' : '') + '</div>';
  }
  return '';
}
