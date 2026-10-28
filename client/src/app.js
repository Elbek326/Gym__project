import { ACT } from './actions.js';
import G from './core/gym.js';
import I18N from './i18n/i18n.js';
import { renderAuditList } from './pages/audit.js';
import { PAGES } from './pages/index.js';
import { renderMemberList } from './pages/members.js';
import Persist from './persist.js';
import { PREFS, effectiveTheme, loadPrefs, savePrefs } from './prefs.js';
import { hooks, modals, ui } from './state.js';
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
  if (page === 'members') { /* keep search and filter between visits */ }
  if (page === 'member') { ui.det.allVisits = false; ui.det.allTx = false; }
  closeDrawer(); render(); window.scrollTo(0, 0);
}
function render() {
  if (!G.me()) { showLogin(); return; }
  var pg = currentPage();
  if (!pageAllowed(pg, G.me())) { ui.route = { page: homePage(G.me()), id: null }; pg = PAGES[ui.route.page]; }
  var title = pg.title;
  if (ui.route.page === 'member') { var c = G.S().clients[ui.route.id]; title = c ? c.name : 'Member'; }
  $('#title').textContent = title;
  document.title = 'Gym Manager Pro';
  $('#view').innerHTML = pg.render();
  if (pg.after) pg.after();
  buildNav();
  updateSync();
  runQuick();   /* keep the quick check-in list in step with member changes */
}
function buildNav() {
  var me = G.me(); var active = currentPage().parent || ui.route.page;
  var staff = G.isStaff(me);
  $('.qci').hidden = !staff;   /* quick check-in is a staff tool */
  $('#nav').innerHTML = NAV_ORDER.map(function (k) {
    var p = PAGES[k]; if (!pageAllowed(p, me)) return '';
    return (k === 'users' ? '<div class="sep"></div>' : '') + '<button type="button" data-act="nav" data-page="' + k + '"' + (k === active ? ' aria-current="page"' : '') + '>' + ic(p.icon) + p.title + '</button>';
  }).join('');
  $('#who').innerHTML = avatar({ name: me.username }) + '<div style="min-width:0"><b>' + esc(me.username) + '</b><small>' + esc(me.role.replace('_', ' ')) + '</small></div>';
}
function updateSync() {
  var el = $('#sync'); if (!el) return;
  var s = Persist.status, txt, cls;
  if (s === 'error') { txt = 'Save failed'; cls = 'expired'; }
  else if (s === 'saving') { txt = 'Saving'; cls = 'warn'; }
  else { txt = 'This browser only'; cls = 'warn'; }
  el.className = 'chip ' + cls; $('.chip-t', el).textContent = txt;
  el.title = 'Data is saved in this browser only. Use Backup now regularly.';
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
  if (G.me()) render(); else showLogin();
}
/* the quick light/night switch flips between the two; Settings holds the full choice */
function toggleTheme() { setPref('mode', effectiveTheme() === 'dark' ? 'light' : 'dark'); }
/* a two-button language switch: full names on the login page, EN | UZ in the topbar (fixed codes, so I18N skips them) */
function langSeg(items, fixed) {
  return '<div class="lang-seg" role="group" aria-label="Language">' +
    items.map(function (l) { return '<button type="button" data-act="setLang" data-v="' + l[0] + '" aria-pressed="' + (PREFS.lang === l[0]) + '" lang="' + l[0] + '"' + (fixed ? ' data-notr' : '') + '>' + l[1] + '</button>'; }).join('') + '</div>';
}
function buildLoginLang() {
  var host = $('#login-lang'); if (!host) return;
  host.innerHTML = langSeg([['uz', 'O‘zbekcha'], ['en', 'English']]);
}
loadPrefs();
$('#top-lang').innerHTML = langSeg([['en', 'EN'], ['uz', 'UZ']], true);
try { var mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { updateThemeButtons(); if (G.me() && ui.route.page === 'settings') render(); }); } catch (e) { /* ignore */ }

/* ---------- login / logout ---------- */
function showLogin() {
  $('#boot').hidden = true; $('#app').hidden = true; $('#login').hidden = false;
  buildLoginLang();
  $('#first-note').innerHTML = tpl('First time here? Sign in as {0} with password {1}, then change it under My Password.', ['admin', 'admin123']);
  var note = $('#storage-note');
  note.textContent = 'Data is saved in this browser only. Download a backup from the Audit Log page now and then.';
  setTimeout(function () { var u = $('#l_user'); if (u) u.focus(); }, 30);
}
function enterApp() {
  $('#boot').hidden = true; $('#login').hidden = true; $('#app').hidden = false;
  try { sessionStorage.setItem('gym_uid', G.me().id); } catch (e) { /* ignore */ }
  ui.route = { page: homePage(G.me()), id: null }; render(); window.scrollTo(0, 0);
}
function doLogout() {
  G.logout(); try { sessionStorage.removeItem('gym_uid'); } catch (e) { /* ignore */ }
  modals.slice().forEach(function (w) { w.remove(); }); modals.length = 0;
  $('#qci-q').value = ''; $('#qci-list').innerHTML = '';
  showLogin();
}

