import { ACT } from './actions.js';
import G from './core/gym.js';
import I18N from './i18n/i18n.js';
import { api, enc, net, qs } from './api.js';
import { refreshAuditList } from './pages/audit.js';
import { PAGES } from './pages/index.js';
import { refreshMemberList } from './pages/members.js';
import { PREFS, effectiveTheme, loadPrefs, savePrefs } from './prefs.js';
import { hooks, modals, session, ui } from './state.js';
import { $, $$, esc } from './ui/html.js';
import { ic, plateLogo } from './ui/icons.js';
import { confirmBox } from './ui/modal.js';
import { avatar } from './ui/parts.js';
import { fail, toast } from './ui/toast.js';
import { lt, tpl } from './ui/tr.js';

/* the sidebar logo and the two icon buttons are static, so they are filled once here */
$('#logo-slot').innerHTML = plateLogo(40);
$('#menu-btn').innerHTML = ic('menu');
$('#logout-btn').innerHTML = ic('out') + 'Sign out';
/* ===== app: routing, actions, login, boot ===== */
const NAV_ORDER = ['profile', 'dashboard', 'members', 'shop', 'finance', 'analytics', 'rankings', 'audit', 'users', 'password', 'settings'];

function currentPage() { return PAGES[ui.route.page] || PAGES.dashboard; }
/* the route gate: used by render() and by the nav, so a page a user may not open is never reachable, not just hidden */
function pageAllowed(pg, me) {
  var a = pg.acc || 'staff';
  if (a === 'any') return true;
  if (a === 'member') return me.role === 'member';
  if (a === 'admin') return me.role === 'admin';
  return G.isStaff(me);
}
function homePage(me) { return G.isStaff(me) ? 'dashboard' : 'profile'; }
function go(page, id) {
  ui.route = { page: page, id: id || null };
  if (page === 'member') { ui.det.allVisits = false; ui.det.allTx = false; }
  closeDrawer(); render(); window.scrollTo(0, 0);
}
/* load then render: the page asks the API for exactly what it shows. Each call gets a number; an answer for a page
   the user has already left (or an older request for this page) is dropped instead of overwriting the new one. */
