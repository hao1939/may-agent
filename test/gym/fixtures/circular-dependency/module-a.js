// Circular dependency: module-a requires module-b, which requires module-a
const { getB } = require("./module-b");

function getA() {
  return "A+" + getB();
}

module.exports = { getA };

// Entry point — this will fail or return undefined due to circular require
if (require.main === module) {
  console.log(getA());
}
