/**
 * math.js — Math utilities
 */

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
  // BUG: no zero-check — will return Infinity
  return a / b;
}

module.exports = { add, subtract, multiply, divide };
