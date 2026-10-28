import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, mkMember, nb } from './_helpers.js';

beforeAll(prepareHashes);
beforeEach(() => fresh());

const water = (extra) => Object.assign({ name: 'Water', price: 5000, cost: 2000, stock: 10 }, extra);
const expenses = () => GYM.values('expenses');

describe('saveProduct', () => {
  it('creates a product with defaults', () => {
    const { product, expense } = GYM.saveProduct({ name: ' Towel ', price: '45 000' });
    expect(product).toMatchObject({ name: 'Towel', category: 'General', price: 45000, cost: 0, stock: 0 });
    expect(expense).toBe(null);
  });
  it('rejects a duplicate name, ignoring case', () => {
    GYM.saveProduct(water());
    expect(() => GYM.saveProduct(water({ name: 'WATER' }))).toThrow('A product with this name already exists.');
    expect(GYM.values('products')).toHaveLength(1);
  });
  it('editing a product may keep its own name; renaming onto another is refused', () => {
    const a = GYM.saveProduct(water()).product;
    const b = GYM.saveProduct(water({ name: 'Bar' })).product;
    expect(() => GYM.saveProduct(water({ price: 6000 }), a.id)).not.toThrow();
    expect(GYM.S().products[a.id].price).toBe(6000);
    expect(() => GYM.saveProduct(water({ name: 'bar' }), a.id)).toThrow('A product with this name already exists.');
    expect(b.name).toBe('Bar');
  });
  it('validates fields', () => {
    expect(() => GYM.saveProduct(water({ name: '' }))).toThrow('Product name is required.');
    expect(() => GYM.saveProduct(water({ price: -1 }))).toThrow('Price must be at least 0.');
    expect(() => GYM.saveProduct(water({ stock: 1.5 }))).toThrow('Stock must be a whole number.');
    expect(() => GYM.saveProduct(water(), 'missing')).toThrow('Product not found.');
  });
  it('a new product with "expense" records a "shop stock" expense = cost x stock', () => {
    const r = GYM.saveProduct(water({ expense: true }));
    expect(r.expense).toMatchObject({ category: 'shop stock', amount: 20000, date: '2026-03-10', note: 'New product: Water x10' });
    expect(expenses()).toHaveLength(1);
    expect(expenses()[0].id).toBe(r.expense.id);
  });
  it('expense_amount overrides, empty or zero means no expense', () => {
    expect(GYM.saveProduct(water({ expense: true, expense_amount: '15 000' })).expense.amount).toBe(15000);
    expect(GYM.saveProduct(water({ name: 'B', expense: true, expense_amount: '' })).expense).toBe(null);
    expect(GYM.saveProduct(water({ name: 'C', expense: true, expense_amount: 0 })).expense).toBe(null);
    expect(GYM.saveProduct(water({ name: 'D', expense: true, cost: 0 })).expense).toBe(null);
    expect(GYM.saveProduct(water({ name: 'E' })).expense).toBe(null);
    expect(expenses()).toHaveLength(1);
  });
  it('product and expense go in together or not at all', () => {
    expect(() => GYM.saveProduct(water({ expense: true, expense_amount: 'abc' }))).toThrow('Expense amount must be a number.');
    expect(GYM.values('products')).toHaveLength(0);
    expect(expenses()).toHaveLength(0);
  });
  it('updating an existing product never records an expense', () => {
    const p = GYM.saveProduct(water()).product;
    const r = GYM.saveProduct(water({ expense: true, stock: 99 }), p.id);
    expect(r.expense).toBe(null);
    expect(expenses()).toHaveLength(0);
    expect(GYM.S().products[p.id].stock).toBe(99);
  });
  it('deleteProduct', () => {
    const p = GYM.saveProduct(water()).product;
    GYM.deleteProduct(p.id);
    expect(GYM.values('products')).toHaveLength(0);
  });
});

