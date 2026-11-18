/* Copies the face-api model files from node_modules into public/models, so Vite serves them (and puts them in dist/).
   The binaries are not committed (public/models is git-ignored); "predev" and "prebuild" run this. */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@vladmandic', 'face-api', 'model');
const to = join(root, 'public', 'models');
/* TinyFaceDetector (finds faces), the full 68-point landmarks (aligns them; more accurate than the tiny net),
   FaceRecognitionNet (128 numbers per face) */
const NAMES = ['tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model'];

if (!existsSync(from)) { console.error('copy-models: ' + from + ' not found. Run npm install first.'); process.exit(1); }
mkdirSync(to, { recursive: true });
let bytes = 0;
for (const n of NAMES) {
  for (const f of [n + '-weights_manifest.json', n + '.bin']) {
    copyFileSync(join(from, f), join(to, f));
    bytes += statSync(join(to, f)).size;
  }
}
console.log('copy-models: ' + NAMES.length * 2 + ' files, ' + (bytes / 1048576).toFixed(1) + ' MB -> public/models');
