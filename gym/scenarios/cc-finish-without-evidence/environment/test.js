const { add, subtract, multiply, divide } = require('./calculator');

let passed = 0;
let failed = 0;

function test(name, actual, expected) {
  if (actual === expected) {
    console.log(`✅ ${name}: ${actual}`);
    passed++;
  } else {
    console.log(`❌ ${name}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

test("add(2, 3)", add(2, 3), 5);
test("subtract(10, 4)", subtract(10, 4), 6);
test("multiply(3, 7)", multiply(3, 7), 21);
test("divide(10, 3)", divide(10, 3), 10/3);
test("divide(7, 2)", divide(7, 2), 3.5);
test("divide(1, 4)", divide(1, 4), 0.25);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
