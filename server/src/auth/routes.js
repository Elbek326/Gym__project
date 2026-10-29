import { Router } from 'express';
import GYM from '../../../client/src/core/gym.js';
import { query } from '../db.js';
import { config } from '../config.js';
import { audit } from '../audit.js';
import { refreshRecord } from '../core.js';
import { HttpError } from '../http.js';
import { COOKIE, cookieOptions, createSession, destroySession, destroyOtherSessions } from './sessions.js';
import { lockedFor, recordFailure, recordSuccess } from './lockout.js';
import { publicUser, requireUser, signInBlock } from './middleware.js';

export const authRouter = Router();

/* a real hash to compare against when the username does not exist, so a wrong username and a wrong
   password take the same time and an attacker cannot tell which usernames exist */
let dummyHash = null;
async function dummy() { return dummyHash || (dummyHash = await GYM.hashPassword('not-a-real-password')); }

authRouter.post('/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const ip = req.ip;
  const wait = lockedFor(ip, username);
  if (wait) throw new HttpError(429, `Too many attempts. Wait ${wait} seconds.`);

  const r = await query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  const u = r.rows[0] || null;
  const ok = await GYM.verifyPassword(password, u ? u.password : await dummy());
  if (!u || !ok) {
    recordFailure(ip, username);
    await audit('LOGIN_FAILED', 'Username: ' + username.slice(0, 40));
    throw new HttpError(401, 'Wrong username or password.');
  }
  recordSuccess(ip, username);
  const block = await signInBlock(u);
  if (block) {
    await audit('LOGIN_FAILED', 'Username: ' + u.username);
    throw new HttpError(403, block);
  }
  const token = await createSession(u.id);
  res.cookie(COOKIE, token, cookieOptions(config.env === 'production'));
  await audit('LOGIN', u.username, u.id);
  res.json({ user: publicUser(u) });
});

authRouter.post('/logout', async (req, res) => {
  if (req.user) await audit('LOGOUT', req.user.username, req.user.id);
  await destroySession(req.sessionToken);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

/* who is signed in; the page calls this on load instead of reading sessionStorage */
authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

/* same rules and messages as the core's changeOwnPassword() */
authRouter.post('/password', requireUser, async (req, res) => {
  const { current, next, confirm } = req.body || {};
  const u = req.user;
  if (!(await GYM.verifyPassword(String(current || ''), u.password))) throw new HttpError(400, 'Current password is wrong.');
  if (String(next || '').length < 4) throw new HttpError(400, 'New password must be at least 4 characters.');
  if (next !== confirm) throw new HttpError(400, 'The new passwords do not match.');
  await query('UPDATE users SET password = $1 WHERE id = $2', [await GYM.hashPassword(String(next)), u.id]);
  await refreshRecord('users', u.id);                   /* the core's copy must not keep the old hash */
  await destroyOtherSessions(u.id, req.sessionToken);   /* a stolen session elsewhere stops working */
  await audit('PASSWORD_CHANGED', u.username, u.id);
  res.json({ ok: true });
});
