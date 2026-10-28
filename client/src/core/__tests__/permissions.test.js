import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, mkMember, timePlan, addMemberUser, signInAs, signOut } from './_helpers.js';

beforeAll(prepareHashes);

let ali, vali, memberId;
beforeEach(async () => {
  fresh();
  ali = await mkMember('Ali', timePlan(), { phone: '+998 90 111 22 33', note: 'secret staff note', image: 'data:image/png;base64,AAAA' });
  vali = await mkMember('Vali', timePlan(), { phone: '+998 91 222 33 44', image: 'data:image/png;base64,BBBB' });
  GYM.checkIn(ali.id);
  GYM.addCharge(ali.id, { amount: 1000 });
  memberId = addMemberUser(ali.id, 'ali_login');
});

describe('signed out', () => {
  it('requireUser / requireStaff ask to sign in', () => {
    signOut();
    expect(GYM.me()).toBe(null);
    expect(() => GYM.requireUser()).toThrow('Please sign in first.');
    expect(() => GYM.requireStaff()).toThrow('Please sign in first.');
    expect(() => GYM.rankings()).toThrow('Please sign in first.');
    expect(() => GYM.profileData(ali.id)).toThrow('Please sign in first.');
  });
  it('a user whose role no longer exists does not count as signed in', () => {
    GYM.S().users.u_old = { id: 'u_old', username: 'old', password: 'x', role: 'owner' };
    expect(GYM.restoreSession('u_old')).toBe(null);
    expect(GYM.restoreSession('missing')).toBe(null);
  });
});

describe('a member user cannot use staff functions', () => {
  beforeEach(() => { expect(signInAs(memberId)).toBeTruthy(); });

  it('is not staff', () => {
    expect(GYM.me().role).toBe('member');
    expect(GYM.isStaff(GYM.me())).toBe(false);
    expect(() => GYM.requireStaff()).toThrow('Only staff can do this.');
  });
  it('every staff entry point throws', async () => {
    const staffCalls = {
      checkIn: () => GYM.checkIn(vali.id),
      freezeClient: () => GYM.freezeClient(vali.id),
      unfreezeClient: () => GYM.unfreezeClient(vali.id),
      addPayment: () => GYM.addPayment(vali.id, { amount: 1 }),
      addCharge: () => GYM.addCharge(vali.id, { amount: 1 }),
      adjustDebt: () => GYM.adjustDebt(vali.id, { debt: 0 }),
      addMeasurement: () => GYM.addMeasurement(vali.id, { weight: 80 }),
      addSubscription: () => GYM.addSubscription(vali.id, timePlan()),
      extendSubscription: () => GYM.extendSubscription(vali.id, { days: 1 }),
      deleteClient: () => GYM.deleteClient(vali.id),
      saveProduct: () => GYM.saveProduct({ name: 'x', price: 1 }),
      sellProduct: () => GYM.sellProduct('p', { qty: 1 }),
      addExpense: () => GYM.addExpense({ category: 'rent', amount: 1 }),
      addIncome: () => GYM.addIncome({ amount: 1 }),
      financeMonth: () => GYM.financeMonth('2026-03'),
      dashboard: () => GYM.dashboard(),
      memberRows: () => GYM.memberRows(),
      lostMembers: () => GYM.lostMembers(),
      newMembers: () => GYM.newMembers('2026-03'),
      monthlyReport: () => GYM.monthlyReport('2026-03'),
      listAudit: () => GYM.listAudit(),
      memberLogin: () => GYM.memberLogin(ali.id),
      clientName: () => GYM.clientName(ali.id)
    };
    Object.keys(staffCalls).forEach((k) => {
      expect(staffCalls[k], k).toThrow('Only staff can do this.');
    });
    await expect(GYM.createClient({ name: 'Z' })).rejects.toThrow('Only staff can do this.');
    await expect(GYM.updateClient(ali.id, { name: 'Z' })).rejects.toThrow('Only staff can do this.');
    await expect(GYM.resetMemberPassword(ali.id, 'abcd')).rejects.toThrow('Only staff can do this.');
    expect(GYM.S().clients[vali.id]).toBeTruthy();
    expect(GYM.values('visits')).toHaveLength(1);
  });
  it('admin-only functions say so', async () => {
    expect(() => GYM.listUsers()).toThrow('Only an admin can do this.');
    expect(() => GYM.exportBackup()).toThrow('Only an admin can do this.');
    expect(() => GYM.restoreBackup('{}')).toThrow('Only an admin can do this.');
    expect(() => GYM.loadSample()).toThrow('Only an admin can do this.');
    expect(() => GYM.removeSample()).toThrow('Only an admin can do this.');
    expect(() => GYM.deleteUser('u_admin')).toThrow('Only an admin can do this.');
    expect(() => GYM.setRole('u_admin', 'admin')).toThrow('Only an admin can do this.');
    await expect(GYM.addUser({ username: 'hacker', password: 'abcd', role: 'admin' })).rejects.toThrow('Only an admin can do this.');
  });

  describe('profileData', () => {
    it('opens only the own profile, without the staff note', () => {
      const p = GYM.profileData(ali.id);
      expect(p.own).toBe(true);
      expect(p.c.name).toBe('Ali');
      expect('note' in p.c).toBe(false);
      expect(p.status).toBe('active');
      expect(p.visits).toHaveLength(1);
      expect(p.txs.length).toBeGreaterThan(0);
      expect(p.login).toEqual({ username: 'ali_login', created_at: '2026-01-01T00:00:00' });
      /* the stored record keeps its note */
      expect(GYM.S().clients[ali.id].note).toBe('secret staff note');
    });
    it('refuses another member and unknown ids', () => {
      expect(() => GYM.profileData(vali.id)).toThrow('You can only open your own profile.');
      expect(() => GYM.profileData('nope')).toThrow('You can only open your own profile.');
    });
    it('never exposes the password hash', () => {
      expect(JSON.stringify(GYM.profileData(ali.id))).not.toContain('pbkdf2');
    });
  });

  describe('rankings', () => {
    it('hides money and other members\' photos, marks "me"', () => {
      const rows = GYM.rankings();
      expect(rows).toHaveLength(2);
      const mine = rows.find((r) => r.c.id === ali.id);
      const other = rows.find((r) => r.c.id === vali.id);
      expect(mine.me).toBe(true);
      expect(other.me).toBe(false);
      expect(mine.c.image).toBe('data:image/png;base64,AAAA');
      expect(other.c.image).toBe(null);
      rows.forEach((r) => {
        expect('paid' in r).toBe(false);
        expect(Object.keys(r.c).sort()).toEqual(['id', 'image', 'name']);
      });
      expect(JSON.stringify(rows)).not.toContain('+998');
      expect(JSON.stringify(rows)).not.toContain('debt');
    });
  });
});

