import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, mkMember, T0 } from './_helpers.js';

beforeAll(prepareHashes);
beforeEach(() => fresh());

const FEB = Date.UTC(2026, 1, 15, 7, 0, 0);

describe('financeMonth', () => {
  it('sums payments + income + sales into revenue; profit = revenue - expenses; other months are ignored', async () => {
    const c = await mkMember('Ali');
    const p = GYM.saveProduct({ name: 'Water', price: 5000, cost: 2000, stock: 50 }).product;

    /* February: must not show up in March */
    GYM.setClock(FEB);
    GYM.addCharge(c.id, { amount: 999 });
    GYM.addPayment(c.id, { amount: 999 });
    GYM.addIncome({ amount: 77777, category: 'day pass' });
    GYM.sellProduct(p.id, { qty: 1 });
    GYM.addExpense({ category: 'rent', amount: 88888 });

    /* March */
    GYM.setClock(T0);
    GYM.addCharge(c.id, { amount: 100000 });          /* charges are not revenue */
    GYM.addPayment(c.id, { amount: 50000 });
    GYM.addIncome({ amount: 20000, category: 'personal training' });
    GYM.sellProduct(p.id, { qty: 3 });                /* 15 000 */
    GYM.adjustDebt(c.id, { debt: 1 });                /* adjustments are not revenue */
    GYM.addExpense({ category: 'rent', amount: 30000 });
    GYM.addExpense({ category: 'utilities', amount: 5000 });
    GYM.addExpense({ category: 'rent', amount: 2000, date: '2026-03-02' });

    const fm = GYM.financeMonth('2026-03');
    expect(fm.totals).toEqual({ payments: 50000, income: 20000, sales: 15000, revenue: 85000, expenses: 37000, profit: 48000 });
    expect(fm.byCat).toEqual({ rent: 32000, utilities: 5000 });
    expect(fm.income).toHaveLength(3);
    expect(fm.expenses).toHaveLength(3);
    expect(fm.daily['2026-03-10']).toEqual({ d: '2026-03-10', revenue: 85000, expense: 35000 });
    expect(fm.daily['2026-03-02']).toEqual({ d: '2026-03-02', revenue: 0, expense: 2000 });

    const feb = GYM.financeMonth('2026-02');
    expect(feb.totals).toEqual({ payments: 999, income: 77777, sales: 5000, revenue: 83776, expenses: 88888, profit: -5112 });
  });
  it('lists income rows with kind, label and member name, newest first', async () => {
    const c = await mkMember('Ali');
    GYM.addCharge(c.id, { amount: 10 });
    GYM.addPayment(c.id, { amount: 10, category: 'membership' });
    GYM.addIncome({ amount: 5, category: 'locker rental', date: '2026-03-12' });
    const rows = GYM.financeMonth('2026-03').income;
    expect(rows.map((r) => r.kind)).toEqual(['income', 'payment']);
    expect(rows[0].label).toBe('Income: locker rental');
    expect(rows[1]).toMatchObject({ label: 'Payment: membership', who: 'Ali' });
  });
  it('an empty month is all zeros', () => {
    expect(GYM.financeMonth('2025-01').totals).toEqual({ payments: 0, income: 0, sales: 0, revenue: 0, expenses: 0, profit: 0 });
  });
  it('a stock purchase recorded as expense lowers the profit', () => {
    GYM.saveProduct({ name: 'Water', price: 5000, cost: 2000, stock: 10, expense: true });
    expect(GYM.financeMonth('2026-03').totals.profit).toBe(-20000);
  });
});

describe('income / expense records', () => {
  it('addIncome falls back to category "other", validates date and amount', () => {
    expect(GYM.addIncome({ amount: 100, category: 'weird' }).category).toBe('other');
    expect(GYM.addIncome({ amount: 100, date: '2026-01-05' })).toMatchObject({ d: '2026-01-05', created_at: '2026-01-05T12:00:00', txn_type: 'income', client: null });
    expect(() => GYM.addIncome({ amount: 100, date: '2026-02-30' })).toThrow('Date is not valid.');
    expect(() => GYM.addIncome({ amount: 0 })).toThrow('Amount must be at least 0.01.');
  });
  it('deleteIncome removes a manual income entry', () => {
    const t = GYM.addIncome({ amount: 100 });
    GYM.deleteIncome(t.id);
    expect(GYM.values('txns')).toHaveLength(0);
  });
  it('deleteIncome refuses payments, charges and unknown ids', async () => {
    const c = await mkMember('Ali');
    GYM.addCharge(c.id, { amount: 10 });
    GYM.addPayment(c.id, { amount: 10 });
    GYM.values('txns').forEach((t) => {
      expect(() => GYM.deleteIncome(t.id)).toThrow('Only manual income entries can be deleted.');
    });
    expect(() => GYM.deleteIncome('nope')).toThrow('Only manual income entries can be deleted.');
    expect(GYM.values('txns')).toHaveLength(2);
  });
  it('addExpense validates category, amount and date; deleteExpense removes', () => {
    expect(() => GYM.addExpense({ category: 'beer', amount: 5 })).toThrow('Choose an expense category.');
    expect(() => GYM.addExpense({ category: 'rent', amount: 0 })).toThrow('Amount must be at least 0.01.');
    expect(() => GYM.addExpense({ category: 'rent', amount: 5, date: '2026-13-01' })).toThrow('Date is not valid.');
    const e = GYM.addExpense({ category: 'rent', amount: 5, note: ' x ' });
    expect(e).toMatchObject({ category: 'rent', amount: 5, note: 'x', date: '2026-03-10' });
    GYM.deleteExpense(e.id);
    expect(GYM.values('expenses')).toHaveLength(0);
  });
});

describe('dashboard / report built on financeMonth', () => {
  it('dashboard month totals equal financeMonth totals', async () => {
    GYM.addIncome({ amount: 1000 });
    GYM.addExpense({ category: 'rent', amount: 400 });
    const d = GYM.dashboard();
    expect(d.today).toBe('2026-03-10');
    expect(d.month).toEqual(GYM.financeMonth('2026-03').totals);
    expect(d.series).toHaveLength(7);
    expect(d.series[6].d).toBe('2026-03-10');
  });
  it('monthlyReport covers every day of the month', () => {
    const r = GYM.monthlyReport('2024-02');
    expect(r.days).toHaveLength(29);
    expect(r.summary[0]).toEqual(['Month', 'February 2024']);
  });
});
