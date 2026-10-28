import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, mkMember, timePlan, sessionsPlan, TODAY } from './_helpers.js';

beforeAll(prepareHashes);
beforeEach(() => fresh());

const sub = (over) => Object.assign({ sub_type: 'time', start_date: '2026-03-01', end_date: '2026-03-31', total_sessions: 0, used_sessions: 0 }, over);

describe('plan validation (via addSubscription)', () => {
  it('requires a known subscription type', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.addSubscription(c.id, { sub_type: 'weird', price: 1 })).toThrow('Choose a subscription type.');
  });
  it('rejects paid > price', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.addSubscription(c.id, timePlan({ price: 100, paid: 101 }))).toThrow('Amount paid cannot be more than the price.');
  });
  it('rejects invalid start / end dates and end before start', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.addSubscription(c.id, timePlan({ start_date: '2026-02-30' }))).toThrow('Start date is not valid.');
    expect(() => GYM.addSubscription(c.id, timePlan({ end_date: undefined }))).toThrow('End date is not valid.');
    expect(() => GYM.addSubscription(c.id, timePlan({ end_date: '2026-02-28' }))).toThrow('End date cannot be before the start date.');
    /* a one-day plan (end == start) is fine */
    expect(() => GYM.addSubscription(c.id, timePlan({ end_date: '2026-03-01' }))).not.toThrow();
  });
  it('checks the sessions bounds (1..1000, whole number)', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.addSubscription(c.id, sessionsPlan({ total_sessions: 0 }))).toThrow('Number of sessions must be at least 1.');
    expect(() => GYM.addSubscription(c.id, sessionsPlan({ total_sessions: 1001 }))).toThrow('Number of sessions must be at most 1000.');
    expect(() => GYM.addSubscription(c.id, sessionsPlan({ total_sessions: 2.5 }))).toThrow('Number of sessions must be a whole number.');
    expect(() => GYM.addSubscription(c.id, sessionsPlan({ total_sessions: '' }))).toThrow('Number of sessions is required.');
    expect(() => GYM.addSubscription(c.id, sessionsPlan({ total_sessions: 1000 }))).not.toThrow();
  });
  it('sessions plan: optional valid-until date is validated', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.addSubscription(c.id, sessionsPlan({ end_date: '2026-02-01' }))).toThrow('Valid-until date cannot be before the start date.');
    expect(() => GYM.addSubscription(c.id, sessionsPlan({ end_date: '2026-02-31' }))).toThrow('Valid-until date is not valid.');
  });
  it('price must be a non-negative number', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.addSubscription(c.id, timePlan({ price: -1 }))).toThrow('Price must be at least 0.');
    expect(() => GYM.addSubscription(c.id, timePlan({ price: undefined }))).toThrow('Price is required.');
  });
  it('a failed validation writes nothing', async () => {
    const c = await mkMember('Ali');
    GYM.Store.write.mockClear();
    expect(() => GYM.addSubscription(c.id, timePlan({ price: 100, paid: 200 }))).toThrow();
    expect(GYM.Store.write).not.toHaveBeenCalled();
    expect(GYM.subsOf(c.id)).toHaveLength(0);
  });
});

