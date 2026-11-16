// Simple calculator with a bug
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  // BUG: integer division truncation — should return float
  return Math.floor(a / b);
}

module.exports = { add, subtract, multiply, divide };
