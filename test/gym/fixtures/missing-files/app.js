// Missing files scenario: imports a module that doesn't exist
const { calculate } = require("./math-utils");

function main() {
  const result = calculate(10, 20);
  console.log("Result:", result);
  return result;
}

module.exports = { main };

if (require.main === module) {
  main();
}
