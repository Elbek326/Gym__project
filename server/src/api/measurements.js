import { Router } from 'express';
import { call } from './call.js';
import { requireStaff } from '../auth/middleware.js';

/* a measurement is added under its member (/api/members/:id/measurements) and deleted by its own id */
export const measurementsRouter = Router();

measurementsRouter.delete('/:id', requireStaff, async (req, res) => {
  await call(req, (G) => G.deleteMeasurement(req.params.id));
  res.json({ ok: true });
});
