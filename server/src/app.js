import express from 'express';
import helmet from 'helmet';
import { query } from './db.js';
import { authRouter } from './auth/routes.js';
import { jsonOnlyWrites, loadUser } from './auth/middleware.js';
import { membersRouter } from './api/members.js';
import { measurementsRouter } from './api/measurements.js';
import { shopRouter } from './api/shop.js';
import { financeRouter } from './api/finance.js';

/* builds the Express app without listening, so tests can use it directly */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');   /* behind a local reverse proxy (deploy), req.ip is the real client IP */
  app.use(helmet());
  app.use('/api', jsonOnlyWrites);
  app.use(express.json({ limit: '1mb' }));   /* member photos are ~40 KB data URLs; backups go through a separate route later */
  app.use('/api', loadUser);

  app.use('/api/auth', authRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/measurements', measurementsRouter);
  app.use('/api/shop', shopRouter);
  app.use('/api/finance', financeRouter);

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
    console.error(err);
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error' });
  });

  return app;
}
