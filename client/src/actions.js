import G from './core/gym.js';
import { api, enc, qs } from './api.js';
import { refreshAuditList } from './pages/audit.js';
import { openMemberForm, planFields, readPlan, refreshMemberList, wirePlan } from './pages/members.js';
import { hooks, ui } from './state.js';
import { csvText, downloadFile, saveXlsx } from './ui/export.js';
import { $, esc } from './ui/html.js';
import { confirmBox, openModal } from './ui/modal.js';
import { cap1, fld, money, sel, todayStr } from './ui/parts.js';
import { fail, toast } from './ui/toast.js';
import { tpl } from './ui/tr.js';

/* app.js fills these in (see state.js), so this file never imports app.js */
function render() { hooks.render(); }
function go(page, id) { hooks.go(page, id); }
function doLogout() { hooks.logout(); }
function setPref(key, val) { hooks.setPref(key, val); }
function toggleTheme() { hooks.toggleTheme(); }
function repaint() { hooks.repaint(); }
function doCheckIn(id) { hooks.checkIn(id); }

/* ---------- action handlers ---------- */
function dayDownload(prefix, ext) { return prefix + '_' + G.now().date + '.' + ext; }
/* the member on screen: the profile data the page loaded (member actions only exist on that page) */
function memberById(id) { var P = ui.data; if (!P || !P.c || P.c.id !== id) throw new G.AppError('Member not found.'); return P.c; }
function mpath(id, tail) { return '/api/members/' + enc(id) + (tail || ''); }
/* a product or user from the list the page loaded */
function fromList(list, id) { return (list || []).find(function (x) { return x.id === id; }); }
function products() { return ui.data && ui.data.products; }

