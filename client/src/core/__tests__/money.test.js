import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, mkMember, nb } from './_helpers.js';

beforeAll(prepareHashes);
beforeEach(() => fresh());

const debtOf = (id) => GYM.S().clients[id].debt;

describe('payments and charges', () => {
  it('a payment lowers the debt and logs a payment txn with the balance after', async () => {
    const c = await mkMember('Ali');
    GYM.addCharge(c.id, { amount: 100000 });
    const r = GYM.addPayment(c.id, { amount: 30000, category: 'shop', note: ' part ' });
    expect(r).toEqual({ debt: 70000, exceeded: false });
    const t = GYM.values('txns').find((x) => x.txn_type === 'payment');
    expect(t).toMatchObject({ amount: 30000, balance_after: 70000, category: 'shop', note: 'part', client: c.id, d: '2026-03-10', by: 'admin' });
  });
  it('debt never goes below 0; "exceeded" tells the payment was larger than the debt', async () => {
    const c = await mkMember('Ali');
    GYM.addCharge(c.id, { amount: 1000 });
    expect(GYM.addPayment(c.id, { amount: 1000 })).toEqual({ debt: 0, exceeded: false });
    expect(GYM.addPayment(c.id, { amount: 500 })).toEqual({ debt: 0, exceeded: true });
    expect(debtOf(c.id)).toBe(0);
    const c2 = await mkMember('Vali');
    GYM.addCharge(c2.id, { amount: 1000 });
    expect(GYM.addPayment(c2.id, { amount: 5000 })).toEqual({ debt: 0, exceeded: true });
  });
  it('a charge raises the debt; categories fall back to defaults', async () => {
    const c = await mkMember('Ali');
    expect(GYM.addCharge(c.id, { amount: 2500.5 })).toEqual({ debt: 2500.5 });
    GYM.addCharge(c.id, { amount: 100, category: 'bogus' });
    const charges = GYM.values('txns').filter((t) => t.txn_type === 'charge');
    expect(charges.map((t) => t.category)).toEqual(['other', 'other']);
    GYM.addPayment(c.id, { amount: 1, category: 'bogus' });
    expect(GYM.values('txns').find((t) => t.txn_type === 'payment').category).toBe('membership');
    expect(debtOf(c.id)).toBe(2599.5);
  });
  it('rounds to 2 decimals', async () => {
    const c = await mkMember('Ali');
    GYM.addCharge(c.id, { amount: 0.1 });
    GYM.addCharge(c.id, { amount: 0.2 });
    expect(debtOf(c.id)).toBe(0.3);
  });
  it('unknown member', () => {
    expect(() => GYM.addPayment('x', { amount: 1 })).toThrow('Member not found.');
  });
});

describe('adjustDebt', () => {
  it('sets the new debt and logs an adjustment with the difference and the old value', async () => {
    const c = await mkMember('Ali');
    GYM.addCharge(c.id, { amount: 50000 });
    GYM.adjustDebt(c.id, { debt: 20000, note: 'agreed discount' });
    expect(debtOf(c.id)).toBe(20000);
    const t = GYM.values('txns').find((x) => x.txn_type === 'adjustment');
    expect(t).toMatchObject({ amount: 30000, balance_after: 20000, category: 'adjustment' });
    expect(t.note).toBe('agreed discount (was ' + nb('50 000') + ')');
  });
  it('uses a default note, accepts raising the debt, rejects negatives', async () => {
    const c = await mkMember('Ali');
    GYM.adjustDebt(c.id, { debt: 700 });
    expect(GYM.values('txns')[0].note).toBe('Debt adjusted (was 0)');
    expect(GYM.values('txns')[0].amount).toBe(700);
    expect(() => GYM.adjustDebt(c.id, { debt: -1 })).toThrow('New debt must be at least 0.');
    expect(() => GYM.adjustDebt(c.id, { debt: '' })).toThrow('New debt is required.');
  });
});

describe('money() / num() parsing (through addPayment)', () => {
  it('rejects zero, negative, empty and non-numbers', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.addPayment(c.id, { amount: 0 })).toThrow('Amount must be at least 0.01.');
    expect(() => GYM.addPayment(c.id, { amount: -5 })).toThrow('Amount must be at least 0.01.');
    expect(() => GYM.addPayment(c.id, { amount: '' })).toThrow('Amount is required.');
    expect(() => GYM.addPayment(c.id, {})).toThrow('Amount is required.');
    expect(() => GYM.addPayment(c.id, { amount: 'abc' })).toThrow('Amount must be a number.');
    expect(() => GYM.addPayment(c.id, { amount: 1e13 })).toThrow('Amount must be at most 1000000000000.');
    expect(GYM.values('txns')).toHaveLength(0);
  });
  it('spaces (incl. non-breaking) and commas are thousands separators', async () => {
    const c = await mkMember('Ali');
    GYM.addCharge(c.id, { amount: '5 000 000' });
    expect(debtOf(c.id)).toBe(5000000);
    GYM.addPayment(c.id, { amount: '1,000,000' });
    expect(debtOf(c.id)).toBe(4000000);
    GYM.addPayment(c.id, { amount: '1 000 000' });
    expect(debtOf(c.id)).toBe(3000000);
  });
  it('keeps decimals written with a dot', async () => {
    const c = await mkMember('Ali');
    GYM.addCharge(c.id, { amount: '1 000.25' });
    expect(debtOf(c.id)).toBe(1000.25);
  });
});

describe('addMeasurement', () => {
  it('reads a decimal comma ("82,5") as 82.5', async () => {
    const c = await mkMember('Ali');
    const m = GYM.addMeasurement(c.id, { weight: '82,5', height: '178', body_fat: '16,25' });
    expect(m.weight).toBe(82.5);
    expect(m.height).toBe(178);
    expect(m.body_fat).toBe(16.25);
    expect(m.chest).toBe(null);
  });
  it('a comma followed by three digits is still a thousands separator', async () => {
    const c = await mkMember('Ali');
    /* 3 digits after the comma: not a decimal, becomes 1234 and hits the max of 1000 */
    expect(() => GYM.addMeasurement(c.id, { weight: '1,234' })).toThrow('weight must be at most 1000.');
  });
  it('needs at least one value and rejects negatives / non-numbers', async () => {
    const c = await mkMember('Ali');
    expect(() => GYM.addMeasurement(c.id, { note: 'x' })).toThrow('Enter at least one measurement.');
    expect(() => GYM.addMeasurement(c.id, { weight: '-1' })).toThrow('weight must be at least 0.');
    expect(() => GYM.addMeasurement(c.id, { body_fat: 'lots' })).toThrow('body fat must be a number.');
    expect(GYM.values('measurements')).toHaveLength(0);
  });
  it('deleteMeasurement removes it', async () => {
    const c = await mkMember('Ali');
    const m = GYM.addMeasurement(c.id, { weight: 80 });
    GYM.deleteMeasurement(m.id);
    expect(GYM.values('measurements')).toHaveLength(0);
  });
});
