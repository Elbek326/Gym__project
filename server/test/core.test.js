import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { run, reload, _resetForTests } from '../src/core.js';
import { query, closePool } from '../src/db.js';

const hasDb = !!process.env.DATABASE_URL;
const ADMIN = 'u_admin';
const count = async (t, where = 'true', p = []) => (await query(`SELECT count(*)::int AS n FROM ${t} WHERE ${where}`, p)).rows[0].n;

describe.runIf(hasDb)('core adapter', () => {
  let cid;
  beforeAll(async () => {
    await query('TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE');
    _resetForTests();
    await run(null, (G) => G.ensureDefaultAdmin());
    const today = (await run(null, (G) => G.now())).date;
    const c = await run(ADMIN, (G) => G.createClient({
      name: 'Ali Valiyev', phone: '+998 90 111 22 33',
      plan: { sub_type: 'time', start_date: today, end_date: today, price: '300000', paid: '100000' }
    }));
    cid = c.id;
  });
  afterAll(closePool);

  it('saves everything a core call changed, in the database', async () => {
    expect(await count('users', 'id = $1', [ADMIN])).toBe(1);
    const c = (await query('SELECT * FROM clients WHERE id = $1', [cid])).rows[0];
    expect(c.name).toBe('Ali Valiyev');
    expect(c.debt).toBe(200000);
    expect(await count('subs', 'client = $1 AND is_active', [cid])).toBe(1);
    expect(await count('txns', 'client = $1', [cid])).toBe(2);   /* charge + payment */
    expect(await count('audit', "action = 'MEMBER_ADDED'")).toBe(1);
  });

  it('reads back the same records after a reload (dates and times keep the core format)', async () => {
    await run(null, () => reload());
    const back = await run(ADMIN, (G) => G.S().clients[cid]);
    expect(back.name).toBe('Ali Valiyev');
    expect(back.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    const sub = await run(ADMIN, (G) => G.activeSub(cid));
    expect(sub.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await run(ADMIN, (G) => G.clientStatus(back))).toBe('active');
  });

  it('runs rules as the given user: nobody signed in is refused and nothing is written', async () => {
    const before = await count('audit');
    await expect(run(null, (G) => G.addCharge(cid, { amount: '5000' }))).rejects.toThrow('Please sign in first.');
    expect(await count('audit')).toBe(before);
  });

  it('a call that fails half way leaves memory and database untouched', async () => {
    await expect(run(ADMIN, (G) => { G.addCharge(cid, { amount: '5000' }); throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await run(ADMIN, (G) => G.S().clients[cid].debt)).toBe(200000);
    expect((await query('SELECT debt FROM clients WHERE id = $1', [cid])).rows[0].debt).toBe(200000);
  });

  it('a database refusal rolls the whole call back and reloads memory', async () => {
    /* another desk checked Ali in a moment ago (written straight to the database) */
    const n = await run(null, (G) => G.now());
    const sub = await run(ADMIN, (G) => G.activeSub(cid));
    await query('INSERT INTO visits (id, d, client, subscription, visit_date, visit_time) VALUES ($1, $2, $3, $4, $2, $5)',
      ['vx1', n.date, cid, sub.id, n.time]);
    await expect(run(ADMIN, (G) => G.checkIn(cid))).rejects.toThrow(/visits_one_per_day/);
    expect(await count('visits', 'client = $1', [cid])).toBe(1);
    expect(await count('audit', "action = 'CHECK_IN'")).toBe(0);
    /* memory now knows about that visit, so the rule itself refuses */
    await expect(run(ADMIN, (G) => G.checkIn(cid))).rejects.toThrow('already checked in today');
  });

  it('queues calls, so a slow call keeps its own user', async () => {
    const slow = run(ADMIN, async (G) => { await G.hashPassword('x'); return G.me() && G.me().id; });
    const other = run(null, (G) => G.me());
    expect(await slow).toBe(ADMIN);
    expect(await other).toBeNull();
  });

  it('a backup restore replaces every table', async () => {
    const b = await run(ADMIN, (G) => G.exportBackup());
    await run(ADMIN, (G) => G.addCharge(cid, { amount: '1000' }));
    expect(await count('txns', 'client = $1', [cid])).toBe(3);
    await run(ADMIN, (G) => G.restoreBackup(b.text));
    expect(await count('txns', 'client = $1', [cid])).toBe(2);
    expect((await query('SELECT debt FROM clients WHERE id = $1', [cid])).rows[0].debt).toBe(200000);
    expect(await count('users')).toBe(1);
  });
});
