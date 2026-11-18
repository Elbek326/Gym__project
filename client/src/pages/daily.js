import G from '../core/gym.js';
import { api, qs } from '../api.js';
import { DAY_PASS_PRICE } from '../config.js';
import { hooks, ui } from '../state.js';
import { esc } from '../ui/html.js';
import { openModal } from '../ui/modal.js';
import { avatar, fld, memberLink, money, tile } from '../ui/parts.js';
import { toast } from '../ui/toast.js';

/* ===== Today's arrivals: members who checked in on a day, and day-pass guests who paid for one visit =====
   GET /api/daily?date=YYYY-MM-DD (the date is optional: empty = today). The page is refreshed after every check-in. */
export function loadDaily() { return api.get('/api/daily' + qs({ date: ui.daily.date })); }

/* "2 days left" / "5 sessions left"; a member with no plan any more shows nothing */
function leftText(v) {
  if (v.remaining == null) return '';
  return v.remaining + (v.sub_type === 'sessions' ? (v.remaining === 1 ? ' session left' : ' sessions left') : (v.remaining === 1 ? ' day left' : ' days left'));
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
    '<span class="grow"></span><button class="btn btn-primary" data-act="addDayPass">+ Day pass</button></div>' +
    '<div class="tiles">' + tile('Members came', t.visits, 'dot-ok') + tile('Day passes', t.dayPasses, 'dot-warn') + tile('Day-pass income', money(t.dayPassAmount), '', '', 'UZS') + '</div>' +
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
