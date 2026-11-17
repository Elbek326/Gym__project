import { describe, expect, it } from 'vitest';
import { MARGIN, STABLE_FRAMES, THRESHOLD, createStabilizer, distance, matchFace, rank } from '../match.js';

/* a 128-d vector that is `x` at the first position and 0 elsewhere: the distance between two of them is |x1 - x2| */
function v(x) { var a = new Array(128).fill(0); a[0] = x; return a; }

describe('distance', () => {
  it('is euclidean', () => {
    expect(distance(v(0), v(0))).toBe(0);
    expect(distance(v(0.3), v(0.7))).toBeCloseTo(0.4, 10);
    var a = new Array(128).fill(0), b = new Array(128).fill(0); a[0] = 3; b[1] = 4;
    expect(distance(a, b)).toBe(5);
  });
});

describe('rank', () => {
  it('uses the closest shot of each member and sorts by distance', () => {
    var r = rank(v(0), [{ id: 'a', descriptors: [v(0.9), v(0.2)] }, { id: 'b', descriptors: [v(0.1)] }, { id: 'c', descriptors: [] }]);
    expect(r.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r[1].distance).toBeCloseTo(0.2, 10);
  });
});

describe('matchFace', () => {
  var members = [{ id: 'a', descriptors: [v(0.0)] }, { id: 'b', descriptors: [v(0.6)] }, { id: 'c', descriptors: [v(1.5)] }];
  it('accepts a close face that is clearly better than the runner-up', () => {
    var m = matchFace(v(0.05), members);
    expect(m.id).toBe('a'); expect(m.reason).toBe('ok');
  });
  it('rejects a face that is too far from everybody', () => {
    var m = matchFace(v(3), members);
    expect(m.id).toBeNull(); expect(m.reason).toBe('far');
  });
  it('rejects the threshold edge (the distance must be below it)', () => {
    expect(matchFace(v(THRESHOLD), [{ id: 'a', descriptors: [v(0)] }]).id).toBeNull();
    expect(matchFace(v(THRESHOLD - 0.01), [{ id: 'a', descriptors: [v(0)] }]).id).toBe('a');
  });
  it('rejects a close call between two members', () => {
    var twins = [{ id: 'a', descriptors: [v(0.0)] }, { id: 'b', descriptors: [v(0.3)] }];
    var m = matchFace(v(0.14), twins);   /* 0.14 vs 0.16: gap 0.02 is below MARGIN */
    expect(m.id).toBeNull(); expect(m.reason).toBe('close-call');
    expect(m.margin).toBeLessThan(MARGIN);
  });
  it('accepts when the gap is at least the margin', () => {
    var m = matchFace(v(0), [{ id: 'a', descriptors: [v(0.1)] }, { id: 'b', descriptors: [v(0.1 + MARGIN + 0.01)] }]);
    expect(m.id).toBe('a');
  });
  it('accepts the only enrolled member when close enough', () => {
    expect(matchFace(v(0.2), [{ id: 'a', descriptors: [v(0)] }]).id).toBe('a');
  });
  it('handles nobody enrolled', () => {
    var m = matchFace(v(0), []);
    expect(m.id).toBeNull(); expect(m.reason).toBe('none');
  });
  it('lets a member match through any of their shots', () => {
    var m = matchFace(v(1.0), [{ id: 'a', descriptors: [v(0), v(1.1)] }, { id: 'b', descriptors: [v(3)] }]);
    expect(m.id).toBe('a');
  });
  it('honours a custom threshold and margin', () => {
    expect(matchFace(v(0.3), [{ id: 'a', descriptors: [v(0)] }], { threshold: 0.2 }).id).toBeNull();
    var two = [{ id: 'a', descriptors: [v(0)] }, { id: 'b', descriptors: [v(0.3)] }];
    expect(matchFace(v(0.14), two, { margin: 0.01 }).id).toBe('a');
  });
});

describe('createStabilizer', () => {
  it('fires only after the same member wins N frames in a row', () => {
    var s = createStabilizer(STABLE_FRAMES);
    expect(s.push('a')).toBeNull(); expect(s.push('a')).toBeNull();
    expect(s.push('a')).toBe('a');
  });
  it('restarts when the winner changes or a frame has no winner', () => {
    var s = createStabilizer(3);
    s.push('a'); s.push('a'); expect(s.push('b')).toBeNull();
    expect(s.push('b')).toBeNull(); expect(s.push(null)).toBeNull();
    expect(s.push('b')).toBeNull(); expect(s.push('b')).toBeNull(); expect(s.push('b')).toBe('b');
  });
  it('needs another full run after firing', () => {
    var s = createStabilizer(3);
    s.push('a'); s.push('a'); expect(s.push('a')).toBe('a');
    expect(s.push('a')).toBeNull(); expect(s.push('a')).toBeNull(); expect(s.push('a')).toBe('a');
  });
  it('reset clears the streak', () => {
    var s = createStabilizer(2);
    s.push('a'); s.reset(); expect(s.push('a')).toBeNull(); expect(s.push('a')).toBe('a');
  });
  it('defaults to three frames', () => {
    expect(STABLE_FRAMES).toBe(3);
    var s = createStabilizer();
    s.push('x'); s.push('x'); expect(s.push('x')).toBe('x');
  });
});
