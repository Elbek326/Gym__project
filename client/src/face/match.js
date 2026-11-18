/* ===== face matching: pure functions, no DOM and no library =====
   A descriptor is an array of 128 numbers. A member has 1 to 5 of them (one per enrolment shot).
   The reception screen compares a live descriptor with every enrolled member and accepts a match only when it is
   both close (THRESHOLD) and clearly better than the runner-up (MARGIN), and only after it won 2 of the last 3 frames. */
export const THRESHOLD = 0.55;    /* euclidean distance below which a face counts as the same person (face-api's own default is 0.6) */
export const MARGIN = 0.08;       /* the second-best member must be at least this much further away than the best */
export const STABLE_NEED = 2;     /* the same member must win this many of the last STABLE_WINDOW frames ... */
export const STABLE_WINDOW = 3;   /* ... counted over this many frames that had a face */

export function distance(a, b) {
  var n = Math.min(a.length, b.length), s = 0;
  for (var i = 0; i < n; i++) { var d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

export const CONSISTENT = 0.45;   /* consecutive frames closer than this to the newest one are the same face and are averaged */

/* element-wise mean of several descriptors (null for an empty list) */
export function mean(list) {
  if (!list || !list.length) return null;
  var n = list[0].length, out = new Array(n).fill(0);
  list.forEach(function (d) { for (var i = 0; i < n; i++) out[i] += d[i]; });
  for (var i = 0; i < n; i++) out[i] /= list.length;
  return out;
}
/* scale to unit length, like face-api's own descriptors (a zero vector is returned as it is) */
export function normalise(d) {
  var s = 0; for (var i = 0; i < d.length; i++) s += d[i] * d[i];
  s = Math.sqrt(s);
  return s > 0 ? d.map(function (x) { return x / s; }) : d.slice();
}
/* the mean of the frames that agree with the newest one (the newest is last), re-normalised.
   Frames further than `limit` from the newest are left out, so a changed face never gets mixed in. */
export function smooth(frames, limit) {
  if (!frames || !frames.length) return null;
  var last = frames[frames.length - 1], lim = limit != null ? limit : CONSISTENT;
  var ok = frames.filter(function (f) { return f === last || distance(f, last) < lim; });
  return ok.length === 1 ? last : normalise(mean(ok));
}

/* adds the cached average of the shots to each member ({ id, descriptors, mean }); call once when the list loads */
export function prepareMembers(members) {
  return (members || []).map(function (m) {
    var ds = m.descriptors || [];
    return Object.assign({}, m, { mean: ds.length > 1 ? normalise(mean(ds)) : null });
  });
}

/* members: [{ id, descriptors: [[128]...], mean? }]. Returns [{ id, distance }] sorted by distance; a member's distance is
   the smallest over their shots and their mean (see prepareMembers). Members without usable descriptors are skipped. */
export function rank(descriptor, members) {
  var out = [];
  (members || []).forEach(function (m) {
    var best = Infinity;
    (m.descriptors || []).forEach(function (d) { var x = distance(descriptor, d); if (x < best) best = x; });
    if (m.mean) { var xm = distance(descriptor, m.mean); if (xm < best) best = xm; }
    if (best !== Infinity) out.push({ id: m.id, distance: best });
  });
  return out.sort(function (a, b) { return a.distance - b.distance; });
}

/* { id, distance, margin, reason }: id is null unless the face is accepted; reason is 'none' | 'far' | 'close-call' | 'ok' */
export function matchFace(descriptor, members, opts) {
  var t = opts && opts.threshold != null ? opts.threshold : THRESHOLD;
  var mg = opts && opts.margin != null ? opts.margin : MARGIN;
  var r = rank(descriptor, members);
  if (!r.length) return { id: null, distance: Infinity, margin: Infinity, reason: 'none' };
  var best = r[0], margin = r.length > 1 ? r[1].distance - best.distance : Infinity;
  if (!(best.distance < t)) return { id: null, distance: best.distance, margin: margin, reason: 'far' };
  if (margin < mg) return { id: null, distance: best.distance, margin: margin, reason: 'close-call' };
  return { id: best.id, distance: best.distance, margin: margin, reason: 'ok' };
}

/* push the winner of a frame that HAD a face (an id, or null for "nobody accepted"); returns the id once it has won
   `need` of the last `win` frames, then starts over, so one standing person is reported once, not on every frame.
   A different winner breaks the streak. Frames without any face are simply not pushed: they neither count nor break it. */
export function createStabilizer(need, win) {
  var n = need || STABLE_NEED, w = win || STABLE_WINDOW, hist = [];
  return {
    push: function (id) {
      if (id == null) { hist.push(null); if (hist.length > w) hist.shift(); return null; }
      if (hist.some(function (x) { return x != null && x !== id; })) hist = [];
      hist.push(id); if (hist.length > w) hist.shift();
      var c = hist.filter(function (x) { return x === id; }).length;
      if (c >= n) { hist = []; return id; }
      return null;
    },
    reset: function () { hist = []; }
  };
}
