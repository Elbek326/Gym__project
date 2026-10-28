import { query } from '../db.js';
import { HttpError } from '../http.js';
import { COOKIE, findSession, readCookie } from './sessions.js';

/* the same rules as the core's roleOk() and loginBlock(): only admin and member exist,
   and a member account must still be linked to an existing member */
export async function signInBlock(u) {
  if (u.role === 'admin') return null;
  if (u.role === 'member') {
    const r = await query('SELECT 1 FROM clients WHERE id = $1', [u.client]);
    return r.rowCount ? null : 'This account is no longer linked to a member. Ask an admin.';
  }
  return 'This role no longer exists. Ask an admin.';
}

/* what the browser may know about a user: never the password hash */
export function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, client: u.client || null };
}

/* attaches req.user (or null) from the session cookie on every request */
export async function loadUser(req, res, next) {
  req.sessionToken = readCookie(req, COOKIE);
  req.user = null;
  if (req.sessionToken) {
    const u = await findSession(req.sessionToken);
    if (u && !(await signInBlock(u))) req.user = u;
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in first.'));
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in first.'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Only an admin can do this.'));
  next();
}

/* staff = admin today; kept separate so a future staff role only changes this line */
export const requireStaff = requireAdmin;

/* CSRF guard: a request that changes data must be JSON. A plain HTML form on another site cannot send
   application/json without a CORS preflight, which this API never allows. Together with SameSite=Lax this
   stops cross-site requests from acting with the user's cookie. */
export function jsonOnlyWrites(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return next(new HttpError(415, 'Send the request as JSON.'));
  }
  next();
}
