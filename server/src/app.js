import express from 'express';
import helmet from 'helmet';
import { query } from './db.js';

/* builds the Express app without listening, so tests can use it directly */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));   /* member photos are ~40 KB data URLs; backups go through a separate route later */

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
