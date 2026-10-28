import G from '../core/gym.js';
import { ui } from '../state.js';
import { $, esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { pager } from '../ui/parts.js';

const AUDIT_PER = 50;

/* ---------- audit log ---------- */
export function pAudit() {
  var admin = G.me().role === 'admin';
  return '<div class="toolbar"><div class="search">' + ic('search') + '<label class="sr" for="audit-q">Search the log</label><input id="audit-q" type="search" placeholder="Search actions, people, details" value="' + esc(ui.audit.q) + '" data-input="auditSearch" autocomplete="off"></div>' +
    (admin ? '<button class="btn" data-act="restore">' + ic('upload') + 'Restore backup</button><button class="btn btn-primary" data-act="backup">' + ic('download') + 'Backup now</button><input class="sr" id="restore-file" type="file" accept=".json,application/json" data-change="restoreFile">' : '') + '</div>' +
    '<section class="card"><div id="audit-list"></div></section>';
}
export function renderAuditList() {
  var host = $('#audit-list'); if (!host) return;
  var q = ui.audit.q.trim().toLowerCase();
  var rows = G.listAudit().sort(function (a, b) { return b.created_at.localeCompare(a.created_at) || (b.id < a.id ? -1 : 1); });
  if (q) rows = rows.filter(function (r) { return (r.action + ' ' + r.detail + ' ' + r.by).toLowerCase().indexOf(q) >= 0; });
  var pg = G.paginate(rows, ui.audit.page, AUDIT_PER); ui.audit.page = pg.page;
  if (!pg.total) { host.innerHTML = '<div class="empty"><b>Nothing logged</b></div>'; return; }
  host.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead><tbody>' + pg.items.map(function (r) {
    return '<tr><td class="small" style="white-space:nowrap">' + G.fmtDT(r.created_at) + '</td><td>' + esc(r.by || '') + '</td><td><span class="act-chip">' + esc(r.action) + '</span></td><td class="small">' + esc(r.detail) + '</td></tr>';
  }).join('') + '</tbody></table></div>' + pager(pg, 'auditPage');
}

