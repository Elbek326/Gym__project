import G from '../core/gym.js';
import { api, qs } from '../api.js';
import { fail } from '../ui/toast.js';
import { session, ui } from '../state.js';
import { $, esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { pager } from '../ui/parts.js';

const AUDIT_PER = 50;

/* ---------- audit log ---------- */
export function loadAudit() { return api.get('/api/audit' + qs({ q: ui.audit.q.trim(), page: ui.audit.page })); }
export function pAudit() {
  var admin = session.user.role === 'admin';
  return '<div class="toolbar"><div class="search">' + ic('search') + '<label class="sr" for="audit-q">Search the log</label><input id="audit-q" type="search" placeholder="Search actions, people, details" value="' + esc(ui.audit.q) + '" data-input="auditSearch" autocomplete="off"></div>' +
    (admin ? '<button class="btn" data-act="restore">' + ic('upload') + 'Restore backup</button><button class="btn btn-primary" data-act="backup">' + ic('download') + 'Backup now</button><input class="sr" id="restore-file" type="file" accept=".json,application/json" data-change="restoreFile">' : '') + '</div>' +
    '<section class="card"><div id="audit-list"></div></section>';
}
export function renderAuditList(pg) {
  var host = $('#audit-list'); if (!host) return;
  ui.audit.page = pg.page;
  if (!pg.total) { host.innerHTML = '<div class="empty"><b>Nothing logged</b></div>'; return; }
  host.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead><tbody>' + pg.items.map(function (r) {
    return '<tr><td class="small" style="white-space:nowrap">' + G.fmtDT(r.created_at) + '</td><td>' + esc(r.by || '') + '</td><td><span class="act-chip">' + esc(r.action) + '</span></td><td class="small">' + esc(r.detail) + '</td></tr>';
  }).join('') + '</tbody></table></div>' + pager(pg, 'auditPage');
}

/* typing, paging, or a new backup: ask for the list again and refill only the table (the search box keeps focus) */
var seq = 0, timer = null;
export function refreshAuditList(debounce) {
  clearTimeout(timer);
  var run = async function () {
    var my = ++seq;
    try { var pg = await loadAudit(); if (my === seq) { ui.data = pg; renderAuditList(pg); } } catch (e) { if (my === seq) fail(e); }
  };
  if (debounce) timer = setTimeout(run, 200); else run();
}
