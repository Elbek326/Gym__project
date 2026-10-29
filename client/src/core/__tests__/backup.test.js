import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, mkMember, timePlan, sessionsPlan, signOut, TODAY } from './_helpers.js';

beforeAll(prepareHashes);
beforeEach(() => fresh());

const clone = (x) => JSON.parse(JSON.stringify(x));

async function populate() {
  const a = await mkMember('Ali', timePlan({ price: 100, paid: 40 }), { phone: '+998 90 111 22 33' });
  const b = await mkMember('Vali', sessionsPlan());
  GYM.checkIn(a.id);
  GYM.checkIn(b.id);
  GYM.addMeasurement(a.id, { weight: '82,5' });
  const p = GYM.saveProduct({ name: 'Water', price: 5000, cost: 2000, stock: 10, expense: true }).product;
  GYM.sellProduct(p.id, { qty: 2, client: a.id });
  GYM.addIncome({ amount: 1000 });
  return { a, b, p };
}

describe('exportBackup', () => {
  it('names the file with the Tashkent date and time and wraps all tables', () => {
    const b = GYM.exportBackup();
    expect(b.name).toBe('gym_2026-03-10_12-00.json');
    const obj = JSON.parse(b.text);
    expect(obj).toMatchObject({ app: 'gym-manager-pro', version: 1, created_at: '2026-03-10T12:00:00' });
    expect(Object.keys(obj.tables).sort()).toEqual([...GYM.TABLES].sort());
    expect(obj.tables.users.u_admin.role).toBe('admin');
  });
  it('is admin-only', () => {
    signOut();
    expect(() => GYM.exportBackup()).toThrow('Please sign in first.');
  });
});

describe('restoreBackup', () => {
  it('round-trips: export then restore into an empty gym gives back the same data', async () => {
    await populate();
    const { text } = GYM.exportBackup();
    const snapshot = clone(GYM.S());

    GYM.loadState({ users: { u_admin: GYM.S().users.u_admin } });     /* wipe everything except the signed-in admin */
    expect(GYM.values('clients')).toHaveLength(0);

    const res = GYM.restoreBackup(text);
    expect(res).toEqual({ loggedOut: false });
    expect(clone(GYM.S())).toEqual(snapshot);
    expect(GYM.Store.replaceAll).toHaveBeenCalledTimes(1);
    /* the derived indexes are rebuilt from the restored data */
    const ali = GYM.values('clients').find((c) => c.name === 'Ali');
    expect(GYM.activeSub(ali.id)).toBeTruthy();
    expect(GYM.visitsOf(ali.id)).toHaveLength(1);
    expect(GYM.financeMonth('2026-03').totals.revenue).toBe(40 + 200000 + 10000 + 1000);
  });
  it('keeps the session when the signed-in admin is in the backup, logs out otherwise', () => {
    const mk = (id) => JSON.stringify({ app: 'gym-manager-pro', version: 1, tables: { users: { [id]: { id, username: 'x', password: 'p', role: 'admin' } } } });
    expect(GYM.restoreBackup(mk('u_admin'))).toEqual({ loggedOut: false });
    expect(GYM.me().id).toBe('u_admin');
    expect(GYM.restoreBackup(mk('other_admin'))).toEqual({ loggedOut: true });
    expect(GYM.me()).toBe(null);
  });
  it('rejects text that is not JSON', () => {
    expect(() => GYM.restoreBackup('not json')).toThrow('This file is not a valid backup.');
  });
  it('rejects JSON that is not a Gym Manager Pro backup', () => {
    expect(() => GYM.restoreBackup('null')).toThrow('This file is not a Bek Sport Gym backup.');
    expect(() => GYM.restoreBackup('{"app":"other","tables":{}}')).toThrow('This file is not a Bek Sport Gym backup.');
    expect(() => GYM.restoreBackup('{"app":"gym-manager-pro"}')).toThrow('This file is not a Bek Sport Gym backup.');
  });
  it('rejects damaged record ids and leaves the data untouched', async () => {
    await populate();
    const before = clone(GYM.S());
    const admin = { id: 'u_admin', role: 'admin', username: 'admin', password: 'x' };
    const bad = (tables) => JSON.stringify({ app: 'gym-manager-pro', tables: Object.assign({ users: { u_admin: admin } }, tables) });
    expect(() => GYM.restoreBackup(bad({ clients: { a: { name: 'no id' } } }))).toThrow('The backup contains a damaged record in clients.');
    expect(() => GYM.restoreBackup(bad({ clients: { a: { id: 'a b' } } }))).toThrow('The backup contains a damaged record in clients.');
    expect(() => GYM.restoreBackup(bad({ products: { a: { id: '../../x' } } }))).toThrow('The backup contains a damaged record in products.');
    expect(() => GYM.restoreBackup(bad({ clients: { a: { id: 5 } } }))).toThrow('damaged record in clients');
    expect(() => GYM.restoreBackup(bad({ clients: { a: null } }))).toThrow('damaged record in clients');
    expect(() => GYM.restoreBackup(bad({ visits: { v: { id: 'v', d: 'bad-date' } } }))).toThrow('The backup contains a damaged record in visits.');
    expect(() => GYM.restoreBackup(bad({ txns: { v: { id: 'v' } } }))).toThrow('The backup contains a damaged record in txns.');
    expect(clone(GYM.S())).toEqual(before);
    expect(GYM.Store.replaceAll).not.toHaveBeenCalled();
  });
  it('rejects a backup without an admin account', () => {
    const t = JSON.stringify({ app: 'gym-manager-pro', tables: { users: { m: { id: 'm', role: 'member', client: 'c' } } } });
    expect(() => GYM.restoreBackup(t)).toThrow('The backup has no admin account.');
    expect(() => GYM.restoreBackup(JSON.stringify({ app: 'gym-manager-pro', tables: {} }))).toThrow('The backup has no admin account.');
    expect(GYM.S().users.u_admin).toBeTruthy();
  });
});

