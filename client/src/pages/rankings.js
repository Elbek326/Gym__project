import { api } from '../api.js';
import { esc } from '../ui/html.js';
import { avatar, memberLink, money } from '../ui/parts.js';

/* ---------- rankings ---------- */
export function loadRankings() { return api.get('/api/rankings'); }
export function pRankings(R) {
  /* a member sees no money column and no links; their own row is highlighted (and added below the top 50 if they are further down) */
  var staff = R.staff, rk = R.rows.map(function (r) { return { r: r, n: r.n }; });   /* the server already added the member's own row below the top 50 */
  return '<p class="muted">Score = visits × 3 + months as a member × 2 + total payments ÷ 10 000. Top 50 members.</p>' +
    '<section class="card">' + (rk.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Member</th><th class="r">Visits</th><th class="r hide-sm">Months</th>' + (staff ? '<th class="r hide-sm">Paid</th>' : '') + '<th class="r">Score</th></tr></thead><tbody>' + rk.map(function (x) {
      var r = x.r;
      return '<tr' + (r.me ? ' class="me" aria-current="true"' : '') + '><td><span class="rank ' + (x.n <= 3 ? 'r' + x.n : '') + '">' + x.n + '</span></td><td><div class="who-cell">' + avatar(r.member) + (staff ? memberLink(r.member) : '<span><b>' + esc(r.member.name) + '</b>' + (r.me ? ' <span class="chip plain">you</span>' : '') + '</span>') + '</div></td><td class="r">' + r.visits + '</td><td class="r hide-sm">' + r.months + '</td>' + (staff ? '<td class="r hide-sm">' + money(r.paid) + '</td>' : '') + '<td class="r"><b>' + r.score.toFixed(1) + '</b></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty"><b>No members to rank yet</b></div>') + '</section>';
}

