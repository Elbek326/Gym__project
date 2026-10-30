import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import GYM from '../../client/src/core/gym.js';
import { applyEnvAdmin, ensureFirstAdmin } from '../src/seed.js';
import { query, closePool } from '../src/db.js';

const hasDb = !!process.env.DATABASE_URL;
const user = async (name) => (await query('SELECT * FROM users WHERE lower(username) = lower($1)', [name])).rows[0];

describe.runIf(hasDb)('first admin', () => {
  beforeEach(() => query('TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE'));
  afterAll(closePool);

  it('production: a random password, only on an empty database', async () => {
    const pw = await ensureFirstAdmin({ random: true });
    expect(pw).toHaveLength(16);
    expect(pw).not.toBe('admin123');
    expect(await GYM.verifyPassword(pw, (await user('admin')).password)).toBe(true);
    expect(await ensureFirstAdmin({ random: true })).toBeNull();
  });

  it('ADMIN_PASSWORD creates the admin, and then no random one is made', async () => {
    expect(await applyEnvAdmin({ ADMIN_USERNAME: 'bek', ADMIN_PASSWORD: 'long-enough-1' })).toBe('created');
    const u = await user('bek');
    expect(u.role).toBe('admin');
    expect(await GYM.verifyPassword('long-enough-1', u.password)).toBe(true);
    expect(await ensureFirstAdmin({ random: true })).toBeNull();
  });

  it('ADMIN_PASSWORD resets an existing account and ends its sessions', async () => {
    await ensureFirstAdmin({ random: true });
    await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('x', 'u_admin', now() + interval '1 hour')");
    expect(await applyEnvAdmin({ ADMIN_PASSWORD: 'new-password-2' })).toBe('reset');
    expect(await GYM.verifyPassword('new-password-2', (await user('admin')).password)).toBe(true);
    expect((await query('SELECT count(*)::int n FROM sessions')).rows[0].n).toBe(0);
  });

  it('never writes the password to the audit log', async () => {
    await applyEnvAdmin({ ADMIN_PASSWORD: 'secret-value-3' });
    const { rows } = await query('SELECT action, detail FROM audit');
    expect(rows).toEqual([{ action: 'PASSWORD_RESET', detail: 'admin (ADMIN_PASSWORD)' }]);
  });

  it('ignores a missing, short or badly named setting', async () => {
    expect(await applyEnvAdmin({})).toBeNull();
    expect(await applyEnvAdmin({ ADMIN_PASSWORD: 'short' })).toBeNull();
    expect(await applyEnvAdmin({ ADMIN_USERNAME: 'a b', ADMIN_PASSWORD: 'long-enough-1' })).toBeNull();
    expect((await query('SELECT count(*)::int n FROM users')).rows[0].n).toBe(0);
  });
});
