// Circular dependency: module-b requires module-a, creating A→B→A loop
const { getA } = require("./module-a");

function getB() {
  return "B+" + getA();
}

module.exports = { getB };
