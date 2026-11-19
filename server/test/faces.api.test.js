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
    expect((await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: Array.from({ length: 9 }, (_, i) => vec(i)) })).status).toBe(400);
    expect((await admin.put(`/api/members/${ali}/face`, { descriptors: [vec(1)] })).body.error)
      .toBe('The member must agree to face check-in first.');
    expect((await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: [] })).body.error).toBe('Take 1 to 8 face shots.');
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

  describe('self-learning', () => {
    const near = (base, k) => base.map((x, i) => (i === 0 ? x + k : x));   /* shifts one number: distance |k| */
    const learn = (id, d) => admin.post(`/api/members/${id}/face/learn`, { descriptor: d });
    const stored = async (id) => (await query('SELECT descriptors, learned FROM faces WHERE client = $1', [id])).rows[0];
    const wide = (k) => Array.from({ length: 128 }, (_, i) => Math.sin(k * (i + 1) * 1.7) / 4);   /* views far from each other and from vec() */
    const r6 = (v) => v.map((x) => Math.round(x * 1e6) / 1e6);
    let orig;
    beforeAll(async () => {
      orig = [1, 2, 3, 4, 5, 6, 7, 8].map(vec);   /* 8 shots, so 12 learned ones fit under the cap of 20 */
      await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: orig });
    });

    it('is staff only and needs an enrolled face', async () => {
      expect((await member.post(`/api/members/${ali}/face/learn`, { descriptor: vec(20) })).status).toBe(403);
      expect((await request(app).post(`/api/members/${ali}/face/learn`).send({ descriptor: vec(20) })).status).toBe(401);
      const bob = (await admin.post('/api/members', { name: 'Bob' })).body.id;
      expect((await learn(bob, vec(20))).status).toBe(404);
      expect((await learn('nope', vec(20))).status).toBe(404);
      expect((await learn(ali, vec(20).slice(1))).status).toBe(400);
    });

    it('adds a new view, keeps the enrolment shots and lists both for matching', async () => {
      const r = await learn(ali, vec(20));
      expect(r.body).toMatchObject({ ok: true, added: true, learned: 1 });
      const row = await stored(ali);
      expect(row.descriptors).toHaveLength(8); expect(row.learned).toHaveLength(1);
      expect(row.descriptors[0]).toEqual(r6(orig[0]));
      expect((await admin.get('/api/faces')).body.find((f) => f.id === ali).descriptors).toHaveLength(9);
      expect((await admin.get(`/api/members/${ali}/face`)).body).toMatchObject({ shots: 8, learned: 1 });
    });

    it('skips a near-duplicate of a learned or an enrolled view', async () => {
      expect((await learn(ali, near(vec(20), 0.05))).body).toMatchObject({ added: false, reason: 'duplicate', learned: 1 });
      expect((await learn(ali, near(orig[3], 0.05))).body).toMatchObject({ added: false, reason: 'duplicate', learned: 1 });
      expect((await stored(ali)).learned).toHaveLength(1);
    });

    it('stops at 20 views in total and then replaces the oldest learned one, never an enrolment shot', async () => {
      const first = (await stored(ali)).learned[0];
      for (let i = 1; i < 12; i++) expect((await learn(ali, wide(i))).body.added).toBe(true);
      let row = await stored(ali);
      expect(row.descriptors).toHaveLength(8); expect(row.learned).toHaveLength(12);   /* 8 + 12 = 20 */
      expect(row.learned[0]).toEqual(first);
      const secondOldest = row.learned[1];
      const fresh = wide(99);
      expect((await learn(ali, fresh)).body).toMatchObject({ added: true, learned: 12 });
      row = await stored(ali);
      expect(row.learned).toHaveLength(12);
      expect(row.learned.some((d) => JSON.stringify(d) === JSON.stringify(first))).toBe(false);   /* the oldest is gone */
      expect(row.learned[0]).toEqual(secondOldest);
      expect(row.learned[11]).toEqual(r6(fresh));
      expect(row.descriptors).toEqual(orig.map(r6));
      expect((await admin.get('/api/faces')).body.find((f) => f.id === ali).descriptors).toHaveLength(20);
    });

    it('a new enrolment starts the learned views over', async () => {
      await admin.put(`/api/members/${ali}/face`, { consent: true, descriptors: [vec(9)] });
      expect((await stored(ali)).learned).toEqual([]);
    });
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
