import G from '../core/gym.js';
import { barChart } from '../ui/charts.js';
import { esc } from '../ui/html.js';
import { memberLink, money, sampleBanner, tile } from '../ui/parts.js';

/* ---------- dashboard ---------- */
export function pDashboard() {
  var D = G.dashboard(), c = D.counts, S = G.S();
  var todays = D.todays.map(function (v) {
    var cl = S.clients[v.client]; if (!cl) return '';
    var sub = G.activeSub(cl.id);
    return '<div><span class="mono muted">' + esc(v.visit_time) + '</span><span class="grow">' + memberLink(cl) + '</span><span class="small muted">' + (sub ? G.subRemaining(sub, D.today) + (sub.sub_type === 'sessions' ? ' sessions left' : ' days left') : '') + '</span></div>';
  }).join('');
  var exp = D.expiring.slice(0, 8).map(function (e) {
    return '<div><span class="grow">' + memberLink(e.c) + '</span><span class="chip warn">' + esc(e.label) + '</span><button class="btn btn-sm" data-act="open" data-id="' + esc(e.c.id) + '">Renew</button></div>';
  }).join('');
  return sampleBanner() + '<div class="tiles">' +
    tile('Members', c.total, '') + tile('Active', c.active, 'dot-ok') + tile('Frozen', c.frozen, 'dot-frozen') + tile('Expired', c.expired, 'dot-bad') +
    tile('Check-ins today', D.todays.length, 'dot-warn', G.dowOf(D.today) + ' ' + G.fmtDate(D.today)) +
    tile('Revenue this month', money(D.month.revenue), '', '', 'UZS') + tile('Expenses this month', money(D.month.expenses), '', '', 'UZS') +
    tile('Debt owed to you', money(D.debt), 'dot-warn', '', 'UZS') + '</div>' +
    '<div class="cols"><section class="card"><header><h3>Checked in today</h3><span class="muted small">' + D.todays.length + '</span></header>' +
    (todays ? '<div class="list">' + todays + '</div>' : '<div class="empty"><b>No check-ins yet today</b>Use Quick Check-In in the sidebar or the Members page.</div>') + '</section>' +
    '<section class="card"><header><h3>Expiring soon</h3><span class="muted small">next 7 days or 2 sessions</span></header>' +
    (exp ? '<div class="list">' + exp + '</div>' : '<div class="empty"><b>Nothing is expiring</b>Active plans have more than a week or two sessions left.</div>') + '</section></div>' +
    '<section class="card"><header><h3>Check-ins, last 7 days</h3></header><div class="body">' + barChart(D.series, { label: 'Check-ins per day, last 7 days' }) + '</div></section>';
}