export const ACT = {
  nav: function (el) { go(el.dataset.page); },
  open: function (el) { go('member', el.dataset.id); },
  back: function () { go('members'); },
  checkin: function (el) { doCheckIn(el.dataset.id); },
  retry: function () { render(); },
  memFilter: function (el) { ui.mem.filter = el.dataset.v; ui.mem.page = 1; refreshMemberList(); },
  memPage: function (el) { ui.mem.page = parseInt(el.dataset.page, 10) || 1; refreshMemberList(); },
  auditPage: function (el) { ui.audit.page = parseInt(el.dataset.page, 10) || 1; refreshAuditList(); },
  toggleVisits: function () { ui.det.allVisits = !ui.det.allVisits; repaint(); },
  toggleTx: function () { ui.det.allTx = !ui.det.allTx; repaint(); },
  logout: function () { doLogout(); },
  theme: function () { toggleTheme(); },
  setLang: function (el) { setPref('lang', el.dataset.v); },
  setMode: function (el) { setPref('mode', el.dataset.v); },
  setLook: function (el) { setPref('look', el.dataset.v); },

  loadSample: async function () { try { await api.post('/api/admin/sample'); toast('Sample data loaded'); render(); } catch (e) { fail(e); } },
  removeSample: async function () {
    if (await confirmBox({ title: 'Remove sample data', text: 'Delete every sample member, product, sale, expense and payment? Real data you added yourself is not touched.', confirm: 'Remove sample data', danger: true })) {
      try { var n = (await api.del('/api/admin/sample')).removed; toast('Removed ' + n + ' sample records'); render(); } catch (e) { fail(e); }
    }
  },
  addMember: function () { openMemberForm(null); },
  editMember: function (el) { openMemberForm(memberById(el.dataset.id), ui.data.login); },
  deleteMember: async function (el) {
    var c = memberById(el.dataset.id);
    if (await confirmBox({ title: 'Delete member', html: tpl('Delete {0}? Their photo, subscriptions, visits, measurements and login are removed. Payment history stays in the finance records.', [c.name]), confirm: 'Delete member', danger: true })) {
      try { await api.del(mpath(c.id)); toast('Member deleted'); go('members'); } catch (e) { fail(e); }
    }
  },
  exportMembers: async function () {
    var today = todayStr(), R;
    try { R = await api.get('/api/members' + qs({ all: 1, q: ui.mem.q.trim(), filter: ui.mem.filter === 'all' ? '' : ui.mem.filter })); } catch (e) { return fail(e); }
    var rows = [['Name', 'Phone', 'Status', 'Plan', 'Remaining', 'Valid until', 'Training days', 'Debt', 'Joined', 'Last visit']];
    R.items.forEach(function (r) {
      rows.push([r.c.name, r.c.phone || '', r.status, r.sub ? G.planLabel(r.sub) : '', r.sub ? (G.subRemaining(r.sub, today) + (r.sub.sub_type === 'sessions' ? ' sessions' : ' days')) : '', r.sub && r.sub.end_date ? G.fmtDate(r.sub.end_date) : '', r.c.days || 'any', r.c.debt || 0, G.fmtDate(r.c.created_at.slice(0, 10)), r.last ? G.fmtDate(r.last) : '']);
    });
    try { if (downloadFile(dayDownload('members', 'csv'), csvText(rows))) toast('Members exported'); } catch (e) { fail(e); }
  },
  freeze: async function (el) {
    var c = memberById(el.dataset.id);
    if (await confirmBox({ title: 'Freeze membership', html: tpl('Freeze {0} from today? Check-in is blocked while frozen, and the frozen days are added to the end date when you unfreeze.', [c.name]), confirm: 'Freeze' })) {
      try { await api.post(mpath(c.id, '/freeze')); toast('Membership frozen'); render(); } catch (e) { fail(e); }
    }
  },
  unfreeze: async function (el) {
    try { var r = await api.post(mpath(el.dataset.id, '/unfreeze')); toast(r.extended ? 'Unfrozen. End date moved ' + r.days + ' days later.' : 'Membership unfrozen'); render(); } catch (e) { fail(e); }
  },
  newSub: function (el) {
    var c = memberById(el.dataset.id);
    openModal({
      title: 'New subscription for ' + c.name, wide: true, submit: 'Add subscription',
      body: '<div class="small muted">The current plan is replaced. The price is added to the debt and the paid amount is recorded as a payment.</div>' + planFields(false),
      onOpen: function (w, form) { wirePlan(form, false); },
      onSubmit: async function (fd) { await api.post(mpath(c.id, '/subscriptions'), readPlan(fd)); toast('Subscription added'); render(); }
    });
  },
  extend: function (el) {
    var c = memberById(el.dataset.id), s = ui.data.sub; if (!s) return fail(new G.AppError('No active subscription.'));
    openModal({
      title: 'Extend subscription', submit: 'Extend',
      body: (s.end_date ? fld('Add days', 'days', { type: 'number', value: 0, attrs: 'min="0" step="1" inputmode="numeric"', hint: 'Current end date: ' + G.fmtDate(s.end_date) }) : '') +
        (s.sub_type === 'sessions' ? fld('Add sessions', 'sessions', { type: 'number', value: 0, attrs: 'min="0" step="1" inputmode="numeric"', hint: 'Now ' + s.total_sessions + ' in total, ' + s.used_sessions + ' used' }) : ''),
      onSubmit: async function (fd) { await api.post(mpath(c.id, '/subscriptions/extend'), { days: fd.get('days') || 0, sessions: fd.get('sessions') || 0 }); toast('Subscription extended'); render(); }
    });
  },
  pay: function (el) {
    var c = memberById(el.dataset.id);
    openModal({
      title: 'Take payment from ' + c.name, submit: 'Record payment',
      body: '<div class="small muted">' + tpl('Current debt: {0}. A payment lowers the debt and never takes it below zero.', [money(c.debt || 0) + ' UZS']) + '</div>' +
        fld('Amount (UZS)', 'amount', { attrs: 'required inputmode="numeric"', value: c.debt > 0 ? c.debt : '' }) + sel('For', 'category', G.PAY_CATS.map(function (x) { return [x, cap1(x)]; }), 'membership') + fld('Note', 'note', { attrs: 'maxlength="200"' }),
      onSubmit: async function (fd) { var r = await api.post(mpath(c.id, '/payments'), { amount: fd.get('amount'), category: fd.get('category'), note: fd.get('note') }); toast(r.exceeded ? 'Payment recorded. Debt is now 0.' : 'Payment recorded'); render(); }
    });
  },
  charge: function (el) {
    var c = memberById(el.dataset.id);
    openModal({
      title: 'Add charge for ' + c.name, submit: 'Add charge',
      body: '<div class="small muted">A charge adds to what this member owes.</div>' + fld('Amount (UZS)', 'amount', { attrs: 'required inputmode="numeric"' }) + sel('For', 'category', G.PAY_CATS.map(function (x) { return [x, cap1(x)]; }), 'other') + fld('Note', 'note', { attrs: 'maxlength="200"' }),
      onSubmit: async function (fd) { await api.post(mpath(c.id, '/charges'), { amount: fd.get('amount'), category: fd.get('category'), note: fd.get('note') }); toast('Charge added'); render(); }
    });
  },
  adjust: function (el) {
    var c = memberById(el.dataset.id);
    openModal({
      title: 'Adjust debt', submit: 'Set debt',
      body: '<div class="small muted">Use this to correct a mistake. The change is logged as an adjustment.</div>' + fld('New debt (UZS)', 'debt', { value: c.debt || 0, attrs: 'required inputmode="numeric"' }) + fld('Reason', 'note', { attrs: 'maxlength="200"' }),
      onSubmit: async function (fd) { await api.post(mpath(c.id, '/debt-adjustments'), { debt: fd.get('debt'), note: fd.get('note') }); toast('Debt adjusted'); render(); }
    });
  },
  addMeasure: function (el) {
    var c = memberById(el.dataset.id);
    openModal({
      title: 'Add measurements', submit: 'Save',
      body: '<div class="grid3">' + fld('Weight (kg)', 'weight', { attrs: 'inputmode="decimal"' }) + fld('Height (cm)', 'height', { attrs: 'inputmode="decimal"' }) + fld('Body fat (%)', 'body_fat', { attrs: 'inputmode="decimal"' }) +
        fld('Chest (cm)', 'chest', { attrs: 'inputmode="decimal"' }) + fld('Waist (cm)', 'waist', { attrs: 'inputmode="decimal"' }) + fld('Bicep (cm)', 'bicep', { attrs: 'inputmode="decimal"' }) + '</div>' + fld('Note', 'note', { attrs: 'maxlength="200"' }),
      onSubmit: async function (fd) {
        var o = {}; ['weight', 'height', 'body_fat', 'chest', 'waist', 'bicep', 'note'].forEach(function (k) { o[k] = fd.get(k); });
        await api.post(mpath(c.id, '/measurements'), o); toast('Measurements saved'); render();
      }
    });
  },
  delMeasure: async function (el) {
    if (await confirmBox({ title: 'Delete measurement', text: 'Delete this measurement entry?', confirm: 'Delete', danger: true })) { try { await api.del('/api/measurements/' + enc(el.dataset.id)); render(); } catch (e) { fail(e); } }
  },

  addProduct: function () { productForm(null); },
  editProduct: function (el) { var p = fromList(products(), el.dataset.id); if (!p) return fail(new G.AppError('Product not found.')); productForm(p); },
  delProduct: async function (el) {
    var p = fromList(products(), el.dataset.id); if (!p) return;
    if (await confirmBox({ title: 'Delete product', html: tpl('Delete {0}? Past sales stay in the records.', [p.name]), confirm: 'Delete product', danger: true })) { try { await api.del('/api/shop/products/' + enc(p.id)); toast('Product deleted'); render(); } catch (e) { fail(e); } }
  },
  sell: async function (el) {
    var p = fromList(products(), el.dataset.id); if (!p) return;
    var clients;
    try { clients = await api.get('/api/members/names'); } catch (e) { return fail(e); }   /* [{id, name}] A to Z */
    openModal({
      title: 'Sell ' + p.name, submit: 'Record sale',
      body: '<div class="small muted">' + money(p.price) + ' UZS each. ' + p.stock + ' in stock.</div>' + fld('Quantity', 'qty', { type: 'number', value: 1, attrs: 'min="1" max="' + p.stock + '" step="1" inputmode="numeric"' }) +
        '<div class="field"><label for="f_client">Member (optional)</label><select id="f_client" name="client"><option value="">Walk-in customer</option>' + clients.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="small">Total: <b id="sell-total">' + money(p.price) + '</b> UZS</div>',
      onOpen: function (w, form) { form.elements.qty.addEventListener('input', function () { var q = parseInt(form.elements.qty.value, 10); $('#sell-total', form).textContent = money(p.price * (q > 0 ? q : 0)); }); },
      onSubmit: async function (fd) { var s = await api.post('/api/shop/products/' + enc(p.id) + '/sales', { qty: fd.get('qty'), client: fd.get('client') }); toast('Sold for ' + money(s.total) + ' UZS'); render(); }
    });
  },
  restock: function (el) {
    var p = fromList(products(), el.dataset.id); if (!p) return;
    openModal({
      title: 'Restock ' + p.name, submit: 'Add stock',
      body: '<div class="small muted">Now ' + p.stock + ' in stock.</div>' + fld('Units to add', 'qty', { type: 'number', value: 10, attrs: 'min="1" step="1" inputmode="numeric"' }) +
        fld('Unit cost (UZS)', 'unit_cost', { value: p.cost, attrs: 'inputmode="numeric"', hint: 'Optional. If you change it, it becomes the cost of this product.' }) + expenseFields(p.cost * 10),
      onOpen: function (w, form) { wireExpense(form, function () { return fnum(form.elements.qty.value) * (String(form.elements.unit_cost.value).trim() === '' ? p.cost : fnum(form.elements.unit_cost.value)); }); },
      onSubmit: async function (fd) {
        var r = await api.post('/api/shop/products/' + enc(p.id) + '/restock', { qty: fd.get('qty'), unit_cost: fd.get('unit_cost'), expense: !!fd.get('expense'), expense_amount: fd.get('expense_amount') });
        toast(r.expense ? 'Stock updated. Expense recorded.' : 'Stock updated'); render();
      }
    });
  },

  addIncome: function () {
    openModal({
      title: 'Add income', submit: 'Add income',
      body: '<div class="small muted">For money that is not a membership payment or a shop sale.</div>' + fld('Amount (UZS)', 'amount', { attrs: 'required inputmode="numeric"' }) +
        sel('Category', 'category', G.INCOME_CATS.map(function (x) { return [x, cap1(x)]; }), 'other') + fld('Date', 'date', { type: 'date', value: todayStr() }) + fld('Note', 'note', { attrs: 'maxlength="200"' }),
      onSubmit: async function (fd) { await api.post('/api/finance/income', { amount: fd.get('amount'), category: fd.get('category'), date: fd.get('date'), note: fd.get('note') }); toast('Income added'); render(); }
    });
  },
  addExpense: function () {
    openModal({
      title: 'Add expense', submit: 'Add expense',
      body: fld('Amount (UZS)', 'amount', { attrs: 'required inputmode="numeric"' }) + sel('Category', 'category', G.EXPENSE_CATS.map(function (x) { return [x, cap1(x)]; }), 'rent') + fld('Date', 'date', { type: 'date', value: todayStr() }) + fld('Note', 'note', { attrs: 'maxlength="200"' }),
      onSubmit: async function (fd) { await api.post('/api/finance/expenses', { amount: fd.get('amount'), category: fd.get('category'), date: fd.get('date'), note: fd.get('note') }); toast('Expense added'); render(); }
    });
  },
  delExpense: async function (el) { if (await confirmBox({ title: 'Delete expense', text: 'Delete this expense entry?', confirm: 'Delete', danger: true })) { try { await api.del('/api/finance/expenses/' + enc(el.dataset.id)); render(); } catch (e) { fail(e); } } },
  delIncome: async function (el) { if (await confirmBox({ title: 'Delete income', text: 'Delete this income entry?', confirm: 'Delete', danger: true })) { try { await api.del('/api/finance/income/' + enc(el.dataset.id)); render(); } catch (e) { fail(e); } } },
  exportFinance: async function () {
    var fm;
    try { fm = await api.get('/api/finance' + qs({ month: ui.fin.ym })); } catch (e) { return fail(e); }
    var inc = [['Date', 'Source', 'Description', 'Member', 'Amount (UZS)', 'Note']];
    fm.income.slice().reverse().forEach(function (r) { inc.push([G.fmtDate(r.d), r.kind === 'payment' ? 'Membership payment' : r.kind === 'sale' ? 'Shop sale' : 'Other income', r.label, r.who, r.amount, r.note]); });
    inc.push(['', '', '', 'Total', fm.totals.revenue, '']);
    var ex = [['Date', 'Category', 'Amount (UZS)', 'Note']];
    fm.expenses.slice().reverse().forEach(function (e) { ex.push([G.fmtDate(e.date), cap1(e.category), e.amount, e.note]); });
    ex.push(['', 'Total', fm.totals.expenses, '']);
    try { if (await saveXlsx('finance_' + ui.fin.ym + '.xlsx', [{ name: 'Income', rows: inc, widths: [12, 20, 34, 22, 16, 30] }, { name: 'Expenses', rows: ex, widths: [12, 16, 16, 34] }])) toast('Excel file saved'); } catch (e) { fail(e); }
  },
  exportReport: async function () {
    var rep;
    try { rep = (await api.get('/api/analytics' + qs({ month: ui.an.ym }))).report; } catch (e) { return fail(e); }
    var sum = [['Bek Sport Gym: monthly report', '']].concat(rep.summary);
    var att = [['Date', 'Day', 'Check-ins']].concat(rep.days.map(function (d) { return [G.fmtDate(d.d), d.dow, d.count]; }));
    att.push(['Total', '', rep.days.reduce(function (a, d) { return a + d.count; }, 0)]);
    var pay = [['Date', 'Member', 'Type', 'Amount (UZS)', 'Note']].concat(rep.payments.map(function (r) { return [G.fmtDate(r.d), r.who, r.label, r.amount, r.note]; }));
    pay.push(['Total', '', '', rep.fm.totals.payments, '']);
    try { if (await saveXlsx('report_' + ui.an.ym + '.xlsx', [{ name: 'Summary', rows: sum, widths: [30, 22] }, { name: 'Daily Attendance', rows: att, widths: [14, 8, 12] }, { name: 'Payments', rows: pay, widths: [12, 26, 24, 16, 30] }])) toast('Report saved'); } catch (e) { fail(e); }
  },

  backup: async function () {
    try {
      var text = await api.get('/api/admin/backup', true), n = G.now();   /* the file exactly as the server sent it */
      if (downloadFile('gym_' + n.date + '_' + n.time.replace(':', '-') + '.json', text)) toast('Backup saved');
      if (ui.route.page === 'audit') refreshAuditList();
    } catch (e) { fail(e); }
  },
  restore: function () { $('#restore-file').click(); },
  resetPw: function (el) {
    var u = fromList(ui.data, el.dataset.id); if (!u) return;
    openModal({
      title: 'Reset password for ' + u.username, submit: 'Set password',
      body: fld('New password', 'pw', { type: 'password', attrs: 'required autocomplete="new-password"', hint: 'At least 4 characters' }),
      onSubmit: async function (fd) { await api.post('/api/admin/users/' + enc(u.id) + '/password', { password: fd.get('pw') }); toast('Password reset'); }
    });
  },
  resetMemberPw: function (el) {
    var c = memberById(el.dataset.id);
    openModal({
      title: 'Reset password for ' + c.name, submit: 'Set password',
      body: fld('New password', 'pw', { type: 'password', attrs: 'required autocomplete="new-password"', hint: 'At least 4 characters' }),
      onSubmit: async function (fd) { await api.post(mpath(c.id, '/login/password'), { password: fd.get('pw') }); toast('Password reset'); }
    });
  },
  delUser: async function (el) {
    var u = fromList(ui.data, el.dataset.id); if (!u) return;
    if (await confirmBox({ title: 'Delete user', html: tpl('Delete the account {0}?', [u.username]), confirm: 'Delete user', danger: true })) { try { await api.del('/api/admin/users/' + enc(u.id)); toast('User deleted'); render(); } catch (e) { fail(e); } }
  }
};