describe('sellProduct', () => {
  it('reduces stock and records a sale at the current price', () => {
    const p = GYM.saveProduct(water()).product;
    const sale = GYM.sellProduct(p.id, { qty: 3 });
    expect(GYM.S().products[p.id].stock).toBe(7);
    expect(sale).toMatchObject({ product: p.id, product_name: 'Water', qty: 3, unit_price: 5000, total: 15000, client: null, d: '2026-03-10', by: 'admin' });
  });
  it('refuses qty > stock and leaves everything unchanged', () => {
    const p = GYM.saveProduct(water({ stock: 3 })).product;
    expect(() => GYM.sellProduct(p.id, { qty: 4 })).toThrow('Only 3 in stock.');
    expect(GYM.S().products[p.id].stock).toBe(3);
    expect(GYM.values('sales')).toHaveLength(0);
  });
  it('can sell exactly the remaining stock', () => {
    const p = GYM.saveProduct(water({ stock: 3 })).product;
    GYM.sellProduct(p.id, { qty: 3 });
    expect(GYM.S().products[p.id].stock).toBe(0);
  });
  it('validates qty and product', () => {
    const p = GYM.saveProduct(water()).product;
    expect(() => GYM.sellProduct(p.id, { qty: 0 })).toThrow('Quantity must be at least 1.');
    expect(() => GYM.sellProduct(p.id, { qty: 1.5 })).toThrow('Quantity must be a whole number.');
    expect(() => GYM.sellProduct('nope', { qty: 1 })).toThrow('Product not found.');
  });
  it('links a member when given, rejects an unknown one', async () => {
    const p = GYM.saveProduct(water()).product;
    const c = await mkMember('Ali');
    expect(GYM.sellProduct(p.id, { qty: 1, client: c.id }).client).toBe(c.id);
    expect(() => GYM.sellProduct(p.id, { qty: 1, client: 'ghost' })).toThrow('Member not found.');
    expect(GYM.S().products[p.id].stock).toBe(9);
  });
});

describe('restockProduct', () => {
  it('adds stock; without a new unit cost the expense uses the current cost', () => {
    const p = GYM.saveProduct(water()).product;
    const r = GYM.restockProduct(p.id, { qty: 5, expense: true });
    expect(r.product.stock).toBe(15);
    expect(r.product.cost).toBe(2000);
    expect(r.expense).toMatchObject({ category: 'shop stock', amount: 10000, note: 'Restock: Water x5' });
  });
  it('a new unit cost becomes the product cost and the expense amount follows it', () => {
    const p = GYM.saveProduct(water()).product;
    const r = GYM.restockProduct(p.id, { qty: 10, unit_cost: '3 000', expense: true });
    expect(GYM.S().products[p.id].cost).toBe(3000);
    expect(GYM.S().products[p.id].stock).toBe(20);
    expect(r.expense.amount).toBe(30000);
    expect(GYM.values('audit').some((a) => a.action === 'RESTOCK' && a.detail === 'Water +10, cost ' + nb('2 000') + ' to ' + nb('3 000'))).toBe(true);
  });
  it('without "expense" no expense is recorded but the cost still updates', () => {
    const p = GYM.saveProduct(water()).product;
    const r = GYM.restockProduct(p.id, { qty: 1, unit_cost: 2500 });
    expect(r.expense).toBe(null);
    expect(expenses()).toHaveLength(0);
    expect(GYM.S().products[p.id].cost).toBe(2500);
  });
  it('an invalid request changes nothing', () => {
    const p = GYM.saveProduct(water()).product;
    expect(() => GYM.restockProduct(p.id, { qty: 0 })).toThrow('Quantity must be at least 1.');
    expect(() => GYM.restockProduct(p.id, { qty: 1, unit_cost: 'x' })).toThrow('Unit cost must be a number.');
    expect(() => GYM.restockProduct(p.id, { qty: 1, expense: true, expense_amount: 'x' })).toThrow('Expense amount must be a number.');
    expect(GYM.S().products[p.id].stock).toBe(10);
    expect(() => GYM.restockProduct('nope', { qty: 1 })).toThrow('Product not found.');
  });
});
