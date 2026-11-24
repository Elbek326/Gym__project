import { describe, expect, it } from 'vitest';
import { SIZE, TEMPLATE, alignMatrix, similarityTransform } from '../align.js';

/* apply a 2x3 row-major matrix to a point */
function apply(m, p) { return [m[0] * p[0] + m[1] * p[1] + m[2], m[3] * p[0] + m[4] * p[1] + m[5]]; }
/* a known similarity: scale s, rotation r (radians), translation (tx, ty) */
function make(s, r, tx, ty) { var a = s * Math.cos(r), b = s * Math.sin(r); return function (p) { return [a * p[0] - b * p[1] + tx, b * p[0] + a * p[1] + ty]; }; }

describe('similarityTransform', () => {
  it('is the identity for identical points', () => {
    var m = similarityTransform(TEMPLATE, TEMPLATE);
    [1, 0, 0, 0, 1, 0].forEach(function (v, i) { expect(m[i]).toBeCloseTo(v, 9); });
  });
  it('recovers a known scale, rotation and translation', () => {
    var f = make(1.7, 0.3, 40, -25), src = TEMPLATE.map(f);
    var m = similarityTransform(src, TEMPLATE);
    TEMPLATE.forEach(function (p, i) { var q = apply(m, src[i]); expect(q[0]).toBeCloseTo(p[0], 6); expect(q[1]).toBeCloseTo(p[1], 6); });
    expect(Math.hypot(m[0], m[3])).toBeCloseTo(1 / 1.7, 9);   /* scale is the inverse of the one that made the points */
  });
  it('maps a face found in a big frame onto the 112x112 template', () => {
    var found = TEMPLATE.map(make(3, -0.2, 500, 300));
    var m = alignMatrix(found);
    found.forEach(function (p, i) { var q = apply(m, p); expect(q[0]).toBeCloseTo(TEMPLATE[i][0], 6); expect(q[1]).toBeCloseTo(TEMPLATE[i][1], 6); });
    expect(SIZE).toBe(112);
  });
  it('fits in the least-squares sense when the points are noisy', () => {
    var f = make(2, 0.1, 10, 10), src = TEMPLATE.map(f), noisy = src.map(function (p, i) { return [p[0] + (i % 2 ? 0.4 : -0.4), p[1] + (i % 2 ? -0.3 : 0.3)]; });
    var m = similarityTransform(noisy, TEMPLATE);
    TEMPLATE.forEach(function (p, i) { var q = apply(m, noisy[i]); expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeLessThan(1); });
  });
  it('never mirrors: the determinant is positive', () => {
    var m = similarityTransform(TEMPLATE.map(make(1.3, 2.5, 3, 4)), TEMPLATE);
    expect(m[0] * m[4] - m[1] * m[3]).toBeGreaterThan(0);
  });
  it('returns null for unusable input', () => {
    expect(similarityTransform(null, TEMPLATE)).toBeNull();
    expect(similarityTransform([[1, 1]], [[2, 2]])).toBeNull();
    expect(similarityTransform([[5, 5], [5, 5], [5, 5]], TEMPLATE.slice(0, 3))).toBeNull();   /* all points on one spot */
    expect(similarityTransform([[0, 0], [NaN, 1]], [[0, 0], [1, 1]])).toBeNull();
  });
});
