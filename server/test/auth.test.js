import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import GYM from '../../client/src/core/gym.js';
import { createApp } from '../src/app.js';
import { query, closePool } from '../src/db.js';
import { _resetLockouts } from '../src/auth/lockout.js';

/* runs against the database in server/.env with throwaway users (prefix below), removed afterwards */
const hasDb = !!process.env.DATABASE_URL;
const P = 'zt' + Date.now().toString(36);
const app = createApp();

async function addUser(name, password, role = 'admin', client = null) {
  await query('INSERT INTO users (id, username, password, role, client, created_at) VALUES ($1, $2, $3, $4, $5, now())',
    [P + '_' + name, P + name, await GYM.hashPassword(password), role, client]);
  return P + name;
}
async function login(username, password) {
  return request(app).post('/api/auth/login').send({ username, password });
}
function sid(res) {
  const c = (res.headers['set-cookie'] || []).find((x) => x.startsWith('gym_sid='));
  return c ? c.split(';')[0] : null;
}

describe.runIf(hasDb)('auth', () => {
  let admin, oldRole;
  beforeAll(async () => {
    admin = await addUser('admin', 'secret1');
    oldRole = await addUser('trainer', 'secret1', 'trainer');
  });
  afterAll(async () => {
    await query('DELETE FROM users WHERE id LIKE $1', [P + '\\_%']);
    await query("DELETE FROM audit WHERE by LIKE $1 OR detail LIKE $2", [P + '%', '%' + P + '%']);
    await closePool();
  });
  beforeEach(() => _resetLockouts());

  it('signs in with the right password and sets an httpOnly session cookie', async () => {
    const res = await login(admin, 'secret1');
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: P + '_admin', username: admin, role: 'admin', client: null });
    const raw = res.headers['set-cookie'].join(';');
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
  });

  it('never sends the password hash to the browser', async () => {
    const res = await login(admin, 'secret1');
    const me = await request(app).get('/api/auth/me').set('Cookie', sid(res));
    expect(JSON.stringify(res.body) + JSON.stringify(me.body)).not.toMatch(/pbkdf2|password/);
  });

  it('refuses a wrong password or unknown user with the same message', async () => {
    const a = await login(admin, 'nope');
    const b = await login(P + 'ghost', 'nope');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
    expect(sid(a)).toBeNull();
  });

  it('username is case-insensitive', async () => {
    expect((await login(admin.toUpperCase(), 'secret1')).status).toBe(200);
  });

  it('locks after 5 wrong passwords, even for the right one', async () => {
    for (let i = 0; i < 5; i++) await login(admin, 'wrong');
    const res = await login(admin, 'secret1');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/^Too many attempts\. Wait \d+ seconds\.$/);
  });

  it('refuses accounts whose role was removed', async () => {
    const res = await login(oldRole, 'secret1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('This role no longer exists. Ask an admin.');
  });

  it('/me shows the signed-in user, and nobody without a cookie', async () => {
    const c = sid(await login(admin, 'secret1'));
    expect((await request(app).get('/api/auth/me').set('Cookie', c)).body.user.username).toBe(admin);
    expect((await request(app).get('/api/auth/me')).body.user).toBeNull();
  });

  it('logout ends the session', async () => {
    const c = sid(await login(admin, 'secret1'));
    await request(app).post('/api/auth/logout').set('Cookie', c).send({});
    expect((await request(app).get('/api/auth/me').set('Cookie', c)).body.user).toBeNull();
  });

  it('rejects data-changing requests that are not JSON (CSRF guard)', async () => {
    const res = await request(app).post('/api/auth/login').type('form').send('username=a&password=b');
    expect(res.status).toBe(415);
  });

  it('changes the password and signs out the other sessions', async () => {
    const name = await addUser('pw', 'old-pass');
    const a = sid(await login(name, 'old-pass'));
    const b = sid(await login(name, 'old-pass'));
    const bad = await request(app).post('/api/auth/password').set('Cookie', a).send({ current: 'x', next: 'new-pass', confirm: 'new-pass' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Current password is wrong.');
    const short = await request(app).post('/api/auth/password').set('Cookie', a).send({ current: 'old-pass', next: 'abc', confirm: 'abc' });
    expect(short.body.error).toBe('New password must be at least 4 characters.');
    const ok = await request(app).post('/api/auth/password').set('Cookie', a).send({ current: 'old-pass', next: 'new-pass', confirm: 'new-pass' });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', a)).body.user.username).toBe(name);
    expect((await request(app).get('/api/auth/me').set('Cookie', b)).body.user).toBeNull();
    expect((await login(name, 'new-pass')).status).toBe(200);
  });

  it('password change needs a signed-in user', async () => {
    const res = await request(app).post('/api/auth/password').send({ current: 'a', next: 'bbbb', confirm: 'bbbb' });
    expect(res.status).toBe(401);
  });
});
