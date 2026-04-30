const { isValidEmail } = require("../src/validators");

const tests = [
  ["user@example.com", true],
  ["invalid", false],
  ["@no-local.com", false],
  ["user@.com", false],
];

let passed = 0;
for (const [input, expected] of tests) {
  const result = isValidEmail(input);
  if (result === expected) {
    passed++;
  } else {
    console.error(`FAIL: isValidEmail("${input}") = ${result}, expected ${expected}`);
  }
}

if (passed === tests.length) {
  console.log(`PASS: All ${passed} tests passed`);
} else {
  console.error(`FAIL: ${passed}/${tests.length} passed`);
  process.exit(1);
}
