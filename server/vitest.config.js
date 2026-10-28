import { defineConfig } from 'vitest/config';

/* tests read server/.env too, so the database test can connect; without it that test is skipped */
try { process.loadEnvFile('.env'); } catch { /* no .env: DB tests are skipped */ }

export default defineConfig({ test: { environment: 'node' } });
