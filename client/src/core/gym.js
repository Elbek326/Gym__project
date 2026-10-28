/* ==========================================================================
   Gym Manager Pro: core (dates, data model, business rules)
   No DOM access in this file, so the rules can be tested on their own.
   ========================================================================== */
var GYM = (function () {
  var TZ = 'Asia/Tashkent';
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var EXPENSE_CATS = ['rent', 'salary', 'repair', 'equipment', 'utilities', 'marketing', 'shop stock', 'other'];
  var STOCK_CAT = 'shop stock';           /* expense category used when stock bought for the shop is recorded as an expense */
  var INCOME_CATS = ['personal training', 'day pass', 'locker rental', 'other'];
  var PAY_CATS = ['membership', 'personal training', 'shop', 'other'];
  var STAFF_ROLES = ['admin'];            /* the only staff role */
  var MEMBER_ROLE = 'member';             /* login of a gym member: sees only their own profile and the rankings */
  var ROLES = STAFF_ROLES.slice();        /* roles an admin can hand out on the User Roles page ('member' is created from a member's profile, never here) */
  var SHARDED = { visits: 1, txns: 1, sales: 1, audit: 1 };
  var TABLES = ['users', 'clients', 'subs', 'measurements', 'products', 'expenses', 'visits', 'txns', 'sales', 'audit'];
  var PBKDF2_ITER = 150000;

  class AppError extends Error {
    constructor(m) { super(m); this.name = 'AppError'; }
  }

  /* ---------- time (Asia/Tashkent) and dates as YYYY-MM-DD strings ---------- */
  var fixedNow = null;
  var tzFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short'
  });
  function now() {
    var d = fixedNow != null ? new Date(fixedNow) : new Date();
    var p = {};
    tzFmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    var date = p.year + '-' + p.month + '-' + p.day;
    return { date: date, time: p.hour + ':' + p.minute, dow: p.weekday, iso: date + 'T' + p.hour + ':' + p.minute + ':' + p.second };
  }
  function setClock(ms) { fixedNow = ms; }
  function dayNum(s) {
    var a = String(s).slice(0, 10).split('-').map(Number);
    return Math.round(Date.UTC(a[0], a[1] - 1, a[2]) / 86400000);
  }
  function fromDayNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
  function addDays(s, n) { return fromDayNum(dayNum(s) + n); }
  function diffDays(a, b) { return dayNum(b) - dayNum(a); }
  function dowOf(s) { return DOW[new Date(dayNum(s) * 86400000).getUTCDay()]; }
  function isDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return fromDayNum(dayNum(s)) === s;
  }
  function fmtDate(s) { return s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '—'; }
  function fmtDT(iso) { return iso ? fmtDate(iso) + ' ' + iso.slice(11, 16) : '—'; }
  function monthsBetween(a, b) {
    var y1 = +a.slice(0, 4), m1 = +a.slice(5, 7), d1 = +a.slice(8, 10);
    var y2 = +b.slice(0, 4), m2 = +b.slice(5, 7), d2 = +b.slice(8, 10);
    var m = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
    return Math.max(0, m);
  }
  function monthLabel(ym) {
    var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return names[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
  }
  function round2(x) { return Math.round(x * 100) / 100; }
  function fmtMoney(n) {
    n = Number(n) || 0;
    var neg = n < 0; n = Math.abs(Math.round(n));
    return (neg ? '-' : '') + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ---------- state ---------- */
  function emptyState() { var s = {}; TABLES.forEach(function (t) { s[t] = {}; }); return s; }
  var S = emptyState();
  var idxCache = null;
  var rev = 0;
  function touch() { rev++; idxCache = null; }

  /* persistence hooks, filled in by the page */
  var Store = {
    readOnly: false,
    write: function () {}, remove: function () {}, replaceAll: function () {}
  };
  function needWrite() {
    if (Store.readOnly) throw new AppError('This view is read-only. Changes cannot be saved.');
  }
  function put(t, rec) { needWrite(); S[t][rec.id] = rec; touch(); Store.write(t, rec); return rec; }
  function del(t, id) {
    var rec = S[t][id]; if (!rec) return;
    needWrite(); delete S[t][id]; touch(); Store.remove(t, rec);
  }
  function values(t) { return Object.keys(S[t]).map(function (k) { return S[t][k]; }); }

  /* apply a document that arrived from the shared database */
  function applyRemote(t, docId, body) {
    if (!(t in S)) return false;
    function byId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
    if (SHARDED[t]) {
      var cur = values(t).filter(function (r) { return r.d === docId; }).sort(byId);
      var next = body && Array.isArray(body.items) ? body.items.slice().sort(byId) : [];
      if (JSON.stringify(cur) === JSON.stringify(next)) return false;
      cur.forEach(function (r) { delete S[t][r.id]; });
      next.forEach(function (r) { S[t][r.id] = r; });
      touch(); return true;
    }
    var old = S[t][docId];
    if (body == null) { if (!old) return false; delete S[t][docId]; touch(); return true; }
    if (JSON.stringify(old) === JSON.stringify(body)) return false;
    S[t][docId] = body; touch(); return true;
  }
  function shardItems(t, d) { return values(t).filter(function (r) { return r.d === d; }); }
  function allDocPaths(state) {
    var out = {};
    TABLES.forEach(function (t) {
      Object.keys(state[t]).forEach(function (k) {
        var r = state[t][k];
        out[t + '/' + (SHARDED[t] ? r.d : r.id)] = [t, SHARDED[t] ? r.d : r.id];
      });
    });
    return out;
  }
  function loadState(obj) {
    var s = emptyState();
    TABLES.forEach(function (t) { if (obj && obj[t]) s[t] = obj[t]; });
    S = s; touch();
  }

  /* ---------- derived lookups ---------- */
  function idx() {
    if (idxCache) return idxCache;
    var subsBy = {}, visitsBy = {}, payBy = {}, byDate = {}, lastVisit = {}, activeSub = {};
    values('subs').forEach(function (s) { (subsBy[s.client] || (subsBy[s.client] = [])).push(s); });
    Object.keys(subsBy).forEach(function (k) {
      subsBy[k].sort(function (a, b) {
        return (b.start_date || '').localeCompare(a.start_date || '') || (b.created_at || '').localeCompare(a.created_at || '');
      });
      activeSub[k] = subsBy[k].find(function (s) { return s.is_active; }) || null;
    });
    values('visits').forEach(function (v) {
      (visitsBy[v.client] || (visitsBy[v.client] = [])).push(v);
      byDate[v.visit_date] = (byDate[v.visit_date] || 0) + 1;
    });
    Object.keys(visitsBy).forEach(function (k) {
      visitsBy[k].sort(function (a, b) { return (b.visit_date + b.visit_time).localeCompare(a.visit_date + a.visit_time); });
      lastVisit[k] = visitsBy[k][0].visit_date;
    });
    values('txns').forEach(function (t) {
      if (t.txn_type === 'payment' && t.client) payBy[t.client] = (payBy[t.client] || 0) + t.amount;
    });
    idxCache = { subsBy: subsBy, activeSub: activeSub, visitsBy: visitsBy, lastVisit: lastVisit, payBy: payBy, byDate: byDate };
    return idxCache;
  }

  /* ---------- subscription and member status rules ---------- */
  function subRemaining(sub, today) {
    today = today || now().date;
    if (sub.sub_type === 'sessions') return Math.max(0, sub.total_sessions - sub.used_sessions);
    return Math.max(0, diffDays(today, sub.end_date));
  }
  function subState(sub, today) {
    today = today || now().date;
    if (sub.sub_type === 'sessions') {
      if (sub.used_sessions >= sub.total_sessions) return 'finished';
      if (sub.end_date && sub.end_date < today) return 'expired';
      return 'ok';
    }
    return sub.end_date < today ? 'expired' : 'ok';
  }
  function planLabel(sub) {
    if (!sub) return 'No plan';
    if (sub.sub_type === 'sessions') return sub.total_sessions + ' sessions';
    var d = diffDays(sub.start_date, sub.end_date) + 1;
    return d + ' days';
  }
  function clientStatus(c, today) {
    if (c.status === 'frozen') return 'frozen';
    var s = idx().activeSub[c.id];
    if (!s) return 'expired';
    return subState(s, today || now().date) === 'ok' ? 'active' : 'expired';
  }
  function activeSub(cid) { return idx().activeSub[cid] || null; }
  function subsOf(cid) { return idx().subsBy[cid] || []; }
  function visitsOf(cid) { return idx().visitsBy[cid] || []; }

  /* ---------- session and permissions ---------- */
  var sessionUserId = null;
  var failedLogins = 0, lockedUntil = 0;
  /* a user only counts as signed in while their role still exists (old owner/trainer/vip_client accounts do not) */
  function roleOk(u) { return !!u && (u.role === 'admin' || u.role === MEMBER_ROLE); }
  function isStaff(u) { return !!u && STAFF_ROLES.indexOf(u.role) >= 0; }
  function me() { var u = sessionUserId ? S.users[sessionUserId] || null : null; return roleOk(u) ? u : null; }
  function requireUser() { var u = me(); if (!u) throw new AppError('Please sign in first.'); return u; }
  function requireStaff() {
    var u = requireUser();
    if (!isStaff(u)) throw new AppError('Only staff can do this.');
    return u;
  }
  function requireAdmin() {
    var u = requireUser();
    if (u.role !== 'admin') throw new AppError('Only an admin can do this.');
    return u;
  }
  /* why this user may not sign in, or null. Accounts with a removed role are kept in the list so an admin can fix them. */
  function loginBlock(u) {
    if (u.role === 'admin') return null;
    if (u.role === MEMBER_ROLE) return S.clients[u.client] ? null : 'This account is no longer linked to a member. Ask an admin.';
    return 'This role no longer exists. Ask an admin.';
  }
  function memberUserOf(cid) { return values('users').find(function (u) { return u.role === MEMBER_ROLE && u.client === cid; }) || null; }
  function audit(action, detail) {
    var n = now(); var u = me();
    put('audit', { id: uid(), d: n.date, action: action, detail: detail || '', created_at: n.iso, by: u ? u.username : 'anonymous' });
  }

  /* ---------- password hashing: PBKDF2-SHA256 via WebCrypto ---------- */
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  async function derive(pw, salt, iter) {
    if (!globalThis.crypto || !globalThis.crypto.subtle) throw new AppError('Secure password hashing is not available in this browser.');
    var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, key, 256);
    return new Uint8Array(bits);
  }
  async function hashPassword(pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var h = await derive(pw, salt, PBKDF2_ITER);
    return 'pbkdf2_sha256$' + PBKDF2_ITER + '$' + b64(salt) + '$' + b64(h);
  }
  function isHashed(s) { return typeof s === 'string' && s.indexOf('pbkdf2_sha256$') === 0; }
  async function verifyPassword(pw, stored) {
    if (!isHashed(stored)) return false;
    var parts = stored.split('$');
    var h = await derive(pw, unb64(parts[2]), parseInt(parts[1], 10));
    var want = unb64(parts[3]); var diff = h.length ^ want.length;
    for (var i = 0; i < h.length && i < want.length; i++) diff |= h[i] ^ want[i];
    return diff === 0;
  }
  /* plain-text passwords from an old backup are hashed once, on load */
  async function migratePasswords() {
    var changed = 0;
    for (var u of values('users')) {
      if (!isHashed(u.password)) {
        u.password = await hashPassword(String(u.password || ''));
        put('users', u); changed++;
      }
    }
    return changed;
  }
  async function ensureDefaultAdmin() {
    if (values('users').length) return false;
    var n = now();
    put('users', { id: 'u_admin', username: 'admin', password: await hashPassword('admin123'), role: 'admin', created_at: n.iso });
    return true;
  }

  async function login(username, password) {
    var n = Date.now();
    if (n < lockedUntil) throw new AppError('Too many attempts. Wait ' + Math.ceil((lockedUntil - n) / 1000) + ' seconds.');
    var uname = String(username || '').trim().toLowerCase();
    var u = values('users').find(function (x) { return x.username.toLowerCase() === uname; });
    var ok = false;
    if (u) ok = await verifyPassword(String(password || ''), u.password);
    if (!ok) {
      failedLogins++;
      if (failedLogins >= 5) { lockedUntil = Date.now() + 30000; failedLogins = 0; }
      if (!Store.readOnly) { try { audit('LOGIN_FAILED', 'Username: ' + String(username || '').slice(0, 40)); } catch (e) { /* ignore */ } }
      throw new AppError('Wrong username or password.');
    }
    failedLogins = 0;
    var block = loginBlock(u);
    if (block) {
      if (!Store.readOnly) { try { audit('LOGIN_FAILED', 'Username: ' + u.username); } catch (e) { /* ignore */ } }
      throw new AppError(block);
    }
    sessionUserId = u.id;
    if (!Store.readOnly) { try { audit('LOGIN', u.username); } catch (e) { /* ignore */ } }
    return u;
  }
  function restoreSession(id) { if (id && S.users[id] && roleOk(S.users[id]) && !loginBlock(S.users[id])) { sessionUserId = id; return S.users[id]; } return null; }
  function logout() { var u = me(); if (u && !Store.readOnly) { try { audit('LOGOUT', u.username); } catch (e) { /* ignore */ } } sessionUserId = null; }

  async function changeOwnPassword(current, next, confirm) {
    var u = requireUser();
    if (!(await verifyPassword(String(current || ''), u.password))) throw new AppError('Current password is wrong.');
    if (String(next || '').length < 4) throw new AppError('New password must be at least 4 characters.');
    if (next !== confirm) throw new AppError('The new passwords do not match.');
    u.password = await hashPassword(next); put('users', u);
    audit('PASSWORD_CHANGED', u.username);
  }

  /* ---------- user management: admin only, checked in every function ---------- */
  /* member login accounts live on the member's profile, so they are not listed here; accounts with a removed role are */
  function listUsers() { requireAdmin(); return values('users').filter(function (u) { return u.role !== MEMBER_ROLE; }).sort(function (a, b) { return a.username.localeCompare(b.username); }); }
  function adminCount() { return values('users').filter(function (u) { return u.role === 'admin'; }).length; }
  /* one rule for every username (staff and member logins): format, and unique across ALL users, ignoring case */
  function checkUsername(raw, exceptId) {
    var name = String(raw || '').trim();
    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(name)) throw new AppError('Username: 3 to 30 letters, digits, dots, dashes or underscores.');
    if (values('users').some(function (u) { return u.id !== exceptId && u.username.toLowerCase() === name.toLowerCase(); })) throw new AppError('That username is taken.');
    return name;
  }
  async function addUser(f) {
    requireAdmin();
    var name = checkUsername(f.username);
    if (String(f.password || '').length < 4) throw new AppError('Password must be at least 4 characters.');
    if (ROLES.indexOf(f.role) < 0) throw new AppError('Choose a valid role.');
    var rec = { id: 'u' + uid(), username: name, password: await hashPassword(f.password), role: f.role, created_at: now().iso };
    requireAdmin(); put('users', rec); audit('USER_ADDED', name + ' (' + f.role + ')');
    return rec;
  }
  function setRole(id, role) {
    requireAdmin();
    var u = S.users[id]; if (!u || u.role === MEMBER_ROLE) throw new AppError('User not found.');
    if (ROLES.indexOf(role) < 0) throw new AppError('Choose a valid role.');
    if (u.role === 'admin' && role !== 'admin' && adminCount() <= 1) throw new AppError('The last admin cannot be demoted.');
    var old = u.role; u.role = role; put('users', u); audit('ROLE_CHANGED', u.username + ': ' + old + ' to ' + role);
  }
  function deleteUser(id) {
    var actor = requireAdmin();
    var u = S.users[id]; if (!u || u.role === MEMBER_ROLE) throw new AppError('User not found.');
    if (u.id === actor.id) throw new AppError('You cannot delete your own account.');
    if (u.role === 'admin' && adminCount() <= 1) throw new AppError('The last admin cannot be deleted.');
    del('users', id); audit('USER_DELETED', u.username);
  }
  async function resetPassword(id, pw) {
    requireAdmin();
    var u = S.users[id]; if (!u || u.role === MEMBER_ROLE) throw new AppError('User not found.');
    if (String(pw || '').length < 4) throw new AppError('Password must be at least 4 characters.');
    u.password = await hashPassword(pw); requireAdmin(); put('users', u); audit('PASSWORD_RESET', u.username);
  }

  /* ---------- member logins: one account per member, managed from the member's profile (staff only) ---------- */
  function memberLogin(cid) {
    requireStaff();
    var u = memberUserOf(cid);
    return u ? { username: u.username, created_at: u.created_at } : null;
  }
  async function resetMemberPassword(cid, pw) {
    requireStaff(); needWrite();
    var c = getClient(cid);
    if (!memberUserOf(cid)) throw new AppError('This member has no login.');
    if (String(pw || '').length < 4) throw new AppError('Password must be at least 4 characters.');
    var h = await hashPassword(pw);
    requireStaff(); needWrite();
    var u = memberUserOf(cid); if (!u) throw new AppError('This member has no login.');
    u.password = h; put('users', u);
    audit('MEMBER_LOGIN_RESET', c.name + ': ' + u.username);   /* never the password itself */
  }
  /* checks the optional Login and Password fields of the member form. Returns null (no account wanted) or { login, password }. */
  function parseLogin(f, existing) {
    var login = String(f.login == null ? '' : f.login).trim(), pw = String(f.password == null ? '' : f.password);
    if (!login) {
      if (pw) throw new AppError('Login is required when a password is set.');
      if (existing) throw new AppError('Login is required while the member has an account.');
      return null;
    }
    login = checkUsername(login, existing ? existing.id : null);
    if (!existing && !pw) throw new AppError('Password is required to create a login.');
    if (pw && pw.length < 4) throw new AppError('Password must be at least 4 characters.');
    return { login: login, password: pw };
  }

  /* ---------- validation helpers ---------- */
  function reqText(v, label, max) {
    var s = String(v == null ? '' : v).trim();
    if (!s) throw new AppError(label + ' is required.');
    if (s.length > (max || 120)) throw new AppError(label + ' is too long.');
    return s;
  }
  function num(v, label, o) {
    o = o || {};
    var s = String(v == null ? '' : v).replace(/[\s ,]/g, '');
    if (s === '') { if (o.optional) return null; throw new AppError(label + ' is required.'); }
    var n = Number(s);
    if (!isFinite(n)) throw new AppError(label + ' must be a number.');
    if (o.int && Math.floor(n) !== n) throw new AppError(label + ' must be a whole number.');
    if (o.min != null && n < o.min) throw new AppError(label + ' must be at least ' + o.min + '.');
    if (o.max != null && n > o.max) throw new AppError(label + ' must be at most ' + o.max + '.');
    return n;
  }
  function money(v, label) { var n = num(v, label || 'Amount', { min: 0.01, max: 1e12 }); return round2(n); }
  function normPhone(p) {
    var s = String(p == null ? '' : p).trim();
    return s ? s : null;
  }
  function phoneKey(p) { return String(p || '').replace(/\D/g, ''); }
  function getClient(id) { var c = S.clients[id]; if (!c) throw new AppError('Member not found.'); return c; }
  function normDays(days) {
    var arr = Array.isArray(days) ? days : String(days || '').split(',');
    var set = {}; arr.forEach(function (d) { d = String(d).trim(); if (WEEK.indexOf(d) >= 0) set[d] = 1; });
    return WEEK.filter(function (d) { return set[d]; }).join(',');
  }

  /* ---------- members ---------- */
  function parsePlan(p) {
    var type = p.sub_type;
    if (type !== 'time' && type !== 'sessions') throw new AppError('Choose a subscription type.');
    var start = p.start_date || now().date;
    if (!isDate(start)) throw new AppError('Start date is not valid.');
    var price = num(p.price, 'Price', { min: 0, max: 1e12 });
    var paid = num(p.paid == null || p.paid === '' ? price : p.paid, 'Amount paid', { min: 0, max: 1e12 });
    if (paid > price) throw new AppError('Amount paid cannot be more than the price.');
    var out = { sub_type: type, start_date: start, price: round2(price), paid: round2(paid), end_date: null, total_sessions: 0 };
    if (type === 'time') {
      if (!isDate(p.end_date)) throw new AppError('End date is not valid.');
      if (p.end_date < start) throw new AppError('End date cannot be before the start date.');
      out.end_date = p.end_date;
    } else {
      out.total_sessions = num(p.total_sessions, 'Number of sessions', { min: 1, max: 1000, int: true });
      if (p.end_date) {
        if (!isDate(p.end_date)) throw new AppError('Valid-until date is not valid.');
        if (p.end_date < start) throw new AppError('Valid-until date cannot be before the start date.');
        out.end_date = p.end_date;
      }
    }
    return out;
  }
  function logTxn(type, clientId, category, amount, balance, note, date) {
    var n = now(); var d = date || n.date;
    return put('txns', {
      id: uid(), d: d, client: clientId || null, txn_type: type, category: category || '',
      amount: round2(amount), balance_after: balance == null ? null : round2(balance),
      note: note || '', created_at: d + 'T' + (date ? '12:00:00' : n.iso.slice(11)), by: (me() || {}).username || ''
    });
  }
  function chargeInternal(c, amount, category, note) {
    c.debt = round2((c.debt || 0) + amount); put('clients', c);
    logTxn('charge', c.id, category, amount, c.debt, note);
  }
  function payInternal(c, amount, category, note) {
    c.debt = Math.max(0, round2((c.debt || 0) - amount)); put('clients', c);
    logTxn('payment', c.id, category, amount, c.debt, note);
  }
  function applyPlan(c, p) {
    subsOf(c.id).forEach(function (s) { if (s.is_active) { s.is_active = false; put('subs', s); } });
    var sub = {
      id: uid(), client: c.id, sub_type: p.sub_type, start_date: p.start_date, end_date: p.end_date,
      total_sessions: p.total_sessions, used_sessions: 0, price: p.price, is_active: true, created_at: now().iso
    };
    put('subs', sub);
    c.status = 'active'; c.frozen_since = null; put('clients', c);
    if (p.price > 0) chargeInternal(c, p.price, 'membership', 'Subscription: ' + planLabel(sub));
    if (p.paid > 0) payInternal(c, p.paid, 'membership', 'Paid with subscription');
    audit('SUBSCRIPTION_ADDED', c.name + ': ' + planLabel(sub) + ', price ' + fmtMoney(p.price));
    return sub;
  }
  function checkImage(img) {
    if (img == null || img === '') return null;
    if (typeof img !== 'string' || img.indexOf('data:image/') !== 0) throw new AppError('The photo is not a valid image.');
    if (img.length > 400000) throw new AppError('The photo is too large.');
    return img;
  }
  function checkPhoneFree(phone, exceptId) {
    if (!phone) return;
    var k = phoneKey(phone);
    if (!k) throw new AppError('Phone number must contain digits.');
    var dup = values('clients').find(function (c) { return c.id !== exceptId && c.phone && phoneKey(c.phone) === k; });
    if (dup) throw new AppError('This phone number already belongs to ' + dup.name + '.');
  }
  /* async because an optional member login is hashed here. Everything is checked before the first write. */
  async function createClient(f) {
    requireStaff(); needWrite();
    var name = reqText(f.name, 'Name');
    var phone = normPhone(f.phone); checkPhoneFree(phone, null);
    var image = checkImage(f.image);
    var plan = f.plan && f.plan.sub_type ? parsePlan(f.plan) : null;
    var acct = parseLogin(f, null);
    var hash = acct ? await hashPassword(acct.password) : null;
    requireStaff(); needWrite();
    if (acct) acct.login = checkUsername(acct.login, null);   /* the database may have changed while the password was hashed */
    var c = {
      id: uid(), name: name, phone: phone, note: String(f.note || '').trim().slice(0, 500), image: image,
      created_at: now().iso, status: 'active', frozen_since: null, days: normDays(f.days), debt: 0
    };
    put('clients', c);
    audit('MEMBER_ADDED', name);
    if (plan) applyPlan(c, plan);
    if (acct) {
      put('users', { id: 'u' + uid(), username: acct.login, password: hash, role: MEMBER_ROLE, client: c.id, created_at: now().iso });
      audit('MEMBER_LOGIN_CREATED', name + ': ' + acct.login);
    }
    return c;
  }
  async function updateClient(id, f) {
    requireStaff(); needWrite();
    var c = getClient(id);
    var name = reqText(f.name, 'Name');
    var phone = normPhone(f.phone); checkPhoneFree(phone, id);
    var image = c.image;
    if (f.image !== undefined) image = checkImage(f.image);
    var acct = parseLogin(f, memberUserOf(id));    /* empty password on an existing account = keep the current one */
    var hash = acct && acct.password ? await hashPassword(acct.password) : null;
    requireStaff(); needWrite();
    c = getClient(id);
    var u = memberUserOf(id);
    if (acct) {
      acct.login = checkUsername(acct.login, u ? u.id : null);
      if (!u && !hash) throw new AppError('Password is required to create a login.');
    }
    c.name = name; c.phone = phone; c.note = String(f.note || '').trim().slice(0, 500);
    c.days = normDays(f.days); c.image = image;
    put('clients', c); audit('MEMBER_UPDATED', name);
    if (acct) {
      if (!u) {
        put('users', { id: 'u' + uid(), username: acct.login, password: hash, role: MEMBER_ROLE, client: c.id, created_at: now().iso });
        audit('MEMBER_LOGIN_CREATED', name + ': ' + acct.login);
      } else {
        if (u.username !== acct.login) {
          var was = u.username; u.username = acct.login; put('users', u);
          audit('MEMBER_LOGIN_CHANGED', name + ': ' + was + ' to ' + acct.login);
        }
        if (hash) { u.password = hash; put('users', u); audit('MEMBER_LOGIN_RESET', name + ': ' + u.username); }
      }
    }
    return c;
  }
  function deleteClient(id) {
    requireStaff(); needWrite();
    var c = getClient(id);
    values('users').filter(function (u) { return u.role === MEMBER_ROLE && u.client === id; }).forEach(function (u) {
      del('users', u.id); audit('MEMBER_LOGIN_DELETED', c.name + ': ' + u.username);
    });
    subsOf(id).slice().forEach(function (s) { del('subs', s.id); });
    visitsOf(id).slice().forEach(function (v) { del('visits', v.id); });
    values('measurements').filter(function (m) { return m.client === id; }).forEach(function (m) { del('measurements', m.id); });
    values('txns').filter(function (t) { return t.client === id; }).forEach(function (t) { t.client = null; t.note = (t.note ? t.note + ' ' : '') + '[member: ' + c.name + ']'; put('txns', t); });
    values('sales').filter(function (s) { return s.client === id; }).forEach(function (s) { s.client = null; put('sales', s); });
    del('clients', id); /* the photo lives inside the member record, so it goes too */
    audit('MEMBER_DELETED', c.name);
  }

  function addSubscription(cid, f) {
    requireStaff(); needWrite();
    var c = getClient(cid);
    var plan = parsePlan(f);
    return applyPlan(c, plan);
  }
  function extendSubscription(cid, f) {
    requireStaff(); needWrite();
    var c = getClient(cid); var s = activeSub(cid);
    if (!s) throw new AppError('This member has no active subscription.');
    var days = num(f.days || 0, 'Days', { min: 0, max: 3650, int: true });
    var sess = num(f.sessions || 0, 'Sessions', { min: 0, max: 1000, int: true });
    if (!days && !sess) throw new AppError('Enter days or sessions to add.');
    if (days && !s.end_date) throw new AppError('This subscription has no end date to extend.');
    if (sess && s.sub_type !== 'sessions') throw new AppError('Sessions can only be added to a session-based plan.');
    if (days) s.end_date = addDays(s.end_date, days);
    if (sess) s.total_sessions += sess;
    put('subs', s);
    audit('SUBSCRIPTION_EXTENDED', c.name + ': +' + days + ' days, +' + sess + ' sessions');
    return s;
  }

  function checkIn(cid) {
    requireStaff(); needWrite();
    var c = getClient(cid); var n = now();
    if (c.status === 'frozen') throw new AppError(c.name + ' is frozen. Unfreeze the membership first.');
    var s = activeSub(cid);
    if (!s) throw new AppError(c.name + ' has no active subscription.');
    var st = subState(s, n.date);
    if (st === 'finished') throw new AppError(c.name + ' has no sessions left.');
    if (st === 'expired') throw new AppError('The subscription of ' + c.name + ' expired on ' + fmtDate(s.end_date) + '.');
    if (visitsOf(cid).some(function (v) { return v.visit_date === n.date; })) throw new AppError(c.name + ' already checked in today.');
    if (c.days && c.days.split(',').indexOf(n.dow) < 0) throw new AppError('Today (' + n.dow + ') is not a training day for ' + c.name + '. Allowed: ' + c.days.replace(/,/g, ', ') + '.');
    var v = put('visits', { id: uid(), d: n.date, client: cid, subscription: s.id, visit_date: n.date, visit_time: n.time });
    if (s.sub_type === 'sessions') { s.used_sessions += 1; put('subs', s); }
    audit('CHECK_IN', c.name);
    return { visit: v, sub: s, remaining: subRemaining(s, n.date), client: c };
  }

  function freezeClient(cid) {
    requireStaff(); needWrite();
    var c = getClient(cid);
    if (c.status === 'frozen') throw new AppError('This membership is already frozen.');
    c.status = 'frozen'; c.frozen_since = now().date; put('clients', c);
    audit('FREEZE', c.name);
  }
  function unfreezeClient(cid) {
    requireStaff(); needWrite();
    var c = getClient(cid);
    if (c.status !== 'frozen') throw new AppError('This membership is not frozen.');
    var n = now(); var days = Math.max(0, diffDays(c.frozen_since || n.date, n.date));
    var s = activeSub(cid); var extended = false;
    if (s && days > 0 && s.end_date) { s.end_date = addDays(s.end_date, days); put('subs', s); extended = true; }
    c.status = 'active'; c.frozen_since = null; put('clients', c);
    audit('UNFREEZE', c.name + ': ' + days + ' frozen days' + (extended ? ', end date extended' : ''));
    return { days: days, extended: extended };
  }

  /* ---------- money: debt is the source of truth, transactions are history ---------- */
  function addPayment(cid, f) {
    requireStaff(); needWrite();
    var c = getClient(cid); var amt = money(f.amount);
    var before = c.debt || 0;
    var cat = PAY_CATS.indexOf(f.category) >= 0 ? f.category : 'membership';
    payInternal(c, amt, cat, String(f.note || '').trim().slice(0, 200));
    audit('PAYMENT', c.name + ': ' + fmtMoney(amt));
    return { debt: c.debt, exceeded: amt > before };
  }
  function addCharge(cid, f) {
    requireStaff(); needWrite();
    var c = getClient(cid); var amt = money(f.amount);
    var cat = PAY_CATS.indexOf(f.category) >= 0 ? f.category : 'other';
    chargeInternal(c, amt, cat, String(f.note || '').trim().slice(0, 200));
    audit('CHARGE', c.name + ': ' + fmtMoney(amt));
    return { debt: c.debt };
  }
  function adjustDebt(cid, f) {
    requireStaff(); needWrite();
    var c = getClient(cid);
    var nd = round2(num(f.debt, 'New debt', { min: 0, max: 1e12 }));
    var old = c.debt || 0; c.debt = nd; put('clients', c);
    logTxn('adjustment', c.id, 'adjustment', Math.abs(nd - old), nd, (String(f.note || '').trim() || 'Debt adjusted') + ' (was ' + fmtMoney(old) + ')');
    audit('DEBT_ADJUSTED', c.name + ': ' + fmtMoney(old) + ' to ' + fmtMoney(nd));
  }

  function addMeasurement(cid, f) {
    requireStaff(); needWrite(); getClient(cid);
    var keys = ['weight', 'height', 'body_fat', 'chest', 'waist', 'bicep'];
    var rec = { id: uid(), client: cid, created_at: now().iso, note: String(f.note || '').trim().slice(0, 200) };
    var any = false;
    keys.forEach(function (k) {
      /* a decimal comma ("82,5") is a decimal here, not a thousands separator: num() would turn it into 825 */
      var v = num(String(f[k] == null ? '' : f[k]).replace(/^(\s*\d+),(\d{1,2})\s*$/, '$1.$2'), k.replace('_', ' '), { optional: true, min: 0, max: 1000 });
      rec[k] = v; if (v != null) any = true;
    });
    if (!any) throw new AppError('Enter at least one measurement.');
    put('measurements', rec); audit('MEASUREMENT_ADDED', getClient(cid).name);
    return rec;
  }
  function deleteMeasurement(id) {
    requireStaff(); var m = S.measurements[id]; if (!m) return;
    del('measurements', id); audit('MEASUREMENT_DELETED', (S.clients[m.client] || {}).name || '');
  }

  /* ---------- shop ---------- */
  function saveProduct(f, id) {
    requireStaff(); needWrite();
    var name = reqText(f.name, 'Product name');
    var p = id ? S.products[id] : null;
    if (id && !p) throw new AppError('Product not found.');
    if (values('products').some(function (x) { return x.id !== id && x.name.toLowerCase() === name.toLowerCase(); })) throw new AppError('A product with this name already exists.');
    var price = round2(num(f.price, 'Price', { min: 0, max: 1e12 }));
    var cost = round2(num(f.cost == null || f.cost === '' ? 0 : f.cost, 'Cost', { min: 0, max: 1e12 }));
    var stock = num(f.stock == null || f.stock === '' ? 0 : f.stock, 'Stock', { min: 0, max: 1e6, int: true });
    var cat = String(f.category || '').trim().slice(0, 40) || 'General';
    /* a new product can record its opening stock as an expense. Checked before anything is saved: product and expense go in together or not at all. */
    var exp = id ? null : stockExpense(f, stock, cost, 'New product: ' + name);
    if (!p) p = { id: uid(), created_at: now().iso };
    p.name = name; p.category = cat; p.price = price; p.cost = cost; p.stock = stock;
    put('products', p); audit(id ? 'PRODUCT_UPDATED' : 'PRODUCT_ADDED', name);
    if (exp) saveExpense(exp);
    return { product: p, expense: exp };
  }
  /* Optional "record as expense" part of a stock purchase. f.expense switches it on; f.expense_amount overrides unit cost x quantity
     (left out = the default, empty or 0 = no expense). Returns a validated expense record, or null. Writes nothing. */
  function stockExpense(f, qty, unitCost, label) {
    if (!f.expense) return null;
    var amt = f.expense_amount == null ? round2(qty * unitCost) : round2(num(f.expense_amount === '' ? 0 : f.expense_amount, 'Expense amount', { min: 0, max: 1e12 }));
    if (!(amt > 0)) return null;
    return expenseRecord({ category: STOCK_CAT, amount: amt, note: label + ' x' + qty });
  }
  function deleteProduct(id) {
    requireStaff(); var p = S.products[id]; if (!p) return;
    del('products', id); audit('PRODUCT_DELETED', p.name);
  }
  function sellProduct(pid, f) {
    requireStaff(); needWrite();
    var p = S.products[pid]; if (!p) throw new AppError('Product not found.');
    var qty = num(f.qty, 'Quantity', { min: 1, max: 1e6, int: true });
    if (qty > p.stock) throw new AppError('Only ' + p.stock + ' in stock.');
    var cid = f.client || null; if (cid) getClient(cid);
    var n = now();
    p.stock -= qty; put('products', p);
    var sale = put('sales', { id: uid(), d: n.date, product: pid, product_name: p.name, client: cid, qty: qty, unit_price: p.price, total: round2(p.price * qty), created_at: n.iso, by: (me() || {}).username || '' });
    audit('SALE', p.name + ' x' + qty + ' = ' + fmtMoney(sale.total));
    return sale;
  }
  function restockProduct(pid, f) {
    requireStaff(); needWrite();
    var p = S.products[pid]; if (!p) throw new AppError('Product not found.');
    var qty = num(f.qty, 'Quantity', { min: 1, max: 1e6, int: true });
    /* optional new unit cost: it becomes the product's cost and is what the expense is based on */
    var unit = f.unit_cost == null || f.unit_cost === '' ? p.cost : round2(num(f.unit_cost, 'Unit cost', { min: 0, max: 1e12 }));
    var exp = stockExpense(f, qty, unit, 'Restock: ' + p.name);
    var oldCost = p.cost;
    p.stock += qty; p.cost = unit; put('products', p);
    audit('RESTOCK', p.name + ' +' + qty + (unit !== oldCost ? ', cost ' + fmtMoney(oldCost) + ' to ' + fmtMoney(unit) : ''));
    if (exp) saveExpense(exp);
    return { product: p, expense: exp };
  }

  /* ---------- finance ---------- */
  /* validates an expense and builds the record; writes nothing, so callers can check first and save later */
  function expenseRecord(f) {
    var cat = EXPENSE_CATS.indexOf(f.category) >= 0 ? f.category : null;
    if (!cat) throw new AppError('Choose an expense category.');
    var amt = money(f.amount);
    var n = now(); var d = f.date || n.date;
    if (!isDate(d)) throw new AppError('Date is not valid.');
    return { id: uid(), category: cat, amount: amt, note: String(f.note || '').trim().slice(0, 200), date: d, created_at: d + 'T' + n.iso.slice(11) };
  }
  function saveExpense(rec) {
    put('expenses', rec);
    audit('EXPENSE_ADDED', rec.category + ': ' + fmtMoney(rec.amount));
    return rec;
  }
  function addExpense(f) {
    requireStaff(); needWrite();
    return saveExpense(expenseRecord(f));
  }
  function deleteExpense(id) {
    requireStaff(); var e = S.expenses[id]; if (!e) return;
    del('expenses', id); audit('EXPENSE_DELETED', e.category + ': ' + fmtMoney(e.amount));
  }
  function addIncome(f) {
    requireStaff(); needWrite();
    var amt = money(f.amount);
    var d = f.date || now().date; if (!isDate(d)) throw new AppError('Date is not valid.');
    var cat = INCOME_CATS.indexOf(f.category) >= 0 ? f.category : 'other';
    var t = logTxn('income', null, cat, amt, null, String(f.note || '').trim().slice(0, 200), d);
    audit('INCOME_ADDED', cat + ': ' + fmtMoney(amt));
    return t;
  }
  function deleteIncome(id) {
    requireStaff(); var t = S.txns[id];
    if (!t || t.txn_type !== 'income') throw new AppError('Only manual income entries can be deleted.');
    del('txns', id); audit('INCOME_DELETED', t.category + ': ' + fmtMoney(t.amount));
  }
  function clientName(id) { requireStaff(); var c = S.clients[id]; return c ? c.name : ''; }

  function financeMonth(ym) {
    requireStaff();
    var income = [], expenses = [];
    var tot = { payments: 0, income: 0, sales: 0, expenses: 0 };
    var daily = {};
    function day(d) { return daily[d] || (daily[d] = { d: d, revenue: 0, expense: 0 }); }
    values('txns').forEach(function (t) {
      if (t.d.slice(0, 7) !== ym) return;
      if (t.txn_type === 'payment') {
        tot.payments += t.amount; day(t.d).revenue += t.amount;
        income.push({ id: t.id, kind: 'payment', d: t.d, at: t.created_at, label: 'Payment: ' + t.category, who: clientName(t.client), amount: t.amount, note: t.note });
      } else if (t.txn_type === 'income') {
        tot.income += t.amount; day(t.d).revenue += t.amount;
        income.push({ id: t.id, kind: 'income', d: t.d, at: t.created_at, label: 'Income: ' + t.category, who: '', amount: t.amount, note: t.note });
      }
    });
    values('sales').forEach(function (s) {
      if (s.d.slice(0, 7) !== ym) return;
      tot.sales += s.total; day(s.d).revenue += s.total;
      income.push({ id: s.id, kind: 'sale', d: s.d, at: s.created_at, label: 'Shop: ' + s.product_name + ' x' + s.qty, who: clientName(s.client), amount: s.total, note: '' });
    });
    var byCat = {};
    values('expenses').forEach(function (e) {
      if (e.date.slice(0, 7) !== ym) return;
      tot.expenses += e.amount; day(e.date).expense += e.amount;
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
      expenses.push(e);
    });
    income.sort(function (a, b) { return b.at.localeCompare(a.at); });
    expenses.sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
    var revenue = round2(tot.payments + tot.income + tot.sales);
    return {
      ym: ym, income: income, expenses: expenses, byCat: byCat, daily: daily,
      totals: { payments: round2(tot.payments), income: round2(tot.income), sales: round2(tot.sales), revenue: revenue, expenses: round2(tot.expenses), profit: round2(revenue - tot.expenses) }
    };
  }

  /* ---------- lists, search, pagination ---------- */
  function paginate(list, page, per) {
    var total = list.length; var pages = Math.max(1, Math.ceil(total / per));
    var p = parseInt(page, 10); if (!isFinite(p) || p < 1) p = 1; if (p > pages) p = pages;
    var start = (p - 1) * per;
    return { items: list.slice(start, start + per), page: p, pages: pages, total: total, from: total ? start + 1 : 0, to: Math.min(total, start + per) };
  }
  function memberRows(o) {
    requireStaff();
    o = o || {};
    var today = now().date; var I = idx();
    var q = String(o.q || '').trim().toLowerCase(); var qd = q.replace(/\D/g, '');
    var rows = values('clients').map(function (c) {
      var sub = I.activeSub[c.id] || null;
      return { c: c, status: clientStatus(c, today), sub: sub, remaining: sub ? subRemaining(sub, today) : null, last: I.lastVisit[c.id] || null };
    });
    if (q) rows = rows.filter(function (r) {
      return r.c.name.toLowerCase().indexOf(q) >= 0 || (r.c.phone || '').toLowerCase().indexOf(q) >= 0 || (qd && phoneKey(r.c.phone).indexOf(qd) >= 0);
    });
    var counts = { all: rows.length, active: 0, frozen: 0, expired: 0 };
    rows.forEach(function (r) { counts[r.status]++; });
    if (o.filter && o.filter !== 'all') rows = rows.filter(function (r) { return r.status === o.filter; });
    rows.sort(function (a, b) { return a.c.name.localeCompare(b.c.name); });
    return { rows: rows, counts: counts };
  }

  /* ---------- dashboard, analytics, rankings ---------- */
  function dashboard() {
    requireStaff();
    var n = now(); var I = idx(); var today = n.date;
    var counts = { total: 0, active: 0, frozen: 0, expired: 0 }; var debt = 0; var expiring = [];
    values('clients').forEach(function (c) {
      var st = clientStatus(c, today); counts.total++; counts[st]++; debt += c.debt || 0;
      var s = I.activeSub[c.id];
      if (st === 'active' && s) {
        var rem = subRemaining(s, today);
        if (s.sub_type === 'time' && rem <= 7) expiring.push({ c: c, sub: s, rem: rem, label: rem === 0 ? 'Ends today' : rem + (rem === 1 ? ' day left' : ' days left'), urgency: rem });
        else if (s.sub_type === 'sessions') {
          if (rem <= 2) expiring.push({ c: c, sub: s, rem: rem, label: rem + (rem === 1 ? ' session left' : ' sessions left'), urgency: rem });
          else if (s.end_date) { var dl = diffDays(today, s.end_date); if (dl <= 7) expiring.push({ c: c, sub: s, rem: dl, label: dl === 0 ? 'Ends today' : dl + ' days left', urgency: dl }); }
        }
      }
    });
    expiring.sort(function (a, b) { return a.urgency - b.urgency; });
    var todays = values('visits').filter(function (v) { return v.visit_date === today; }).sort(function (a, b) { return b.visit_time.localeCompare(a.visit_time); });
    var series = [];
    for (var i = 6; i >= 0; i--) { var d = addDays(today, -i); series.push({ d: d, label: dowOf(d), value: I.byDate[d] || 0 }); }
    var fm = financeMonth(today.slice(0, 7));
    return { today: today, counts: counts, debt: round2(debt), expiring: expiring, todays: todays, series: series, month: fm.totals };
  }
  function attendanceSeries(days) {
    requireStaff();
    var today = now().date; var I = idx(); var out = [];
    for (var i = days - 1; i >= 0; i--) { var d = addDays(today, -i); out.push({ d: d, label: d.slice(8, 10), value: I.byDate[d] || 0 }); }
    return out;
  }
  function newMembers(ym) {
    requireStaff();
    return values('clients').filter(function (c) { return c.created_at.slice(0, 7) === ym; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
  }
  function lostMembers() {
    requireStaff();
    var today = now().date; var I = idx(); var out = [];
    values('clients').forEach(function (c) {
      if (c.status === 'frozen') return;
      var last = I.lastVisit[c.id] || null;
      var base = last || c.created_at.slice(0, 10);
      var gap = diffDays(base, today);
      if (gap >= 30) out.push({ c: c, last: last, gap: gap, status: clientStatus(c, today) });
    });
    return out.sort(function (a, b) { return b.gap - a.gap; });
  }
  /* staff get the full rows. A member gets a trimmed copy: no money column, no other member's photo or phone,
     and `me` marks their own row. */
  function rankings() {
    var u = requireUser();
    var today = now().date; var I = idx();
    var rows = values('clients').map(function (c) {
      var visits = (I.visitsBy[c.id] || []).length;
      var months = monthsBetween(c.created_at.slice(0, 10), today);
      var paid = I.payBy[c.id] || 0;
      return { c: c, visits: visits, months: months, paid: paid, score: visits * 3 + months * 2 + paid / 10000 };
    }).sort(function (a, b) { return b.score - a.score || a.c.name.localeCompare(b.c.name); });
    if (isStaff(u)) return rows;
    return rows.map(function (r) {
      var mine = u.client === r.c.id;
      return { c: { id: r.c.id, name: r.c.name, image: mine ? r.c.image : null }, visits: r.visits, months: r.months, score: r.score, me: mine };
    });
  }
  /* everything the profile page shows. Staff can open any member; a member only their own (without the staff-only note). */
  function profileData(cid) {
    var u = requireUser();
    var own = u.role === MEMBER_ROLE && u.client === cid;
    if (!own && !isStaff(u)) throw new AppError('You can only open your own profile.');
    var c = S.clients[cid]; if (!c) return null;
    var today = now().date; var acct = memberUserOf(cid);
    function newest(a, b) { return b.created_at.localeCompare(a.created_at); }
    var shown = c;
    if (!isStaff(u)) { shown = Object.assign({}, c); delete shown.note; }
    return {
      c: shown, own: own, status: clientStatus(c, today), sub: activeSub(cid), subs: subsOf(cid), visits: visitsOf(cid),
      txs: values('txns').filter(function (t) { return t.client === cid; }).sort(newest),
      ms: values('measurements').filter(function (m) { return m.client === cid; }).sort(newest),
      login: acct ? { username: acct.username, created_at: acct.created_at } : null
    };
  }
  function listAudit() { requireStaff(); return values('audit'); }
  function monthlyReport(ym) {
    requireStaff();
    var fm = financeMonth(ym); var I = idx();
    var first = ym + '-01'; var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var days = []; var visitsTotal = 0; var uniq = {};
    for (var d = 1; d <= lastDay; d++) {
      var ds = ym + '-' + String(d).padStart(2, '0');
      var cnt = I.byDate[ds] || 0; visitsTotal += cnt; days.push({ d: ds, dow: dowOf(ds), count: cnt });
    }
    values('visits').forEach(function (v) { if (v.visit_date.slice(0, 7) === ym) uniq[v.client] = 1; });
    var payments = fm.income.filter(function (r) { return r.kind === 'payment'; }).slice().reverse();
    return {
      ym: ym, first: first, days: days, payments: payments, fm: fm,
      summary: [
        ['Month', monthLabel(ym)],
        ['New members', newMembers(ym).length],
        ['Check-ins', visitsTotal],
        ['Members who visited', Object.keys(uniq).length],
        ['Membership payments', fm.totals.payments],
        ['Other income', fm.totals.income],
        ['Shop sales', fm.totals.sales],
        ['Total revenue', fm.totals.revenue],
        ['Total expenses', fm.totals.expenses],
        ['Profit', fm.totals.profit]
      ]
    };
  }

  /* ---------- sample data: clearly flagged, one click to remove ---------- */
  function hasSample() { return values('clients').some(function (c) { return c.sample; }); }
  function loadSample() {
    requireAdmin(); needWrite();
    if (values('clients').length) throw new AppError('Sample data can only be loaded into an empty gym.');
    var today = now().date;
    function ago(d) { return addDays(today, -d); }
    function pad(x) { return String(x).padStart(2, '0'); }
    function mkClient(name, phone, days, joined) {
      return put('clients', { id: uid(), name: name, phone: phone, note: '', image: null, created_at: ago(joined) + 'T10:00:00', status: 'active', frozen_since: null, days: days, debt: 0, sample: true });
    }
    function mkTxn(type, c, cat, amt, bal, note, date) { var t = logTxn(type, c ? c.id : null, cat, amt, bal, note, date); t.sample = true; put('txns', t); }
    function mkSub(c, type, startAgo, len, total, used, price, paid) {
      var start = ago(startAgo);
      var sub = put('subs', { id: uid(), client: c.id, sub_type: type, start_date: start, end_date: type === 'time' ? addDays(start, len - 1) : null, total_sessions: type === 'sessions' ? total : 0, used_sessions: used || 0, price: price, is_active: true, created_at: start + 'T10:00:00', sample: true });
      if (price > 0) { c.debt = round2(c.debt + price); mkTxn('charge', c, 'membership', price, c.debt, 'Subscription: ' + planLabel(sub), start); }
      if (paid > 0) { c.debt = Math.max(0, round2(c.debt - paid)); mkTxn('payment', c, 'membership', paid, c.debt, 'Paid with subscription', start); }
      put('clients', c); return sub;
    }
    function visits(c, sub, list) {
      list.forEach(function (d) {
        var date = ago(d);
        if (c.days && c.days.split(',').indexOf(dowOf(date)) < 0) return;
        put('visits', { id: uid(), d: date, client: c.id, subscription: sub.id, visit_date: date, visit_time: pad(7 + (d * 5) % 13) + ':' + pad((d * 17) % 60), sample: true });
      });
    }
    function range(a, b, step) { var o = []; for (var i = a; i <= b; i += step || 1) o.push(i); return o; }

    var c, s;
    c = mkClient('Aziz Karimov', '+998 90 123 45 67', 'Mon,Wed,Fri', 210); s = mkSub(c, 'time', 12, 30, 0, 0, 350000, 350000); visits(c, s, range(0, 11)); 
    c = mkClient('Dilnoza Yusupova', '+998 91 234 56 78', '', 80); s = mkSub(c, 'sessions', 40, 0, 12, 10, 400000, 400000); visits(c, s, [1, 4, 6, 9, 12, 15, 19, 24, 28, 33]);
    c = mkClient('Jasur Toshmatov', '+998 93 345 67 89', '', 150); s = mkSub(c, 'time', 28, 30, 0, 0, 350000, 200000); visits(c, s, range(0, 27, 2));
    c = mkClient('Malika Rahimova', '+998 94 456 78 90', 'Tue,Thu,Sat', 130); s = mkSub(c, 'time', 40, 90, 0, 0, 900000, 900000); visits(c, s, range(0, 39));
    c = mkClient('Sherzod Abdullayev', '+998 95 567 89 01', '', 190); s = mkSub(c, 'time', 50, 30, 0, 0, 350000, 350000); visits(c, s, [24, 26, 29, 31, 34, 36, 40, 43, 46, 49]);
    c = mkClient('Nodira Qodirova', '+998 97 678 90 12', '', 95); s = mkSub(c, 'time', 20, 60, 0, 0, 600000, 600000); visits(c, s, [8, 10, 13, 15, 18]); c.status = 'frozen'; c.frozen_since = ago(5); put('clients', c);
    c = mkClient('Bobur Ismoilov', '+998 99 789 01 23', '', 60); s = mkSub(c, 'sessions', 35, 0, 8, 8, 280000, 280000); visits(c, s, [3, 7, 10, 14, 17, 21, 25, 30]);
    c = mkClient('Madina Aliyeva', '+998 90 890 12 34', '', 45); s = mkSub(c, 'time', 5, 30, 0, 0, 350000, 350000); visits(c, s, range(0, 4));
    c = mkClient('Sardor Nazarov', '+998 91 901 23 45', '', 170); s = mkSub(c, 'time', 90, 30, 0, 0, 350000, 350000); visits(c, s, [45, 47, 50, 52, 55, 58, 61, 64]);
    c = mkClient('Kamola Sodiqova', '+998 93 012 34 56', '', 320); s = mkSub(c, 'time', 100, 365, 0, 0, 2400000, 2400000); visits(c, s, range(0, 60));
    c = mkClient('Otabek Rustamov', '+998 94 111 22 33', '', 3); s = mkSub(c, 'time', 3, 30, 0, 0, 350000, 250000); visits(c, s, [0, 2]);
    c = mkClient('Zilola Hamidova', null, '', 0);
    var aziz = values('clients').find(function (x) { return x.name === 'Aziz Karimov'; });
    [[60, 86.0, 18.5], [30, 84.2, 17.1], [3, 82.9, 16.0]].forEach(function (m) {
      put('measurements', { id: uid(), client: aziz.id, created_at: ago(m[0]) + 'T11:00:00', note: '', weight: m[1], height: 178, body_fat: m[2], chest: null, waist: null, bicep: null, sample: true });
    });
    var prods = [['Water 0.5 L', 'Drinks', 4000, 2000, 48], ['Protein bar', 'Food', 15000, 9000, 3], ['Energy drink', 'Drinks', 12000, 7500, 20], ['Gym towel', 'Gear', 45000, 30000, 0], ['Shaker bottle', 'Gear', 35000, 20000, 9]].map(function (p) {
      return put('products', { id: uid(), name: p[0], category: p[1], price: p[2], cost: p[3], stock: p[4], created_at: ago(30) + 'T09:00:00', sample: true });
    });
    [[0, 3, 0], [1, 2, 0], [2, 1, 1], [0, 5, 1], [3, 1, 2], [1, 1, 3], [4, 1, 4]].forEach(function (x) {
      var p = prods[x[0]];
      put('sales', { id: uid(), d: ago(x[2]), product: p.id, product_name: p.name, client: null, qty: x[1], unit_price: p.price, total: round2(p.price * x[1]), created_at: ago(x[2]) + 'T1' + (x[0] + 1) + ':20:00', sample: true });
    });
    [['rent', 6000000, 0], ['salary', 4500000, 1], ['utilities', 850000, 2], ['repair', 300000, 4], ['marketing', 400000, 6]].forEach(function (e) {
      var d = ago(e[2]); put('expenses', { id: uid(), category: e[0], amount: e[1], note: 'Sample', date: d, created_at: d + 'T12:00:00', sample: true });
    });
    mkTxn('income', null, 'day pass', 100000, null, 'Sample', ago(1)); mkTxn('income', null, 'personal training', 250000, null, 'Sample', ago(3));
    audit('SAMPLE_LOADED', '12 sample members and demo shop, finance and visit data');
    return 12;
  }
  function removeSample() {
    requireAdmin(); needWrite();
    var n = 0;
    TABLES.forEach(function (t) {
      if (t === 'users' || t === 'audit') return;
      values(t).forEach(function (r) { if (r.sample) { del(t, r.id); n++; } });
    });
    audit('SAMPLE_REMOVED', n + ' sample records removed');
    return n;
  }

  /* ---------- backup and restore (the whole database as one JSON file) ---------- */
  function exportBackup() {
    requireAdmin(); var n = now();
    audit('BACKUP', 'Backup downloaded');
    return { name: 'gym_' + n.date + '_' + n.time.replace(':', '-') + '.json', text: JSON.stringify({ app: 'gym-manager-pro', version: 1, created_at: n.iso, tables: S }) };
  }
  function restoreBackup(text) {
    requireAdmin(); needWrite();
    var obj;
    try { obj = JSON.parse(text); } catch (e) { throw new AppError('This file is not a valid backup.'); }
    if (!obj || obj.app !== 'gym-manager-pro' || !obj.tables) throw new AppError('This file is not a Gym Manager Pro backup.');
    var ns = emptyState();
    TABLES.forEach(function (t) {
      var src = obj.tables[t] || {};
      Object.keys(src).forEach(function (k) {
        var r = src[k];
        if (!r || typeof r.id !== 'string' || !/^[A-Za-z0-9_.~:@+-]{1,100}$/.test(r.id)) throw new AppError('The backup contains a damaged record in ' + t + '.');
        if (SHARDED[t] && !isDate(r.d)) throw new AppError('The backup contains a damaged record in ' + t + '.');
        ns[t][r.id] = r;
      });
    });
    if (!Object.keys(ns.users).some(function (k) { return ns.users[k].role === 'admin'; })) throw new AppError('The backup has no admin account.');
    var old = S; S = ns; touch();
    Store.replaceAll(old, S);
    var stillThere = !!S.users[sessionUserId];
    if (!stillThere) sessionUserId = null;
    return { loggedOut: !stillThere };
  }

  return {
    AppError: AppError, Store: Store, TABLES: TABLES, SHARDED: SHARDED, WEEK: WEEK, ROLES: ROLES,
    EXPENSE_CATS: EXPENSE_CATS, INCOME_CATS: INCOME_CATS, PAY_CATS: PAY_CATS,
    S: function () { return S; }, rev: function () { return rev; }, values: values, loadState: loadState,
    applyRemote: applyRemote, shardItems: shardItems, allDocPaths: allDocPaths, SHARD_OF: function (t) { return !!SHARDED[t]; },
    now: now, setClock: setClock, addDays: addDays, diffDays: diffDays, dowOf: dowOf, isDate: isDate,
    fmtDate: fmtDate, fmtDT: fmtDT, fmtMoney: fmtMoney, monthLabel: monthLabel, monthsBetween: monthsBetween, uid: uid,
    me: me, isStaff: isStaff, login: login, logout: logout, restoreSession: restoreSession, requireUser: requireUser, requireStaff: requireStaff,
    profileData: profileData, memberLogin: memberLogin, resetMemberPassword: resetMemberPassword, listAudit: listAudit,
    ensureDefaultAdmin: ensureDefaultAdmin, migratePasswords: migratePasswords, hashPassword: hashPassword, verifyPassword: verifyPassword,
    changeOwnPassword: changeOwnPassword, listUsers: listUsers, addUser: addUser, setRole: setRole, deleteUser: deleteUser, resetPassword: resetPassword,
    clientStatus: clientStatus, activeSub: activeSub, subsOf: subsOf, visitsOf: visitsOf, subRemaining: subRemaining, subState: subState, planLabel: planLabel,
    createClient: createClient, updateClient: updateClient, deleteClient: deleteClient, addSubscription: addSubscription, extendSubscription: extendSubscription,
    checkIn: checkIn, freezeClient: freezeClient, unfreezeClient: unfreezeClient,
    addPayment: addPayment, addCharge: addCharge, adjustDebt: adjustDebt, addMeasurement: addMeasurement, deleteMeasurement: deleteMeasurement,
    saveProduct: saveProduct, deleteProduct: deleteProduct, sellProduct: sellProduct, restockProduct: restockProduct,
    addExpense: addExpense, deleteExpense: deleteExpense, addIncome: addIncome, deleteIncome: deleteIncome, financeMonth: financeMonth,
    paginate: paginate, memberRows: memberRows, dashboard: dashboard, attendanceSeries: attendanceSeries, newMembers: newMembers,
    lostMembers: lostMembers, rankings: rankings, monthlyReport: monthlyReport, exportBackup: exportBackup, restoreBackup: restoreBackup, loadSample: loadSample, removeSample: removeSample, hasSample: hasSample,
    clientName: clientName, audit: audit
  };
})();

export default GYM;
