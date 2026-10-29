import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { run, _resetForTests } from '../src/core.js';
import { query, closePool } from '../src/db.js';

const hasDb = !!process.env.DATABASE_URL;
const app = createApp();

async function signIn(username, password) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.headers['set-cookie'].find((c) => c.startsWith('gym_sid=')).split(';')[0];
}
const as = (cookie) => ({
  get: (u) => request(app).get(u).set('Cookie', cookie),
  post: (u, b = {}) => request(app).post(u).set('Cookie', cookie).send(b),
  del: (u) => request(app).delete(u).set('Cookie', cookie).send({})
});
const db1 = async (sql, p) => (await query(sql, p)).rows[0];

describe.runIf(hasDb)('check-in and money API', () => {
  let admin, ali, vali, today;
  beforeAll(async () => {
    await query('TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE');
    _resetForTests();
    await run(null, (G) => G.ensureDefaultAdmin());
    today = (await run(null, (G) => G.now())).date;
    admin = as(await signIn('admin', 'admin123'));
    ali = (await admin.post('/api/members', {
      name: 'Ali', login: 'ali', password: 'ali-pass',
      plan: { sub_type: 'sessions', start_date: today, total_sessions: '2', price: '0' }
    })).body.id;
    vali = (await admin.post('/api/members', { name: 'Vali' })).body.id;
  });
  afterAll(closePool);

  it('checks a member in once a day and counts the session', async () => {
    const res = await admin.post(`/api/members/${ali}/checkin`);
    expect(res.status).toBe(201);
    expect(res.body.remaining).toBe(1);
    expect(res.body.visit.visit_date).toBe(today);
    const again = await admin.post(`/api/members/${ali}/checkin`);
    expect(again.status).toBe(400);
    expect(again.body.error).toBe('Ali already checked in today.');
    expect((await db1('SELECT count(*)::int n FROM visits WHERE client = $1', [ali])).n).toBe(1);
    expect((await db1('SELECT used_sessions FROM subs WHERE client = $1 AND is_active', [ali])).used_sessions).toBe(1);
  });

  it('refuses a member without a plan, or frozen', async () => {
    expect((await admin.post(`/api/members/${vali}/checkin`)).body.error).toBe('Vali has no active subscription.');
    await admin.post(`/api/members/${ali}/freeze`);
    expect((await admin.post(`/api/members/${ali}/checkin`)).body.error).toBe('Ali is frozen. Unfreeze the membership first.');
    await admin.post(`/api/members/${ali}/unfreeze`);
  });

  it('charge, payment and adjustment keep debt and history in step', async () => {
    expect((await admin.post(`/api/members/${vali}/charges`, { amount: '100 000', category: 'personal training' })).body).toEqual({ debt: 100000 });
    expect((await admin.post(`/api/members/${vali}/payments`, { amount: '150000' })).body).toEqual({ debt: 0, exceeded: true });
    expect((await admin.post(`/api/members/${vali}/debt-adjustments`, { debt: '50000', note: 'Mistake' })).status).toBe(201);
    expect((await db1('SELECT debt FROM clients WHERE id = $1', [vali])).debt).toBe(50000);
    const t = (await query('SELECT txn_type, amount, balance_after FROM txns WHERE client = $1 ORDER BY created_at, txn_type', [vali])).rows;
    expect(t.map((x) => x.txn_type).sort()).toEqual(['adjustment', 'charge', 'payment']);
  });

  it('rejects a zero or bad amount with the core message', async () => {
    const res = await admin.post(`/api/members/${vali}/payments`, { amount: '0' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Amount must be at least 0.01.');
    expect((await admin.post(`/api/members/${vali}/payments`, { amount: 'abc' })).body.error).toBe('Amount must be a number.');
  });

  it('measurements accept a decimal comma and can be deleted', async () => {
    const m = await admin.post(`/api/members/${ali}/measurements`, { weight: '82,5', height: '178', note: 'start' });
    expect(m.status).toBe(201);
    expect((await db1('SELECT weight, height FROM measurements WHERE id = $1', [m.body.id]))).toEqual({ weight: 82.5, height: 178 });
    expect((await admin.post(`/api/members/${ali}/measurements`, {})).body.error).toBe('Enter at least one measurement.');
    expect((await admin.del('/api/measurements/' + m.body.id)).status).toBe(200);
    expect((await db1('SELECT count(*)::int n FROM measurements')).n).toBe(0);
  });

  it('a member cannot use any of it', async () => {
    const me = as(await signIn('ali', 'ali-pass'));
    expect((await me.post(`/api/members/${ali}/checkin`)).status).toBe(403);
    expect((await me.post(`/api/members/${ali}/payments`, { amount: '1' })).status).toBe(403);
    expect((await me.post(`/api/members/${ali}/measurements`, { weight: '80' })).status).toBe(403);
    expect((await me.del('/api/measurements/x')).status).toBe(403);
  });
});
