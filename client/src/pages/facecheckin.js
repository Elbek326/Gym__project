import { api, enc } from '../api.js';
import { stopCamera, startCamera } from '../face/camera.js';
import { detectFaces, loadEngine } from '../face/engine.js';
import { createStabilizer, matchFace } from '../face/match.js';
import { $, esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { avatar } from '../ui/parts.js';

/* ===== Face check-in: the reception screen =====
   Fully automatic: when one enrolled face wins 3 frames in a row, the normal POST /api/members/:id/checkin is sent
   (every server rule still applies) and a big result card shows for a few seconds. The camera runs only while this
   page is open: leaving the page, a sign-out or a lost session calls stopFaceCheckin(). */
const INTERVAL = 300;       /* ms between detections */
const COOLDOWN = 60000;     /* the same member is not sent again for this long */
const RESULT_MS = 4000;     /* how long the result card stays */
const MIN_FACE = 0.12;      /* faces narrower than this share of the frame are background people and are ignored */

var S = { token: 0, stream: null, timer: null, faces: [], facesState: 'loading', ready: false, cool: new Map(), stab: createStabilizer(), result: null, resultTimer: null, status: '', camError: null, audio: null };

export function pFaceCheckin() {
  return '<section class="card"><header class="fc-head"><h3>Face check-in</h3><span class="chip plain" id="fc-count" role="status"></span>' +
    '<button type="button" class="btn btn-sm" data-act="faceReload">Reload list</button></header>' +
    '<div class="body fc-body"><div class="fc-stage"><video id="fc-video" playsinline muted></video>' +
    '<div class="fc-over" id="fc-over" role="status" hidden></div><div class="fc-result-host" id="fc-result" aria-live="assertive"></div></div>' +
    '<p class="fc-status" id="fc-status" role="status" aria-live="polite"></p>' +
    '<p class="small muted fc-note">' + ic('camera') + 'Stand in front of the camera, one person at a time. The camera is used only on this page.</p></div></section>';
}

/* called after every paint of the page: bind the (new) elements; keep a running camera instead of restarting it */
export function afterFaceCheckin() {
  var video = $('#fc-video');
  if (S.stream && video) {
    video.muted = true; video.srcObject = S.stream; video.play().catch(function () { /* needs a tap */ });
    drawCount(); drawStatus(); drawOver(S.ready || S.camError ? '' : 'Loading face models'); drawResult();
    return;
  }
  startFaceCheckin();
}

export function stopFaceCheckin() {
  S.token++; clearTimeout(S.timer); S.timer = null; clearTimeout(S.resultTimer); S.resultTimer = null;
  stopCamera(S.stream, $('#fc-video')); S.stream = null; S.ready = false;
  S.result = null; S.status = ''; S.camError = null; S.stab.reset();
  /* the cooldown list is kept on purpose: coming back to the page does not re-send the person standing there */
}

export function retryFaceCheckin() { stopFaceCheckin(); startFaceCheckin(); }

export async function reloadFaces() {
  S.facesState = 'loading'; drawCount();
  try { S.faces = await api.get('/api/faces'); S.facesState = 'ok'; }
  catch (e) { S.facesState = 'error'; }
  drawCount();
  if (S.facesState === 'ok') { S.status = S.faces.length ? '' : 'No member has enrolled a face yet.'; drawStatus(); }
}

async function startFaceCheckin() {
  var my = ++S.token, video = $('#fc-video');
  S.camError = null; S.ready = false; setStatus(''); S.stab.reset();
  drawOver('Starting the camera');
  var faces = reloadFaces();
  var engine = loadEngine(); engine.catch(function () { /* reported below */ });   /* models load while the camera permission is being asked */
  try { S.stream = await startCamera(video); }
  catch (e) { if (my === S.token) { S.camError = e.message; drawOver(); } return; }
  if (my !== S.token) { stopCamera(S.stream, video); S.stream = null; return; }
  drawOver('Loading face models');
  try { await engine; }
  catch (e) { if (my === S.token) { S.camError = 'Could not load the face models. Check the connection and try again.'; drawOver(); } return; }
  await faces;
  if (my !== S.token) return;
  S.ready = true; drawOver();
  if (!S.faces.length && S.facesState === 'ok') setStatus('No member has enrolled a face yet.');
  tick(my);
}

function tick(my) {
  if (my !== S.token) return;
  S.timer = null;
  var run = S.ready && !document.hidden && Date.now() >= (S.result ? S.result.until : 0) ? detectOnce(my) : Promise.resolve();
  run.catch(function (e) { console.error(e); }).then(function () {
    if (my === S.token) S.timer = setTimeout(function () { tick(my); }, INTERVAL);
  });
}

async function detectOnce(my) {
  var video = $('#fc-video');
  if (!video || video.readyState < 2) return;
  var faces = await detectFaces(video);
  if (my !== S.token) return;
  var real = faces.filter(function (f) { return f.size >= MIN_FACE; });
  if (real.length > 1) { S.stab.reset(); setStatus('One person at a time'); return; }
  if (!real.length) { S.stab.reset(); setStatus(S.faces.length ? '' : 'No member has enrolled a face yet.'); return; }
  if (!S.faces.length) { setStatus('No member has enrolled a face yet.'); return; }
  var m = matchFace(real[0].descriptor, S.faces);
  var id = S.stab.push(m.id);
  if (id) { setStatus(''); fire(id); return; }
  setStatus(m.id ? 'Recognising' : 'Not recognised');
}

async function fire(id) {
  var who = S.faces.find(function (f) { return f.id === id; }); if (!who) return;
  var now = Date.now();
  if ((S.cool.get(id) || 0) > now) return;
  S.cool.set(id, now + COOLDOWN);
  var res;
  try {
    var r = await api.post('/api/members/' + enc(id) + '/checkin');
    var left = r.sub.sub_type === 'sessions' ? r.remaining + (r.remaining === 1 ? ' session left' : ' sessions left') : r.remaining + (r.remaining === 1 ? ' day left' : ' days left');
    res = { ok: true, who: who, title: 'Checked in', text: left };
  } catch (e) {
    if (e && e.signedOut) return;
    res = { ok: false, who: who, title: who.name, text: e && e.message ? e.message : 'Something went wrong.' };
  }
  showResult(res);
}

function showResult(res) {
  res.until = Date.now() + RESULT_MS; S.result = res; S.stab.reset();
  drawResult(); beep(res.ok);
  clearTimeout(S.resultTimer);
  S.resultTimer = setTimeout(function () { S.result = null; drawResult(); }, RESULT_MS);
}

function setStatus(t) { if (S.status !== t) { S.status = t; drawStatus(); } }
function drawStatus() { var el = $('#fc-status'); if (el) el.textContent = S.status; }
function drawCount() {
  var el = $('#fc-count'); if (!el) return;
  var n = S.faces.length;
  el.textContent = S.facesState === 'loading' ? 'Loading members' : S.facesState === 'error' ? 'Could not load the members' : n + (n === 1 ? ' member enrolled' : ' members enrolled');
  el.className = 'chip plain' + (S.facesState === 'error' ? ' bad' : '');
}
/* the overlay over the camera: a short note while starting, or the camera problem with a retry button */
function drawOver(note) {
  var el = $('#fc-over'); if (!el) return;
  if (S.camError) { el.innerHTML = '<p>' + esc(S.camError) + '</p><button type="button" class="btn btn-primary" data-act="faceRetry">Try again</button>'; el.hidden = false; }
  else if (note) { el.innerHTML = '<p>' + esc(note) + '</p>'; el.hidden = false; }
  else { el.hidden = true; el.innerHTML = ''; }
}
function drawResult() {
  var el = $('#fc-result'); if (!el) return;
  var r = S.result;
  if (!r) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="fc-result ' + (r.ok ? 'ok' : 'bad') + '">' + avatar(r.who, true) +
    '<div class="fc-r-t"><b>' + esc(r.who.name) + '</b><span class="fc-r-h">' + esc(r.ok ? r.title : r.text) + '</span>' + (r.ok ? '<span class="fc-r-s">' + esc(r.text) + '</span>' : '') + '</div></div>';
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
