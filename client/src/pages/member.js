import G from '../core/gym.js';
import { ui } from '../state.js';
import { lineSpark } from '../ui/charts.js';
import { esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { avatar, cap1, daysText, money, planText, statusChip, todayStr } from '../ui/parts.js';

/* ---------- member detail ---------- */
function typeChip(t) {
  var m = { payment: 'ok', income: 'ok', charge: 'warn', adjustment: 'plain' };
  return '<span class="chip ' + (m[t] || 'plain') + '">' + cap1(t) + '</span>';
}
export function pMember() { return memberView(ui.route.id, false); }
export function pMyProfile() { return memberView(G.me().client, true); }
/* one profile for both: staff get the action buttons; a signed-in member sees only their own data, read-only (ro) */
function memberView(cid, ro) {
  var P = G.profileData(cid);
  if (!P) return '<div class="card"><div class="empty"><b>Member not found</b>This member may have been deleted.</div></div>' + (ro ? '' : '<div><button class="btn" data-act="back">' + ic('back') + 'Back to members</button></div>');
  var c = P.c, today = todayStr(), status = P.status, sub = P.sub, subs = P.subs, visits = P.visits, txs = P.txs, ms = P.ms;
  var loginRow = '<dt>Login</dt><dd>' + (P.login ? esc(P.login.username) : '<span class="muted">No login</span>') + '</dd>';
  var frozenNote = c.status === 'frozen' ? '<div class="banner" style="background:var(--frozen-bg);color:var(--frozen)">Frozen since ' + G.fmtDate(c.frozen_since) + ' (' + Math.max(0, G.diffDays(c.frozen_since || today, today)) + ' days). Unfreezing adds these days to the end date.</div>' : '';

  var head = '<section class="card profile">' + avatar(c, true) + '<div class="info"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2>' + esc(c.name) + '</h2>' + statusChip(status, !!sub) + '</div>' +
    '<dl class="kv"><dt>Phone</dt><dd>' + esc(c.phone || '—') + '</dd><dt>Training days</dt><dd>' + esc(daysText(c)) + '</dd><dt>Joined</dt><dd>' + G.fmtDate(c.created_at.slice(0, 10)) + '</dd>' + loginRow + (c.note ? '<dt>Note</dt><dd>' + esc(c.note) + '</dd>' : '') + '</dl>' +
    (ro ? '' : '<div class="row-actions"><button class="btn btn-sm" data-act="back">' + ic('back') + 'Members</button><button class="btn btn-sm btn-primary" data-act="checkin" data-id="' + esc(c.id) + '" data-stay="1">' + ic('check') + 'Check in</button>' +
    '<button class="btn btn-sm" data-act="editMember" data-id="' + esc(c.id) + '">' + ic('edit') + 'Edit</button>' +
    (P.login ? '<button class="btn btn-sm" data-act="resetMemberPw" data-id="' + esc(c.id) + '">' + ic('key') + 'Reset password</button>' : '') +
    (c.status === 'frozen' ? '<button class="btn btn-sm" data-act="unfreeze" data-id="' + esc(c.id) + '">' + ic('snow') + 'Unfreeze</button>' : '<button class="btn btn-sm" data-act="freeze" data-id="' + esc(c.id) + '">' + ic('snow') + 'Freeze</button>') +
    '<button class="btn btn-sm btn-danger" data-act="deleteMember" data-id="' + esc(c.id) + '">' + ic('trash') + 'Delete</button></div>') + '</div></section>';

  /* subscription card */
  var subBody;
  if (sub) {
    var st = G.subState(sub, today), rem = G.subRemaining(sub, today), pct, cls = '';
    if (sub.sub_type === 'sessions') { pct = Math.round(100 * sub.used_sessions / sub.total_sessions); if (st !== 'ok') cls = 'bad'; else if (rem <= 2) cls = 'warn'; }
    else { var total = G.diffDays(sub.start_date, sub.end_date) + 1; var el = Math.min(total, Math.max(0, G.diffDays(sub.start_date, today) + 1)); pct = Math.round(100 * el / total); if (st !== 'ok') cls = 'bad'; else if (rem <= 7) cls = 'warn'; }
    subBody = '<div class="body" style="display:flex;flex-direction:column;gap:12px"><div><b style="font-size:16px">' + esc(G.planLabel(sub)) + '</b> <span class="muted">' + (sub.sub_type === 'sessions' ? 'session pass' : 'time plan') + '</span><div class="small" style="margin-top:2px">' + planText(sub) + '</div></div>' +
      '<div class="bar ' + cls + '" role="img" aria-label="' + pct + ' percent used"><i style="width:' + pct + '%"></i></div>' +
      '<dl class="kv small"><dt>Starts</dt><dd>' + G.fmtDate(sub.start_date) + '</dd><dt>' + (sub.sub_type === 'sessions' ? 'Valid until' : 'Ends') + '</dt><dd>' + (sub.end_date ? G.fmtDate(sub.end_date) : 'No expiry') + '</dd>' +
      (sub.sub_type === 'sessions' ? '<dt>Used</dt><dd>' + sub.used_sessions + ' of ' + sub.total_sessions + '</dd>' : '') + '<dt>Price</dt><dd>' + money(sub.price) + ' UZS</dd></dl>' +
      (ro ? '' : '<div class="row-actions"><button class="btn btn-sm btn-primary" data-act="newSub" data-id="' + esc(c.id) + '">' + ic('plus') + 'New subscription</button><button class="btn btn-sm" data-act="extend" data-id="' + esc(c.id) + '">Extend</button></div>') + '</div>';
  } else {
    subBody = ro ? '<div class="empty"><b>No subscription</b>Ask the gym staff to add a plan.</div>' : '<div class="empty"><b>No subscription</b>Add a plan so this member can check in.<div style="margin-top:12px"><button class="btn btn-primary" data-act="newSub" data-id="' + esc(c.id) + '">' + ic('plus') + 'New subscription</button></div></div>';
  }
  var older = subs.filter(function (s) { return !sub || s.id !== sub.id; });
  var subHist = older.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Earlier plans</th><th>Period</th><th class="r">Price</th></tr></thead><tbody>' + older.map(function (s) {
    return '<tr><td>' + esc(G.planLabel(s)) + '</td><td class="small">' + G.fmtDate(s.start_date) + (s.end_date ? ' – ' + G.fmtDate(s.end_date) : '') + (s.sub_type === 'sessions' ? ' · ' + s.used_sessions + '/' + s.total_sessions + ' used' : '') + '</td><td class="r">' + money(s.price) + '</td></tr>';
  }).join('') + '</tbody></table></div>' : '';

  var money_card = '<section class="card"><header><h3>Debt</h3></header><div class="body" style="display:flex;flex-direction:column;gap:12px"><div class="tile" style="border:0;padding:0"><div class="v" style="font-size:calc(44px * var(--ds));color:' + (c.debt > 0 ? 'var(--bad)' : 'var(--ok)') + '">' + money(c.debt || 0) + '<small>UZS</small></div><div class="s">' + (c.debt > 0 ? (ro ? 'You owe the gym' : 'Owed by this member') : 'Nothing owed') + '</div></div>' +
    (ro ? '' : '<div class="row-actions"><button class="btn btn-sm btn-primary" data-act="pay" data-id="' + esc(c.id) + '">' + ic('card') + 'Take payment</button><button class="btn btn-sm" data-act="charge" data-id="' + esc(c.id) + '">Add charge</button><button class="btn btn-sm" data-act="adjust" data-id="' + esc(c.id) + '">Adjust</button></div>') + '</div></section>';

  var wts = ms.filter(function (m) { return m.weight != null; }).map(function (m) { return m.weight; }).reverse();
  var mBody = ms.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th class="r">Weight kg</th><th class="r">Height cm</th><th class="r hide-sm">Body fat %</th><th class="r hide-sm">Chest</th><th class="r hide-sm">Waist</th><th class="r hide-sm">Bicep</th><th class="hide-sm">Note</th>' + (ro ? '' : '<th></th>') + '</tr></thead><tbody>' + ms.map(function (m) {
    function v(x) { return x == null ? '<span class="muted">—</span>' : x; }
    return '<tr><td>' + G.fmtDate(m.created_at.slice(0, 10)) + '</td><td class="r">' + v(m.weight) + '</td><td class="r">' + v(m.height) + '</td><td class="r hide-sm">' + v(m.body_fat) + '</td><td class="r hide-sm">' + v(m.chest) + '</td><td class="r hide-sm">' + v(m.waist) + '</td><td class="r hide-sm">' + v(m.bicep) + '</td><td class="hide-sm small">' + esc(m.note) + '</td>' + (ro ? '' : '<td class="act"><button class="btn btn-sm icon-btn" data-act="delMeasure" data-id="' + esc(m.id) + '" aria-label="Delete measurement">' + ic('trash') + '</button></td>') + '</tr>';
  }).join('') + '</tbody></table></div>' : '<div class="empty"><b>No measurements</b>Record weight, body fat and girth to track progress.</div>';

  var vShow = ui.det.allVisits ? visits : visits.slice(0, 12);
  var vBody = visits.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Day</th><th>Time</th></tr></thead><tbody>' + vShow.map(function (v) {
    return '<tr><td>' + G.fmtDate(v.visit_date) + '</td><td>' + G.dowOf(v.visit_date) + '</td><td class="mono">' + esc(v.visit_time) + '</td></tr>';
  }).join('') + '</tbody></table></div>' + (visits.length > 12 ? '<div class="pager"><button class="btn btn-sm" data-act="toggleVisits">' + (ui.det.allVisits ? 'Show fewer' : 'Show all ' + visits.length) + '</button></div>' : '') : '<div class="empty"><b>No visits yet</b></div>';
  var tShow = ui.det.allTx ? txs : txs.slice(0, 12);
  var tBody = txs.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th class="r">Amount</th><th class="r hide-sm">Debt after</th><th class="hide-sm">Note</th></tr></thead><tbody>' + tShow.map(function (t) {
    return '<tr><td>' + G.fmtDate(t.d) + '</td><td>' + typeChip(t.txn_type) + '</td><td class="r">' + money(t.amount) + '</td><td class="r hide-sm">' + (t.balance_after == null ? '—' : money(t.balance_after)) + '</td><td class="hide-sm small">' + esc((t.category ? t.category + '. ' : '') + (t.note || '')) + '</td></tr>';
  }).join('') + '</tbody></table></div>' + (txs.length > 12 ? '<div class="pager"><button class="btn btn-sm" data-act="toggleTx">' + (ui.det.allTx ? 'Show fewer' : 'Show all ' + txs.length) + '</button></div>' : '') : '<div class="empty"><b>No transactions yet</b></div>';

  return frozenNote + head +
    '<div class="cols"><section class="card"><header><h3>Subscription</h3></header>' + subBody + subHist + '</section>' + money_card + '</div>' +
    '<section class="card"><header><h3>Measurements</h3>' + lineSpark(wts) + (ro ? '' : '<button class="btn btn-sm" data-act="addMeasure" data-id="' + esc(c.id) + '">' + ic('plus') + 'Add</button>') + '</header>' + mBody + '</section>' +
    '<div class="cols"><section class="card"><header><h3>Visits</h3><span class="muted small">' + visits.length + ' total</span></header>' + vBody + '</section>' +
    '<section class="card"><header><h3>Payments and charges</h3></header>' + tBody + '</section></div>';
}

