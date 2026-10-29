import G from './core/gym.js';

/* the signed-in user from GET /api/auth/me: { id, username, role, client } (null = signed out) */
export const session = { user: null };
export const ui = {
  route: { page: 'dashboard', id: null },
  mem: { q: '', filter: 'all', page: 1 },
  fin: { ym: G.now().date.slice(0, 7) },
  an: { ym: G.now().date.slice(0, 7) },
  audit: { q: '', page: 1 },
  det: { allVisits: false, allTx: false },
  /* what the current page loaded from the API (the profile, the product list ...): actions read names and amounts from here */
  data: null
};
/* open modal elements */
export const modals = [];
/* filled in by app.js, so pages and actions can call render() / go() without importing app.js (no import cycle) */
export const hooks = { render: null, go: null, logout: null, setPref: null, toggleTheme: null, checkIn: null, signedOut: null };
