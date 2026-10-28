import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, mkMember, timePlan, sessionsPlan, addMemberUser, MEMBER_PW, TODAY, T0 } from './_helpers.js';

beforeAll(prepareHashes);
beforeEach(() => fresh());

describe('createClient', () => {
  it('creates an active member with defaults', async () => {
    const c = await GYM.createClient({ name: '  Ali Karimov ', phone: ' +998 90 111 22 33 ', note: ' hi ', days: ['Wed', 'Mon', 'Xyz', 'Mon'] });
    expect(c).toMatchObject({ name: 'Ali Karimov', phone: '+998 90 111 22 33', note: 'hi', status: 'active', frozen_since: null, debt: 0, days: 'Mon,Wed', image: null });
    expect(GYM.S().clients[c.id]).toBe(c);
    expect(GYM.values('audit').some((a) => a.action === 'MEMBER_ADDED')).toBe(true);
  });
  it('accepts days as a comma string; empty phone becomes null', async () => {
    const c = await GYM.createClient({ name: 'A', phone: '  ', days: 'Sun, Sat' });
    expect(c.days).toBe('Sat,Sun');
    expect(c.phone).toBe(null);
  });
  it('validates name, phone, photo', async () => {
    await expect(GYM.createClient({ name: '  ' })).rejects.toThrow('Name is required.');
    await expect(GYM.createClient({ name: 'x'.repeat(121) })).rejects.toThrow('Name is too long.');
    await expect(GYM.createClient({ name: 'A', phone: 'abc' })).rejects.toThrow('Phone number must contain digits.');
    await expect(GYM.createClient({ name: 'A', image: 'http://x/y.png' })).rejects.toThrow('The photo is not a valid image.');
    await expect(GYM.createClient({ name: 'A', image: 'data:image/png;base64,' + 'A'.repeat(400000) })).rejects.toThrow('The photo is too large.');
    expect(GYM.values('clients')).toHaveLength(0);
  });
  it('rejects a phone number already used, whatever the formatting', async () => {
    await GYM.createClient({ name: 'Ali', phone: '+998 90 111 22 33' });
    await expect(GYM.createClient({ name: 'Vali', phone: '998901112233' })).rejects.toThrow('This phone number already belongs to Ali.');
    expect(GYM.values('clients')).toHaveLength(1);
  });
  it('with a plan: creates the subscription and the debt; a bad plan creates nothing', async () => {
    const c = await mkMember('Ali', timePlan({ price: 100, paid: 40 }));
    expect(GYM.S().clients[c.id].debt).toBe(60);
    expect(GYM.activeSub(c.id)).toBeTruthy();
    await expect(GYM.createClient({ name: 'Bad', plan: timePlan({ price: 1, paid: 2 }) })).rejects.toThrow('Amount paid cannot be more than the price.');
    expect(GYM.values('clients')).toHaveLength(1);
  });
});

describe('updateClient', () => {
  it('updates fields, keeps the photo when image is not sent', async () => {
    const c = await mkMember('Ali', null, { image: 'data:image/png;base64,AAAA', phone: '+998 90 111 22 33' });
    await GYM.updateClient(c.id, { name: 'Ali K', phone: '+998 90 111 22 33', days: 'Fri', note: 'n' });
    expect(GYM.S().clients[c.id]).toMatchObject({ name: 'Ali K', days: 'Fri', note: 'n', image: 'data:image/png;base64,AAAA' });
    await GYM.updateClient(c.id, { name: 'Ali K', image: null });
    expect(GYM.S().clients[c.id].image).toBe(null);
  });
  it('phone uniqueness excludes the member themself', async () => {
    const a = await mkMember('Ali', null, { phone: '+998 90 111 22 33' });
    const b = await mkMember('Vali', null, { phone: '+998 91 222 33 44' });
    await expect(GYM.updateClient(b.id, { name: 'Vali', phone: '+998 (90) 111-22-33' })).rejects.toThrow('This phone number already belongs to Ali.');
    await expect(GYM.updateClient(a.id, { name: 'Ali', phone: '998901112233' })).resolves.toBeTruthy();
  });
  it('adds, renames and re-passwords the member login', async () => {
    const c = await mkMember('Ali');
    await GYM.updateClient(c.id, { name: 'Ali', login: 'ali1', password: 'pass1234' });
    expect(GYM.memberLogin(c.id).username).toBe('ali1');
    const hash1 = GYM.values('users').find((u) => u.role === 'member').password;

    /* blank password keeps the current one; a new login name is applied */
    await GYM.updateClient(c.id, { name: 'Ali', login: 'ali2', password: '' });
    const u = GYM.values('users').find((x) => x.role === 'member');
    expect(u.username).toBe('ali2');
    expect(u.password).toBe(hash1);

    await GYM.updateClient(c.id, { name: 'Ali', login: 'ali2', password: 'other1234' });
    expect(await GYM.verifyPassword('other1234', GYM.values('users').find((x) => x.role === 'member').password)).toBe(true);
  });
  it('an existing login cannot be blanked; password-only change needs a login', async () => {
    const c = await mkMember('Ali');
    await GYM.updateClient(c.id, { name: 'Ali', login: 'ali1', password: 'pass1234' });
    await expect(GYM.updateClient(c.id, { name: 'Ali', login: '' })).rejects.toThrow('Login is required while the member has an account.');
    const d = await mkMember('Vali');
    await expect(GYM.updateClient(d.id, { name: 'Vali', login: 'ali1', password: 'pass1234' })).rejects.toThrow('That username is taken.');
  });
  it('resetMemberPassword', async () => {
    const c = await mkMember('Ali');
    await expect(GYM.resetMemberPassword(c.id, 'pass1234')).rejects.toThrow('This member has no login.');
    addMemberUser(c.id, 'ali1');
    await expect(GYM.resetMemberPassword(c.id, 'abc')).rejects.toThrow('Password must be at least 4 characters.');
    await GYM.resetMemberPassword(c.id, 'fresh1234');
    const u = await GYM.login('ali1', 'fresh1234');
    expect(u.role).toBe('member');
    await expect(GYM.login('ali1', MEMBER_PW)).rejects.toThrow('Wrong username or password.');
    expect(JSON.stringify(GYM.values('audit'))).not.toContain('fresh1234');
  });
});

