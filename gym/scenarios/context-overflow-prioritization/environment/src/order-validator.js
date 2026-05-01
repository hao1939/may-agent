const config = require('./config.json');

function loadValidator(name) {
  const path = config.validators[name];
  if (!path) return undefined;
  return require(path);
}

// This is the line that fails in production (line ~23 equivalent)
const orderValidator = loadValidator('orderValidator');

module.exports = {
  validateOrder: (order) => {
    return orderValidator.validate(order);
  }
};
