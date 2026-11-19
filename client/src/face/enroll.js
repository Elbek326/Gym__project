import G from '../core/gym.js';
import { api, enc } from '../api.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { $ } from '../ui/html.js';
import { startCamera, stopCamera } from './camera.js';
import { detectFaces, loadEngine } from './engine.js';
import { distance, mean, normalise, THRESHOLD } from './match.js';
import { poseMatches } from './pose.js';
import { refreshFaces } from './watcher.js';

/* ===== enrolment: eight automatic shots of one face in different head poses, then PUT /api/members/:id/face =====
   Only 128 numbers per shot leave the browser; the picture itself is never kept or sent. */
export const SHOTS = 8;
const MIN_SIZE = 0.15;      /* the face must fill at least this share of the frame width */
const PAUSE = 800;          /* ms between two shots, so they are not the same instant */
const GIVE_UP = 75000;      /* ms without all the shots (turning the head takes longer than staring ahead) */
const SAME_FACE = 0.7;      /* a turned head may be this far from the mean of the frontal shots; further = a different person */
const SAME_FACE_FRONT = THRESHOLD;   /* a frontal shot must be as close as a live match would need */

/* what to do for each shot. "left" and "right" are the person's OWN left and right (the preview is mirrored like a mirror, so
   the face moves the same way on screen). Each shot is taken only when the measured head pose matches (see pose.js). */
const STEPS = [
  { pose: 'straight',    hint: 'Look straight at the camera' },
  { pose: 'left',        hint: 'Turn your head to the left' },
  { pose: 'right',       hint: 'Turn your head to the right' },
  { pose: 'straight',    hint: 'Look straight again' },
  { pose: 'up',          hint: 'Tilt your head up' },
  { pose: 'down',        hint: 'Tilt your head down' },
  { pose: 'slightLeft',  hint: 'Turn your head slightly to the left' },
  { pose: 'slightRight', hint: 'Turn your head slightly to the right' }
];
function ask(n) { return STEPS[n].hint + '. ' + n + '/' + SHOTS; }

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

export function openEnroll(member, onDone) {
  var stream = null, video = null, closed = false, camErr = null, engineErr = null, m_sync = null;
  var m = openModal({
    title: 'Enrol face', wide: true, submit: 'Start',
    body: '<div class="fc-stage fe-stage"><video id="fe-video" playsinline muted></video><div class="fc-over" id="fe-over" role="status"></div></div>' +
      '<p class="fe-hint" id="fe-hint" role="status" aria-live="polite">Starting the camera</p>' +
      '<label class="fe-consent"><input type="checkbox" name="consent" id="fe-consent"><span>The member agreed to face check-in. Only face measurements are stored, not photos.</span></label>',
    onOpen: function (wrap, form) {
      video = $('#fe-video', wrap);
      var btn = $('[type=submit]', form), box = $('#fe-consent', wrap), hint = $('#fe-hint', wrap), over = $('#fe-over', wrap);
      function sync() { btn.disabled = !box.checked; }
      sync(); box.addEventListener('change', sync);
      m_sync = sync;
      startCamera(video).then(function (s) {
        if (closed) { stopCamera(s, video); return; }
        stream = s; hint.textContent = 'Loading face models';
      }, function (e) { camErr = e; over.textContent = e.message; over.hidden = false; hint.textContent = ''; });
      loadEngine().then(function () { if (!camErr && !closed) hint.textContent = 'Tick the box, then press Start and look at the camera.'; },
        function (e) { engineErr = e; if (!closed) hint.textContent = 'Could not load the face models. Check the connection and try again.'; });
    },
    onClose: function () { closed = true; stopCamera(stream, video); },
    onSubmit: async function (fd, form) {
      var hint = $('#fe-hint', form);
      try {
        if (!fd.get('consent')) throw new G.AppError('Tick the box first: the member must agree to face check-in.');
        if (camErr) throw new G.AppError(camErr.message);
        if (!stream) throw new G.AppError('The camera is still starting. Try again in a moment.');
        if (engineErr) throw new G.AppError('Could not load the face models. Check the connection and try again.');
        await loadEngine();
        var shots = [], front = [], pitchBase = null, started = Date.now();
        hint.textContent = ask(0);
        while (shots.length < SHOTS) {
          if (closed) return false;
          if (Date.now() - started > GIVE_UP) throw new G.AppError('No clear face was found. Face the camera in good light and try again.');
          var faces;
          try { faces = await detectFaces(video); } catch (e) { throw new G.AppError('Face detection failed. Reload the page and try again.'); }
          if (faces.length === 0) { hint.textContent = 'No face found. Look at the camera. ' + shots.length + '/' + SHOTS; await wait(300); continue; }
          if (faces.length > 1) { hint.textContent = 'One person at a time. ' + shots.length + '/' + SHOTS; await wait(300); continue; }
          var f = faces[0];
          if (f.size < MIN_SIZE) { hint.textContent = 'Come a little closer. ' + shots.length + '/' + SHOTS; await wait(300); continue; }
          var step = STEPS[shots.length];
          if (!f.pose) { hint.textContent = ask(shots.length); await wait(300); continue; }
          /* pitch has a different neutral value for every face: the first frontal shot sets it */
          if (!poseMatches(step.pose, f.pose, pitchBase != null ? pitchBase : f.pose.pitch)) { hint.textContent = ask(shots.length); await wait(200); continue; }
          /* same person as the frontal shots so far? (a turned head moves further from them, so its limit is looser) */
          if (front.length) {
            var ref = normalise(mean(front)), lim = step.pose === 'straight' ? SAME_FACE_FRONT : SAME_FACE;
            if (distance(f.descriptor, ref) > lim) { hint.textContent = 'The face changed. Keep the same person in front of the camera. ' + shots.length + '/' + SHOTS; await wait(300); continue; }
          }
          if (step.pose === 'straight') { front.push(f.descriptor); if (pitchBase == null) pitchBase = f.pose.pitch; }
          shots.push(f.descriptor);
          hint.textContent = 'Shot ' + shots.length + '/' + SHOTS + '.';
          if (shots.length < SHOTS) { await wait(PAUSE); hint.textContent = ask(shots.length); }
        }
        if (closed) return false;
        await api.put('/api/members/' + enc(member.id) + '/face', { consent: true, descriptors: shots });
        toast('Face saved');
        refreshFaces();   /* the camera in the background knows the new face at once */
        if (onDone) onDone();
        return true;
      } finally {
        setTimeout(function () { if (!closed && m_sync) m_sync(); }, 0);   /* the modal re-enables its button after a failure; the consent box still decides */
      }
    }
  });
  return m;
}