describe('deleteClient', () => {
  it('removes subs, visits, measurements and the member login; anonymises txns and sales', async () => {
    const c = await mkMember('Ali', timePlan({ price: 100, paid: 50 }));
    const other = await mkMember('Vali', timePlan({ price: 10 }));
    GYM.checkIn(c.id);
    GYM.checkIn(other.id);
    GYM.addMeasurement(c.id, { weight: 80 });
    addMemberUser(c.id, 'ali1');
    const p = GYM.saveProduct({ name: 'Water', price: 5, stock: 5 }).product;
    GYM.sellProduct(p.id, { qty: 1, client: c.id });
    const txBefore = GYM.values('txns').filter((t) => t.client === c.id).length;
    expect(txBefore).toBe(2);

    GYM.deleteClient(c.id);

    expect(GYM.S().clients[c.id]).toBeUndefined();
    expect(GYM.values('subs').filter((s) => s.client === c.id)).toHaveLength(0);
    expect(GYM.values('visits').filter((v) => v.client === c.id)).toHaveLength(0);
    expect(GYM.values('measurements')).toHaveLength(0);
    expect(GYM.values('users').some((u) => u.role === 'member')).toBe(false);

    /* money history stays, but no longer points at the member */
    const txns = GYM.values('txns').filter((t) => t.note.includes('[member: Ali]'));
    expect(txns).toHaveLength(2);
    txns.forEach((t) => expect(t.client).toBe(null));
    expect(GYM.values('txns').filter((t) => t.client === c.id)).toHaveLength(0);
    expect(GYM.values('sales')[0].client).toBe(null);
    expect(GYM.values('sales')).toHaveLength(1);

    /* the other member is untouched */
    expect(GYM.values('subs').filter((s) => s.client === other.id)).toHaveLength(1);
    expect(GYM.visitsOf(other.id)).toHaveLength(1);
    expect(GYM.values('audit').map((a) => a.action)).toEqual(expect.arrayContaining(['MEMBER_LOGIN_DELETED', 'MEMBER_DELETED']));
    /* the index cache was refreshed */
    expect(GYM.activeSub(c.id)).toBe(null);
    expect(GYM.visitsOf(c.id)).toHaveLength(0);
  });
  it('unknown member', () => {
    expect(() => GYM.deleteClient('nope')).toThrow('Member not found.');
  });
});