var renderSeq = 0, shownKey = null;
function routeOk() {
  var me = session.user, pg = currentPage();
  if (!pageAllowed(pg, me)) { ui.route = { page: homePage(me), id: null }; pg = PAGES[ui.route.page]; }
  return pg;
}
function pageKey() { return ui.route.page + ':' + (ui.route.id || ''); }
function paint(pg, data, key) {
  var title = pg.title;
  if (ui.route.page === 'member') title = data && data.c ? data.c.name : 'Member';
  $('#title').textContent = title;
  document.title = 'Bek Sport Gym';
  ui.data = data; shownKey = key;
  $('#view').innerHTML = pg.render(data);
  if (pg.after) pg.after(data);
  buildNav();
}
async function render() {
  if (!session.user) { showLogin(); return; }
  var pg = routeOk(), key = pageKey(), my = ++renderSeq;
  buildNav(); updateSync();
  var fresh = shownKey !== key;
  var wait = null;
  if (fresh) {   /* a short loading note, but only if the answer is not instant */
    $('#title').textContent = ui.route.page === 'member' ? 'Member' : pg.title;
    wait = setTimeout(function () { if (my === renderSeq) $('#view').innerHTML = '<div class="empty" role="status"><b>Loading</b></div>'; }, 120);
  }
  var data = null;
  try { data = pg.load ? await pg.load() : null; }
  catch (e) {
    clearTimeout(wait);
    if (my !== renderSeq || !session.user) return;
    if (fresh) {
      shownKey = null; $('#view').innerHTML = '<div class="card"><div class="empty"><b>Could not load this page</b>' + esc(e && e.message) + '<div style="margin-top:12px"><button class="btn" data-act="retry">Try again</button></div></div></div>';
    } else fail(e);
    return;
  }
  clearTimeout(wait);
  if (my !== renderSeq || !session.user) return;
  paint(pg, data, key);
  runQuick();   /* keep the quick check-in list in step with member changes */
}
/* draw the current page again from the data it already has (language, theme, show-all toggles): no request */
function repaint() {
  if (!session.user) { showLogin(); return; }
  var pg = routeOk();
  if (pageKey() !== shownKey) { render(); return; }
  paint(pg, ui.data, shownKey);
}
function buildNav() {
  var me = session.user; var active = currentPage().parent || ui.route.page;
  var staff = G.isStaff(me);
  $('.qci').hidden = !staff;   /* quick check-in is a staff tool */
  $('#nav').innerHTML = NAV_ORDER.map(function (k) {
    var p = PAGES[k]; if (!pageAllowed(p, me)) return '';
    return (k === 'users' ? '<div class="sep"></div>' : '') + '<button type="button" data-act="nav" data-page="' + k + '"' + (k === active ? ' aria-current="page"' : '') + '>' + ic(p.icon) + p.title + '</button>';
  }).join('');
  $('#who').innerHTML = avatar({ name: me.username }) + '<div style="min-width:0"><b>' + esc(me.username) + '</b><small>' + esc(me.role.replace('_', ' ')) + '</small></div>';
}
/* the topbar chip is the server connection: online, saving, or a write that failed */
function updateSync() {
  var el = $('#sync'); if (!el) return;
  var s = net.status, txt, cls;
  if (s === 'error') { txt = 'Save failed'; cls = 'expired'; }
  else if (s === 'saving') { txt = 'Saving'; cls = 'warn'; }
  else { txt = 'Online'; cls = 'ok'; }
  el.className = 'chip ' + cls; $('.chip-t', el).textContent = txt;
  el.title = 'Data is saved on the server.';
}
/* the menu button: on wide screens it shows or hides the sidebar (PREFS.side), on narrow ones it opens or closes the drawer */
var mqNarrow = null;
try { mqNarrow = window.matchMedia('(max-width: 960px)'); } catch (e) { /* ignore */ }
function isNarrow() { return !!(mqNarrow && mqNarrow.matches); }
function drawerOpen() { return $('#side').classList.contains('open'); }
function sideVisible() { return isNarrow() ? drawerOpen() : PREFS.side !== 'hidden'; }
function syncMenuBtn() {
  var b = $('#menu-btn'), on = sideVisible() ? 'true' : 'false';
  if (b.getAttribute('aria-expanded') === on) return;      /* the label is translated by I18N, so only write on a change */
  b.setAttribute('aria-expanded', on);
  b.setAttribute('aria-label', on === 'true' ? 'Close menu' : 'Open menu');
}
function openDrawer() { $('#side').classList.add('open'); $('#scrim').classList.add('on'); syncMenuBtn(); }
function closeDrawer() { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); syncMenuBtn(); }
function applySide() { $('#app').classList.toggle('nav-hidden', PREFS.side === 'hidden'); syncMenuBtn(); }
function toggleSide() {
  if (isNarrow()) { if (drawerOpen()) closeDrawer(); else openDrawer(); return; }
  PREFS.side = PREFS.side === 'hidden' ? 'shown' : 'hidden'; savePrefs(); applySide();   /* just a class, no render() */
}
/* crossing the 960px line: drop a drawer left open and re-read the button state */
try { if (mqNarrow && mqNarrow.addEventListener) mqNarrow.addEventListener('change', function () { closeDrawer(); }); } catch (e) { /* ignore */ }