describe('subState / subRemaining / planLabel', () => {
  it('time plan: ok on the end date, expired the day after', () => {
    const s = sub({ end_date: '2026-03-10' });
    expect(GYM.subState(s, '2026-03-09')).toBe('ok');
    expect(GYM.subState(s, '2026-03-10')).toBe('ok');
    expect(GYM.subState(s, '2026-03-11')).toBe('expired');
  });
  it('time plan remaining days (never negative)', () => {
    const s = sub({ end_date: '2026-03-10' });
    expect(GYM.subRemaining(s, '2026-03-09')).toBe(1);
    expect(GYM.subRemaining(s, '2026-03-10')).toBe(0);
    expect(GYM.subRemaining(s, '2026-03-20')).toBe(0);
  });
  it('sessions plan: finished beats expired, expired by valid-until date, otherwise ok', () => {
    const base = { sub_type: 'sessions', start_date: '2026-03-01', total_sessions: 5, used_sessions: 2 };
    expect(GYM.subState(Object.assign({ end_date: null }, base), '2027-01-01')).toBe('ok');
    expect(GYM.subState(Object.assign({ end_date: '2026-03-10' }, base), '2026-03-10')).toBe('ok');
    expect(GYM.subState(Object.assign({ end_date: '2026-03-10' }, base), '2026-03-11')).toBe('expired');
    expect(GYM.subState(Object.assign({ end_date: null }, base, { used_sessions: 5 }), '2026-03-02')).toBe('finished');
    expect(GYM.subState(Object.assign({ end_date: '2026-03-02' }, base, { used_sessions: 5 }), '2026-03-20')).toBe('finished');
  });
  it('sessions remaining = total - used, floored at 0', () => {
    expect(GYM.subRemaining({ sub_type: 'sessions', total_sessions: 5, used_sessions: 2 })).toBe(3);
    expect(GYM.subRemaining({ sub_type: 'sessions', total_sessions: 5, used_sessions: 7 })).toBe(0);
  });
  it('planLabel', () => {
    expect(GYM.planLabel(null)).toBe('No plan');
    expect(GYM.planLabel(sub({ start_date: '2026-03-01', end_date: '2026-03-30' }))).toBe('30 days');
    expect(GYM.planLabel(sub({ start_date: '2026-03-01', end_date: '2026-03-01' }))).toBe('1 days');
    expect(GYM.planLabel({ sub_type: 'sessions', total_sessions: 10 })).toBe('10 sessions');
  });
  it('defaults "today" to the Tashkent date of the clock', () => {
    expect(GYM.subState(sub({ end_date: TODAY }))).toBe('ok');
    expect(GYM.subState(sub({ end_date: '2026-03-09' }))).toBe('expired');
  });
});

describe('clientStatus', () => {
  it('no plan counts as expired', async () => {
    const c = await mkMember('Ali');
    expect(GYM.clientStatus(c)).toBe('expired');
  });
  it('active with a live plan, expired after the end date', async () => {
    const c = await mkMember('Ali', timePlan({ end_date: TODAY }));
    expect(GYM.clientStatus(c)).toBe('active');
    expect(GYM.clientStatus(c, '2026-03-11')).toBe('expired');
  });
  it('frozen wins over everything', async () => {
    const c = await mkMember('Ali', timePlan());
    GYM.freezeClient(c.id);
    expect(GYM.clientStatus(GYM.S().clients[c.id])).toBe('frozen');
  });
  it('finished sessions plan is expired', async () => {
    const c = await mkMember('Ali', sessionsPlan({ total_sessions: 1 }));
    GYM.checkIn(c.id);
    expect(GYM.clientStatus(c)).toBe('expired');
  });
});

