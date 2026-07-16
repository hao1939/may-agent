/**
 * Order module tests
 * Run: node test/order.test.js
 */

const { Order, createOrder, VALID_STATUSES } = require('../src/order');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label || ''} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('\nOrder Tests\n');

// --- Basic Creation ---

test('creates order with valid items', () => {
  const order = createOrder({
    userId: 'u1',
    items: [{ name: 'Widget', price: 10, quantity: 2 }]
  });
  assertEqual(order.userId, 'u1', 'userId');
  assertEqual(order.status, 'pending', 'default status');
});

test('rejects order without userId', () => {
  let threw = false;
  try {
    createOrder({ items: [{ name: 'Widget', price: 10, quantity: 1 }] });
  } catch (e) { threw = true; }
  assert(threw, 'Should throw for missing userId');
});

test('rejects empty items', () => {
  let threw = false;
  try {
    createOrder({ userId: 'u1', items: [] });
  } catch (e) { threw = true; }
  assert(threw, 'Should throw for empty items');
});

test('rejects items with zero price', () => {
  let threw = false;
  try {
    createOrder({ userId: 'u1', items: [{ name: 'Free', price: 0, quantity: 1 }] });
  } catch (e) { threw = true; }
  assert(threw, 'Should throw for zero price');
});

// --- Total Calculation (catches v2.1.0 bug) ---

test('calculates total with quantity', () => {
  // This test catches the v2.1.0 regression where quantity was dropped from calculation
  const order = createOrder({
    userId: 'u1',
    items: [
      { name: 'Widget', price: 10, quantity: 3 },
      { name: 'Gadget', price: 25, quantity: 2 }
    ]
  });
  // Correct total: (10*3) + (25*2) = 30 + 50 = 80
  assertEqual(order.total, 80, 'total should be 80');
});

test('calculates total for single item', () => {
  const order = createOrder({
    userId: 'u1',
    items: [{ name: 'Widget', price: 15, quantity: 4 }]
  });
  // Correct: 15 * 4 = 60
  assertEqual(order.total, 60, 'total should be 60');
});

test('calculates total for quantity=1 items', () => {
  // This case would pass even with the bug (price * 1 = price)
  // but quantity > 1 tests catch it
  const order = createOrder({
    userId: 'u1',
    items: [
      { name: 'A', price: 10, quantity: 1 },
      { name: 'B', price: 20, quantity: 1 }
    ]
  });
  assertEqual(order.total, 30, 'total should be 30');
});

// --- Status Transitions ---

test('allows valid status transitions', () => {
  const order = new Order({ id: 'o1', userId: 'u1', items: [{ name: 'X', price: 10, quantity: 1 }], status: 'pending' });
  order.updateStatus('confirmed');
  assertEqual(order.status, 'confirmed', 'status after confirm');
  order.updateStatus('shipped');
  assertEqual(order.status, 'shipped', 'status after ship');
});

test('rejects backward status transitions', () => {
  const order = new Order({ id: 'o1', userId: 'u1', items: [{ name: 'X', price: 10, quantity: 1 }], status: 'shipped' });
  let threw = false;
  try { order.updateStatus('pending'); } catch (e) { threw = true; }
  assert(threw, 'Should reject going from shipped to pending');
});

test('allows cancellation from any status', () => {
  const order = new Order({ id: 'o1', userId: 'u1', items: [{ name: 'X', price: 10, quantity: 1 }], status: 'confirmed' });
  order.updateStatus('cancelled');
  assertEqual(order.status, 'cancelled', 'status after cancel');
});

test('rejects invalid status', () => {
  const order = new Order({ id: 'o1', userId: 'u1', items: [{ name: 'X', price: 10, quantity: 1 }], status: 'pending' });
  let threw = false;
  try { order.updateStatus('invalid'); } catch (e) { threw = true; }
  assert(threw, 'Should reject invalid status');
});

// --- Serialization ---

test('toJSON includes all fields', () => {
  const order = new Order({ id: 'o1', userId: 'u1', items: [{ name: 'X', price: 10, quantity: 1 }], status: 'pending', total: 10, createdAt: '2024-01-01' });
  const json = order.toJSON();
  assert(json.id !== undefined, 'must have id');
  assert(json.userId !== undefined, 'must have userId');
  assert(json.items !== undefined, 'must have items');
  assert(json.status !== undefined, 'must have status');
  assert(json.total !== undefined, 'must have total');
  assert(json.createdAt !== undefined, 'must have createdAt');
});

// Summary
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
