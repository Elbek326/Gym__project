import G from '../core/gym.js';
import { api, enc } from '../api.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { $ } from '../ui/html.js';
import { startCamera, stopCamera } from './camera.js';
import { detectFaces, loadEngine } from './engine.js';
import { distance, THRESHOLD } from './match.js';
import { refreshFaces } from './watcher.js';

/* ===== enrolment: five automatic shots of one face, then PUT /api/members/:id/face =====
   Only 128 numbers per shot leave the browser; the picture itself is never kept or sent. */
export const SHOTS = 5;
const MIN_SIZE = 0.15;      /* the face must fill at least this share of the frame width */
const PAUSE = 800;          /* ms between two shots, so they are not the same instant */
const GIVE_UP = 45000;      /* ms without five good shots */

/* what to do for each shot: the small head turns give the matcher several views of the same face */
const HINTS = ['Look straight at the camera', 'Turn your head slightly to the left', 'Turn your head slightly to the right', 'Look straight again', 'Tilt your head slightly up'];
function ask(n) { return HINTS[n] + '. ' + n + '/' + SHOTS; }

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
        var shots = [], started = Date.now();
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
          if (shots.length && distance(f.descriptor, shots[0]) > THRESHOLD) { hint.textContent = 'The face changed. Keep the same person in front of the camera. ' + shots.length + '/' + SHOTS; await wait(300); continue; }
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
