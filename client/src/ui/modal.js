import G from '../core/gym.js';
import { modals } from '../state.js';
import { $, esc } from './html.js';
import { ic } from './icons.js';

export function openModal(o) {
  var root = $('#modal-root'); var prev = document.activeElement;
  var wrap = document.createElement('div'); wrap.className = 'modal-wrap';
  wrap.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
    '<header><h3>' + esc(o.title) + '</h3><button type="button" class="btn icon-btn" data-close aria-label="Close">' + ic('x') + '</button></header>' +
    '<form novalidate><div class="mb">' + o.body + '<div class="form-error" role="alert" hidden></div></div>' +
    '<footer><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn ' + (o.danger ? 'btn-danger solid' : 'btn-primary') + '">' + esc(o.submit || 'Save') + '</button></footer></form></div>';
  root.appendChild(wrap); modals.push(wrap);
  var form = $('form', wrap); var errEl = $('.form-error', wrap); var sbtn = $('[type=submit]', form);
  var done = false;
  function close(result) {
    if (done) return; done = true;
    wrap.remove(); modals.splice(modals.indexOf(wrap), 1);
    if (o.onClose) o.onClose(result === true);
    if (prev && prev.focus && document.contains(prev)) prev.focus();
  }
  wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(false); });
  wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(false); });
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); errEl.hidden = true; sbtn.disabled = true;
    try {
      var r = await o.onSubmit(new FormData(form), form);
      if (r !== false) close(true);
    } catch (err) {
      errEl.textContent = err instanceof G.AppError ? err.message : 'Something went wrong: ' + (err && err.message);
      errEl.hidden = false; if (!(err instanceof G.AppError)) console.error(err);
    } finally { sbtn.disabled = false; }
  });
  if (o.onOpen) o.onOpen(wrap, form);
  setTimeout(function () {
    var f = $('input:not([type=hidden]):not([type=file]):not([type=checkbox]),select,textarea', form); if (f) f.focus();
  }, 20);
  return { close: close, wrap: wrap, form: form };
}
export function confirmBox(o) {
  return new Promise(function (resolve) {
    openModal({
      title: o.title, body: '<p>' + (o.html || esc(o.text || '')) + '</p>', submit: o.confirm || 'Confirm', danger: o.danger,
      onSubmit: function () { return true; }, onClose: function (ok) { resolve(ok); }
    });
  });
}
