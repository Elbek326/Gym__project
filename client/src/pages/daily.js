import G from '../core/gym.js';
import { api, qs } from '../api.js';
import { DAY_PASS_PRICE } from '../config.js';
import { hooks, ui } from '../state.js';
import { esc } from '../ui/html.js';
import { saveXlsx } from '../ui/export.js';
import { openModal } from '../ui/modal.js';
import { avatar, fld, memberLink, money, tile } from '../ui/parts.js';
import { barChart } from '../ui/charts.js';
import { toast } from '../ui/toast.js';

/* ===== Today's arrivals: members who checked in on a day, and day-pass guests who paid for one visit =====
   GET /api/daily?date=YYYY-MM-DD (the date is optional: empty = today). The page is refreshed after every check-in. */
export function loadDaily() { return api.get('/api/daily' + qs({ date: ui.daily.date })); }

/* "2 days left" / "5 sessions left"; a member with no plan any more shows nothing */
function leftText(v) {
  if (v.remaining == null) return '';
  return v.remaining + (v.sub_type === 'sessions' ? (v.remaining === 1 ? ' session left' : ' sessions left') : (v.remaining === 1 ? ' day left' : ' days left'));
}

/* the small "+3 vs yesterday" line under a tile; `fmt` formats a money difference */
function delta(now, before, fmt) {
  var d = now - before;
  if (!d) return '<div class="s">same as yesterday</div>';
  var txt = (d > 0 ? '+' : '−') + (fmt ? fmt(Math.abs(d)) : Math.abs(d)) + ' vs yesterday';
  return '<div class="s ' + (d > 0 ? 'up' : 'down') + '">' + txt + '</div>';
}
/* tile() puts `sub` inside its own <div class="s">, so the delta is built as a string of that inner div here */
function dtile(label, val, dot, now, before, unit, fmt) {
  return tile(label, val, dot, null, unit).replace(/<\/div>$/, delta(now, before, fmt) + '</div>');
}

/* the hours worth drawing: 06..23, widened if somebody came earlier */
function hourRange(byHour) {
  var lo = 6, hi = 23;
  byHour.forEach(function (h) { if (h.visits + h.dayPasses > 0) { if (h.hour < lo) lo = h.hour; if (h.hour > hi) hi = h.hour; } });
  return byHour.filter(function (h) { return h.hour >= lo && h.hour <= hi; });
}
function hh(n) { return (n < 10 ? '0' : '') + n; }

/* the stats block; the server may not send `stats` (older server): then there is nothing to draw */
function statsBlock(D) {
  var st = D.stats, t = D.totals;
  if (!st || !Array.isArray(st.byHour)) return '';
  var y = st.yesterday, hours = hourRange(st.byHour);
  var tiles = '<div class="tiles">' +
    (y ? dtile('Members came', t.visits, 'dot-ok', t.visits, y.visits) : tile('Members came', t.visits, 'dot-ok')) +
    (y ? dtile('Day passes', t.dayPasses, 'dot-warn', t.dayPasses, y.dayPasses) : tile('Day passes', t.dayPasses, 'dot-warn')) +
    tile('New members', st.newMembers, 'dot-ok') +
    (y ? dtile('Revenue', money(st.revenue), '', st.revenue, y.revenue, 'UZS', money) : tile('Revenue', money(st.revenue), '', '', 'UZS')) +
    tile('Expenses', money(st.expenses), '', '', 'UZS') +
    tile('Profit', money(st.profit), st.profit < 0 ? 'dot-bad' : 'dot-ok', '', 'UZS') + '</div>';
  var chart = hours.some(function (h) { return h.visits + h.dayPasses > 0; })
    ? barChart(hours.map(function (h) { return { label: hh(h.hour), value: h.visits + h.dayPasses, title: hh(h.hour) + ':00 — ' + h.visits + ' + ' + h.dayPasses }; }),
        { label: 'Arrivals by hour', hiLast: false, labelEvery: 2 })
    : '<div class="empty"><b>No arrivals</b>Check-ins and day passes of this day appear here.</div>';
  return tiles + '<section class="card"><header><h3>Arrivals by hour</h3><span class="muted small">Members + day passes</span></header>' + chart + '</section>';
}

