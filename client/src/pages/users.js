import G from '../core/gym.js';
import { api } from '../api.js';
import { session } from '../state.js';
import { esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { fld, roleLabel, sel } from '../ui/parts.js';

/* ---------- user roles (admin only) ---------- */
export function loadUsers() { return api.get('/api/admin/users'); }
export function pUsers(users) {
  var me = session.user;
  if (me.role !== 'admin') return '<div class="card"><div class="empty"><b>Admins only</b>Only an admin can add users, change roles or reset passwords.</div></div>';
  return '<section class="card"><header><h3>Add user</h3></header><form class="body" data-form="addUser" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end">' +
    fld('Username', 'username', { attrs: 'required maxlength="30" autocomplete="off"' }) + fld('Password', 'password', { type: 'password', attrs: 'required autocomplete="new-password"', hint: 'At least 4 characters' }) +
    sel('Role', 'role', G.ROLES.map(function (r) { return [r, roleLabel(r)]; }), 'admin') +
    '<div class="field"><button class="btn btn-primary" type="submit">' + ic('plus') + 'Add user</button></div><div class="form-error" role="alert" hidden style="grid-column:1/-1"></div></form></section>' +
    '<section class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>User</th><th>Role</th><th class="hide-sm">Created</th><th></th></tr></thead><tbody>' + users.map(function (u) {
      var self = u.id === me.id, removed = G.ROLES.indexOf(u.role) < 0;   /* removed = an old owner/trainer/vip_client account: kept so an admin can fix or delete it */
      return '<tr><td><b>' + esc(u.username) + '</b>' + (self ? ' <span class="chip plain">you</span>' : '') + (removed ? ' <span class="chip warn">Removed role</span>' : '') + '</td><td><label class="sr" for="role_' + esc(u.id) + '">Role for ' + esc(u.username) + '</label><select class="inline" id="role_' + esc(u.id) + '" data-change="setRole" data-id="' + esc(u.id) + '" style="width:auto">' +
        (removed ? '<option value="" selected disabled>' + roleLabel(u.role) + '</option>' : '') +
        G.ROLES.map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + roleLabel(r) + '</option>'; }).join('') + '</select></td><td class="hide-sm small">' + G.fmtDate(u.created_at.slice(0, 10)) + '</td>' +
        '<td class="act"><button class="btn btn-sm" data-act="resetPw" data-id="' + esc(u.id) + '">' + ic('key') + 'Reset password</button><button class="btn btn-sm btn-danger" data-act="delUser" data-id="' + esc(u.id) + '"' + (self ? ' disabled' : '') + '>' + ic('trash') + 'Delete</button></td></tr>';
    }).join('') + '</tbody></table></div></section>';
}

