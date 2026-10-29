import { defineConfig } from 'vitest/config';

/* Tests never touch the real gym database. They use gym_test: TEST_DATABASE_URL if set, otherwise
   DATABASE_URL from server/.env with the database name swapped. Without either, DB tests are skipped. */
try { process.loadEnvFile('.env'); } catch { /* no .env */ }
const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (base) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || base.replace(/\/[^/?]+(\?|$)/, '/gym_test$1');

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/global-setup.js'],
    fileParallelism: false   /* one shared test database: files run one after another */
  }
});
