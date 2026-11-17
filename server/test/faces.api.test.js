import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { run, _resetForTests } from '../src/core.js';
import { query, closePool } from '../src/db.js';

const hasDb = !!process.env.DATABASE_URL;
const app = createApp();
const vec = (seed) => Array.from({ length: 128 }, (_, i) => Math.sin(seed + i) / 4);

async function signIn(username, password) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.headers['set-cookie'].find((c) => c.startsWith('gym_sid=')).split(';')[0];
}
const as = (cookie) => ({
  get: (u) => request(app).get(u).set('Cookie', cookie),
  post: (u, b = {}) => request(app).post(u).set('Cookie', cookie).send(b),
  put: (u, b = {}) => request(app).put(u).set('Cookie', cookie).send(b),
  del: (u) => request(app).delete(u).set('Cookie', cookie).send({})
});

describe.runIf(hasDb)('face check-in API', () => {
  let admin, member, ali;
  beforeAll(async () => {
    await query('TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE');
    _resetForTests();
    await run(null, (G) => G.ensureDefaultAdmin());
    admin = as(await signIn('admin', 'admin123'));
    ali = (await admin.post('/api/members', { name: 'Ali', login: 'ali', password: 'ali-pass' })).body.id;
    member = as(await signIn('ali', 'ali-pass'));
  });
  afterAll(closePool);

  it('refuses enrolment without consent or with bad data', async () => {
    expect((await admin.put(`/api/members/${ali}/face`, { descriptors: [vec(1)] })).body.error)
      .toBe('The member must agree to face check-in first.');
    expect((await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: [] })).body.error).toBe('Take 1 to 5 face shots.');
    expect((await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: [vec(1).slice(1)] })).status).toBe(400);
    expect((await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: [[...vec(1).slice(1), 'x']] })).status).toBe(400);
    expect((await admin.put('/api/members/nope/face', { consent: true, descriptors: [vec(1)] })).status).toBe(404);
  });

  it('enrols, reports status, lists for matching, replaces', async () => {
    const r = await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: [vec(1), vec(2), vec(3)] });
    expect(r.body).toEqual({ ok: true, shots: 3 });
    expect((await admin.get(`/api/members/${ali}/face`)).body).toMatchObject({ enrolled: true, shots: 3 });
    const list = (await admin.get('/api/faces')).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: ali, name: 'Ali' });
    expect(list[0].descriptors[0]).toHaveLength(128);
    await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: [vec(9)] });
    expect((await admin.get(`/api/members/${ali}/face`)).body.shots).toBe(1);
    expect((await query("SELECT count(*)::int n FROM audit WHERE action = 'FACE_ENROLLED'")).rows[0].n).toBe(2);
  });

  it('members and anonymous users get nothing', async () => {
    expect((await member.get('/api/faces')).status).toBe(403);
    expect((await member.put(`/api/members/${ali}/face`, { consent: true, descriptors: [vec(1)] })).status).toBe(403);
    expect((await request(app).get('/api/faces')).status).toBe(401);
  });

  it('does not block other /api routes for members', async () => {
    expect((await member.get('/api/rankings')).status).toBe(200);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('face data is not in the backup file', async () => {
    const b = await admin.get('/api/admin/backup');
    expect(b.text).not.toMatch(/descriptors/);
  });

  it('deletes on request, and together with the member', async () => {
    expect((await admin.del(`/api/members/${ali}/face`)).body).toEqual({ ok: true, deleted: true });
    expect((await admin.get(`/api/members/${ali}/face`)).body).toEqual({ enrolled: false });
    await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: [vec(1)] });
    await admin.del('/api/members/' + ali);
    expect((await query('SELECT count(*)::int n FROM faces')).rows[0].n).toBe(0);
  });
});
