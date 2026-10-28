import G from '../core/gym.js';
import { esc } from '../ui/html.js';
import { avatar, memberLink, money } from '../ui/parts.js';

/* ---------- rankings ---------- */
export function pRankings() {
  /* a member sees no money column and no links; their own row is highlighted (and added below the top 50 if they are further down) */
  var staff = G.isStaff(G.me()), all = G.rankings();
  var rk = all.slice(0, 50).map(function (r, i) { return { r: r, n: i + 1 }; });
  if (!staff) { var mi = all.findIndex(function (r) { return r.me; }); if (mi >= 50) rk.push({ r: all[mi], n: mi + 1 }); }
  return '<p class="muted">Score = visits × 3 + months as a member × 2 + total payments ÷ 10 000. Top 50 members.</p>' +
    '<section class="card">' + (rk.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Member</th><th class="r">Visits</th><th class="r hide-sm">Months</th>' + (staff ? '<th class="r hide-sm">Paid</th>' : '') + '<th class="r">Score</th></tr></thead><tbody>' + rk.map(function (x) {
      var r = x.r;
      return '<tr' + (r.me ? ' class="me" aria-current="true"' : '') + '><td><span class="rank ' + (x.n <= 3 ? 'r' + x.n : '') + '">' + x.n + '</span></td><td><div class="who-cell">' + avatar(r.c) + (staff ? memberLink(r.c) : '<span><b>' + esc(r.c.name) + '</b>' + (r.me ? ' <span class="chip plain">you</span>' : '') + '</span>') + '</div></td><td class="r">' + r.visits + '</td><td class="r hide-sm">' + r.months + '</td>' + (staff ? '<td class="r hide-sm">' + money(r.paid) + '</td>' : '') + '<td class="r"><b>' + r.score.toFixed(1) + '</b></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty"><b>No members to rank yet</b></div>') + '</section>';
}

