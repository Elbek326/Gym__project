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
  put: (u, b = {}) => request(app).put(u).set('Cookie', cookie).send(b),
  del: (u) => request(app).delete(u).set('Cookie', cookie).send({})
});
const db1 = async (sql, p) => (await query(sql, p)).rows[0];

describe.runIf(hasDb)('shop and finance API', () => {
  let admin, member, water, ali, ym, today;
  beforeAll(async () => {
    await query('TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE');
    _resetForTests();
    await run(null, (G) => G.ensureDefaultAdmin());
    today = (await run(null, (G) => G.now())).date;
    ym = today.slice(0, 7);
    admin = as(await signIn('admin', 'admin123'));
    ali = (await admin.post('/api/members', { name: 'Ali', login: 'ali', password: 'ali-pass' })).body.id;
    member = as(await signIn('ali', 'ali-pass'));
  });
  afterAll(closePool);

  it('adds a product and records its opening stock as an expense', async () => {
    const res = await admin.post('/api/shop/products', { name: 'Water 0.5 L', category: 'Drinks', price: '4000', cost: '2000', stock: '10', expense: true });
    expect(res.status).toBe(201);
    water = res.body.product.id;
    expect(res.body.expense).toMatchObject({ category: 'shop stock', amount: 20000 });
    expect((await admin.post('/api/shop/products', { name: 'water 0.5 l', price: '1' })).body.error).toBe('A product with this name already exists.');
  });

  it('sells: stock goes down, a sale row is kept, too many is refused', async () => {
    const s = await admin.post(`/api/shop/products/${water}/sales`, { qty: '3', client: ali });
    expect(s.status).toBe(201);
    expect(s.body.total).toBe(12000);
    expect((await db1('SELECT stock FROM products WHERE id = $1', [water])).stock).toBe(7);
    expect((await admin.post(`/api/shop/products/${water}/sales`, { qty: '8' })).body.error).toBe('Only 7 in stock.');
    const shop = await admin.get('/api/shop');
    expect(shop.body.products.map((p) => p.name)).toEqual(['Water 0.5 L']);
    expect(shop.body.sales[0]).toMatchObject({ qty: 3, client_name: 'Ali' });
  });

  it('restocks with a new unit cost and an expense', async () => {
    const r = await admin.post(`/api/shop/products/${water}/restock`, { qty: '5', unit_cost: '2500', expense: true });
    expect(r.body.product).toMatchObject({ stock: 12, cost: 2500 });
    expect(r.body.expense.amount).toBe(12500);
  });

  it('edits and deletes a product; past sales stay', async () => {
    expect((await admin.put(`/api/shop/products/${water}`, { name: 'Water', price: '5000', cost: '2500', stock: '12' })).body.product.name).toBe('Water');
    expect((await admin.del(`/api/shop/products/${water}`)).status).toBe(200);
    expect((await db1('SELECT count(*)::int n FROM sales')).n).toBe(1);
  });

  it('month totals add up: payments + income + sales = revenue, minus expenses = profit', async () => {
    await admin.post(`/api/members/${ali}/charges`, { amount: '100000' });
    await admin.post(`/api/members/${ali}/payments`, { amount: '100000' });
    const inc = await admin.post('/api/finance/income', { category: 'day pass', amount: '50000', date: today });
    expect(inc.status).toBe(201);
    await admin.post('/api/finance/expenses', { category: 'rent', amount: '30000', date: today, note: 'Oct' });
    const f = await admin.get('/api/finance?month=' + ym);
    expect(f.body.totals).toEqual({ payments: 100000, income: 50000, sales: 12000, revenue: 162000, expenses: 30000 + 20000 + 12500, profit: 162000 - 62500 });
    expect(f.body.byCat).toEqual({ 'shop stock': 32500, rent: 30000 });
    expect((await admin.get('/api/finance?month=2026-13')).status).toBe(400);
  });

  it('deletes income and expenses; a membership payment is not deletable as income', async () => {
    const f = (await admin.get('/api/finance?month=' + ym)).body;
    const income = f.income.find((r) => r.kind === 'income');
    const payment = f.income.find((r) => r.kind === 'payment');
    expect((await admin.del('/api/finance/income/' + payment.id)).body.error).toBe('Only manual income entries can be deleted.');
    expect((await admin.del('/api/finance/income/' + income.id)).status).toBe(200);
    const rent = f.expenses.find((e) => e.category === 'rent');
    expect((await admin.del('/api/finance/expenses/' + rent.id)).status).toBe(200);
    expect((await admin.get('/api/finance?month=' + ym)).body.totals.revenue).toBe(112000);
  });

  it('members cannot see the shop or the money', async () => {
    expect((await member.get('/api/shop')).status).toBe(403);
    expect((await member.get('/api/finance?month=' + ym)).status).toBe(403);
    expect((await member.post('/api/finance/expenses', { category: 'rent', amount: '1' })).status).toBe(403);
  });
});
