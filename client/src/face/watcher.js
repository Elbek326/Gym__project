import G from '../core/gym.js';
import { api, enc } from '../api.js';
import { PREFS, savePrefs } from '../prefs.js';
import { hooks, session, ui } from '../state.js';
import { $, esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { startCamera, stopCamera } from './camera.js';
import { detectFaces, loadEngine } from './engine.js';
import { createStabilizer, matchFace } from './match.js';

/* ===== the background camera =====
   While a STAFF user is signed in on this device and PREFS.faceCam is on, a small floating preview runs the camera on every
   page. One enrolled face that wins 2 of the last 3 frames is checked in with the normal POST /api/members/:id/checkin
   (every server rule still applies) and the result is a toast. Off (toggle, sign-out, a member signing in) = tracks stopped.
   The face library is a dynamic import inside engine.js, so nothing is downloaded until the camera is turned on. */
const INTERVAL = 300;       /* ms between detections */
const COOLDOWN = 60000;     /* the same member is not sent again for this long */
const RELOAD_MS = 60000;    /* the enrolled faces are fetched again this often while the camera runs */
const MIN_FACE = 0.08;      /* faces narrower than this share of the frame width are background people and are ignored */

var S = { token: 0, starting: false, stream: null, timer: null, reloadTimer: null, faces: [], ready: false, folded: false, cool: new Map(), stab: createStabilizer(), status: '', diag: '', camError: null, note: '', audio: null, built: false };

/* the person at the keyboard may use the camera: staff only, and only when they switched it on */
function wanted() { return !!(session.user && G.isStaff(session.user) && PREFS.faceCam); }

function build() {
  if (S.built) return; S.built = true;
  var el = document.createElement('div');
  el.id = 'fcam'; el.className = 'fcam'; el.hidden = true;
  el.innerHTML = '<button type="button" class="fcam-dot" data-act="camFold" id="fcam-dot" aria-label="Hide camera">' + ic('camera') + '</button>' +
    '<div class="fcam-box" id="fcam-box"><div class="fcam-stage"><video id="fcam-video" playsinline muted></video><div class="fcam-over" id="fcam-over" hidden></div></div>' +
    '<div class="fcam-foot"><span class="fcam-status" id="fcam-status" role="status" aria-live="polite"></span>' +
    '<button type="button" class="btn btn-sm icon-btn" data-act="camFold" aria-label="Hide camera">' + ic('x') + '</button></div>' +
    '<div class="fcam-diag" id="fcam-diag"></div></div>';
  document.body.appendChild(el);
  document.addEventListener('visibilitychange', function () { if (S.stream) drawStatus(); });
}

/* make the camera match the situation: called after sign-in, sign-out and every toggle (safe to call any time) */
export function syncWatcher() {
  build();
  if (wanted()) { if (!S.stream && !S.starting) start(); }
  else stop();
  drawWidget(); drawButton();
}
export function toggleCamera() {
  if (!(session.user && G.isStaff(session.user))) return;
  PREFS.faceCam = !PREFS.faceCam; savePrefs();
  if (PREFS.faceCam) S.folded = false;
  syncWatcher();
}
export function foldCamera() { S.folded = !S.folded; drawWidget(); }
export function retryCamera() { stop(); if (wanted()) start(); drawWidget(); }

function stop() {
  S.token++; S.starting = false; clearTimeout(S.timer); S.timer = null; clearInterval(S.reloadTimer); S.reloadTimer = null;
  stopCamera(S.stream, $('#fcam-video')); S.stream = null; S.ready = false;
  S.status = ''; S.diag = ''; S.camError = null; S.note = ''; S.stab.reset();
  /* the cooldown list is kept: switching the camera off and on does not re-send the person standing there */
}

/* the enrolled faces (id, name, image, descriptors) used for matching; also called right after an enrolment */
export async function refreshFaces() {
  if (!wanted()) return;
  try { S.faces = await api.get('/api/faces'); } catch (e) { /* keep the old list; try again in a minute */ }
  drawStatus();
}

async function start() {
  var my = ++S.token, video = $('#fcam-video');
  S.starting = true; S.camError = null; S.ready = false; S.stab.reset(); S.status = ''; S.diag = '';
  note('Starting the camera');
  var faces = refreshFaces();
  var engine = loadEngine(); engine.catch(function () { /* reported below */ });   /* the models load while the permission is asked */
  var stream;
  try { stream = await startCamera(video); }
  catch (e) { if (my === S.token) { S.starting = false; S.camError = e.message; note(''); } return; }
  if (my !== S.token) { stopCamera(stream, video); return; }
  S.stream = stream; S.starting = false;
  note('Loading face models');
  try { await engine; }
  catch (e) { if (my === S.token) { S.camError = 'Could not load the face models. Check the connection and try again.'; note(''); } return; }
  await faces;
  if (my !== S.token) return;
  S.ready = true; note('');
  clearInterval(S.reloadTimer); S.reloadTimer = setInterval(refreshFaces, RELOAD_MS);
  tick(my);
}

function tick(my) {
  if (my !== S.token) return;
  S.timer = null;
  detectOnce(my).catch(function (e) { console.error(e); }).then(function () {
    if (my === S.token) S.timer = setTimeout(function () { tick(my); }, INTERVAL);
  });
}

async function detectOnce(my) {
  var video = $('#fcam-video');
  if (!S.ready || !video || video.readyState < 2) return;
  var faces = await detectFaces(video);
  if (my !== S.token) return;
  var real = faces.filter(function (f) { return f.size >= MIN_FACE; });
  if (real.length > 1) { S.stab.reset(); setDiag(''); setStatus('One person at a time'); return; }
  if (!real.length) { setDiag(''); setStatus(S.faces.length ? '' : 'No member has enrolled a face yet.'); return; }   /* no face: the streak is kept */
  if (!S.faces.length) { setStatus('No member has enrolled a face yet.'); return; }
  var m = matchFace(real[0].descriptor, S.faces);
  setDiag('best: ' + (isFinite(m.distance) ? m.distance.toFixed(2) : '-') + ' (' + m.reason + ')');
  var id = S.stab.push(m.id);
  if (id) { setStatus(''); fire(id); return; }
  setStatus(m.id ? 'Recognising' : 'Not recognised');
}

async function fire(id) {
  var who = S.faces.find(function (f) { return f.id === id; }); if (!who) return;
  var now = Date.now();
  if ((S.cool.get(id) || 0) > now) return;
  S.cool.set(id, now + COOLDOWN);
  try {
    var r = await api.post('/api/members/' + enc(id) + '/checkin');
    var left = r.sub.sub_type === 'sessions' ? r.remaining + (r.remaining === 1 ? ' session left' : ' sessions left') : r.remaining + (r.remaining === 1 ? ' day left' : ' days left');
    toast(who.name + ' came — ' + left, 'ok'); beep(true);
    if (ui.route.page === 'daily' && hooks.render) hooks.render();   /* the arrivals list shows the new visit */
  } catch (e) {
    if (e && e.signedOut) return;
    toast(e && e.message ? e.message : 'Something went wrong.', 'err'); beep(false);
  }
  S.stab.reset();
}

/* ----- drawing: the widget lives outside #view, so a page repaint never touches it ----- */
function note(t) { S.note = t; drawWidget(); }
function setStatus(t) { if (S.status !== t) { S.status = t; drawStatus(); } }
function setDiag(t) { if (S.diag !== t) { S.diag = t; var el = $('#fcam-diag'); if (el) el.textContent = t; } }
function drawStatus() {
  var el = $('#fcam-status'); if (!el) return;
  var t = document.hidden && S.stream ? 'Keep this tab open' : S.status;
  if (el.dataset.t !== t) { el.dataset.t = t; el.textContent = t; }
  var dot = $('#fcam-dot'); if (dot) dot.dataset.s = S.camError ? 'bad' : S.ready ? 'ok' : 'wait';
}
function drawWidget() {
  var el = $('#fcam'); if (!el) return;
  el.hidden = !wanted(); el.classList.toggle('folded', S.folded);
  var over = $('#fcam-over');
  if (S.camError) { over.innerHTML = '<p>' + esc(S.camError) + '</p><button type="button" class="btn btn-sm btn-primary" data-act="camRetry">Try again</button>'; over.hidden = false; }
  else if (S.note) { over.innerHTML = '<p>' + esc(S.note) + '</p>'; over.hidden = false; }
  else { over.hidden = true; over.innerHTML = ''; }
  var dot = $('#fcam-dot'), lbl = S.folded ? 'Show camera' : 'Hide camera';
  if (dot && dot.getAttribute('aria-label') !== lbl) dot.setAttribute('aria-label', lbl);
  drawStatus();
}
/* the topbar button: staff only; its label names what a press does */
function drawButton() {
  var b = $('#cam-btn'); if (!b) return;
  var staff = !!(session.user && G.isStaff(session.user));
  b.hidden = !staff;
  var on = staff && !!PREFS.faceCam, lbl = on ? 'Camera off' : 'Camera on';
  if (!b.firstChild) b.innerHTML = ic('camera');
  b.classList.toggle('on', on);
  if (b.getAttribute('aria-label') !== lbl) { b.setAttribute('aria-label', lbl); b.setAttribute('title', lbl); }
}

/* a short tone: higher for success, lower for a refusal. Sound is optional, so any failure is ignored. */
function beep(ok) {
  try {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!S.audio) S.audio = new AC();
    if (S.audio.state === 'suspended') S.audio.resume();
    var o = S.audio.createOscillator(), g = S.audio.createGain(), t = S.audio.currentTime;
    o.frequency.value = ok ? 880 : 220; o.type = 'sine';
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + (ok ? 0.18 : 0.35));
    o.connect(g); g.connect(S.audio.destination); o.start(t); o.stop(t + 0.4);
  } catch (e) { /* no sound */ }
}
