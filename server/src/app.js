import express from 'express';
import helmet from 'helmet';
import { query } from './db.js';
import { authRouter } from './auth/routes.js';
import { jsonOnlyWrites, loadUser } from './auth/middleware.js';
import { membersRouter } from './api/members.js';
import { measurementsRouter } from './api/measurements.js';
import { shopRouter } from './api/shop.js';
import { financeRouter } from './api/finance.js';
import { reportsRouter } from './api/reports.js';
import { adminRouter } from './api/admin.js';

/* builds the Express app without listening, so tests can use it directly */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');   /* behind a local reverse proxy (deploy), req.ip is the real client IP */
  app.use(helmet());
  app.use('/api', jsonOnlyWrites);
  /* request bodies: 1 MB is plenty (a member photo is ~40 KB); only a backup restore may be large */
  const small = express.json({ limit: '1mb' }), large = express.json({ limit: '50mb' });
  app.use((req, res, next) => (req.path === '/api/admin/backup/restore' ? large : small)(req, res, next));
  app.use('/api', loadUser);

  app.use('/api/auth', authRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/measurements', measurementsRouter);
  app.use('/api/shop', shopRouter);
  app.use('/api/finance', financeRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', reportsRouter);   /* /dashboard, /analytics, /rankings, /audit */

  /* liveness and database check */
  app.get('/api/health', async (req, res) => {
    try {
      const r = await query('SELECT 1 AS ok');
      res.json({ ok: true, db: r.rows[0].ok === 1 });
    } catch (err) {
      res.status(503).json({ ok: false, db: false, error: 'database unavailable' });
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  /* last resort: never leak stack traces to the browser */
  app.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
    if (!err.status || err.status >= 500) console.error(err);   /* expected 4xx (rule errors) are not logged */
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error' });
  });

  return app;
}