describe('staff', () => {
  it('opens any profile with the note, and gets null for an unknown id', () => {
    const p = GYM.profileData(ali.id);
    expect(p.own).toBe(false);
    expect(p.c.note).toBe('secret staff note');
    expect(GYM.profileData('nope')).toBe(null);
  });
  it('rankings include money; score = visits*3 + months*2 + paid/10000', async () => {
    GYM.addPayment(ali.id, { amount: 20000 });
    const rows = GYM.rankings();
    const mine = rows.find((r) => r.c.id === ali.id);
    expect(mine.paid).toBe(300000 + 20000);
    expect(mine.visits).toBe(1);
    expect(mine.score).toBe(1 * 3 + 0 * 2 + 320000 / 10000);
    expect(rows[0].c.id).toBe(ali.id);
    expect(mine.c.phone).toBe('+998 90 111 22 33');
  });
});

describe('read-only store', () => {
  it('blocks every write but still allows reads', async () => {
    GYM.Store.readOnly = true;
    const msg = 'This view is read-only. Changes cannot be saved.';
    expect(() => GYM.checkIn(vali.id)).toThrow(msg);
    expect(() => GYM.addPayment(vali.id, { amount: 1 })).toThrow(msg);
    expect(() => GYM.addCharge(vali.id, { amount: 1 })).toThrow(msg);
    expect(() => GYM.freezeClient(vali.id)).toThrow(msg);
    expect(() => GYM.saveProduct({ name: 'x', price: 1 })).toThrow(msg);
    expect(() => GYM.addExpense({ category: 'rent', amount: 1 })).toThrow(msg);
    expect(() => GYM.addIncome({ amount: 1 })).toThrow(msg);
    expect(() => GYM.deleteClient(vali.id)).toThrow(msg);
    expect(() => GYM.loadSample()).toThrow(msg);
    expect(() => GYM.restoreBackup('{}')).toThrow(msg);
    await expect(GYM.createClient({ name: 'Z' })).rejects.toThrow(msg);
    expect(GYM.S().clients[vali.id]).toBeTruthy();
    expect(GYM.dashboard().counts.total).toBe(2);
    expect(GYM.financeMonth('2026-03').totals).toBeTruthy();
  });
  it('writes go through Store.write when not read-only', () => {
    GYM.Store.write.mockClear();
    GYM.addIncome({ amount: 1 });
    expect(GYM.Store.write).toHaveBeenCalled();
    const tables = GYM.Store.write.mock.calls.map((c) => c[0]);
    expect(tables).toContain('txns');
    expect(tables).toContain('audit');
  });
  it('deleting goes through Store.remove', () => {
    GYM.deleteClient(vali.id);
    expect(GYM.Store.remove).toHaveBeenCalledWith('clients', expect.objectContaining({ id: vali.id }));
  });
});
