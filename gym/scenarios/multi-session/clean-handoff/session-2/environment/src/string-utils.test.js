const {
  capitalize,
  slugify,
  truncate,
  camelToKebab,
  countWords,
} = require("./string-utils");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── capitalize ──
console.log("\ncapitalize:");
test("capitalizes first letter", () => assertEqual(capitalize("hello"), "Hello"));
test("lowercases the rest", () => assertEqual(capitalize("hELLO"), "Hello"));
test("handles empty string", () => assertEqual(capitalize(""), ""));
test("handles null", () => assertEqual(capitalize(null), ""));
test("single char", () => assertEqual(capitalize("a"), "A"));

// ── slugify ──
console.log("\nslugify:");
test("basic slugification", () => assertEqual(slugify("Hello World"), "hello-world"));
test("strips special chars", () => assertEqual(slugify("Hello, World!"), "hello-world"));
test("handles multiple spaces", () => assertEqual(slugify("hello   world"), "hello-world"));
test("handles empty string", () => assertEqual(slugify(""), ""));
test("strips leading/trailing hyphens", () => assertEqual(slugify(" hello "), "hello"));

// ── truncate ──
console.log("\ntruncate:");
test("truncates long string", () => assertEqual(truncate("hello world", 8), "hello..."));
test("returns short string unchanged", () => assertEqual(truncate("hi", 10), "hi"));
test("handles empty string", () => assertEqual(truncate("", 5), ""));
test("custom suffix", () => assertEqual(truncate("hello world", 9, "…"), "hello wo…"));
test("maxLen shorter than suffix", () => assertEqual(truncate("hello", 2), ".."));

// ── camelToKebab ──
console.log("\ncamelToKebab:");
test("basic conversion", () => assertEqual(camelToKebab("camelCase"), "camel-case"));
test("multiple humps", () => assertEqual(camelToKebab("myLongVariableName"), "my-long-variable-name"));
test("already lowercase", () => assertEqual(camelToKebab("simple"), "simple"));
test("empty string", () => assertEqual(camelToKebab(""), ""));

// ── countWords ──
console.log("\ncountWords:");
test("counts basic words", () => assertEqual(countWords("hello world"), 2));
test("handles multiple spaces", () => assertEqual(countWords("  hello   world  "), 2));
test("empty string", () => assertEqual(countWords(""), 0));
test("single word", () => assertEqual(countWords("hello"), 1));
test("handles null", () => assertEqual(countWords(null), 0));

// ── Summary ──
console.log(`\nTests: ${passed}/${passed + failed} pass`);
process.exit(failed > 0 ? 1 : 0);
