/* Downloads the two OpenCV Zoo models into public/models when they are missing (github.com/opencv/opencv_zoo):
   YuNet (finds faces + 5 landmarks) and SFace (128 numbers per aligned face).
   The binaries are not committed (public/models is git-ignored); "predev" and "prebuild" run this. After the first
   download nothing is needed from the network again, and the app itself never calls an external service.
   Each file is checked against a pinned SHA-256, so a truncated or replaced download is never served. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const to = join(root, 'public', 'models');
const BASE = 'https://github.com/opencv/opencv_zoo/raw/main/models/';
const MODELS = [
  { file: 'face_detection_yunet_2023mar.onnx', path: 'face_detection_yunet/', sha: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4' },
  { file: 'face_recognition_sface_2021dec.onnx', path: 'face_recognition_sface/', sha: '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79' }
];
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url) {
  let last;
  for (let i = 1; i <= 4; i++) {   /* the connection to github.com is flaky on some networks: try a few times */
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(300000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) { last = e; await sleep(1500 * i); }
  }
  throw new Error(last && last.cause && last.cause.code ? last.cause.code : last && last.message);
}

mkdirSync(to, { recursive: true });
let failed = false;
for (const m of MODELS) {
  const dest = join(to, m.file);
  if (existsSync(dest) && sha(readFileSync(dest)) === m.sha) continue;
  try {
    console.log('fetch-models: downloading ' + m.file);
    const buf = await download(BASE + m.path + m.file);
    if (sha(buf) !== m.sha) throw new Error('the checksum does not match (' + buf.length + ' bytes)');
    writeFileSync(dest + '.part', buf); renameSync(dest + '.part', dest);   /* never leave a half-written model behind */
    console.log('fetch-models: ' + m.file + ' ' + (buf.length / 1048576).toFixed(2) + ' MB');
  } catch (e) {
    failed = true;
    console.error('fetch-models: could not get ' + m.file + ' (' + e.message + '). Download it from ' + BASE + m.path + ' into ' + to);
  }
}
if (failed) process.exit(1);
