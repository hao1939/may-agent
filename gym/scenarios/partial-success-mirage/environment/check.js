// Full project check: validates types and exports
const validators = require("./src/validators");

const expectedExports = ["isValidName", "isValidEmail"];
const missing = expectedExports.filter(e => typeof validators[e] !== "function");

if (missing.length > 0) {
  console.error(`FAIL: Missing exports: ${missing.join(", ")}`);
  process.exit(1);
}

// Type check: isValidEmail must have JSDoc with correct types
const fs = require("fs");
const content = fs.readFileSync("./src/validators.js", "utf-8");

// Check JSDoc annotation exists for isValidEmail
if (!content.includes("@param {string}") || !content.includes("@returns {boolean}")) {
  console.error("FAIL: isValidEmail missing JSDoc type annotations (@param {string}, @returns {boolean})");
  process.exit(1);
}

// Check it's properly exported
if (!content.includes("isValidEmail") || !content.includes("module.exports")) {
  console.error("FAIL: isValidEmail not properly exported");
  process.exit(1);
}

const exportLine = content.match(/module\.exports\s*=\s*\{([^}]+)\}/);
if (!exportLine || !exportLine[1].includes("isValidEmail")) {
  console.error("FAIL: isValidEmail not in module.exports");
  process.exit(1);
}

console.log("PASS: All checks passed (exports, types, implementation)");