describe('lists and dashboard', () => {
  it('memberRows filters by status and searches name / phone digits', async () => {
    const a = await mkMember('Ali', timePlan({ end_date: TODAY }), { phone: '+998 90 111 22 33' });
    const b = await mkMember('Bobur', timePlan({ end_date: '2026-03-09' }));
    const c = await mkMember('Carim', timePlan());
    GYM.freezeClient(c.id);
    const all = GYM.memberRows();
    expect(all.counts).toEqual({ all: 3, active: 1, frozen: 1, expired: 1 });
    expect(all.rows.map((r) => r.c.name)).toEqual(['Ali', 'Bobur', 'Carim']);
    expect(GYM.memberRows({ filter: 'expired' }).rows.map((r) => r.c.id)).toEqual([b.id]);
    expect(GYM.memberRows({ q: '901112233' }).rows.map((r) => r.c.id)).toEqual([a.id]);
    expect(GYM.memberRows({ q: 'bob' }).rows).toHaveLength(1);
  });
  it('dashboard flags plans ending within 7 days and low sessions', async () => {
    await mkMember('Soon', timePlan({ end_date: '2026-03-13' }));
    await mkMember('Today', timePlan({ end_date: TODAY }));
    await mkMember('Later', timePlan({ end_date: '2026-04-30' }));
    await mkMember('Few', sessionsPlan({ total_sessions: 2 }));
    const d = GYM.dashboard();
    expect(d.counts).toEqual({ total: 4, active: 4, frozen: 0, expired: 0 });
    expect(d.expiring.map((e) => e.c.name)).toEqual(['Today', 'Few', 'Soon']);
    expect(d.expiring.find((e) => e.c.name === 'Today').label).toBe('Ends today');
    expect(d.expiring.find((e) => e.c.name === 'Soon').label).toBe('3 days left');
    expect(d.expiring.find((e) => e.c.name === 'Few').label).toBe('2 sessions left');
  });
  it('lostMembers lists members idle for 30+ days, skipping frozen ones', async () => {
    const a = await mkMember('Ali', timePlan());
    const f = await mkMember('Frozen', timePlan());
    GYM.freezeClient(f.id);
    GYM.S().clients[a.id].created_at = '2026-01-01T10:00:00';
    GYM.S().clients[f.id].created_at = '2026-01-01T10:00:00';
    const lost = GYM.lostMembers();
    expect(lost.map((l) => l.c.name)).toEqual(['Ali']);
    expect(lost[0].gap).toBe(68);
  });
  it('newMembers by month; attendanceSeries counts visits per day', async () => {
    const a = await mkMember('Ali', timePlan());
    GYM.checkIn(a.id);
    expect(GYM.newMembers('2026-03').map((c) => c.name)).toEqual(['Ali']);
    expect(GYM.newMembers('2026-02')).toEqual([]);
    const s = GYM.attendanceSeries(3);
    expect(s.map((x) => x.d)).toEqual(['2026-03-08', '2026-03-09', '2026-03-10']);
    expect(s.map((x) => x.value)).toEqual([0, 0, 1]);
  });
  it('paginate clamps the page', () => {
    const list = [1, 2, 3, 4, 5];
    expect(GYM.paginate(list, 2, 2)).toMatchObject({ items: [3, 4], page: 2, pages: 3, total: 5, from: 3, to: 4 });
    expect(GYM.paginate(list, 99, 2).page).toBe(3);
    expect(GYM.paginate(list, 'x', 2).page).toBe(1);
    expect(GYM.paginate([], 1, 2)).toMatchObject({ items: [], pages: 1, from: 0, to: 0 });
  });
});

describe('state helpers', () => {
  it('loadState replaces everything, rev() grows on changes', () => {
    const r0 = GYM.rev();
    GYM.loadState({ clients: { x: { id: 'x', name: 'X' } } });
    expect(GYM.rev()).toBeGreaterThan(r0);
    expect(Object.keys(GYM.S().clients)).toEqual(['x']);
    expect(GYM.S().users).toEqual({});
    expect(GYM.TABLES.every((t) => t in GYM.S())).toBe(true);
  });
  it('applyRemote: plain tables and sharded tables; returns whether something changed', () => {
    expect(GYM.applyRemote('nope', 'a', {})).toBe(false);
    expect(GYM.applyRemote('products', 'p1', { id: 'p1', name: 'W' })).toBe(true);
    expect(GYM.applyRemote('products', 'p1', { id: 'p1', name: 'W' })).toBe(false);
    expect(GYM.applyRemote('products', 'p1', null)).toBe(true);
    expect(GYM.applyRemote('products', 'p1', null)).toBe(false);
    expect(GYM.applyRemote('visits', '2026-03-10', { items: [{ id: 'v1', d: '2026-03-10' }] })).toBe(true);
    expect(GYM.shardItems('visits', '2026-03-10')).toHaveLength(1);
    expect(GYM.applyRemote('visits', '2026-03-10', { items: [] })).toBe(true);
    expect(GYM.shardItems('visits', '2026-03-10')).toHaveLength(0);
  });
  it('allDocPaths maps records to their document path (sharded tables by date)', () => {
    GYM.loadState({ clients: { c1: { id: 'c1' } }, visits: { v1: { id: 'v1', d: '2026-03-10' }, v2: { id: 'v2', d: '2026-03-10' } } });
    expect(Object.keys(GYM.allDocPaths(GYM.S())).sort()).toEqual(['clients/c1', 'visits/2026-03-10']);
    expect(GYM.SHARD_OF('visits')).toBe(true);
    expect(GYM.SHARD_OF('clients')).toBe(false);
  });
  it('T0 is the fixed test instant', () => { expect(GYM.now().date).toBe('2026-03-10'); expect(T0).toBeGreaterThan(0); });
});