function applyPrefs() {
  var root = document.documentElement;
  root.setAttribute('data-look', PREFS.look);
  if (PREFS.mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', PREFS.mode);
  root.setAttribute('lang', PREFS.lang);
  I18N.setLang(PREFS.lang);
  applySide();
  updateThemeButtons();
  updateLangButtons();
}
/* every theme switch (login page and topbar) follows effectiveTheme(); aria-checked = night is on */
function updateThemeButtons() {
  var dark = effectiveTheme() === 'dark', on = dark ? 'true' : 'false';
  $$('.theme-sw').forEach(function (b) {
    if (b.getAttribute('aria-checked') === on) return;   /* the texts are translated by I18N, so only write on a change; the knob stays put so it can slide */
    if (!b.firstChild) b.innerHTML = '<span class="ts-t"></span><span class="ts-k"></span>';
    $('.ts-t', b).textContent = dark ? 'Night mode' : 'Light mode';
    $('.ts-k', b).innerHTML = ic(dark ? 'moon' : 'sun');
    b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to night mode');
    b.setAttribute('aria-checked', on);
  });
}
/* the topbar is static, so its language buttons are re-marked here whenever the language changes */
function updateLangButtons() {
  $$('.lang-seg button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === PREFS.lang ? 'true' : 'false'); });
}
function setPref(key, val) {
  PREFS[key] = val; savePrefs(); applyPrefs();
  repaint();
}
/* the quick light/night switch flips between the two; Settings holds the full choice */
function toggleTheme() { setPref('mode', effectiveTheme() === 'dark' ? 'light' : 'dark'); }
/* a two-button language switch: EN | UZ on the login page and in the topbar (fixed codes, so I18N skips them) */
function langSeg(items, fixed) {
  return '<div class="lang-seg" role="group" aria-label="Language">' +
    items.map(function (l) { return '<button type="button" data-act="setLang" data-v="' + l[0] + '" aria-pressed="' + (PREFS.lang === l[0]) + '" lang="' + l[0] + '"' + (fixed ? ' data-notr' : '') + '>' + l[1] + '</button>'; }).join('') + '</div>';
}
function buildLoginLang() {
  var host = $('#login-lang'); if (!host) return;
  host.innerHTML = langSeg([['en', 'EN'], ['uz', 'UZ']], true);
}
loadPrefs();
$('#top-lang').innerHTML = langSeg([['en', 'EN'], ['uz', 'UZ']], true);
try { var mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { updateThemeButtons(); if (session.user && ui.route.page === 'settings') repaint(); }); } catch (e) { /* ignore */ }

/* ---------- login / logout ---------- */
function showLogin() {
  $('#boot').hidden = true; $('#app').hidden = true; $('#login').hidden = false;
  buildLoginLang();
  $('#first-note').textContent = 'Welcome to the Bek Sport Gym app! Ask the manager for your login and password.';
  setTimeout(function () { var u = $('#l_user'); if (u) u.focus(); }, 30);
}
function enterApp() {
  $('#boot').hidden = true; $('#login').hidden = true; $('#app').hidden = false;
  ui.route = { page: homePage(session.user), id: null }; shownKey = null; render(); window.scrollTo(0, 0);
}
/* back to the login screen: after sign-out, a restore, or a session that ended */
function leaveApp() {
  session.user = null; renderSeq++; shownKey = null; ui.data = null;
  modals.slice().forEach(function (w) { w.remove(); }); modals.length = 0;
  $('#qci-q').value = ''; $('#qci-list').innerHTML = '';
  showLogin();
}
function doLogout() {
  api.post('/api/auth/logout').catch(function () { /* the server session is gone or unreachable; the screen is signed out either way */ });
  leaveApp();
}
net.onUnauthorized = function () {
  if (!session.user) return false;   /* a failed sign-in attempt is not a lost session */
  leaveApp(); toast('Please sign in first.', 'err'); return true;
};
net.onStatus = updateSync;

/* ---------- check in ---------- */
async function doCheckIn(id) {
  try {
    var r = await api.post('/api/members/' + enc(id) + '/checkin');
    var left = r.sub.sub_type === 'sessions' ? r.remaining + ' sessions left' : r.remaining + ' days left';
    toast(r.client.name + ' checked in. ' + left + '.');
    render();
  } catch (e) { fail(e); }
}
/* the sidebar quick check-in: the members endpoint with a search text, the first 6 rows */
var quickSeq = 0, quickTimer = null;
async function runQuick() {
  var q = $('#qci-q').value.trim(), host = $('#qci-list'), my = ++quickSeq;
  if (!q || !session.user || !G.isStaff(session.user)) { host.innerHTML = ''; return; }
  var d;
  try { d = await api.get('/api/members' + qs({ q: q })); } catch (e) { if (my === quickSeq) host.innerHTML = ''; return; }
  if (my !== quickSeq || $('#qci-q').value.trim() !== q) return;
  var rows = d.items.slice(0, 6);
  host.innerHTML = rows.length ? rows.map(function (r) {
    var cls = r.status === 'active' ? 'dot-ok' : r.status === 'frozen' ? 'dot-frozen' : 'dot-bad';
    return '<div class="qci-item"><span class="tile" style="border:0;background:none;padding:0"><span class="cap"><i class="' + cls + '"></i></span></span><span class="n" title="' + esc(r.c.name) + '">' + esc(r.c.name) + '</span><button class="btn btn-sm" data-act="checkin" data-id="' + esc(r.c.id) + '"' + (r.status !== 'active' ? ' disabled' : '') + '>In</button></div>';
  }).join('') : '<div class="small" style="color:var(--side-ink-2);padding:4px 6px">No match</div>';
}


document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && modals.length) { var w = modals[modals.length - 1]; var b = $('[data-close]', w); if (b) b.click(); }
  else if (e.key === 'Escape' && isNarrow() && drawerOpen()) { closeDrawer(); $('#menu-btn').focus(); }   /* one Escape does one thing: a modal first */
});

