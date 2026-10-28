import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { GYM, prepareHashes, fresh, ADMIN_PW } from './_helpers.js';

/* The lockout uses the real Date.now(), not the GYM clock, and keeps its counters in module state.
   This file is its own module instance (Vitest isolates files), so the lock cannot leak into other test files. */

beforeAll(prepareHashes);
afterEach(() => { vi.restoreAllMocks(); });

const BASE = Date.now();
const wrong = () => GYM.login('ghost', 'nope');   /* unknown user: fails without a slow PBKDF2 run */

describe('login lockout', () => {
  it('successful login resets the failure counter', async () => {
    fresh({ signedIn: false });
    vi.spyOn(Date, 'now').mockReturnValue(BASE);
    for (let i = 0; i < 4; i++) await expect(wrong()).rejects.toThrow('Wrong username or password.');
    await GYM.login('admin', ADMIN_PW);
    GYM.logout();
    for (let i = 0; i < 4; i++) await expect(wrong()).rejects.toThrow('Wrong username or password.');
    /* 8 failures in total, but never 5 in a row: still not locked */
    await expect(wrong()).rejects.toThrow('Wrong username or password.');   /* 5th in a row: this one locks */
    await expect(wrong()).rejects.toThrow('Too many attempts. Wait 30 seconds.');
  });

  it('5 failures lock sign-in for 30 s, even for the right password', async () => {
    fresh({ signedIn: false });
    /* the previous test left us locked at BASE; move past it and start clean with a success */
    const t0 = BASE + 60000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(t0);
    await GYM.login('admin', ADMIN_PW);
    GYM.logout();

    for (let i = 0; i < 5; i++) await expect(wrong()).rejects.toThrow('Wrong username or password.');
    await expect(GYM.login('admin', ADMIN_PW)).rejects.toThrow('Too many attempts. Wait 30 seconds.');
    expect(GYM.me()).toBe(null);

    now.mockReturnValue(t0 + 20000);
    await expect(GYM.login('admin', ADMIN_PW)).rejects.toThrow('Too many attempts. Wait 10 seconds.');
    now.mockReturnValue(t0 + 29001);
    await expect(GYM.login('admin', ADMIN_PW)).rejects.toThrow('Too many attempts. Wait 1 seconds.');

    now.mockReturnValue(t0 + 30000);
    const u = await GYM.login('admin', ADMIN_PW);
    expect(u.id).toBe('u_admin');
  });

  it('after a lockout expires the counter starts again from zero', async () => {
    fresh({ signedIn: false });
    const t0 = BASE + 200000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(t0);
    for (let i = 0; i < 5; i++) await expect(wrong()).rejects.toThrow('Wrong username or password.');
    await expect(wrong()).rejects.toThrow('Too many attempts');
    now.mockReturnValue(t0 + 31000);
    for (let i = 0; i < 4; i++) await expect(wrong()).rejects.toThrow('Wrong username or password.');
    const u = await GYM.login('admin', ADMIN_PW);   /* only 4 failures since the unlock: allowed */
    expect(u.username).toBe('admin');
  });
});