describe('applyPlan (via addSubscription / createClient)', () => {
  it('charges the price and records the payment: debt = price - paid', async () => {
    const c = await mkMember('Ali');
    const s = GYM.addSubscription(c.id, timePlan({ price: 300000, paid: 100000 }));
    expect(GYM.S().clients[c.id].debt).toBe(200000);
    const tx = GYM.values('txns').filter((t) => t.client === c.id);
    expect(tx.map((t) => t.txn_type).sort()).toEqual(['charge', 'payment']);
    const charge = tx.find((t) => t.txn_type === 'charge');
    const pay = tx.find((t) => t.txn_type === 'payment');
    expect(charge.amount).toBe(300000);
    expect(charge.balance_after).toBe(300000);
    expect(charge.note).toBe('Subscription: 31 days');
    expect(pay.amount).toBe(100000);
    expect(pay.balance_after).toBe(200000);
    expect(s.is_active).toBe(true);
    expect(s.used_sessions).toBe(0);
  });
  it('paid defaults to the full price, so no debt is left', async () => {
    const c = await mkMember('Ali', timePlan({ price: 300000 }));
    expect(GYM.S().clients[c.id].debt).toBe(0);
    expect(GYM.values('txns').filter((t) => t.txn_type === 'payment')).toHaveLength(1);
  });
  it('paid = 0 leaves the whole price as debt; price 0 creates no money rows', async () => {
    const c = await mkMember('Ali', timePlan({ price: 100, paid: 0 }));
    expect(GYM.S().clients[c.id].debt).toBe(100);
    const f = await mkMember('Free', timePlan({ price: 0 }));
    expect(GYM.values('txns').filter((t) => t.client === f.id)).toHaveLength(0);
  });
  it('deactivates the previous active plan; only the new one is active', async () => {
    const c = await mkMember('Ali', timePlan());
    const first = GYM.activeSub(c.id);
    const second = GYM.addSubscription(c.id, sessionsPlan());
    expect(GYM.S().subs[first.id].is_active).toBe(false);
    expect(GYM.activeSub(c.id).id).toBe(second.id);
    expect(GYM.subsOf(c.id)).toHaveLength(2);
  });
  it('debts of consecutive plans add up', async () => {
    const c = await mkMember('Ali', timePlan({ price: 100, paid: 0 }));
    GYM.addSubscription(c.id, timePlan({ price: 50, paid: 20 }));
    expect(GYM.S().clients[c.id].debt).toBe(130);
  });
  it('re-activates a frozen member', async () => {
    const c = await mkMember('Ali', timePlan());
    GYM.freezeClient(c.id);
    GYM.addSubscription(c.id, timePlan());
    expect(GYM.S().clients[c.id].status).toBe('active');
    expect(GYM.S().clients[c.id].frozen_since).toBe(null);
  });
  it('amounts are rounded to 2 decimals', async () => {
    const c = await mkMember('Ali');
    GYM.addSubscription(c.id, timePlan({ price: 10.456, paid: 0 }));
    expect(GYM.S().clients[c.id].debt).toBe(10.46);
  });
});

describe('extendSubscription', () => {
  it('needs an active plan', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.extendSubscription(c.id, { days: 5 })).toThrow('This member has no active subscription.');
  });
  it('needs days or sessions', async () => {
    const c = await mkMember('Ali', timePlan());
    expect(() => GYM.extendSubscription(c.id, {})).toThrow('Enter days or sessions to add.');
    expect(() => GYM.extendSubscription(c.id, { days: 0, sessions: 0 })).toThrow('Enter days or sessions to add.');
  });
  it('adds days to end_date', async () => {
    const c = await mkMember('Ali', timePlan({ end_date: '2026-03-31' }));
    const s = GYM.extendSubscription(c.id, { days: 10 });
    expect(s.end_date).toBe('2026-04-10');
  });
  it('adds sessions to a sessions plan', async () => {
    const c = await mkMember('Ali', sessionsPlan({ total_sessions: 10 }));
    const s = GYM.extendSubscription(c.id, { sessions: 5 });
    expect(s.total_sessions).toBe(15);
  });
  it('rejects sessions on a time plan', async () => {
    const c = await mkMember('Ali', timePlan());
    expect(() => GYM.extendSubscription(c.id, { sessions: 2 })).toThrow('Sessions can only be added to a session-based plan.');
  });
  it('rejects days on a sessions plan without a valid-until date', async () => {
    const c = await mkMember('Ali', sessionsPlan());
    expect(() => GYM.extendSubscription(c.id, { days: 2 })).toThrow('This subscription has no end date to extend.');
  });
  it('validates bounds', async () => {
    const c = await mkMember('Ali', timePlan());
    expect(() => GYM.extendSubscription(c.id, { days: -1 })).toThrow('Days must be at least 0.');
    expect(() => GYM.extendSubscription(c.id, { days: 3651 })).toThrow('Days must be at most 3650.');
    expect(() => GYM.extendSubscription(c.id, { days: 1.5 })).toThrow('Days must be a whole number.');
  });
  // extendSubscription is all-or-nothing: validation runs before any mutation.
  it('a rejected extend (days + sessions on a time plan) leaves the plan untouched', async () => {
    const c = await mkMember('Ali', timePlan({ end_date: '2026-03-31' }));
    expect(() => GYM.extendSubscription(c.id, { days: 5, sessions: 2 })).toThrow();
    expect(GYM.activeSub(c.id).end_date).toBe('2026-03-31');
  });
});
