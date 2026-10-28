import GYM from '../../client/src/core/gym.js';
import { query } from './db.js';

/* one audit row, same shape and time format (Asia/Tashkent) as the core writes */
export async function audit(action, detail, by, db = { query }) {
  const n = GYM.now();
  await db.query('INSERT INTO audit (id, d, action, detail, created_at, by) VALUES ($1, $2, $3, $4, $5, $6)',
    [GYM.uid(), n.date, action, String(detail || '').slice(0, 300), n.iso, by || 'anonymous']);
}
