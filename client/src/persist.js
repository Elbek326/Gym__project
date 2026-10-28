import GYM from './core/gym.js';

/* ===== persistence: shared database (claude db capability) or this browser only ===== */
const Persist = {
  mode: 'memory',          /* 'shared' | 'browser' | 'memory' */
  status: 'idle',          /* idle | saving | saved | error */
  canWrite: true,
  onStatus: null, onRemote: null, onError: null,
  _dl: null, _dbWrites: 0
};

Persist.init = async function (forceLocal) {
  var db = null, user = null;
  if (!forceLocal) {
    try { if (window.claude && window.claude.use) db = await window.claude.use('db'); } catch (e) { db = null; }
    try { if (window.claude && window.claude.use) user = await window.claude.use('user'); } catch (e) { user = null; }
  }
  try { if (window.claude && window.claude.use) Persist._dl = await window.claude.use('downloads'); } catch (e) { Persist._dl = null; }
  if (db) {
    var canWrite = true;
    try { if (user && user.can && user.can('data.write') === false) canWrite = false; } catch (e) { /* keep default */ }
    Persist.canWrite = canWrite; GYM.Store.readOnly = !canWrite;
    await Persist._startShared(db);
    Persist.mode = 'shared';
  } else {
    Persist._startLocal();
    Persist.mode = 'browser';
  }
};

Persist._setStatus = function (s) { Persist.status = s; if (Persist.onStatus) Persist.onStatus(s); };

/* ----- shared database: every table is a collection; busy tables are stored one document per day ----- */
Persist._startShared = async function (db) {
  var pend = new Map();
  function body(t, key) {
    if (GYM.SHARD_OF(t)) { var items = GYM.shardItems(t, key); return items.length ? { items: items } : null; }
    var r = GYM.S()[t][key]; return r || null;
  }
  async function run(path, e) {
    e.running = true; Persist._setStatus('saving');
    var failed = false;
    try {
      do {
        e.dirty = false;
        var b = body(e.t, e.key); var ref = db.doc(path);
        if (b == null) await ref.delete(); else await ref.set(b);
      } while (e.dirty);
      Persist._setStatus('saved');
    } catch (err) {
      failed = true; Persist._setStatus('error');
      if (err && err.code === 'revoked') { GYM.Store.readOnly = true; Persist.canWrite = false; }
      if (Persist.onError) Persist.onError(err);
    } finally {
      e.running = false;
      /* after a failed save, retry only on the next local change, so a lasting error (quota, revoked) cannot loop */
      if (!e.dirty || failed) pend.delete(path); else run(path, e);
    }
  }
  function schedule(t, key) {
    var path = t + '/' + key; var e = pend.get(path);
    if (!e) { e = { t: t, key: key, running: false, dirty: false }; pend.set(path, e); }
    if (e.running) { e.dirty = true; return; }
    run(path, e);
  }
  function keyOf(t, rec) { return GYM.SHARD_OF(t) ? rec.d : rec.id; }
  GYM.Store.write = function (t, rec) { schedule(t, keyOf(t, rec)); };
  GYM.Store.remove = function (t, rec) { schedule(t, keyOf(t, rec)); };
  GYM.Store.replaceAll = function (oldS, newS) {
    var oldP = GYM.allDocPaths(oldS), newP = GYM.allDocPaths(newS);
    Object.keys(newP).forEach(function (p) { schedule(newP[p][0], newP[p][1]); });
    Object.keys(oldP).forEach(function (p) { if (!newP[p]) schedule(oldP[p][0], oldP[p][1]); });
  };

  var waits = [];
  GYM.TABLES.forEach(function (t) {
    var first = true;
    waits.push(new Promise(function (resolve) {
      db.collection(t).onSnapshot(function (snap) {
        var changed = false;
        snap.docChanges().forEach(function (ch) {
          var d = ch.doc; var path = t + '/' + d.id;
          if (pend.has(path)) return;                         /* a local write is still on its way */
          if (d.metadata && d.metadata.hasPendingWrites) return;
          /* the database hands out frozen (read-only) objects; keep a plain copy so the rules can edit records in place */
          var b = ch.type === 'removed' ? null : JSON.parse(JSON.stringify(d.data()));
          if (GYM.applyRemote(t, d.id, b)) changed = true;
        });
        if (changed && !first && Persist.onRemote) Persist.onRemote();
        if (first && !(snap.metadata && snap.metadata.fromCache)) { first = false; resolve(); }
      }, function (err) {
        if (err && err.code === 'revoked') { GYM.Store.readOnly = true; Persist.canWrite = false; }
        if (first) { first = false; resolve(); }
        if (Persist.onError) Persist.onError(err);
      });
    }));
  });
  var timer;
  var timeout = new Promise(function (_, rej) { timer = setTimeout(function () { rej(new Error('timeout')); }, 15000); });
  try { await Promise.race([Promise.all(waits), timeout]); } finally { clearTimeout(timer); }
};

/* ----- this browser only (localStorage), used when the shared database is not available ----- */
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

Persist.saveFile = async function (filename, data) {
  if (!Persist._dl) throw new GYM.AppError('Downloads are not available in this view.');
  try { return await Persist._dl.save({ filename: filename, data: data }); }
  catch (e) {
    if (e && e.code === 'declined') return null;
    throw new GYM.AppError('The file could not be saved (' + ((e && e.code) || 'error') + ').');
  }
};

export default Persist;
