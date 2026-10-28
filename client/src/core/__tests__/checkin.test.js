import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, mkMember, timePlan, sessionsPlan, TODAY, T0, advanceDays } from './_helpers.js';

beforeAll(prepareHashes);
beforeEach(() => fresh());

describe('checkIn', () => {
  it('records a visit with the Tashkent date and time', async () => {
    const c = await mkMember('Ali', timePlan());
    const r = GYM.checkIn(c.id);
    expect(r.visit.visit_date).toBe(TODAY);
    expect(r.visit.visit_time).toBe('12:00');
    expect(r.visit.client).toBe(c.id);
    expect(GYM.visitsOf(c.id)).toHaveLength(1);
  });
  it('a session plan loses one session and reports what is left', async () => {
    const c = await mkMember('Ali', sessionsPlan({ total_sessions: 3 }));
    const r = GYM.checkIn(c.id);
    expect(r.sub.used_sessions).toBe(1);
    expect(r.remaining).toBe(2);
  });
  it('a time plan does not use sessions', async () => {
    const c = await mkMember('Ali', timePlan({ end_date: '2026-03-15' }));
    const r = GYM.checkIn(c.id);
    expect(r.sub.used_sessions).toBe(0);
    expect(r.remaining).toBe(5);
  });
  it('is allowed on the last day of a time plan', async () => {
    const c = await mkMember('Ali', timePlan({ end_date: TODAY }));
    expect(() => GYM.checkIn(c.id)).not.toThrow();
  });
  it('is refused the day after the end date', async () => {
    const c = await mkMember('Ali', timePlan({ end_date: '2026-03-09' }));
    expect(() => GYM.checkIn(c.id)).toThrow('The subscription of Ali expired on 09.03.2026.');
    expect(GYM.visitsOf(c.id)).toHaveLength(0);
  });
  it('is refused for a frozen member', async () => {
    const c = await mkMember('Ali', timePlan());
    GYM.freezeClient(c.id);
    expect(() => GYM.checkIn(c.id)).toThrow('Ali is frozen. Unfreeze the membership first.');
  });
  it('is refused without a plan', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.checkIn(c.id)).toThrow('Ali has no active subscription.');
  });
  it('is refused when all sessions are used', async () => {
    const c = await mkMember('Ali', sessionsPlan({ total_sessions: 1 }));
    GYM.checkIn(c.id);
    advanceDays(1);
    expect(() => GYM.checkIn(c.id)).toThrow('Ali has no sessions left.');
  });
  it('is refused when the valid-until date of a sessions plan has passed', async () => {
    const c = await mkMember('Ali', sessionsPlan({ end_date: '2026-03-09' }));
    expect(() => GYM.checkIn(c.id)).toThrow('expired on 09.03.2026');
  });
  it('is refused a second time on the same day, and does not use another session', async () => {
    const c = await mkMember('Ali', sessionsPlan({ total_sessions: 5 }));
    GYM.checkIn(c.id);
    expect(() => GYM.checkIn(c.id)).toThrow('Ali already checked in today.');
    expect(GYM.activeSub(c.id).used_sessions).toBe(1);
    expect(GYM.visitsOf(c.id)).toHaveLength(1);
  });
  it('is allowed again the next day', async () => {
    const c = await mkMember('Ali', sessionsPlan({ total_sessions: 5 }));
    GYM.checkIn(c.id);
    advanceDays(1);
    expect(() => GYM.checkIn(c.id)).not.toThrow();
    expect(GYM.activeSub(c.id).used_sessions).toBe(2);
  });
  it('"today" follows Tashkent midnight, not UTC midnight', async () => {
    const c = await mkMember('Ali', timePlan());
    GYM.setClock(Date.UTC(2026, 2, 10, 18, 0, 0));      /* 23:00 Tashkent, Tue 10 */
    GYM.checkIn(c.id);
    GYM.setClock(Date.UTC(2026, 2, 10, 19, 30, 0));     /* 00:30 Tashkent, Wed 11, still 10 March in UTC */
    const r = GYM.checkIn(c.id);
    expect(r.visit.visit_date).toBe('2026-03-11');
    expect(GYM.visitsOf(c.id)).toHaveLength(2);
  });
  it('unknown member', () => {
    expect(() => GYM.checkIn('nope')).toThrow('Member not found.');
  });

  describe('training days', () => {
    it('is refused on a day that is not in the member\'s days (today is Tue)', async () => {
      const c = await mkMember('Ali', timePlan(), { days: ['Mon', 'Wed'] });
      expect(() => GYM.checkIn(c.id)).toThrow('Today (Tue) is not a training day for Ali. Allowed: Mon, Wed.');
      expect(GYM.visitsOf(c.id)).toHaveLength(0);
    });
    it('is allowed on a training day', async () => {
      const c = await mkMember('Ali', timePlan(), { days: 'Tue,Thu' });
      expect(() => GYM.checkIn(c.id)).not.toThrow();
    });
    it('no days set means every day is allowed', async () => {
      const c = await mkMember('Ali', timePlan());
      expect(c.days).toBe('');
      expect(() => GYM.checkIn(c.id)).not.toThrow();
    });
    it('uses the Tashkent weekday near midnight', async () => {
      const c = await mkMember('Ali', timePlan(), { days: ['Wed'] });
      GYM.setClock(Date.UTC(2026, 2, 10, 19, 30, 0));   /* Wed in Tashkent, Tue in UTC */
      expect(() => GYM.checkIn(c.id)).not.toThrow();
    });
  });

  it('writes an audit row', async () => {
    const c = await mkMember('Ali', timePlan());
    GYM.checkIn(c.id);
    expect(GYM.values('audit').some((a) => a.action === 'CHECK_IN' && a.detail === 'Ali' && a.by === 'admin')).toBe(true);
  });
});

