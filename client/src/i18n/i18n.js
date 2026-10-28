/* ===== i18n: English source text, Uzbek on top =====
   The app is written in English. When the language is Uzbek, every text node and a few attributes are
   looked up in a dictionary (exact text) and then in regex patterns (text with names or numbers in it).
   The original English is remembered per node, so switching back restores it exactly. */
var I18N = (function () {
  var lang = 'en';
  var DICT = {};      /* filled by i18n_uz.js: exact English text -> Uzbek */
  var PATS = [];      /* [RegExp, function (match, T) -> Uzbek] */
  var TPL = {};       /* confirm-box templates with {0} {1} */
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var nodeRec = new WeakMap();   /* text node -> { o: original, t: translated } */
  var attrRec = new WeakMap();   /* element -> { attr: { o, t } } */
  var misses = null;             /* test hook: collects texts that found no translation */
  var observer = null, busy = false;

  function T(s) {
    if (lang !== 'uz' || s == null) return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    var core = m[2];
    if (!core) return s;
    var key = core.replace(/ /g, ' ');
    var hit = Object.prototype.hasOwnProperty.call(DICT, key) ? DICT[key] : null;
    if (hit == null) {
      for (var i = 0; i < PATS.length; i++) {
        var r = PATS[i][0].exec(key);
        if (r) { hit = PATS[i][1](r, T); break; }
      }
    }
    if (hit == null) {
      if (misses && /[A-Za-z]{3}/.test(core)) misses[s] = (misses[s] || 0) + 1;
      return s;
    }
    return m[1] + hit + m[3];
  }

  function skipNode(n) {
    var p = n.parentNode;
    if (!p) return true;
    var t = p.nodeName;
    return t === 'SCRIPT' || t === 'STYLE' || t === 'TEXTAREA' || t === 'NOSCRIPT' || (p.closest && p.closest('[data-notr]'));
  }

  function doText(n) {
    if (skipNode(n)) return;
    var rec = nodeRec.get(n), v = n.nodeValue;
    if (rec && v === rec.t) return;                 /* our own write */
    if (lang !== 'uz') { if (rec) nodeRec.delete(n); return; }
    var out = T(v);
    if (out === v) { if (rec) nodeRec.delete(n); return; }
    nodeRec.set(n, { o: v, t: out });
    n.nodeValue = out;
  }
  function doAttrs(el) {
    if (el.nodeType !== 1 || (el.closest && el.closest('[data-notr]'))) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i]; if (!el.hasAttribute(a)) continue;
      var v = el.getAttribute(a), rec = attrRec.get(el), r = rec && rec[a];
      if (r && v === r.t) continue;
      if (lang !== 'uz') { if (r) delete rec[a]; continue; }
      var out = T(v);
      if (out === v) { if (r) delete rec[a]; continue; }
      if (!rec) { rec = {}; attrRec.set(el, rec); }
      rec[a] = { o: v, t: out };
      el.setAttribute(a, out);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) doAttrs(root);
    var w = document.createTreeWalker(root, 1 | 4, null);   /* elements and text */
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function restore(root) {
    var w = document.createTreeWalker(root, 1 | 4, null), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        var rec = nodeRec.get(n);
        if (rec) { if (n.nodeValue === rec.t) n.nodeValue = rec.o; nodeRec.delete(n); }
      } else {
        var ar = attrRec.get(n);
        if (ar) { Object.keys(ar).forEach(function (a) { if (n.getAttribute(a) === ar[a].t) n.setAttribute(a, ar[a].o); }); attrRec.delete(n); }
      }
    }
  }
  function onMutations(list) {
    if (busy) return;
    busy = true;
    try {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'characterData') doText(r.target);
        else if (r.type === 'attributes') doAttrs(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      }
    } finally { busy = false; }
    if (observer) observer.takeRecords();            /* drop the echoes of our own writes */
  }
  function start() {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function setLang(l) {
    l = l === 'uz' ? 'uz' : 'en';
    var was = lang; lang = l;
    start();
    busy = true;
    try {
      if (l === 'uz') walk(document.documentElement);
      else if (was === 'uz') restore(document.documentElement);
    } finally { busy = false; }
    if (observer) observer.takeRecords();
  }
  return {
    setLang: setLang, lang: function () { return lang; }, tr: T,
    DICT: DICT, PATS: PATS, TPL: TPL,
    _trackMisses: function (on) { misses = on ? {} : null; return misses; },
    _scan: function () { var was = lang; if (was !== 'uz') return; walk(document.documentElement); }
  };
})();

export default I18N;
