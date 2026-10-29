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
  cookie,
  get: (u) => request(app).get(u).set('Cookie', cookie),
  post: (u, b = {}) => request(app).post(u).set('Cookie', cookie).send(b),
  put: (u, b = {}) => request(app).put(u).set('Cookie', cookie).send(b),
  del: (u) => request(app).delete(u).set('Cookie', cookie).send({})
});

describe.runIf(hasDb)('dashboard, reports and admin API', () => {
  let admin, member, aziz, ym;
  beforeAll(async () => {
    await query('TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE');
    _resetForTests();
    await run(null, (G) => G.ensureDefaultAdmin());
    ym = (await run(null, (G) => G.now())).date.slice(0, 7);
    admin = as(await signIn('admin', 'admin123'));
  });
  afterAll(closePool);

  it('loads sample data once', async () => {
    expect((await admin.post('/api/admin/sample')).body).toEqual({ members: 12 });
    expect((await admin.post('/api/admin/sample')).body.error).toBe('Sample data can only be loaded into an empty gym.');
    aziz = (await admin.get('/api/members?q=aziz')).body.items[0].c.id;
    await admin.put('/api/members/' + aziz, { name: 'Aziz Karimov', phone: '+998 90 123 45 67', days: 'Mon,Wed,Fri', login: 'aziz', password: 'aziz-pass' });
    member = as(await signIn('aziz', 'aziz-pass'));
  });

  it('dashboard: counts, today, expiring, with member names', async () => {
    const d = (await admin.get('/api/dashboard')).body;
    expect(d.counts.total).toBe(12);
    expect(d.has_sample).toBe(true);
    expect(d.series).toHaveLength(7);
    for (const v of d.todays) expect(v.member.name).toEqual(expect.any(String));
    for (const e of d.expiring) expect(e.member.id).toEqual(expect.any(String));
  });

  it('analytics for a month', async () => {
    const a = (await admin.get('/api/analytics?month=' + ym)).body;
    expect(a.attendance).toHaveLength(30);
    expect(a.report.summary[0][0]).toBe('Month');
    expect(a.lost.every((x) => x.gap >= 30)).toBe(true);
    expect((await admin.get('/api/analytics?month=oct')).status).toBe(400);
  });

  it('rankings: staff see payments; a member sees no money and only their own photo', async () => {
    const s = (await admin.get('/api/rankings')).body;
    expect(s.staff).toBe(true);
    expect(s.rows).toHaveLength(12);
    expect(s.rows[0]).toHaveProperty('paid');
    const m = (await member.get('/api/rankings')).body;
    expect(m.staff).toBe(false);
    expect(m.rows.some((r) => 'paid' in r)).toBe(false);
    expect(m.rows.filter((r) => r.me).map((r) => r.member.id)).toEqual([aziz]);
    expect(JSON.stringify(m.rows)).not.toMatch(/\+998/);
  });

  it('audit log: newest first, searchable, staff only', async () => {
    const a = (await admin.get('/api/audit?q=sample_loaded')).body;
    expect(a.total).toBe(1);
    expect(a.items[0].action).toBe('SAMPLE_LOADED');
    expect((await member.get('/api/audit')).status).toBe(403);
  });

  it('staff accounts: add, list, reset, delete, never a hash in a reply', async () => {
    const add = await admin.post('/api/admin/users', { username: 'boss', password: 'boss-pass', role: 'admin' });
    expect(add.status).toBe(201);
    expect(add.body).toEqual({ id: expect.any(String), username: 'boss', role: 'admin', created_at: expect.any(String) });
    const list = (await admin.get('/api/admin/users')).body;
    expect(list.map((u) => u.username)).toEqual(['admin', 'boss']);   /* member logins are not listed here */
    expect(JSON.stringify(list)).not.toMatch(/pbkdf2|password/);
    expect((await admin.post(`/api/admin/users/${add.body.id}/password`, { password: 'new-pass' })).status).toBe(200);
    expect((await admin.put(`/api/admin/users/${add.body.id}/role`, { role: 'owner' })).body.error).toBe('Choose a valid role.');
    expect((await admin.del('/api/admin/users/u_admin')).body.error).toBe('You cannot delete your own account.');
    expect((await admin.del(`/api/admin/users/${add.body.id}`)).status).toBe(200);
  });

  it('members cannot reach admin routes', async () => {
    expect((await member.get('/api/admin/users')).status).toBe(403);
    expect((await member.get('/api/admin/backup')).status).toBe(403);
    expect((await member.post('/api/admin/sample')).status).toBe(403);
    expect((await member.get('/api/dashboard')).status).toBe(403);
  });

  it('backup download, then restore brings data back and signs everyone out', async () => {
    const b = await admin.get('/api/admin/backup');
    expect(b.headers['content-disposition']).toMatch(/^attachment; filename="gym_.+\.json"$/);
    const text = b.text;
    expect(JSON.parse(text).app).toBe('gym-manager-pro');
    expect((await admin.del('/api/admin/sample')).body.removed).toBeGreaterThan(0);
    expect((await admin.get('/api/dashboard')).body.counts.total).toBe(0);
    const r = await admin.post('/api/admin/backup/restore', { text });
    expect(r.body).toEqual({ ok: true, signedOut: true });
    expect((await admin.get('/api/auth/me')).body.user).toBeNull();
    const again = as(await signIn('admin', 'admin123'));
    expect((await again.get('/api/dashboard')).body.counts.total).toBe(12);
    expect((await again.post('/api/admin/backup/restore', { text: '{"x":1}' })).body.error).toBe('This file is not a Bek Sport Gym backup.');
  });
});
