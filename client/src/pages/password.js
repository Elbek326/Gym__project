import { ic } from '../ui/icons.js';
import { fld } from '../ui/parts.js';

/* ---------- my password ---------- */
export function pPassword() {
  return '<section class="card" style="max-width:460px"><header><h3>Change your password</h3></header><form class="body" data-form="password" style="display:flex;flex-direction:column;gap:14px">' +
    fld('Current password', 'current', { type: 'password', attrs: 'required autocomplete="current-password"' }) +
    fld('New password', 'next', { type: 'password', attrs: 'required autocomplete="new-password"', hint: 'At least 4 characters' }) +
    fld('Confirm new password', 'confirm', { type: 'password', attrs: 'required autocomplete="new-password"' }) +
    '<div class="form-error" role="alert" hidden></div><div><button class="btn btn-primary" type="submit">' + ic('key') + 'Change password</button></div></form></section>';
}