export function pDaily(D) {
  var t = D.totals;
  /* one list for both kinds, newest first ("HH:MM" strings sort the same way as the clock) */
  var rows = D.visits.map(function (v) { return { time: v.time || '', html: memberRow(v) }; })
    .concat(D.dayPasses.map(function (p) { return { time: p.time || '', html: passRow(p) }; }))
    .sort(function (a, b) { return a.time < b.time ? 1 : a.time > b.time ? -1 : 0; });
  var today = G.now().date;
  return '<div class="toolbar"><div class="field" style="flex-direction:row;align-items:center;gap:8px"><label for="daily-date" class="lbl">Date</label>' +
    '<input id="daily-date" type="date" value="' + esc(D.date) + '" max="' + esc(today) + '" data-change="dailyDate" style="padding:7px 10px;border:1px solid var(--line);border-radius:var(--r-ctl);background:var(--surface)"></div>' +
    (D.date !== today ? '<button class="btn btn-sm" data-act="dailyToday">Today</button>' : '') +
    '<span class="grow"></span>' + (D.stats ? '<button class="btn" data-act="exportDaily">Excel</button>' : '') + '<button class="btn btn-primary" data-act="addDayPass">+ Day pass</button></div>' +
    (D.stats ? statsBlock(D) : '<div class="tiles">' + tile('Members came', t.visits, 'dot-ok') + tile('Day passes', t.dayPasses, 'dot-warn') + tile('Day-pass income', money(t.dayPassAmount), '', '', 'UZS') + '</div>') +
    '<section class="card"><header><h3>Arrivals</h3><span class="muted small">' + (t.visits + t.dayPasses) + '</span></header>' +
    (rows.length ? '<div class="list">' + rows.map(function (r) { return r.html; }).join('') + '</div>' :
      '<div class="empty"><b>No arrivals</b>Check-ins and day passes of this day appear here.</div>') + '</section>';
}

function memberRow(v) {
  var left = leftText(v);
  return '<div class="arr">' + avatar(v.member) + '<span class="grow">' + memberLink(v.member) + '</span>' +
    (left ? '<span class="small muted">' + left + '</span>' : '') + '<span class="chip ok">Member</span>' + '<span class="mono muted">' + esc(v.time) + '</span></div>';
}
function passRow(p) {
  var name = p.name || 'Walk-in guest';
  return '<div class="arr">' + avatar({ name: name }) + '<span class="grow">' + esc(name) + '</span>' +
    '<span class="small muted">' + money(p.amount) + ' UZS</span><span class="chip warn">Day pass</span><span class="mono muted">' + esc(p.time) + '</span></div>';
}

/* the "+ Day pass" form: POST /api/daily/day-pass { name, phone, amount } */
export function openDayPass() {
  openModal({
    title: 'Day pass', submit: 'Save',
    body: fld('Name (optional)', 'name', { attrs: 'placeholder="Walk-in guest" maxlength="80" autocomplete="off"' }) +
      fld('Phone (optional)', 'phone', { type: 'tel', attrs: 'maxlength="30" autocomplete="off"' }) +
      fld('Amount (UZS)', 'amount', { type: 'number', value: DAY_PASS_PRICE, attrs: 'min="0" step="1000" inputmode="numeric" required' }),
    onSubmit: async function (fd) {
      var amount = Number(String(fd.get('amount') || '').trim());
      if (!isFinite(amount) || amount <= 0) throw new G.AppError('Enter the amount.');
      await api.post('/api/daily/day-pass', { name: String(fd.get('name') || '').trim(), phone: String(fd.get('phone') || '').trim(), amount: amount });
      toast('Day pass recorded', 'ok');
      ui.daily.date = '';   /* a new day pass is of today: show today's list */
      hooks.render();
      return true;
    }
  });
}

/* the day as an Excel file (daily_YYYY-MM-DD.xlsx): Summary, Arrivals (newest first, like the page), By hour */
export async function exportDaily() {
  var D;
  try { D = await loadDaily(); } catch (e) { toast(e && e.message ? e.message : 'Something went wrong.', 'err'); return; }
  var st = D.stats || { byHour: [] }, t = D.totals, y = st.yesterday;
  var sum = [['Bek Sport Gym: daily report', D.date], ['Members came', t.visits], ['Day passes', t.dayPasses], ['Day-pass income', t.dayPassAmount]];
  if (D.stats) sum.push(['New members', st.newMembers], ['Membership payments', st.payments], ['Other income', st.income], ['Shop sales', st.sales],
    ['Revenue', st.revenue], ['Expenses', st.expenses], ['Profit', st.profit]);
  if (y) sum.push(['Members came yesterday', y.visits], ['Day passes yesterday', y.dayPasses], ['Revenue yesterday', y.revenue]);
  var arr = [['Time', 'Name', 'Type', 'Left / Amount (UZS)']]
    .concat(D.visits.map(function (v) { return [v.time, v.member ? v.member.name : '', 'Member', leftText(v)]; }))
    .concat(D.dayPasses.map(function (p) { return [p.time, p.name || 'Walk-in guest', 'Day pass', p.amount]; }))
    .sort(function (a, b) { return a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0; });
  arr = [arr.shift()].concat(arr);
  var hr = [['Hour', 'Members came', 'Day passes']].concat(st.byHour.map(function (h) { return [hh(h.hour) + ':00', h.visits, h.dayPasses]; }));
  try {
    if (await saveXlsx('daily_' + D.date + '.xlsx', [{ name: 'Summary', rows: sum, widths: [30, 18] }, { name: 'Arrivals', rows: arr, widths: [8, 28, 12, 22] }, { name: 'By hour', rows: hr, widths: [8, 14, 14] }])) toast('Excel file saved');
  } catch (e) { toast(e && e.message ? e.message : 'Something went wrong.', 'err'); }
}
