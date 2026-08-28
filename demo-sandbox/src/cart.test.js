import test from 'node:test';
import assert from 'node:assert';
import { calculateCartTotal, applyCoupon } from './cart.js';

test('calculateCartTotal computes basic total for clean items', () => {
  const items = [
    { name: 'Shirt', price: 50, quantity: 2 },
    { name: 'Hat', price: 20, quantity: 1 }
  ];
  assert.strictEqual(calculateCartTotal(items), 120);
});

test('calculateCartTotal handles empty or invalid cart', () => {
  assert.strictEqual(calculateCartTotal([]), 0);
  assert.strictEqual(calculateCartTotal(null), 0);
});
