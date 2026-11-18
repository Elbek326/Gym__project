/* ===== the face-api wrapper =====
   The library (tfjs inside, ~1.3 MB) is loaded with a dynamic import() the first time a face page needs it, so the main
   bundle does not grow. Models come from /models (copied from node_modules at build time, see scripts/copy-models.mjs). */
var loading = null, faceapi = null;

export function loadEngine() {
  if (!loading) {
    loading = (async function () {
      var lib = await import('@vladmandic/face-api');
      try { await lib.tf.setBackend('webgl'); } catch (e) { console.warn('WebGL backend not available, using the default one', e); }
      await lib.tf.ready();
      var url = import.meta.env.BASE_URL + 'models';
      await Promise.all([lib.nets.tinyFaceDetector.loadFromUri(url), lib.nets.faceLandmark68Net.loadFromUri(url), lib.nets.faceRecognitionNet.loadFromUri(url)]);
      faceapi = lib;
    })();
    loading.catch(function () { loading = null; });   /* a failed load (offline, blocked) can be retried */
  }
  return loading;
}

var OPTS = null;
/* all faces in the video frame: [{ size, descriptor }] where size = box width as a share of the frame width (0..1) */
export async function detectFaces(video) {
  if (!faceapi) throw new Error('The face engine is not loaded.');
  if (!OPTS) OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
  var w = video.videoWidth || 1;
  var res = await faceapi.detectAllFaces(video, OPTS).withFaceLandmarks(false).withFaceDescriptors();
  return res.map(function (r) { return { size: r.detection.box.width / w, descriptor: Array.from(r.descriptor) }; });
}