/* ---------- check in ---------- */
function doCheckIn(id, stay) {
  try {
    var r = G.checkIn(id);
    var left = r.sub.sub_type === 'sessions' ? r.remaining + ' sessions left' : r.remaining + ' days left';
    toast(r.client.name + ' checked in. ' + left + '.');
    render(); runQuick();
  } catch (e) { fail(e); }
}
function runQuick() {
  var q = $('#qci-q').value.trim(); var host = $('#qci-list');
  if (!q || !G.isStaff(G.me())) { host.innerHTML = ''; return; }
  var rows = G.memberRows({ q: q }).rows.slice(0, 6);
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
  var who = G.me(); if (who && !G.isStaff(who) && !MEMBER_ACTS[el.dataset.act]) return;
  try { var r = fn(el, e); if (r && r.catch) r.catch(fail); } catch (err) { fail(err); }
});
document.addEventListener('input', function (e) {
  var el = e.target.closest('[data-input]'); if (!el) return;
  if (el.dataset.input === 'memSearch') { ui.mem.q = el.value; ui.mem.page = 1; renderMemberList(); }
  if (el.dataset.input === 'auditSearch') { ui.audit.q = el.value; ui.audit.page = 1; renderAuditList(); }
});
document.addEventListener('change', function (e) {
  var el = e.target.closest('[data-change]'); if (!el) return;
  try {
    var k = el.dataset.change;
    if (k === 'finMonth') { if (/^\d{4}-\d{2}$/.test(el.value)) { ui.fin.ym = el.value; render(); } }
    else if (k === 'anMonth') { if (/^\d{4}-\d{2}$/.test(el.value)) { ui.an.ym = el.value; render(); } }
    else if (k === 'setRole') { try { G.setRole(el.dataset.id, el.value); toast('Role changed'); } catch (err) { fail(err); } render(); }
    else if (k === 'restoreFile') {
      var f = el.files[0]; el.value = ''; if (!f) return;
      f.text().then(function (text) {
        return confirmBox({ title: 'Restore backup', html: tpl('Replace {0} with the contents of {1}? This cannot be undone. Download a backup first if you are not sure.', [lt('all current data'), f.name]), confirm: 'Replace everything', danger: true }).then(function (ok) {
          if (!ok) return;
          var r = G.restoreBackup(text);
          if (r.loggedOut) { toast('Backup restored. Please sign in again.'); doLogout(); } else { try { G.audit('RESTORE', f.name); } catch (x) { /* ignore */ } toast('Backup restored'); render(); }
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
    if (k === 'addUser') { await G.addUser({ username: fd.get('username'), password: fd.get('password'), role: fd.get('role') }); toast('User added'); render(); }
    else if (k === 'password') { await G.changeOwnPassword(fd.get('current'), fd.get('next'), fd.get('confirm')); form.reset(); toast('Password changed'); }
  } catch (ex) { err.textContent = ex instanceof G.AppError ? ex.message : 'Something went wrong: ' + ex.message; err.hidden = false; }
});
$('#qci-q').addEventListener('input', runQuick);
$('#menu-btn').addEventListener('click', toggleSide);
$('#scrim').addEventListener('click', closeDrawer);
$('#login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var err = $('#login-err'), btn = $('#login-go'); err.hidden = true; btn.disabled = true;
  try {
    await G.login($('#l_user').value, $('#l_pass').value);
    $('#l_pass').value = ''; enterApp();
  } catch (ex) { err.textContent = ex instanceof G.AppError ? ex.message : 'Sign in failed: ' + ex.message; err.hidden = false; }
  finally { btn.disabled = false; }
});

/* ---------- boot ---------- */
export async function boot() {
  applyPrefs();
  $('#boot').hidden = false; $('#boot-msg').textContent = 'Opening Gym Manager Pro';
  Persist.init();
  Persist.onStatus = updateSync;
  Persist.onError = function (err) {
    var code = err && err.code;
    if (code === 'quota_exceeded') toast('The database is full. Delete old data or restore a smaller backup.', 'err');
    else toast('Changes could not be saved' + (code ? ' (' + code + ')' : '') + '.', 'err');
    updateSync();
  };
  try {
    if (!G.Store.readOnly) { await G.ensureDefaultAdmin(); await G.migratePasswords(); }
  } catch (e) { console.error(e); }
  var restored = null;
  try { restored = G.restoreSession(sessionStorage.getItem('gym_uid')); } catch (e) { restored = null; }
  if (restored) enterApp(); else showLogin();
  updateSync();
}
hooks.render = render; hooks.go = go; hooks.logout = doLogout; hooks.setPref = setPref; hooks.toggleTheme = toggleTheme; hooks.checkIn = doCheckIn;

