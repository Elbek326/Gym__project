/* ===== camera access: getUserMedia with readable errors, and one registry so no camera is ever left running ===== */
var open = new Set();

/* start the user-facing camera and show it in `video`. Throws an Error whose message is a ready-to-show English text. */
export async function startCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(window.isSecureContext === false ? 'The camera needs a secure (https) connection.' : 'Camera not available in this browser.');
  }
  var stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
  } catch (e) { throw new Error(cameraMessage(e)); }
  open.add(stream);
  video.muted = true; video.playsInline = true; video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay can be refused until the first tap; the stream is still attached */ }
  return stream;
}
export function cameraMessage(e) {
  var n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'Camera permission denied. Allow the camera for this site and try again.';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'No camera found on this device.';
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return 'The camera is busy or not working. Close other apps that use it and try again.';
  return 'Camera not available.';
}
export function stopCamera(stream, video) {
  if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); open.delete(stream); }
  if (video && video.srcObject) video.srcObject = null;
}
/* sign-out, a lost session or leaving the page: every camera off */
export function stopAllCameras() {
  open.forEach(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); });
  open.clear();
}
