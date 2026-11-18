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
  post: (u, b = {}) => request(app).post(u).set('Cookie', cookie).send(b)
});

describe.runIf(hasDb)("today's arrivals API", () => {
  let admin, member, ali, today;
  beforeAll(async () => {
    await query('TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE');
    _resetForTests();
    await run(null, (G) => G.ensureDefaultAdmin());
    today = (await run(null, (G) => G.now())).date;
    admin = as(await signIn('admin', 'admin123'));
    ali = (await admin.post('/api/members', {
      name: 'Ali', login: 'ali', password: 'ali-pass',
      plan: { sub_type: 'sessions', start_date: today, total_sessions: '10', price: '0' }
    })).body.id;
    member = as(await signIn('ali', 'ali-pass'));
  });
  afterAll(closePool);

  it('is empty on a quiet day', async () => {
    const d = (await admin.get('/api/daily')).body;
    expect(d).toMatchObject({ date: today, visits: [], dayPasses: [], totals: { visits: 0, dayPasses: 0, dayPassAmount: 0 } });
    expect(d.stats).toMatchObject({ revenue: 0, expenses: 0, profit: 0 });
  });

  it('lists members who checked in today, with what is left on their plan', async () => {
    await admin.post(`/api/members/${ali}/checkin`);
    const d = (await admin.get('/api/daily')).body;
    expect(d.visits).toHaveLength(1);
    expect(d.visits[0]).toMatchObject({ member: { id: ali, name: 'Ali' }, remaining: 9, sub_type: 'sessions' });
    expect(d.visits[0].time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('records a day pass with the real time, as day-pass income', async () => {
    const r = await admin.post('/api/daily/day-pass', { name: 'Mehmon Aka', phone: '+998 90 000 00 00', amount: '30 000' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: 'Mehmon Aka · +998 90 000 00 00', amount: 30000 });
    expect(r.body.time).not.toBe('12:00');
    await admin.post('/api/daily/day-pass', { amount: '25000' });
    const d = (await admin.get('/api/daily')).body;
    expect(d.totals).toEqual({ visits: 1, dayPasses: 2, dayPassAmount: 55000 });
    const f = (await admin.get('/api/finance?month=' + today.slice(0, 7))).body;
    expect(f.totals.income).toBe(55000);
  });

  it('daily statistics: money, new members, arrivals per hour, yesterday', async () => {
    await admin.post(`/api/members/${ali}/payments`, { amount: '100000' });
    await admin.post('/api/finance/expenses', { category: 'rent', amount: '20000', date: today });
    const s = (await admin.get('/api/daily')).body.stats;
    expect(s).toMatchObject({ newMembers: 1, payments: 100000, income: 55000, sales: 0, revenue: 155000, expenses: 20000, profit: 135000 });
    expect(s.byHour).toHaveLength(24);
    expect(s.byHour.reduce((n, h) => n + h.visits, 0)).toBe(1);
    expect(s.byHour.reduce((n, h) => n + h.dayPasses, 0)).toBe(2);
    expect(s.yesterday).toEqual({ visits: 0, dayPasses: 0, revenue: 0 });
  });

  it('refuses a missing amount and a bad date', async () => {
    expect((await admin.post('/api/daily/day-pass', { name: 'X' })).body.error).toBe('Amount is required.');
    expect((await admin.get('/api/daily?date=2026-02-30')).status).toBe(400);
  });

  it('another day shows that day only', async () => {
    const d = (await admin.get('/api/daily?date=2020-01-01')).body;
    expect(d.totals).toEqual({ visits: 0, dayPasses: 0, dayPassAmount: 0 });
  });

  it('members cannot see or add arrivals; other routes still work for them', async () => {
    expect((await member.get('/api/daily')).status).toBe(403);
    expect((await member.post('/api/daily/day-pass', { amount: '1' })).status).toBe(403);
    expect((await member.get('/api/rankings')).status).toBe(200);
  });
});