describe('freeze / unfreeze', () => {
  it('freeze records the date; freezing twice is refused', async () => {
    const c = await mkMember('Ali', timePlan());
    GYM.freezeClient(c.id);
    expect(GYM.S().clients[c.id].status).toBe('frozen');
    expect(GYM.S().clients[c.id].frozen_since).toBe(TODAY);
    expect(() => GYM.freezeClient(c.id)).toThrow('This membership is already frozen.');
  });
  it('unfreezing after N days pushes end_date by N and reports it', async () => {
    const c = await mkMember('Ali', timePlan({ end_date: '2026-03-31' }));
    GYM.freezeClient(c.id);
    GYM.setClock(T0 + 5 * 86400000);
    const r = GYM.unfreezeClient(c.id);
    expect(r).toEqual({ days: 5, extended: true });
    expect(GYM.activeSub(c.id).end_date).toBe('2026-04-05');
    expect(GYM.S().clients[c.id].status).toBe('active');
    expect(GYM.S().clients[c.id].frozen_since).toBe(null);
  });
  it('same-day unfreeze extends 0 days', async () => {
    const c = await mkMember('Ali', timePlan({ end_date: '2026-03-31' }));
    GYM.freezeClient(c.id);
    const r = GYM.unfreezeClient(c.id);
    expect(r).toEqual({ days: 0, extended: false });
    expect(GYM.activeSub(c.id).end_date).toBe('2026-03-31');
  });
  it('a member without a plan can be frozen and unfrozen; nothing to extend', async () => {
    const c = await mkMember('Ali');
    GYM.freezeClient(c.id);
    GYM.setClock(T0 + 3 * 86400000);
    expect(GYM.unfreezeClient(c.id)).toEqual({ days: 3, extended: false });
  });
  it('sessions plan with no end date is not extended', async () => {
    const c = await mkMember('Ali', sessionsPlan());
    GYM.freezeClient(c.id);
    GYM.setClock(T0 + 3 * 86400000);
    expect(GYM.unfreezeClient(c.id)).toEqual({ days: 3, extended: false });
  });
  it('unfreezing a member who is not frozen is refused', async () => {
    const c = await mkMember('Ali', timePlan());
    expect(() => GYM.unfreezeClient(c.id)).toThrow('This membership is not frozen.');
  });
});
