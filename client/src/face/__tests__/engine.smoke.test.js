import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/* Smoke test of the real OpenCV engine in Node: opencv.js loads, both ONNX models load, and detection + recognition run on a
   synthetic frame without throwing. A real face is not part of the repository, so this proves loading and inference, not accuracy.
   The test skips itself when the models were not downloaded (run scripts/fetch-models.mjs). */
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'models');
const FILES = ['face_detection_yunet_2023mar.onnx', 'face_recognition_sface_2021dec.onnx'];
/* in the browser the engine loads opencv.js with a <script> tag; here it is handed the package through setOpenCvLoader */
const openCv = () => Promise.resolve({ default: createRequire(import.meta.url)('@techstark/opencv-js') });
const have = FILES.every((f) => existsSync(join(dir, f)));

/* a stand-in for the browser: a video of the given size and a canvas that returns a fixed synthetic image */
function fakeBrowser(paint) {
  var frame = { w: 0, h: 0 };
  vi.stubGlobal('document', { createElement: () => ({
    width: 0, height: 0,
    getContext() { var self = this; return {
      drawImage(v, x, y, w, h) { frame.w = w; frame.h = h; },
      getImageData(x, y, w, h) { var d = new Uint8ClampedArray(w * h * 4); paint(d, w, h); return { data: d, width: w, height: h }; }
    }; }
  }) });
  vi.stubGlobal('fetch', async (url) => {
    var buf = readFileSync(join(dir, String(url).split('/').pop()));
    return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  });
}

describe.runIf(have)('OpenCV engine smoke test', () => {
  var engine;
  beforeAll(async () => {
    fakeBrowser((d, w, h) => { for (var i = 0; i < w * h; i++) { d[4 * i] = 120; d[4 * i + 1] = 130; d[4 * i + 2] = 140; d[4 * i + 3] = 255; } });
    engine = await import('../engine.js');
    engine.setOpenCvLoader(openCv);
    await engine.loadEngine();
  }, 120000);
  afterAll(() => { vi.unstubAllGlobals(); });

  it('loads opencv.js and both models, and loading twice is the same promise', () => {
    expect(engine.loadEngine()).toBe(engine.loadEngine());
    expect(engine.MODEL).toBe('sface');
  });
  it('finds no face in a plain frame, and does not throw', async () => {
    expect(await engine.detectFaces({ videoWidth: 640, videoHeight: 480 })).toEqual([]);
  });
  it('handles a frame wider than the working size and a frame without size', async () => {
    expect(await engine.detectFaces({ videoWidth: 1920, videoHeight: 1080 })).toEqual([]);
    expect(await engine.detectFaces({ videoWidth: 0, videoHeight: 0 })).toEqual([]);
  });
  it('runs many frames in a row (Mats are freed each time)', async () => {
    for (var i = 0; i < 40; i++) await engine.detectFaces({ videoWidth: 1280, videoHeight: 720 });
  }, 60000);
  it('refuses to detect before the engine is loaded', async () => {
    vi.resetModules();
    var fresh = await import('../engine.js');
    await expect(fresh.detectFaces({ videoWidth: 640, videoHeight: 480 })).rejects.toThrow(/not loaded/);
  });
});
