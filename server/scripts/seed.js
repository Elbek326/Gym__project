/* local development: creates admin / admin123 when the users table is empty.
   In production the server creates the first admin itself, with a random password (see src/server.js). */
import { ensureFirstAdmin } from '../src/seed.js';
import { closePool } from '../src/db.js';

ensureFirstAdmin({ random: false })
  .then((pw) => console.log(pw ? 'Created admin / admin123. Change this password after the first sign-in.' : 'Users already exist, nothing to seed.'))
  .catch((err) => { console.error('Seed failed:', err.message); process.exitCode = 1; })
  .finally(closePool);
