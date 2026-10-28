import { describe, it, expect } from 'vitest';
import { GYM, nb } from './_helpers.js';

describe('addDays / diffDays', () => {
  it('crosses month, year and leap-year boundaries', () => {
    expect(GYM.addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(GYM.addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(GYM.addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(GYM.addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(GYM.addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(GYM.addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(GYM.addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(GYM.addDays('2026-03-10', 0)).toBe('2026-03-10');
    expect(GYM.addDays('2026-01-01', 365)).toBe('2027-01-01');
  });
  it('diffDays is signed and leap-aware', () => {
    expect(GYM.diffDays('2024-02-28', '2024-03-01')).toBe(2);
    expect(GYM.diffDays('2025-02-28', '2025-03-01')).toBe(1);
    expect(GYM.diffDays('2025-12-31', '2026-01-01')).toBe(1);
    expect(GYM.diffDays('2026-01-01', '2027-01-01')).toBe(365);
    expect(GYM.diffDays('2024-01-01', '2025-01-01')).toBe(366);
    expect(GYM.diffDays('2026-03-10', '2026-03-01')).toBe(-9);
  });
  it('dowOf gives English short weekday names', () => {
    expect(GYM.dowOf('2026-03-10')).toBe('Tue');
    expect(GYM.dowOf('2026-03-08')).toBe('Sun');
    expect(GYM.dowOf('2026-03-14')).toBe('Sat');
  });
});

describe('isDate', () => {
  it('accepts real dates', () => {
    expect(GYM.isDate('2026-03-10')).toBe(true);
    expect(GYM.isDate('2024-02-29')).toBe(true);
  });
  it('rejects impossible or malformed dates', () => {
    ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-3-1', '2026-03-10T10:00', '', null, undefined, 20260310]
      .forEach((v) => expect(GYM.isDate(v)).toBe(false));
  });
});

describe('formatting', () => {
  it('fmtDate / fmtDT', () => {
    expect(GYM.fmtDate('2026-03-10')).toBe('10.03.2026');
    expect(GYM.fmtDate(null)).toBe('—');
    expect(GYM.fmtDT('2026-03-10T14:05:09')).toBe('10.03.2026 14:05');
    expect(GYM.fmtDT('')).toBe('—');
  });
  it('fmtMoney groups thousands with spaces and rounds', () => {
    expect(GYM.fmtMoney(1234567)).toBe(nb('1 234 567'));
    expect(GYM.fmtMoney(999)).toBe('999');
    expect(GYM.fmtMoney(1234.6)).toBe(nb('1 235'));
    expect(GYM.fmtMoney(-50000)).toBe(nb('-50 000'));
    expect(GYM.fmtMoney('abc')).toBe('0');
  });
  it('monthLabel', () => {
    expect(GYM.monthLabel('2026-03')).toBe('March 2026');
    expect(GYM.monthLabel('2025-12')).toBe('December 2025');
  });
});

describe('monthsBetween (day-of-month rule)', () => {
  it('counts a month only once the day-of-month is reached', () => {
    expect(GYM.monthsBetween('2026-01-15', '2026-02-14')).toBe(0);
    expect(GYM.monthsBetween('2026-01-15', '2026-02-15')).toBe(1);
    expect(GYM.monthsBetween('2025-11-30', '2026-03-01')).toBe(3);
    expect(GYM.monthsBetween('2025-01-31', '2026-01-30')).toBe(11);
    expect(GYM.monthsBetween('2025-01-31', '2026-01-31')).toBe(12);
  });
  it('never goes below zero', () => {
    expect(GYM.monthsBetween('2026-03-10', '2026-01-01')).toBe(0);
  });
});

describe('now() in Asia/Tashkent', () => {
  it('uses UTC+5', () => {
    GYM.setClock(Date.UTC(2026, 2, 10, 7, 0, 0));
    const n = GYM.now();
    expect(n.date).toBe('2026-03-10');
    expect(n.time).toBe('12:00');
    expect(n.dow).toBe('Tue');
    expect(n.iso).toBe('2026-03-10T12:00:00');
  });
  it('a late-evening UTC instant lands on the next Tashkent date', () => {
    GYM.setClock(Date.UTC(2026, 2, 10, 19, 30, 5));
    const n = GYM.now();
    expect(n.date).toBe('2026-03-11');
    expect(n.time).toBe('00:30');
    expect(n.dow).toBe('Wed');
    expect(n.iso).toBe('2026-03-11T00:30:05');
  });
  it('just before Tashkent midnight is still the same day', () => {
    GYM.setClock(Date.UTC(2026, 2, 10, 18, 59, 59));
    expect(GYM.now().date).toBe('2026-03-10');
    expect(GYM.now().time).toBe('23:59');
  });
  it('rolls over the year', () => {
    GYM.setClock(Date.UTC(2025, 11, 31, 20, 0, 0));
    expect(GYM.now().date).toBe('2026-01-01');
    expect(GYM.now().time).toBe('01:00');
  });
});
