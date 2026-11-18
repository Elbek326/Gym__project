import G from './core/gym.js';
import { api } from './api.js';
import { hooks, modals, session, ui } from './state.js';
import { $, esc } from './ui/html.js';
import { ic } from './ui/icons.js';
import { avatar } from './ui/parts.js';
import { denyText } from './pages/daily.js';
import { toast } from './ui/toast.js';

/* ===== arrival notifications =====
   While a STAFF user is signed in, GET /api/daily (today) is polled every POLL_MS. Visits that were not there before are
   announced with a toast and kept in the bell list, so the owner sees a check-in made on another computer (the camera at the
   door, another receptionist). The first poll only fills the "seen" set, so old visits do not fire on load. A new day starts over.
   Unread state lives in memory of this tab. */
const POLL_MS = 12000;
const KEEP = 30;            /* notifications kept in the list */
const LOCAL_MS = 90000;     /* a check-in made on this device is not toasted again by the poll for this long */

var N = { on: false, timer: null, busy: false, date: null, seen: new Set(), seenD: new Set(), list: [], unread: new Set(), local: new Map(), open: false, wired: false };

function wanted() { return !!(session.user && G.isStaff(session.user)); }

/* called by code that checked a member in on THIS device, which already showed its own toast */
export function noteLocalCheckin(memberId) { N.local.set(memberId, Date.now()); }

export function syncNotify() {
  var b = $('#bell-btn');
  if (!wire()) return;
  if (wanted()) { b.hidden = false; if (!N.on) { N.on = true; poll(); } }
  else { N.on = false; clearTimeout(N.timer); N.timer = null; N.date = null; N.seen = new Set(); N.seenD = new Set(); N.list = []; N.unread = new Set(); closePanel(); b.hidden = true; }
  drawBell();
}

function wire() {
  var b = $('#bell-btn'); if (!b) return false;
  if (!N.wired) {
    N.wired = true;
    b.innerHTML = ic('bell') + '<span class="bell-badge" id="bell-badge" hidden></span>';
    document.addEventListener('visibilitychange', function () { if (!document.hidden && N.on) { clearTimeout(N.timer); poll(); } });
    document.addEventListener('click', function (e) { if (N.open && !e.target.closest('#bell-panel, #bell-btn')) closePanel(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && N.open) closePanel(); });
  }
  return true;
}

function schedule() { clearTimeout(N.timer); if (N.on) N.timer = setTimeout(poll, POLL_MS); }

async function poll() {
  if (!N.on || N.busy) return;
  if (document.hidden) { schedule(); return; }   /* a hidden tab asks nothing; the visibility handler polls at once on return */
  N.busy = true;
  try {
    var D = await api.get('/api/daily');
    if (!N.on) return;
    absorb(D);
  } catch (e) { /* offline or signed out: the next round tries again */ }
  finally { N.busy = false; schedule(); }
}

function absorb(D) {
  var visits = (D.visits || []).filter(function (v) { return v.member; }), fresh = [];
  var first = N.date !== D.date;   /* the first poll, or the day changed: only remember */
  if (first) { N.date = D.date; N.seen = new Set(); N.seenD = new Set(); N.list = []; N.unread = new Set(); }
  visits.forEach(function (v) { if (!N.seen.has(v.id)) { N.seen.add(v.id); fresh.push(v); } });
  fresh.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });   /* oldest first, so the newest ends on top */
  var now = Date.now(), shown = 0;
  fresh.forEach(function (v) {
    N.list.unshift({ id: v.id, time: v.time, member: v.member });
    if (first) return;
    if (now - (N.local.get(v.member.id) || 0) < LOCAL_MS) return;   /* this device's own check-in: already toasted */
    N.unread.add(v.id);
    if (++shown <= 3) toast(v.member.name + ' came · ' + v.time, 'ok');   /* a burst (e.g. after being offline) does not flood the screen; the bell lists all */
  });
  /* recognised at the door but not let in: a warning toast and a warn-coloured row */
  var freshD = [];
  (D.denied || []).filter(function (x) { return x.member; }).forEach(function (x) { if (!N.seenD.has(x.id)) { N.seenD.add(x.id); freshD.push(x); } });
  freshD.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
  freshD.forEach(function (x) {
    N.list.unshift({ id: 'd' + x.id, time: x.time, member: x.member, denied: x.reason });
    if (first) return;
    if (now - (N.local.get(x.member.id) || 0) < LOCAL_MS) return;
    N.unread.add('d' + x.id);
    if (++shown <= 3) toast(x.member.name + ' came \u2014 not let in: ' + denyText(x.reason), 'err');
  });
  if (N.list.length > KEEP) N.list.length = KEEP;
  drawBell();
  if (!first && (fresh.length || freshD.length)) refreshPage();
}

/* the dashboard and the arrivals page show today's check-ins: draw them again, unless a form is open; scroll stays */
async function refreshPage() {
  if ((ui.route.page !== 'dashboard' && ui.route.page !== 'daily') || modals.length || !hooks.render) return;
  var y = window.scrollY;
  try { await hooks.render(); } catch (e) { /* the page shows its own error */ }
  window.scrollTo(0, y);
}

function drawBell() {
  var b = $('#bell-btn'); if (!b) return;
  var n = N.unread.size, badge = $('#bell-badge');
  if (badge) { badge.hidden = !n; badge.textContent = n > 9 ? '9+' : String(n); }
  var lbl = 'Notifications';
  if (b.getAttribute('aria-label') !== lbl) { b.setAttribute('aria-label', lbl); b.setAttribute('title', lbl); }
  b.setAttribute('aria-expanded', N.open ? 'true' : 'false');
  if (N.open) drawPanel();
}

export function toggleBell() { if (N.open) closePanel(); else { N.open = true; drawBell(); } }
export function markAllRead() { N.unread.clear(); drawBell(); }
export function closePanel() {
  N.open = false;
  var p = $('#bell-panel'); if (p) p.remove();
  var b = $('#bell-btn'); if (b) b.setAttribute('aria-expanded', 'false');
}

function drawPanel() {
  var p = $('#bell-panel');
  if (!p) { p = document.createElement('div'); p.id = 'bell-panel'; p.className = 'bell-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Notifications'); document.body.appendChild(p); }
  p.innerHTML = '<header><b>Notifications</b><button type="button" class="btn btn-sm" data-act="bellRead"' + (N.unread.size ? '' : ' disabled') + '>Mark all as read</button></header>' +
    (N.list.length ? '<div class="list">' + N.list.map(function (r) {
      return '<button type="button" class="bell-row' + (N.unread.has(r.id) ? ' unread' : '') + (r.denied ? ' denied' : '') + '" data-act="bellOpen" data-id="' + esc(r.member.id) + '">' + avatar(r.member) +
        '<span class="grow">' + esc(r.member.name) + (r.denied ? '<small class="deny">' + denyText(r.denied) + '</small>' : '') + '</span><span class="mono muted">' + esc(r.time) + '</span></button>';
    }).join('') + '</div>' : '<div class="empty"><b>No arrivals yet today</b></div>') +
    '<footer><button type="button" class="btn btn-sm" data-act="bellAll">All arrivals</button></footer>';
}