/* ---------- delegated events ---------- */
/* the only buttons a signed-in member can use; the core refuses everything else too */
const MEMBER_ACTS = { nav: 1, logout: 1, theme: 1, setLang: 1, setMode: 1, setLook: 1, toggleVisits: 1, toggleTx: 1 };
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  var fn = ACT[el.dataset.act]; if (!fn) return;
  var who = session.user; if (who && !G.isStaff(who) && !MEMBER_ACTS[el.dataset.act]) return;
  try { var r = fn(el, e); if (r && r.catch) r.catch(fail); } catch (err) { fail(err); }
});
document.addEventListener('input', function (e) {
  var el = e.target.closest('[data-input]'); if (!el) return;
  if (el.dataset.input === 'memSearch') { ui.mem.q = el.value; ui.mem.page = 1; refreshMemberList(true); }
  if (el.dataset.input === 'auditSearch') { ui.audit.q = el.value; ui.audit.page = 1; refreshAuditList(true); }
});
document.addEventListener('change', function (e) {
  var el = e.target.closest('[data-change]'); if (!el) return;
  try {
    var k = el.dataset.change;
    if (k === 'finMonth') { if (/^\d{4}-\d{2}$/.test(el.value)) { ui.fin.ym = el.value; render(); } }
    else if (k === 'anMonth') { if (/^\d{4}-\d{2}$/.test(el.value)) { ui.an.ym = el.value; render(); } }
    else if (k === 'setRole') { api.put('/api/admin/users/' + enc(el.dataset.id) + '/role', { role: el.value }).then(function () { toast('Role changed'); }, fail).then(render); }
    else if (k === 'restoreFile') {
      var f = el.files[0]; el.value = ''; if (!f) return;
      f.text().then(function (text) {
        return confirmBox({ title: 'Restore backup', html: tpl('Replace {0} with the contents of {1}? This cannot be undone. Download a backup first if you are not sure.', [lt('all current data'), f.name]), confirm: 'Replace everything', danger: true }).then(async function (ok) {
          if (!ok) return;
          await api.post('/api/admin/backup/restore', { text: text });   /* the server ends every session, ours too */
          leaveApp(); toast('Backup restored. Please sign in again.');
        });
      }).catch(fail);
    }
  } catch (err) { fail(err); }
});
document.addEventListener('submit', async function (e) {
  var form = e.target.closest('[data-form]'); if (!form) return;
  e.preventDefault();
  var err = $('.form-error', form); err.hidden = true;
  try {
    var fd = new FormData(form); var k = form.dataset.form;
    if (k === 'addUser') { await api.post('/api/admin/users', { username: fd.get('username'), password: fd.get('password'), role: fd.get('role') }); toast('User added'); render(); }
    else if (k === 'password') { await api.post('/api/auth/password', { current: fd.get('current'), next: fd.get('next'), confirm: fd.get('confirm') }); form.reset(); toast('Password changed'); }
  } catch (ex) { err.textContent = ex instanceof G.AppError ? ex.message : 'Something went wrong: ' + ex.message; err.hidden = false; }
});
$('#qci-q').addEventListener('input', function () { clearTimeout(quickTimer); quickTimer = setTimeout(runQuick, 180); });
$('#menu-btn').addEventListener('click', toggleSide);
$('#scrim').addEventListener('click', closeDrawer);
$('#login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var err = $('#login-err'), btn = $('#login-go'); err.hidden = true; btn.disabled = true;
  try {
    var r = await api.post('/api/auth/login', { username: $('#l_user').value, password: $('#l_pass').value });
    session.user = r.user;
    $('#l_pass').value = ''; enterApp();
  } catch (ex) { err.textContent = ex instanceof G.AppError ? ex.message : 'Sign in failed: ' + ex.message; err.hidden = false; }
  finally { btn.disabled = false; }
});

/* ---------- boot ---------- */
export async function boot() {
  applyPrefs();
  $('#boot').hidden = false; $('#boot-msg').textContent = 'Opening Bek Sport Gym';
  var offline = null;
  try { session.user = (await api.get('/api/auth/me')).user; } catch (e) { offline = e; }
  if (session.user) enterApp(); else {
    showLogin();
    if (offline) { $('#login-err').textContent = offline.message; $('#login-err').hidden = false; }
  }
  updateSync();
}
hooks.render = render; hooks.repaint = repaint; hooks.go = go; hooks.logout = doLogout; hooks.setPref = setPref; hooks.toggleTheme = toggleTheme; hooks.checkIn = doCheckIn;

