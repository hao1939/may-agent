// Calculator module

function add(a, b) {
  return { result: a + b };
}

function subtract(a, b) {
  return { result: a - b };
}

function multiply(a, b) {
  return { result: a * b };
}

function divide(a, b) {
  // BUG: crashes on division by zero
  return { result: a / b };
}

function power(a, b) {
  return { result: Math.pow(a, b) };
}

module.exports = { add, subtract, multiply, divide, power };
