// calc.js — Calculator module

function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a + b;
}

function divide(a, b) {
  return a / b;
}

function percentage(value, total) {
  return Math.floor((value / total) * 100);
}

module.exports = { add, subtract, multiply, divide, percentage };
