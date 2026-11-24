/* ===== head pose from YuNet's 5 face landmarks: pure functions, no DOM and no library =====
   Points, in YuNet's order: [0] right eye, [1] left eye, [2] nose tip, [3] right mouth corner, [4] left mouth corner
   ("right" = the person's own right = the LEFT side of the raw frame). Each is { x, y } in the RAW video frame (not the mirrored preview).

   yaw   = (nose.x - eyeMid.x) / interEye             0 = frontal. Positive = the nose moves to the RIGHT of the raw frame,
                                                       which is the person's own LEFT. The preview is mirrored, so the person
                                                       sees the nose go to the left of the screen, like in a mirror.
   pitch = (nose.y - eyeMid.y) / (mouthMid.y - eyeMid.y) - 0.5     about 0 when frontal (on the SFace template the nose sits at
                                                       0.49 of the way from the eye line to the mouth line). Positive = looking
                                                       DOWN (the nose drops towards the mouth), negative = looking UP. The neutral
                                                       value differs per face, so enrolment compares pitch with the first frontal shot.
   The eye-to-mouth span is shorter than the old eye-to-chin one, so the same head tilt gives about 1.7x bigger pitch numbers. */
var NEUTRAL = 0.5;

/* pts: the 5 landmarks [{x, y}]. Returns { yaw, pitch } or null when the input is unusable. */
export function estimatePose(pts) {
  if (!pts || pts.length < 5) return null;
  var re = pts[0], le = pts[1], nose = pts[2], rm = pts[3], lm = pts[4];
  var mid = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 };
  var eye = Math.hypot(le.x - re.x, le.y - re.y), drop = (rm.y + lm.y) / 2 - mid.y;
  if (!(eye > 0) || !(drop > 0)) return null;
  var yaw = (nose.x - mid.x) / eye;
  var pitch = (nose.y - mid.y) / drop - NEUTRAL;
  if (!isFinite(yaw) || !isFinite(pitch)) return null;
  return { yaw: yaw, pitch: pitch };
}

/* the requested poses, by name. `pitchBase` is the pitch of the first frontal shot (0 when unknown); yaw is absolute.
   Ranges are in yaw units (inter-eye distances) and pitch units (share of the eye-to-mouth height), tuned for webcams:
   yaw 0.25 is roughly 25 degrees. The pitch limits are the old eye-to-chin ones times about 1.7. */
export var POSE_RULES = {
  straight:   function (p, b) { return Math.abs(p.yaw) <= 0.10 && Math.abs(p.pitch - b) <= 0.08; },
  left:       function (p, b) { return p.yaw >= 0.22 && p.yaw <= 0.80 && Math.abs(p.pitch - b) <= 0.17; },
  right:      function (p, b) { return p.yaw <= -0.22 && p.yaw >= -0.80 && Math.abs(p.pitch - b) <= 0.17; },
  slightLeft: function (p, b) { return p.yaw >= 0.10 && p.yaw <= 0.30 && Math.abs(p.pitch - b) <= 0.12; },
  slightRight:function (p, b) { return p.yaw <= -0.10 && p.yaw >= -0.30 && Math.abs(p.pitch - b) <= 0.12; },
  up:         function (p, b) { return p.pitch - b <= -0.09 && p.pitch - b >= -0.50 && Math.abs(p.yaw) <= 0.20; },
  down:       function (p, b) { return p.pitch - b >= 0.09 && p.pitch - b <= 0.50 && Math.abs(p.yaw) <= 0.20; }
};

export function poseMatches(kind, pose, pitchBase) {
  var rule = POSE_RULES[kind];
  return !!(rule && pose && rule(pose, pitchBase || 0));
}
