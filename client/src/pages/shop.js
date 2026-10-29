import G from '../core/gym.js';
import { api } from '../api.js';
import { esc } from '../ui/html.js';
import { ic } from '../ui/icons.js';
import { memberLink, money } from '../ui/parts.js';

/* ---------- shop ---------- */
export function loadShop() { return api.get('/api/shop'); }
export function pShop(D) {
  var prods = D.products, sales = D.sales;
  var rows = prods.map(function (p) {
    var stock = p.stock === 0 ? '<span class="chip expired">Out</span>' : (p.stock <= 5 ? '<span class="chip warn">' + p.stock + ' left</span>' : '<span class="num">' + p.stock + '</span>');
    return '<tr><td><b>' + esc(p.name) + '</b><div class="small muted">' + esc(p.category) + '</div></td><td class="r">' + money(p.price) + '</td><td class="r hide-sm">' + money(p.cost) + '</td><td class="r">' + stock + '</td>' +
      '<td class="act"><button class="btn btn-sm btn-primary" data-act="sell" data-id="' + esc(p.id) + '"' + (p.stock < 1 ? ' disabled' : '') + '>Sell</button><button class="btn btn-sm" data-act="restock" data-id="' + esc(p.id) + '">Restock</button><button class="btn btn-sm icon-btn" data-act="editProduct" data-id="' + esc(p.id) + '" aria-label="Edit ' + esc(p.name) + '">' + ic('edit') + '</button><button class="btn btn-sm icon-btn btn-danger" data-act="delProduct" data-id="' + esc(p.id) + '" aria-label="Delete ' + esc(p.name) + '">' + ic('trash') + '</button></td></tr>';
  }).join('');
  return '<div class="toolbar"><span class="grow muted">' + prods.length + ' products</span><button class="btn btn-primary" data-act="addProduct">' + ic('plus') + 'Add product</button></div>' +
    '<section class="card">' + (prods.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th class="r">Price</th><th class="r hide-sm">Cost</th><th class="r">Stock</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty"><b>The shop is empty</b>Add water, protein bars or anything else you sell at the desk.</div>') + '</section>' +
    '<section class="card"><header><h3>Recent sales</h3></header>' + (sales.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Product</th><th class="r">Qty</th><th class="r">Total</th><th class="hide-sm">Member</th></tr></thead><tbody>' + sales.map(function (s) {
      return '<tr><td class="small">' + G.fmtDT(s.created_at) + '</td><td>' + esc(s.product_name) + '</td><td class="r">' + s.qty + '</td><td class="r">' + money(s.total) + '</td><td class="hide-sm">' + (s.client ? memberLink(s.client_name ? { id: s.client, name: s.client_name } : null) : '<span class="muted">Walk-in</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty"><b>No sales yet</b></div>') + '</section>';
}

