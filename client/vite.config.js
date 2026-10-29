import { defineConfig } from 'vite';

/* the page and the API share one origin in dev: /api goes to the Express server, so the session cookie just works */
export default defineConfig({
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  build: { target: 'es2020' }
});
