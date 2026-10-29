import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { run, _resetForTests } from '../src/core.js';
import { query, closePool } from '../src/db.js';

const hasDb = !!process.env.DATABASE_URL;
const app = createApp();

async function signIn(username, password) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'].find((c) => c.startsWith('gym_sid=')).split(';')[0];
}
const as = (cookie) => ({
  get: (u) => request(app).get(u).set('Cookie', cookie),
  post: (u, b = {}) => request(app).post(u).set('Cookie', cookie).send(b),
  put: (u, b = {}) => request(app).put(u).set('Cookie', cookie).send(b),
  del: (u) => request(app).delete(u).set('Cookie', cookie).send({})
});

describe.runIf(hasDb)('members API', () => {
  let admin, ali, vali, today;
  beforeAll(async () => {
    await query('TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE');
    _resetForTests();
    await run(null, (G) => G.ensureDefaultAdmin());
    today = (await run(null, (G) => G.now())).date;
    admin = as(await signIn('admin', 'admin123'));
  });
  afterAll(closePool);

  it('admin adds a member with a plan and a login', async () => {
    const res = await admin.post('/api/members', {
      name: 'Ali Valiyev', phone: '+998 90 111 22 33', days: ['Mon', 'Wed'],
      plan: { sub_type: 'sessions', start_date: today, total_sessions: '12', price: '400000', paid: '400000' },
      login: 'ali', password: 'ali-pass'
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ali Valiyev');
    expect(res.body.days).toBe('Mon,Wed');
    ali = res.body.id;
    vali = (await admin.post('/api/members', { name: 'Vali Aliyev' })).body.id;
  });

  it('rule errors come back as 400 with the core message', async () => {
    const res = await admin.post('/api/members', { name: 'Copy', phone: '+998 (90) 111-22-33' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This phone number already belongs to Ali Valiyev.');
  });

  it('lists, searches and filters members', async () => {
    const all = await admin.get('/api/members');
    expect(all.body.total).toBe(2);
    expect(all.body.counts).toEqual({ all: 2, active: 1, frozen: 0, expired: 1 });
    const q = await admin.get('/api/members?q=vali&filter=expired');
    expect(q.body.items.map((r) => r.c.name)).toEqual(['Vali Aliyev']);
  });

  it('opens a profile, 404 for an unknown id', async () => {
    const p = await admin.get('/api/members/' + ali);
    expect(p.body.sub.total_sessions).toBe(12);
    expect(p.body.login).toEqual({ username: 'ali', created_at: expect.any(String) });
    expect((await admin.get('/api/members/nope')).status).toBe(404);
  });

  it('edits a member and keeps the photo when image is left out', async () => {
    await admin.put('/api/members/' + vali, { name: 'Vali Aliyev', image: 'data:image/jpeg;base64,AAAA' });
    const res = await admin.put('/api/members/' + vali, { name: 'Vali A.', note: 'VIP' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Vali A.');
    expect(res.body.image).toBe('data:image/jpeg;base64,AAAA');
  });

  it('subscriptions: add, extend, freeze and unfreeze', async () => {
    const s = await admin.post(`/api/members/${vali}/subscriptions`, { sub_type: 'time', start_date: today, end_date: today, price: '0' });
    expect(s.status).toBe(201);
    const e = await admin.post(`/api/members/${vali}/subscriptions/extend`, { days: 5 });
    expect(e.body.end_date > today).toBe(true);
    expect((await admin.post(`/api/members/${vali}/subscriptions/extend`, { sessions: 2 })).body.error)
      .toBe('Sessions can only be added to a session-based plan.');
    expect((await admin.post(`/api/members/${vali}/freeze`)).status).toBe(200);
    expect((await admin.get('/api/members?filter=frozen')).body.total).toBe(1);
    expect((await admin.post(`/api/members/${vali}/unfreeze`)).body).toEqual({ days: 0, extended: false });
  });

  it('member login: username only, password reset by staff', async () => {
    expect((await admin.get(`/api/members/${ali}/login`)).body).toEqual({ login: { username: 'ali', created_at: expect.any(String) } });
    expect((await admin.post(`/api/members/${ali}/login/password`, { password: 'new-pass' })).status).toBe(200);
  });

  it('a signed-in member sees only their own profile, without the staff note', async () => {
    const me = as(await signIn('ali', 'new-pass'));
    const own = await me.get('/api/members/' + ali);
    expect(own.status).toBe(200);
    expect(own.body.own).toBe(true);
    expect(own.body.c).not.toHaveProperty('note');
    expect((await me.get('/api/members/' + vali)).status).toBe(403);
    expect((await me.get('/api/members')).status).toBe(403);
    expect((await me.post('/api/members', { name: 'X' })).status).toBe(403);
    expect((await me.post(`/api/members/${ali}/freeze`)).status).toBe(403);
  });

  it('nobody signed in gets 401', async () => {
    expect((await request(app).get('/api/members')).status).toBe(401);
    expect((await request(app).get('/api/members/' + ali)).status).toBe(401);
  });

  it('no response ever carries a password hash', async () => {
    const bodies = [await admin.get('/api/members'), await admin.get('/api/members/' + ali), await admin.get(`/api/members/${ali}/login`)];
    for (const r of bodies) expect(JSON.stringify(r.body)).not.toMatch(/pbkdf2/);
  });

  it('deleting a member removes their login and keeps payment history', async () => {
    expect((await admin.del('/api/members/' + ali)).status).toBe(200);
    expect((await query('SELECT count(*)::int n FROM users WHERE username = $1', ['ali'])).rows[0].n).toBe(0);
    expect((await query("SELECT count(*)::int n FROM txns WHERE note LIKE '%[member: Ali Valiyev]%'")).rows[0].n).toBe(2);
    expect((await admin.get('/api/members/' + ali)).status).toBe(404);
  });
});
