// Calculator module

function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  // Bug: uses Math.abs which drops the sign for negative numbers
  return Math.abs(a) * Math.abs(b);
}

function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

module.exports = { add, subtract, multiply, divide };
