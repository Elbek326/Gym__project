import G from '../core/gym.js';
import { api, enc, qs } from '../api.js';
import { hooks, ui } from '../state.js';
import { $, $$, esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { readImage } from '../ui/image.js';
import { openModal } from '../ui/modal.js';
import { avatar, daysText, fld, memberLink, money, pager, planText, sampleBanner, sel, statusChip, todayStr } from '../ui/parts.js';
import { fail, toast } from '../ui/toast.js';

/* ---------- members list ---------- */
/* the list endpoint takes the search text, the status filter and the page; the answer has counts and the page rows */
export function loadMembers() {
  return api.get('/api/members' + qs({ q: ui.mem.q.trim(), filter: ui.mem.filter === 'all' ? '' : ui.mem.filter, page: ui.mem.page }));
}
export function pMembers(D) {
  return sampleBanner(D.total_all, D.has_sample) + '<div class="toolbar"><div class="search">' + ic('search') + '<label class="sr" for="mem-q">Search members</label><input id="mem-q" type="search" placeholder="Search by name or phone" value="' + esc(ui.mem.q) + '" data-input="memSearch" autocomplete="off"></div>' +
    '<div class="seg" id="mem-seg" role="group" aria-label="Filter by status"></div>' +
    '<button class="btn" data-act="exportMembers">' + ic('download') + 'CSV</button>' +
    '<button class="btn btn-primary" data-act="addMember">' + ic('plus') + 'Add member</button></div>' +
    '<section class="card"><div id="mem-list"></div></section>';
}
export function renderMemberList(pg) {
  var host = $('#mem-list'); if (!host) return;
  var R = { counts: pg.counts }; ui.mem.page = pg.page;
  var segs = [['all', 'All'], ['active', 'Active'], ['frozen', 'Frozen'], ['expired', 'Expired']];
  $('#mem-seg').innerHTML = segs.map(function (s) {
    return '<button type="button" data-act="memFilter" data-v="' + s[0] + '" aria-pressed="' + (ui.mem.filter === s[0]) + '">' + s[1] + '<span class="ct">' + R.counts[s[0]] + '</span></button>';
  }).join('');
  if (!pg.total) {
    host.innerHTML = '<div class="empty"><b>' + (pg.total_all ? 'No members match' : 'No members yet') + '</b>' + (pg.total_all ? 'Try a different search or filter.' : 'Add your first member to get started.') + '</div>'; return;
  }
  host.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Member</th><th>Status</th><th class="hide-sm">Plan</th><th class="hide-sm">Days</th><th class="r">Debt</th><th></th></tr></thead><tbody>' +
    pg.items.map(function (r) {
      var c = r.c;
      return '<tr><td><div class="who-cell">' + avatar(c) + '<div style="min-width:0">' + memberLink(c) + '<small>' + esc(c.phone || 'No phone') + '</small></div></div></td>' +
        '<td>' + statusChip(r.status, !!r.sub) + '</td><td class="hide-sm small">' + planText(r.sub) + '</td><td class="hide-sm small">' + esc(daysText(c)) + '</td>' +
        '<td class="r">' + (c.debt ? money(c.debt) : '<span class="muted">0</span>') + '</td>' +
        '<td class="act"><button class="btn btn-sm" data-act="checkin" data-id="' + esc(c.id) + '">' + ic('check') + 'Check in</button></td></tr>';
    }).join('') + '</tbody></table></div>' + pager(pg, 'memPage');
}

/* ---------- member form ---------- */
export function planFields(withNone, defType) {
  var t = todayStr();
  return '<div class="sub-box">' +
    (withNone ? sel('Subscription', 'sub_type', [['', 'No subscription yet'], ['time', 'Time-based (days)'], ['sessions', 'Session-based (visits)']], defType || '') :
      sel('Type', 'sub_type', [['time', 'Time-based (days)'], ['sessions', 'Session-based (visits)']], defType || 'time')) +
    '<div data-plan' + (withNone ? ' hidden' : '') + ' style="display:flex;flex-direction:column;gap:12px">' +
    '<div class="grid2">' + fld('Start date', 'start_date', { type: 'date', value: t }) +
    '<div data-for="time">' + fld('End date', 'end_date', { type: 'date', value: G.addDays(t, 29) }) + '</div>' +
    '<div data-for="sessions" hidden>' + fld('Valid until (optional)', 'end_date_s', { type: 'date' }) + '</div></div>' +
    '<div data-for="time" class="row-actions"><span class="small muted" style="align-self:center">Quick length:</span>' +
    [30, 90, 180, 365].map(function (n) { return '<button type="button" class="btn btn-sm" data-preset="' + n + '">' + n + ' days</button>'; }).join('') + '</div>' +
    '<div data-for="sessions" hidden>' + fld('Number of sessions', 'total_sessions', { type: 'number', value: 12, attrs: 'min="1" step="1" inputmode="numeric"' }) + '</div>' +
    '<div class="grid2">' + fld('Price (UZS)', 'price', { type: 'text', attrs: 'inputmode="numeric" placeholder="0"' }) + fld('Paid now (UZS)', 'paid', { type: 'text', attrs: 'inputmode="numeric" placeholder="Same as price"', hint: 'Anything unpaid is added to the member’s debt.' }) + '</div>' +
    '</div></div>';
}
export function wirePlan(form, withNone) {
  var selEl = form.elements.sub_type; var box = $('[data-plan]', form);
  function sync() {
    var v = selEl.value;
    if (withNone) box.hidden = !v;
    $$('[data-for]', form).forEach(function (e) { e.hidden = e.dataset.for !== (v || 'time'); });
  }
  selEl.addEventListener('change', sync); sync();
  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-preset]'); if (!b) return;
    var start = form.elements.start_date.value || todayStr();
    form.elements.end_date.value = G.addDays(start, parseInt(b.dataset.preset, 10) - 1);
  });
}
export function readPlan(fd) {
  var type = fd.get('sub_type');
  if (!type) return null;
  return {
    sub_type: type, start_date: fd.get('start_date'),
    end_date: type === 'time' ? fd.get('end_date') : (fd.get('end_date_s') || ''),
    total_sessions: fd.get('total_sessions'), price: fd.get('price') === '' ? '0' : fd.get('price'), paid: fd.get('paid')
  };
}
export function openMemberForm(c, acct) {
  var isEdit = !!c; c = c || { name: '', phone: '', note: '', days: '' };
  var img; /* undefined = unchanged, null = removed, string = new photo */
  var daySet = (c.days || '').split(',');
  /* acct = the member's existing login ({ username }) from the profile data, if any */
  var body = '<div class="photo-pick"><span id="ph-prev">' + avatar(isEdit ? c : { name: 'New' }, true) + '</span><div style="display:flex;flex-direction:column;gap:8px">' +
    '<label class="btn btn-sm" for="f_photo">' + ic('camera') + 'Choose photo</label><input class="sr" id="f_photo" type="file" accept="image/*">' +
    (isEdit && c.image ? '<label class="small"><input type="checkbox" name="remove_photo"> Remove photo</label>' : '') + '</div></div>' +
    '<div class="grid2">' + fld('Name', 'name', { value: c.name, attrs: 'required maxlength="120" autocomplete="off"' }) + fld('Phone', 'phone', { value: c.phone || '', attrs: 'inputmode="tel" autocomplete="off"', hint: 'Each phone number can belong to one member.' }) + '</div>' +
    '<div class="field"><span class="lbl">Training days</span><div class="checks">' + G.WEEK.map(function (d) {
      return '<label><input type="checkbox" name="days" value="' + d + '"' + (daySet.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + d + '</span></label>';
    }).join('') + '</div><div class="hint">Leave all unchecked to allow any day.</div></div>' +
    '<div class="field"><label for="f_note">Note</label><textarea id="f_note" name="note" maxlength="500">' + esc(c.note || '') + '</textarea></div>' +
    '<div class="sub-box"><span class="lbl">Member login</span><div class="small muted">Optional. Lets the member sign in and see only their own profile.</div><div class="grid2">' +
    fld('Login', 'login', { value: acct ? acct.username : '', attrs: 'maxlength="30" autocomplete="off" autocapitalize="off" spellcheck="false"' }) +
    fld('Password', 'password', { type: 'password', attrs: 'autocomplete="new-password"', hint: acct ? 'Leave empty to keep the current password.' : 'At least 4 characters' }) + '</div></div>' +
    (isEdit ? '' : planFields(true));
  openModal({
    title: isEdit ? 'Edit member' : 'Add member', body: body, submit: isEdit ? 'Save changes' : 'Add member', wide: !isEdit,
    onOpen: function (wrap, form) {
      var file = $('#f_photo', form), prev = $('#ph-prev', form);
      file.addEventListener('change', async function () {
        try {
          img = await readImage(file.files[0]);
          prev.innerHTML = '<img class="avatar lg" alt="" src="' + esc(img) + '">';
          if (form.elements.remove_photo) form.elements.remove_photo.checked = false;
        } catch (e) { fail(e); }
      });
      if (!isEdit) wirePlan(form, true);
    },
    onSubmit: async function (fd) {
      var days = fd.getAll('days');
      var image = fd.get('remove_photo') ? null : img;
      if (isEdit) {
        await api.put('/api/members/' + enc(c.id), { name: fd.get('name'), phone: fd.get('phone'), note: fd.get('note'), days: days, image: image, login: fd.get('login'), password: fd.get('password') });
        toast('Member updated'); hooks.render();
      } else {
        var m = await api.post('/api/members', { name: fd.get('name'), phone: fd.get('phone'), note: fd.get('note'), days: days, image: image === undefined ? null : image, plan: readPlan(fd), login: fd.get('login'), password: fd.get('password') });
        toast('Member added: ' + m.name); hooks.render();
      }
    }
  });
}


/* typing, a filter, a page button or a change elsewhere: ask for the list again and refill only the list (the search box keeps focus) */
var seq = 0, timer = null;
export function refreshMemberList(debounce) {
  clearTimeout(timer);
  var run = async function () {
    var my = ++seq;
    try {
      var pg = await loadMembers();
      if (my !== seq || ui.route.page !== 'members') return;
      ui.data = pg; renderMemberList(pg);
    } catch (e) { if (my === seq) fail(e); }
  };
  if (debounce) timer = setTimeout(run, 200); else run();
}
