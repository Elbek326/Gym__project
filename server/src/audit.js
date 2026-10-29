import { run } from './core.js';

/* one audit row written by the core itself (same shape, Asia/Tashkent time), so the in-memory copy and the
   database stay the same. `userId` is who did it; null = not signed in ('anonymous'). */
export function audit(action, detail, userId = null) {
  return run(userId, (G) => G.audit(action, String(detail || '').slice(0, 300)));
}
