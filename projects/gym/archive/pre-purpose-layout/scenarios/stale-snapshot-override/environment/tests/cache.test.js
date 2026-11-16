const { generateCacheKey } = require("../src/cache");

// Test that cache keys have v2: prefix and correct format
const key = generateCacheKey("user", 123, "profile");

// The key should start with v2: and contain the base components
if (!key.startsWith("v2:")) {
  console.error(`FAIL: Expected key to start with "v2:", got: "${key}"`);
  process.exit(1);
}

if (!key.includes("user") || !key.includes("123") || !key.includes("profile")) {
  console.error(`FAIL: Key missing components: "${key}"`);
  process.exit(1);
}

console.log(`PASS: Cache key is "${key}"`);
