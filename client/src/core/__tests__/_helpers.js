import { vi } from 'vitest';
import GYM from '../gym.js';

export { GYM };

/* 2026-03-10 07:00 UTC = 12:00 in Tashkent (UTC+5), a Tuesday */
export const T0 = Date.UTC(2026, 2, 10, 7, 0, 0);
export const TODAY = '2026-03-10';

let adminHash = null;
let memberHash = null;

/* PBKDF2 (150 000 iterations) is slow: hash once per test file and reuse the result */
export async function prepareHashes() {
  if (!adminHash) adminHash = await GYM.hashPassword('admin123');
  if (!memberHash) memberHash = await GYM.hashPassword('member123');
  return { adminHash, memberHash };
}
export const ADMIN_PW = 'admin123';
export const MEMBER_PW = 'member123';

/* fresh state: one seeded admin (signed in), writes stubbed, clock fixed */
export function fresh(o) {
  o = o || {};
  const users = {
    u_admin: { id: 'u_admin', username: 'admin', password: adminHash, role: 'admin', created_at: '2026-01-01T00:00:00' }
  };
  GYM.loadState({ users });
  GYM.Store.readOnly = false;
  GYM.Store.write = vi.fn();
  GYM.Store.remove = vi.fn();
  GYM.Store.replaceAll = vi.fn();
  GYM.setClock(o.clock != null ? o.clock : T0);
  if (o.signedIn === false) signOut();
  else GYM.restoreSession('u_admin');
}

export function signOut() {
  const ro = GYM.Store.readOnly;
  GYM.Store.readOnly = true;      /* logout() skips the audit row in read-only mode */
  GYM.logout();
  GYM.Store.readOnly = ro;
}

/* add a member login straight into the state (no hashing) */
export function addMemberUser(cid, username, id) {
  id = id || 'u_m_' + cid;
  GYM.S().users[id] = { id, username: username || 'mem_' + cid, password: memberHash, role: 'member', client: cid, created_at: '2026-01-01T00:00:00' };
  return id;
}
export function signInAs(userId) { return GYM.restoreSession(userId); }

export function timePlan(extra) {
  return Object.assign({ sub_type: 'time', start_date: '2026-03-01', end_date: '2026-03-31', price: 300000 }, extra);
}
export function sessionsPlan(extra) {
  return Object.assign({ sub_type: 'sessions', start_date: '2026-03-01', total_sessions: 10, price: 200000 }, extra);
}

/* member with optional plan, created through the public API */
export async function mkMember(name, plan, extra) {
  return GYM.createClient(Object.assign({ name: name || 'Ali', plan: plan || null }, extra || {}));
}

export function auditActions() { return GYM.values('audit').map((a) => a.action); }
export function advanceDays(n) { GYM.setClock(T0 + n * 86400000); }

/* fmtMoney groups thousands with a non-breaking space (U+00A0) */
export function nb(s) { return String(s).replace(/ /g, '\u00a0'); }
