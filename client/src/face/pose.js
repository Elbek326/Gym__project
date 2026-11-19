/* ===== head pose from the 68 face landmarks: pure functions, no DOM and no library =====
   Landmark indexes (iBUG 68, 0-based): jaw 0..16 (chin = 8), nose tip 30, eyes 36..41 and 42..47.
   Coordinates are those of the RAW video frame (not the mirrored preview).

   yaw   = (noseTip.x - eyeMid.x) / interEye          0 = frontal. Positive = the nose moves to the RIGHT of the raw frame,
                                                       which is the person's own LEFT. The preview is mirrored, so the person
                                                       sees the nose go to the left of the screen, like in a mirror.
   pitch = (noseTip.y - eyeMid.y) / (chin.y - eyeMid.y) - 0.5     about 0 when frontal. Positive = looking DOWN (the nose
                                                       tip drops towards the chin), negative = looking UP. The neutral value
                                                       differs per face, so enrolment compares pitch with the first frontal shot. */
var NOSE = 30, CHIN = 8;

function centre(pts, from, to) {
  var x = 0, y = 0, n = to - from + 1;
  for (var i = from; i <= to; i++) { x += pts[i].x; y += pts[i].y; }
  return { x: x / n, y: y / n };
}

/* points: the 68 landmark positions [{x, y}]. Returns { yaw, pitch } or null when the input is unusable. */
export function estimatePose(pts) {
  if (!pts || pts.length < 68) return null;
  var l = centre(pts, 36, 41), r = centre(pts, 42, 47);
  var mid = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
  var eye = Math.hypot(r.x - l.x, r.y - l.y), drop = pts[CHIN].y - mid.y;
  if (!(eye > 0) || !(drop > 0)) return null;
  var yaw = (pts[NOSE].x - mid.x) / eye;
  var pitch = (pts[NOSE].y - mid.y) / drop - 0.5;
  return { yaw: yaw, pitch: pitch };
}

/* the requested poses, by name. `pitchBase` is the pitch of the first frontal shot (0 when unknown); yaw is absolute.
   Ranges are in yaw units (inter-eye distances) and pitch units (share of eye-to-chin height), tuned for webcams:
   yaw 0.25 is roughly 25 degrees. */
export var POSE_RULES = {
  straight:   function (p, b) { return Math.abs(p.yaw) <= 0.10 && Math.abs(p.pitch - b) <= 0.05; },
  left:       function (p, b) { return p.yaw >= 0.22 && p.yaw <= 0.80 && Math.abs(p.pitch - b) <= 0.10; },
  right:      function (p, b) { return p.yaw <= -0.22 && p.yaw >= -0.80 && Math.abs(p.pitch - b) <= 0.10; },
  slightLeft: function (p, b) { return p.yaw >= 0.10 && p.yaw <= 0.30 && Math.abs(p.pitch - b) <= 0.07; },
  slightRight:function (p, b) { return p.yaw <= -0.10 && p.yaw >= -0.30 && Math.abs(p.pitch - b) <= 0.07; },
  up:         function (p, b) { return p.pitch - b <= -0.05 && p.pitch - b >= -0.30 && Math.abs(p.yaw) <= 0.20; },
  down:       function (p, b) { return p.pitch - b >= 0.05 && p.pitch - b <= 0.30 && Math.abs(p.yaw) <= 0.20; }
};

export function poseMatches(kind, pose, pitchBase) {
  var rule = POSE_RULES[kind];
  return !!(rule && pose && rule(pose, pitchBase || 0));
}
