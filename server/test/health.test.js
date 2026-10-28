import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/db.js';

/* needs a database: run with DATABASE_URL set (npm test reads server/.env) */
const hasDb = !!process.env.DATABASE_URL;

describe('GET /api/health', () => {
  afterAll(closePool);

  it.runIf(hasDb)('reports the database as reachable', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true });
  });

  it('answers unknown API routes with JSON 404', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