/* "Record as expense" box for stock purchases (new product, restock). The amount follows unit cost x quantity until the admin types their own. */
function expenseFields(amount) {
  return '<div class="sub-box"><label class="small"><input type="checkbox" name="expense" checked> Record as expense</label>' +
    fld('Expense amount (UZS)', 'expense_amount', { value: amount > 0 ? amount : '', attrs: 'inputmode="numeric" placeholder="0"', hint: 'Unit cost × quantity. You can change it.' }) + '</div>';
}
function fnum(v) { var n = Number(String(v == null ? '' : v).replace(/[\s ,]/g, '')); return isFinite(n) && n > 0 ? n : 0; }
function wireExpense(form, calc) {
  var box = form.elements.expense, amt = form.elements.expense_amount, touched = false;
  amt.addEventListener('input', function () { touched = true; });
  box.addEventListener('change', function () { amt.disabled = !box.checked; });
  form.addEventListener('input', function (e) {
    if (e.target === amt || touched) return;
    var v = Math.round(calc() * 100) / 100; amt.value = v > 0 ? v : '';
  });
}
function productForm(p) {
  openModal({
    title: p ? 'Edit product' : 'Add product', submit: p ? 'Save changes' : 'Add product',
    body: fld('Product name', 'name', { value: p ? p.name : '', attrs: 'required maxlength="120"' }) + fld('Category', 'category', { value: p ? p.category : 'Drinks', attrs: 'maxlength="40"' }) +
      '<div class="grid3">' + fld('Price (UZS)', 'price', { value: p ? p.price : '', attrs: 'required inputmode="numeric"' }) + fld('Cost (UZS)', 'cost', { value: p ? p.cost : '', attrs: 'inputmode="numeric"' }) + fld('Stock', 'stock', { value: p ? p.stock : 0, attrs: 'inputmode="numeric"' }) + '</div>' +
      (p ? '' : expenseFields(0)),
    onOpen: function (w, form) { if (!p) wireExpense(form, function () { return fnum(form.elements.cost.value) * fnum(form.elements.stock.value); }); },
    onSubmit: async function (fd) {
      var f = { name: fd.get('name'), category: fd.get('category'), price: fd.get('price'), cost: fd.get('cost'), stock: fd.get('stock') };
      if (!p) { f.expense = !!fd.get('expense'); f.expense_amount = fd.get('expense_amount'); }
      var r = p ? await api.put('/api/shop/products/' + enc(p.id), f) : await api.post('/api/shop/products', f);
      toast(p ? 'Product updated' : r.expense ? 'Product added. Expense recorded.' : 'Product added'); render();
    }
  });
}
