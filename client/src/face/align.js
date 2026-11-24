/* ===== SFace alignment: pure functions, no DOM and no library =====
   SFace expects a 112x112 face whose 5 landmarks sit at fixed places (the same template OpenCV's FaceRecognizerSF.alignCrop
   uses). The build of opencv.js we ship does not expose FaceRecognizerSF, so the crop is made with cv.warpAffine and the
   similarity transform computed here. Point order is YuNet's: right eye, left eye, nose tip, right and left mouth corner
   ("right" = the person's own right, which is the LEFT side of the raw frame). */
export var TEMPLATE = [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]];
export var SIZE = 112;

/* Least-squares similarity transform (rotation + uniform scale + translation, no reflection) taking `src` points onto `dst`
   points, both [[x, y], ...] of the same length >= 2. Closed form of the 2-D Umeyama fit.
   Returns [a, -b, tx, b, a, ty]: the row-major 2x3 matrix of cv.warpAffine, or null when the input is unusable. */
export function similarityTransform(src, dst) {
  var n = src && dst ? Math.min(src.length, dst.length) : 0;
  if (n < 2) return null;
  var sx = 0, sy = 0, dx = 0, dy = 0, i;
  for (i = 0; i < n; i++) { sx += src[i][0]; sy += src[i][1]; dx += dst[i][0]; dy += dst[i][1]; }
  sx /= n; sy /= n; dx /= n; dy /= n;
  var dot = 0, cross = 0, norm = 0;
  for (i = 0; i < n; i++) {
    var xs = src[i][0] - sx, ys = src[i][1] - sy, xd = dst[i][0] - dx, yd = dst[i][1] - dy;
    dot += xs * xd + ys * yd; cross += xs * yd - ys * xd; norm += xs * xs + ys * ys;
  }
  if (!(norm > 0) || !isFinite(dot) || !isFinite(cross)) return null;
  var a = dot / norm, b = cross / norm;
  return [a, -b, dx - (a * sx - b * sy), b, a, dy - (b * sx + a * sy)];
}

/* the transform from a detected face's 5 landmarks to the 112x112 template */
export function alignMatrix(points) {
  return similarityTransform(points, TEMPLATE);
}
