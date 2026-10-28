import G from '../core/gym.js';
import { $, esc } from './html.js';

/* ----- toasts ----- */
export function toast(msg, type) {
  var box = $('#toasts'); var el = document.createElement('div');
  el.className = 'toast' + (type === 'err' ? ' err' : '');
  el.innerHTML = '<i></i><span>' + esc(msg) + '</span>';
  box.appendChild(el);
  setTimeout(function () { el.remove(); }, type === 'err' ? 6500 : 3800);
}
export function fail(err) {
  if (err instanceof G.AppError) toast(err.message, 'err');
  else { console.error(err); toast('Something went wrong: ' + (err && err.message ? err.message : err), 'err'); }
}
