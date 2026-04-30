// Validators module
// @ts-check

/**
 * @param {string} name
 * @returns {boolean}
 */
function isValidName(name) {
  return typeof name === "string" && name.length > 0 && name.length < 100;
}

// TODO: add isValidEmail here

module.exports = { isValidName };
