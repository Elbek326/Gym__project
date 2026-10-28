import G from './core/gym.js';

export const ui = {
  route: { page: 'dashboard', id: null },
  mem: { q: '', filter: 'all', page: 1 },
  fin: { ym: G.now().date.slice(0, 7) },
  an: { ym: G.now().date.slice(0, 7) },
  audit: { q: '', page: 1 },
  det: { allVisits: false, allTx: false }
};
/* open modal elements, and a flag the modal sets when a render was asked for while it was open */
export const modals = [];
export const modalState = { pending: false };
/* filled in by app.js, so pages and actions can call render() / go() without importing app.js (no import cycle) */
export const hooks = { render: null, go: null, logout: null, setPref: null, toggleTheme: null, checkIn: null };

