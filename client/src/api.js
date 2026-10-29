import G from './core/gym.js';

/* ===== the server API: one fetch wrapper =====
   Same origin (Vite proxies /api in dev), the session cookie travels by itself, bodies are JSON.
   A non-2xx reply becomes a G.AppError with the server's message, so fail() and the forms show it
   (and I18N translates it) exactly like a core rule message. */
export const net = {
  pending: 0,            /* writes in flight */
  status: 'online',      /* online | saving | error */
  onStatus: null,        /* called with the new status */
  onUnauthorized: null   /* called when a signed-in page gets 401 */
};
function setStatus(s) { if (net.status !== s) { net.status = s; if (net.onStatus) net.onStatus(s); } }

async function send(method, path, body, raw) {
  var write = method !== 'GET';
  var opts = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (write) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body === undefined ? {} : body); }
  if (write) { net.pending++; setStatus('saving'); }
  var res, failed = false, signedOut = false;
  try {
    try { res = await fetch(path, opts); } catch (e) { failed = true; throw new G.AppError('Could not reach the server.'); }
    var text = await res.text();
    var data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
    if (!res.ok) {
      /* 5xx and an empty or HTML reply: the proxy or the server is down */
      if (res.status >= 500) failed = true;
      if (res.status === 401 && net.onUnauthorized && net.onUnauthorized()) signedOut = true;   /* the app already went to the login screen */
      var msg = data && data.error ? data.error : (res.status >= 502 ? 'Could not reach the server.' : 'Something went wrong: ' + res.status);
      var err = new G.AppError(msg); err.signedOut = signedOut;
      throw err;
    }
    return raw ? text : data;
  } finally {
    if (write) { net.pending--; if (net.pending <= 0) { net.pending = 0; setStatus(failed ? 'error' : 'online'); } }
    else if (!failed && net.status === 'error' && net.pending === 0) setStatus('online');
  }
}

export const api = {
  get: function (path, raw) { return send('GET', path, undefined, raw); },
  post: function (path, body) { return send('POST', path, body); },
  put: function (path, body) { return send('PUT', path, body); },
  del: function (path) { return send('DELETE', path); }
};
/* ?a=1&b=2 from an object, skipping empty values */
export function qs(o) {
  var p = Object.keys(o).filter(function (k) { return o[k] !== '' && o[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); });
  return p.length ? '?' + p.join('&') : '';
}
export const enc = encodeURIComponent;