describe('sample data', () => {
  it('loadSample fills an empty gym with flagged records', () => {
    expect(GYM.hasSample()).toBe(false);
    expect(GYM.loadSample()).toBe(12);
    expect(GYM.hasSample()).toBe(true);
    expect(GYM.values('clients')).toHaveLength(12);
    ['clients', 'subs', 'visits', 'txns', 'sales', 'products', 'expenses', 'measurements'].forEach((t) => {
      expect(GYM.values(t).length, t).toBeGreaterThan(0);
      GYM.values(t).forEach((r) => expect(r.sample, t).toBe(true));
    });
    expect(GYM.values('users')).toHaveLength(1);
    expect(GYM.values('clients').every((c) => c.debt >= 0)).toBe(true);
    expect(GYM.dashboard().counts.total).toBe(12);
    expect(GYM.dashboard().counts.frozen).toBe(1);
  });
  it('refuses to load into a gym that already has members', async () => {
    await mkMember('Ali');
    expect(() => GYM.loadSample()).toThrow('Sample data can only be loaded into an empty gym.');
    expect(GYM.values('clients')).toHaveLength(1);
  });
  it('refuses a second load', () => {
    GYM.loadSample();
    expect(() => GYM.loadSample()).toThrow('Sample data can only be loaded into an empty gym.');
  });
  it('removeSample removes only sample records and keeps users, audit and real data', async () => {
    GYM.loadSample();
    const real = await mkMember('Real Member', timePlan({ price: 100 }));
    GYM.checkIn(real.id);
    const p = GYM.saveProduct({ name: 'Real product', price: 10, stock: 5 }).product;
    GYM.sellProduct(p.id, { qty: 1 });
    GYM.addExpense({ category: 'rent', amount: 10 });
    GYM.addIncome({ amount: 7 });

    const n = GYM.removeSample();
    expect(n).toBeGreaterThan(50);
    expect(GYM.hasSample()).toBe(false);
    TABLES_WITH_SAMPLE_FLAG.forEach((t) => GYM.values(t).forEach((r) => expect(r.sample, t).toBeUndefined()));
    expect(GYM.values('clients').map((c) => c.name)).toEqual(['Real Member']);
    expect(GYM.values('subs')).toHaveLength(1);
    expect(GYM.values('visits')).toHaveLength(1);
    expect(GYM.values('products').map((x) => x.name)).toEqual(['Real product']);
    expect(GYM.values('sales')).toHaveLength(1);
    expect(GYM.values('expenses')).toHaveLength(1);
    expect(GYM.values('txns').filter((t) => t.txn_type === 'income')).toHaveLength(1);
    expect(GYM.values('users')).toHaveLength(1);
    expect(GYM.values('audit').some((a) => a.action === 'SAMPLE_REMOVED')).toBe(true);
    expect(GYM.values('audit').some((a) => a.action === 'SAMPLE_LOADED')).toBe(true);
    expect(GYM.financeMonth(TODAY.slice(0, 7)).totals.revenue).toBe(100 + 10 + 7);
  });
  it('after removing the sample the gym is empty again and can load it again', () => {
    GYM.loadSample();
    GYM.removeSample();
    expect(GYM.values('clients')).toHaveLength(0);
    expect(GYM.loadSample()).toBe(12);
  });
});

const TABLES_WITH_SAMPLE_FLAG = ['clients', 'subs', 'visits', 'txns', 'sales', 'products', 'expenses', 'measurements'];
