import { describe, expect, it } from 'vitest';
import { estimatePose, poseMatches } from '../pose.js';

/* YuNet's 5 landmarks: eyes at (-30, 0) and (30, 0) (inter-eye 60), mouth corners at (-20, 60) and (20, 60) (eye-to-mouth 60)
   and the nose tip at (nx, ny); a frontal nose is at (0, 30). `scale` makes the face bigger. */
function face(nx, ny, scale) {
  var k = scale || 1;
  return [{ x: -30 * k, y: 0 }, { x: 30 * k, y: 0 }, { x: nx * k, y: ny * k }, { x: -20 * k, y: 60 * k }, { x: 20 * k, y: 60 * k }];
}

describe('estimatePose', () => {
  it('is about zero for a frontal face', () => {
    var p = estimatePose(face(0, 30));
    expect(p.yaw).toBeCloseTo(0, 10); expect(p.pitch).toBeCloseTo(0, 10);
  });
  it('gives a positive yaw when the nose moves to the right of the raw frame (the person turns to their own left)', () => {
    expect(estimatePose(face(15, 30)).yaw).toBeCloseTo(0.25, 10);
    expect(estimatePose(face(-15, 30)).yaw).toBeCloseTo(-0.25, 10);
  });
  it('gives a negative pitch looking up and a positive one looking down', () => {
    expect(estimatePose(face(0, 24)).pitch).toBeCloseTo(-0.1, 10);
    expect(estimatePose(face(0, 36)).pitch).toBeCloseTo(0.1, 10);
  });
  it('does not depend on the size of the face', () => {
    var a = estimatePose(face(9, 27)), b = estimatePose(face(9, 27, 3.5));
    expect(b.yaw).toBeCloseTo(a.yaw, 10); expect(b.pitch).toBeCloseTo(a.pitch, 10);
  });
  it('uses the middle of the mouth, so a crooked mouth does not matter', () => {
    var f = face(0, 30); f[3] = { x: -20, y: 50 }; f[4] = { x: 20, y: 70 };   /* the mouth line is tilted, its middle is the same */
    expect(estimatePose(f).pitch).toBeCloseTo(0, 10);
  });
  it('returns null for unusable input', () => {
    expect(estimatePose(null)).toBeNull();
    expect(estimatePose([])).toBeNull();
    expect(estimatePose(face(0, 30).slice(0, 4))).toBeNull();
    var flat = face(0, 30); flat[3] = { x: -20, y: -5 }; flat[4] = { x: 20, y: -5 };   /* mouth above the eyes */
    expect(estimatePose(flat)).toBeNull();
    var same = face(0, 30); same[1] = { x: -30, y: 0 };                               /* both eyes on one spot */
    expect(estimatePose(same)).toBeNull();
  });
});

describe('poseMatches', () => {
  var P = (yaw, pitch) => ({ yaw: yaw, pitch: pitch });
  it('straight needs a small yaw and a pitch near the base', () => {
    expect(poseMatches('straight', P(0.03, 0.01), 0)).toBe(true);
    expect(poseMatches('straight', P(0.2, 0), 0)).toBe(false);
    expect(poseMatches('straight', P(0, 0.12), 0)).toBe(false);
    expect(poseMatches('straight', P(0, 0.17), 0.1)).toBe(true);   /* the base moves the neutral pitch */
  });
  it('left and right need a clear turn of the matching sign', () => {
    expect(poseMatches('left', P(0.35, 0), 0)).toBe(true);
    expect(poseMatches('left', P(-0.35, 0), 0)).toBe(false);
    expect(poseMatches('left', P(0.15, 0), 0)).toBe(false);
    expect(poseMatches('right', P(-0.35, 0), 0)).toBe(true);
    expect(poseMatches('right', P(0.35, 0), 0)).toBe(false);
  });
  it('slight turns are in between straight and a full turn', () => {
    expect(poseMatches('slightLeft', P(0.18, 0), 0)).toBe(true);
    expect(poseMatches('slightLeft', P(0.05, 0), 0)).toBe(false);
    expect(poseMatches('slightRight', P(-0.18, 0), 0)).toBe(true);
    expect(poseMatches('slightRight', P(0.18, 0), 0)).toBe(false);
  });
  it('up is a lower pitch and down a higher one, with the head not turned', () => {
    expect(poseMatches('up', P(0, -0.15), 0)).toBe(true);
    expect(poseMatches('up', P(0, 0.15), 0)).toBe(false);
    expect(poseMatches('up', P(0.4, -0.15), 0)).toBe(false);
    expect(poseMatches('down', P(0, 0.15), 0)).toBe(true);
    expect(poseMatches('down', P(0, -0.15), 0)).toBe(false);
    expect(poseMatches('up', P(0, 0.0), 0.15)).toBe(true);   /* relative to this face's own frontal pitch */
  });
  it('is false for an unknown pose or no pose', () => {
    expect(poseMatches('sideways', P(0, 0), 0)).toBe(false);
    expect(poseMatches('straight', null, 0)).toBe(false);
  });
});
