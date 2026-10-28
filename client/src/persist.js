import GYM from './core/gym.js';

/* ===== persistence: this browser only (localStorage, key gympro.v1) ===== */
const Persist = {
  mode: 'memory',          /* 'browser' | 'memory' */
  status: 'idle',          /* idle | saving | saved | error */
  onStatus: null, onError: null
};

Persist.init = function () {
  Persist._startLocal();
  Persist.mode = 'browser';
};

Persist._setStatus = function (s) { Persist.status = s; if (Persist.onStatus) Persist.onStatus(s); };

Persist._startLocal = function () {
  var KEY = 'gympro.v1'; var timer = null; var ok = true;
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) GYM.loadState(JSON.parse(raw));
  } catch (e) { ok = false; }
  function save() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(GYM.S())); Persist._setStatus('saved'); }
      catch (e) { Persist._setStatus('error'); if (Persist.onError) Persist.onError(e); }
    }, 250);
  }
  GYM.Store.write = save; GYM.Store.remove = save; GYM.Store.replaceAll = save;
  Persist.localOk = ok;
};

export default Persist;
