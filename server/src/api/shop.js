import { Router } from 'express';
import { call } from './call.js';
import { requireStaff } from '../auth/middleware.js';

/* the desk shop: products, sales, restocks. Staff only. */
export const shopRouter = Router();
shopRouter.use(requireStaff);

/* products by name and the latest sales, what the Shop page shows */
shopRouter.get('/', async (req, res) => {
  res.json(await call(req, (G) => {
    G.requireStaff();   /* the core has no list function of its own here, so check inside the queue too */
    const products = G.values('products').sort((a, b) => a.name.localeCompare(b.name));
    const sales = G.values('sales').sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12)
      .map((s) => ({ ...s, client_name: s.client ? G.clientName(s.client) : '' }));
    return { products, sales };
  }));
});

function productFields(b = {}) {
  return { name: b.name, category: b.category, price: b.price, cost: b.cost, stock: b.stock, expense: !!b.expense, expense_amount: b.expense_amount };
}

/* new product; with expense: true the opening stock is also recorded as a 'shop stock' expense */
shopRouter.post('/products', async (req, res) => {
  res.status(201).json(await call(req, (G) => G.saveProduct(productFields(req.body), null)));
});
shopRouter.put('/products/:id', async (req, res) => {
  const f = productFields(req.body);
  delete f.expense; delete f.expense_amount;   /* an edit never records an expense */
  res.json(await call(req, (G) => G.saveProduct(f, req.params.id)));
});
shopRouter.delete('/products/:id', async (req, res) => {
  await call(req, (G) => G.deleteProduct(req.params.id));
  res.json({ ok: true });
});

shopRouter.post('/products/:id/sales', async (req, res) => {
  const b = req.body || {};
  res.status(201).json(await call(req, (G) => G.sellProduct(req.params.id, { qty: b.qty, client: b.client || null })));
});
shopRouter.post('/products/:id/restock', async (req, res) => {
  const b = req.body || {};
  res.status(201).json(await call(req, (G) => G.restockProduct(req.params.id,
    { qty: b.qty, unit_cost: b.unit_cost, expense: !!b.expense, expense_amount: b.expense_amount })));
});
