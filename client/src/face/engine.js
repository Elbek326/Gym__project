import { SIZE, alignMatrix } from './align.js';
import { normalise } from './match.js';
import { estimatePose } from './pose.js';

/* ===== the OpenCV wrapper (opencv.js, WASM, runs in the browser) =====
   Detection: YuNet (cv.FaceDetectorYN, built into opencv.js) gives a box and 5 landmarks per face.
   Recognition: SFace through cv.readNetFromONNX. FaceRecognizerSF is NOT exposed by this opencv.js build, so the face is
   aligned here (similarity transform from the 5 landmarks to the 112x112 template, see align.js, then cv.warpAffine) and
   the net output is the 128-number feature, scaled to unit length.
   The library (~13 MB, WASM inside) is loaded with a dynamic import() the first time a face page needs it, so the main
   bundle does not grow. The two ONNX models come from /models (downloaded at build time, see scripts/fetch-models.mjs).
   Only numbers leave this module: frames are drawn to a canvas, measured and thrown away. */
export const MODEL = 'sface';   /* the tag stored with every descriptor; descriptors of different engines are never compared */

const DETECT_W = 640;        /* the detector sees the frame at this width (faster, and plenty for faces over ~8% of the width) */
const FULL_MAX = 1280;       /* the aligned crop is cut from the frame at up to this width, so a small face keeps its detail */
const SCORE = 0.8, NMS = 0.3, TOP_K = 50, MAX_FACES = 3;
const YUNET = 'face_detection_yunet_2023mar.onnx', SFACE = 'face_recognition_sface_2021dec.onnx';

var loading = null, cv = null, detector = null, net = null, canvas = null, ctx = null, inSize = '';

async function ready(lib) {
  var c = lib.default || lib;
  if (typeof c.then === 'function') return await c;                  /* the build hands back a promise-like that resolves with the module */
  if (!c.Mat) await new Promise(function (r) { c.onRuntimeInitialized = r; });
  return c;
}
/* a dropped connection is retried twice (the SFace model is 37 MB, a flaky line can cut it); a missing file is not */
async function putModel(lib, url, name) {
  var buf, last;
  for (var i = 1; i <= 3 && !buf; i++) {
    try {
      var res = await fetch(url);
      if (!res.ok) throw Object.assign(new Error('Model ' + name + ' not found (' + res.status + ')'), { final: true });
      buf = new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      last = e;
      if (e.final || i === 3) throw e;
      await new Promise(function (r) { setTimeout(r, 1000 * i); });
    }
  }
  if (!buf) throw last;
  lib.FS_createDataFile('/', name, buf, true, false, false);
}

/* a short, plain reason for a failed loadEngine(), shown under the error message (the full error goes to the console) */
export function loadFailReason(e) {
  var m = String((e && (e.message || e)) || '');
  if ((e && e.name === 'EvalError') || /Content Security Policy|unsafe-eval/i.test(m)) return 'Blocked by the site security policy (CSP). Reload the page with Ctrl+F5.';
  if (/^Model .* not found/.test(m)) return m;
  if (e && e.name === 'TypeError' && /fetch|network|load failed/i.test(m)) return 'Network error while downloading the face models.';
  return m.slice(0, 160);
}
function dropFile(lib, name) { try { lib.FS_unlink('/' + name); } catch (e) { /* only frees memory; the net keeps its own copy */ } }

export function loadEngine() {
  if (!loading) {
    loading = (async function () {
      var lib = await ready(await import('@techstark/opencv-js'));
      var url = import.meta.env.BASE_URL + 'models/';
      await Promise.all([putModel(lib, url + YUNET, YUNET), putModel(lib, url + SFACE, SFACE)]);
      var d = new lib.FaceDetectorYN(YUNET, '', new lib.Size(DETECT_W, 360), SCORE, NMS, TOP_K, 0, 0);
      var n = lib.readNetFromONNX(SFACE);
      dropFile(lib, YUNET); dropFile(lib, SFACE);
      cv = lib; detector = d; net = n;
    })();
    loading.catch(function () { loading = null; });   /* a failed load (offline, blocked) can be retried */
  }
  return loading;
}

/* all faces in the video frame: [{ size, descriptor, pose }] where size = box width as a share of the frame width (0..1),
   descriptor = the SFace feature as a plain array of 128 numbers of unit length, and pose = { yaw, pitch } from the 5
   landmarks (see pose.js), or null. At most 3 faces, the most certain ones first. */
export async function detectFaces(video) {
  if (!cv) throw new Error('The face engine is not loaded.');
  var vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return [];
  var W = Math.min(vw, FULL_MAX), H = Math.round(vh * W / vw);
  if (!canvas) { canvas = document.createElement('canvas'); ctx = canvas.getContext('2d', { willReadFrequently: true }); }
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  ctx.drawImage(video, 0, 0, W, H);
  var image = ctx.getImageData(0, 0, W, H);

  var mats = [];   /* every cv.Mat made below is freed in the finally block: WASM memory is not garbage collected */
  function own(m) { mats.push(m); return m; }
  try {
    var rgba = own(cv.matFromImageData(image));
    var rgb = own(new cv.Mat()); cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    var dw = Math.min(W, DETECT_W), dh = Math.round(H * dw / W), scale = W / dw;
    var small = rgb;
    if (dw !== W) { small = own(new cv.Mat()); cv.resize(rgb, small, new cv.Size(dw, dh), 0, 0, cv.INTER_AREA); }
    var bgr = own(new cv.Mat()); cv.cvtColor(small, bgr, cv.COLOR_RGB2BGR);   /* YuNet expects BGR */
    if (inSize !== dw + 'x' + dh) { detector.setInputSize(new cv.Size(dw, dh)); inSize = dw + 'x' + dh; }
    var found = own(new cv.Mat()); detector.detect(bgr, found);

    /* one row per face: x, y, w, h, then 5 landmark pairs (right eye, left eye, nose, right and left mouth corner), then the score */
    var rows = [];
    for (var r = 0; r < found.rows; r++) rows.push(Array.from(found.data32F.subarray(r * 15, r * 15 + 15)));
    rows.sort(function (a, b) { return b[14] - a[14]; });
    var out = [];
    for (var i = 0; i < rows.length && out.length < MAX_FACES; i++) {
      var f = rows[i], pts = [];
      for (var k = 0; k < 5; k++) pts.push({ x: f[4 + 2 * k] * scale, y: f[5 + 2 * k] * scale });   /* back to full-frame pixels */
      var m = alignMatrix(pts.map(function (p) { return [p.x, p.y]; }));
      if (!m) continue;
      var M = own(cv.matFromArray(2, 3, cv.CV_64F, m));
      var crop = own(new cv.Mat()); cv.warpAffine(rgb, crop, M, new cv.Size(SIZE, SIZE), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
      var blob = own(cv.blobFromImage(crop, 1, new cv.Size(SIZE, SIZE), new cv.Scalar(0, 0, 0, 0), false, false));   /* the crop is RGB already, which is what SFace wants */
      net.setInput(blob);
      var feat = own(net.forward());
      out.push({ size: f[2] / dw, descriptor: normalise(Array.from(feat.data32F)), pose: estimatePose(pts) });
    }
    return out;
  } finally {
    for (var j = mats.length - 1; j >= 0; j--) { try { mats[j].delete(); } catch (e) { /* already freed */ } }
  }
}
