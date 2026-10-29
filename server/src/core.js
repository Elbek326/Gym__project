/* The GYM core on the server.

   The business rules are the same tested code the browser used (client/src/core/gym.js). The core works on an
   in-memory copy of all tables, so the server keeps one: loaded from PostgreSQL at start, and every change the
   core makes is written back in ONE transaction before the next request runs.

   - Calls are queued (one at a time), because the core acts for one signed-in user at a time.
   - If saving fails, or a rule fails half way, memory is reloaded from the database, so it never drifts.
   Trade-off: one server process only. Plenty for one gym; a chain of gyms would need SQL-based rules. */
import GYM from '../../client/src/core/gym.js';
import { query, tx } from './db.js';

/* the columns of each table, in the order of the migrations; anything else on a record is ignored */
export const COLUMNS = {
  users: ['id', 'username', 'password', 'role', 'client', 'created_at'],
  clients: ['id', 'name', 'phone', 'note', 'image', 'created_at', 'status', 'frozen_since', 'days', 'debt', 'sample'],
  subs: ['id', 'client', 'sub_type', 'start_date', 'end_date', 'total_sessions', 'used_sessions', 'price', 'is_active', 'created_at', 'sample'],
  measurements: ['id', 'client', 'created_at', 'note', 'weight', 'height', 'body_fat', 'chest', 'waist', 'bicep', 'sample'],
  products: ['id', 'name', 'category', 'price', 'cost', 'stock', 'created_at', 'sample'],
  expenses: ['id', 'category', 'amount', 'note', 'date', 'created_at', 'sample'],
  visits: ['id', 'd', 'client', 'subscription', 'visit_date', 'visit_time', 'sample'],
  txns: ['id', 'd', 'client', 'txn_type', 'category', 'amount', 'balance_after', 'note', 'created_at', 'by', 'sample'],
  sales: ['id', 'd', 'product', 'product_name', 'client', 'qty', 'unit_price', 'total', 'created_at', 'by', 'sample'],
  audit: ['id', 'd', 'action', 'detail', 'created_at', 'by']
};
/* parents before children, for inserting a whole state (restore) */
const ORDER = ['clients', 'users', 'subs', 'measurements', 'products', 'expenses', 'visits', 'txns', 'sales', 'audit'];

let loaded = false;
let pending = [];            /* changes the current call made: ['put' | 'del', table, record] or ['all'] */
let queue = Promise.resolve();

GYM.Store.readOnly = false;
GYM.Store.write = (t, rec) => { pending.push(['put', t, rec]); };
GYM.Store.remove = (t, rec) => { pending.push(['del', t, rec]); };
GYM.Store.replaceAll = () => { pending.push(['all']); };

function q(name) { return '"' + name + '"'; }   /* quoted identifier: some columns (by, date) are SQL words */

function rowToRecord(row) {
  const r = { ...row };
  if (r.sample === false) delete r.sample;   /* the core marks only sample data */
  return r;
}

/* (re)reads every table into the core */
export async function reload() {
  const state = {};
  for (const t of Object.keys(COLUMNS)) {
    const { rows } = await query(`SELECT * FROM ${q(t)}`);
    state[t] = {};
    for (const row of rows) state[t][row.id] = rowToRecord(row);
  }
  GYM.loadState(state);
  loaded = true;
}

/* NOT NULL columns that older records may lack (sample data has no `by`, old backups may miss a note):
   they get the same default as the migration gives them. Nullable columns stay null. */
const DEFAULTS = {
  note: '', by: '', detail: '', days: '', status: 'active', debt: 0, sample: false,
  total_sessions: 0, used_sessions: 0, price: 0, cost: 0, stock: 0, is_active: true
};
function values(t, rec) {
  return COLUMNS[t].map((c) => {
    const v = rec[c];
    if (v != null) return v;
    if (c === 'category') return t === 'products' ? 'General' : '';
    return c in DEFAULTS ? DEFAULTS[c] : null;
  });
}

async function upsert(db, t, rec) {
  const cols = COLUMNS[t];
  const sets = cols.slice(1).map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(', ');
  await db.query(`INSERT INTO ${q(t)} (${cols.map(q).join(', ')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(', ')})
                  ON CONFLICT (id) DO UPDATE SET ${sets}`, values(t, rec));
}

/* writes one call's changes, all or nothing */
async function persist(ops) {
  if (!ops.length) return;
  await tx(async (db) => {
    if (ops.some((o) => o[0] === 'all')) {
      /* a backup restore replaces everything: empty the tables and write the new state */
      await db.query(`TRUNCATE ${ORDER.map(q).join(', ')} CASCADE`);
      const S = GYM.S();
      for (const t of ORDER) for (const rec of Object.values(S[t])) await upsert(db, t, rec);
      return;
    }
    for (const [kind, t, rec] of ops) {
      if (kind === 'put') await upsert(db, t, rec);
      else await db.query(`DELETE FROM ${q(t)} WHERE id = $1`, [rec.id]);
    }
  });
}

/* runs fn(GYM) as the given user (null = nobody signed in), then saves what it changed.
   Returns fn's result. Core rule errors (AppError) come through unchanged. */
export function run(userId, fn) {
  const job = queue.then(async () => {
    if (!loaded) await reload();
    pending = [];
    GYM.setSessionUser(userId);
    try {
      const out = await fn(GYM);
      await persist(pending);
      return out;
    } catch (err) {
      if (pending.length) await reload().catch((e) => console.error('Reload after failure failed:', e.message));
      throw err;
    } finally {
      pending = [];
      GYM.setSessionUser(null);
    }
  });
  queue = job.catch(() => {});   /* one failure must not block the next request */
  return job;
}

/* after a change made with plain SQL (sign-in, password change), refresh that one record in memory */
export function refreshRecord(t, id) {
  return run(null, async () => {
    const { rows } = await query(`SELECT * FROM ${q(t)} WHERE id = $1`, [id]);
    const S = GYM.S();
    if (rows[0]) S[t][id] = rowToRecord(rows[0]); else delete S[t][id];
    GYM.loadState(S);   /* clears the core's derived indexes */
  });
}

export function _resetForTests() { loaded = false; queue = Promise.resolve(); }
