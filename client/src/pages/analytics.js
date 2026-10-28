import G from '../core/gym.js';
import { ui } from '../state.js';
import { barChart } from '../ui/charts.js';
import { esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { avatar, memberLink, tile } from '../ui/parts.js';

/* ---------- analytics ---------- */
export function pAnalytics() {
  var ym = ui.an.ym, rep = G.monthlyReport(ym), S = G.S();
  var nm = G.newMembers(ym), lost = G.lostMembers();
  var visitsTotal = rep.summary[2][1], uniq = rep.summary[3][1];
  var series = G.attendanceSeries(30);
  return '<div class="toolbar"><div class="field" style="flex-direction:row;align-items:center;gap:8px"><label for="an-month" class="lbl">Month</label><input id="an-month" type="month" value="' + esc(ym) + '" data-change="anMonth" style="padding:7px 10px;border:1px solid var(--line);border-radius:var(--r-ctl);background:var(--surface)"></div><span class="grow"></span>' +
    '<button class="btn btn-primary" data-act="exportReport">' + ic('download') + 'Monthly report (Excel)</button></div>' +
    '<div class="tiles">' + tile('New members', nm.length, 'dot-ok', G.monthLabel(ym)) + tile('Check-ins', visitsTotal, '', G.monthLabel(ym)) + tile('Members who came', uniq, '', 'at least once') + tile('Lost members', lost.length, 'dot-bad', '30+ days away') + '</div>' +
    '<section class="card"><header><h3>Attendance, last 30 days</h3></header><div class="body">' + barChart(series, { w: 900, h: 230, labelEvery: 2, label: 'Check-ins per day, last 30 days' }) + '</div></section>' +
    '<div class="cols"><section class="card"><header><h3>New members</h3><span class="muted small">' + G.monthLabel(ym) + '</span></header>' + (nm.length ? '<div class="list">' + nm.slice(0, 40).map(function (c) {
      return '<div>' + avatar(c) + '<span class="grow">' + memberLink(c) + '</span><span class="small muted">' + G.fmtDate(c.created_at.slice(0, 10)) + '</span></div>';
    }).join('') + '</div>' : '<div class="empty"><b>No new members this month</b></div>') + '</section>' +
    '<section class="card"><header><h3>Lost members</h3><span class="muted small">no visit for 30+ days</span></header>' + (lost.length ? '<div class="list">' + lost.slice(0, 40).map(function (x) {
      return '<div>' + avatar(x.c) + '<span class="grow">' + memberLink(x.c) + '<div class="small muted">' + (x.last ? 'Last visit ' + G.fmtDate(x.last) : 'Never visited') + '</div></span><span class="chip ' + (x.gap >= 60 ? 'expired' : 'warn') + '">' + x.gap + ' days</span></div>';
    }).join('') + '</div>' : '<div class="empty"><b>Nobody is lost</b>Everyone active has visited in the last 30 days.</div>') + '</section></div>';
}

