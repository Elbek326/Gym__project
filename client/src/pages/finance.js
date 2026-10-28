import G from '../core/gym.js';
import { ui } from '../state.js';
import { hbars } from '../ui/charts.js';
import { esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { cap1, money, tile } from '../ui/parts.js';

/* ---------- finance ---------- */
export function pFinance() {
  var fm = G.financeMonth(ui.fin.ym), t = fm.totals;
  var days = Object.keys(fm.daily).sort();
  var cats = Object.keys(fm.byCat).map(function (k) { return { label: cap1(k), value: fm.byCat[k] }; }).sort(function (a, b) { return b.value - a.value; });
  var src = [{ label: 'Memberships', value: t.payments }, { label: 'Shop', value: t.sales }, { label: 'Other income', value: t.income }].filter(function (x) { return x.value > 0; });
  var inc = fm.income.slice(0, 100).map(function (r) {
    return '<tr><td class="small">' + G.fmtDate(r.d) + '</td><td>' + esc(r.label) + (r.who ? '<div class="small muted">' + esc(r.who) + '</div>' : '') + '</td><td class="r">' + money(r.amount) + '</td><td class="act">' + (r.kind === 'income' ? '<button class="btn btn-sm icon-btn" data-act="delIncome" data-id="' + esc(r.id) + '" aria-label="Delete income entry">' + ic('trash') + '</button>' : '') + '</td></tr>';
  }).join('');
  var exp = fm.expenses.slice(0, 100).map(function (e) {
    return '<tr><td class="small">' + G.fmtDate(e.date) + '</td><td>' + cap1(e.category) + (e.note ? '<div class="small muted">' + esc(e.note) + '</div>' : '') + '</td><td class="r">' + money(e.amount) + '</td><td class="act"><button class="btn btn-sm icon-btn" data-act="delExpense" data-id="' + esc(e.id) + '" aria-label="Delete expense">' + ic('trash') + '</button></td></tr>';
  }).join('');
  return '<div class="toolbar"><div class="field" style="flex-direction:row;align-items:center;gap:8px"><label for="fin-month" class="lbl">Month</label><input id="fin-month" type="month" value="' + esc(ui.fin.ym) + '" data-change="finMonth" style="padding:7px 10px;border:1px solid var(--line);border-radius:var(--r-ctl);background:var(--surface)"></div><span class="grow"></span>' +
    '<button class="btn" data-act="exportFinance">' + ic('download') + 'Excel</button><button class="btn" data-act="addIncome">' + ic('plus') + 'Income</button><button class="btn btn-primary" data-act="addExpense">' + ic('plus') + 'Expense</button></div>' +
    '<div class="tiles">' + tile('Revenue', money(t.revenue), 'dot-ok', G.monthLabel(ui.fin.ym), 'UZS') + tile('Expenses', money(t.expenses), 'dot-bad', '', 'UZS') + tile('Profit', money(t.profit), t.profit >= 0 ? 'dot-ok' : 'dot-bad', 'Revenue minus expenses', 'UZS') + '</div>' +
    '<div class="cols"><section class="card"><header><h3>Where revenue came from</h3></header><div class="body">' + hbars(src, money) + '</div></section>' +
    '<section class="card"><header><h3>Where money went</h3></header><div class="body">' + hbars(cats, money) + '</div></section></div>' +
    '<div class="cols"><section class="card"><header><h3>Income</h3><span class="muted small">' + fm.income.length + ' entries</span></header>' + (inc ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Source</th><th class="r">Amount</th><th></th></tr></thead><tbody>' + inc + '</tbody></table></div>' : '<div class="empty"><b>No income this month</b></div>') + '</section>' +
    '<section class="card"><header><h3>Expenses</h3><span class="muted small">' + fm.expenses.length + ' entries</span></header>' + (exp ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Category</th><th class="r">Amount</th><th></th></tr></thead><tbody>' + exp + '</tbody></table></div>' : '<div class="empty"><b>No expenses this month</b></div>') + '</section></div>';
}

