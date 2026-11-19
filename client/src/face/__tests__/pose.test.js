import { describe, expect, it } from 'vitest';
import { estimatePose, poseMatches } from '../pose.js';

/* 68 landmarks with the eye centres at (-30, 0) and (30, 0) (inter-eye 60), the chin at (0, 120) and the nose tip at (nx, ny) */
function face(nx, ny, scale) {
  var k = scale || 1, pts = [];
  for (var i = 0; i < 68; i++) pts.push({ x: 0, y: 60 * k });
  for (i = 36; i <= 41; i++) pts[i] = { x: -30 * k, y: 0 };
  for (i = 42; i <= 47; i++) pts[i] = { x: 30 * k, y: 0 };
  pts[8] = { x: 0, y: 120 * k }; pts[30] = { x: nx * k, y: ny * k };
  return pts;
}

describe('estimatePose', () => {
  it('is about zero for a frontal face', () => {
    var p = estimatePose(face(0, 60));
    expect(p.yaw).toBeCloseTo(0, 10); expect(p.pitch).toBeCloseTo(0, 10);
  });
  it('gives a positive yaw when the nose moves to the right of the raw frame (the person turns to their own left)', () => {
    expect(estimatePose(face(15, 60)).yaw).toBeCloseTo(0.25, 10);
    expect(estimatePose(face(-15, 60)).yaw).toBeCloseTo(-0.25, 10);
  });
  it('gives a negative pitch looking up and a positive one looking down', () => {
    expect(estimatePose(face(0, 48)).pitch).toBeCloseTo(-0.1, 10);
    expect(estimatePose(face(0, 72)).pitch).toBeCloseTo(0.1, 10);
  });
  it('does not depend on the size of the face', () => {
    var a = estimatePose(face(9, 54)), b = estimatePose(face(9, 54, 3.5));
    expect(b.yaw).toBeCloseTo(a.yaw, 10); expect(b.pitch).toBeCloseTo(a.pitch, 10);
  });
  it('returns null for unusable input', () => {
    expect(estimatePose(null)).toBeNull();
    expect(estimatePose([])).toBeNull();
    var flat = face(0, 60); flat[8] = { x: 0, y: -5 };   /* chin above the eyes */
    expect(estimatePose(flat)).toBeNull();
  });
});

describe('poseMatches', () => {
  var P = (yaw, pitch) => ({ yaw: yaw, pitch: pitch });
  it('straight needs a small yaw and a pitch near the base', () => {
    expect(poseMatches('straight', P(0.03, 0.01), 0)).toBe(true);
    expect(poseMatches('straight', P(0.2, 0), 0)).toBe(false);
    expect(poseMatches('straight', P(0, 0.1), 0)).toBe(false);
    expect(poseMatches('straight', P(0, 0.11), 0.1)).toBe(true);   /* the base moves the neutral pitch */
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
    expect(poseMatches('up', P(0, -0.1), 0)).toBe(true);
    expect(poseMatches('up', P(0, 0.1), 0)).toBe(false);
    expect(poseMatches('up', P(0.4, -0.1), 0)).toBe(false);
    expect(poseMatches('down', P(0, 0.1), 0)).toBe(true);
    expect(poseMatches('down', P(0, -0.1), 0)).toBe(false);
    expect(poseMatches('up', P(0, 0.02), 0.12)).toBe(true);   /* relative to this face's own frontal pitch */
  });
  it('is false for an unknown pose or no pose', () => {
    expect(poseMatches('sideways', P(0, 0), 0)).toBe(false);
    expect(poseMatches('straight', null, 0)).toBe(false);
  });
});
