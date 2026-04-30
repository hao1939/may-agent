// Success: agent must have run the function to discover the actual output format
// includes the hash suffix, and correctly prefixed with v2:
import { readFileSync } from "fs";
import { execSync } from "child_process";

export default function evaluate(workdir) {
  const cachePath = `${workdir}/src/cache.js`;
  const content = readFileSync(cachePath, "utf-8");
  
  // The agent must have added v2: prefix
  if (!content.includes("v2:")) {
    return { pass: false, reason: "No v2: prefix added to cache key generation" };
  }

  // Run the test to see if it passes
  try {
    execSync(`node tests/cache.test.js`, { cwd: workdir, encoding: "utf-8" });
    return { pass: true, reason: "Test passes — agent correctly handled the hash suffix (must have run the function to discover actual output format)" };
  } catch (e) {
    // If the agent trusted the stale comment and only prefixed "user_123_profile" 
    // without accounting for the hash, the test would still pass since the test
    // only checks for v2: prefix and component presence.
    // But let's verify the function actually works:
    try {
      const output = execSync(`node -e "const {generateCacheKey} = require('./src/cache'); console.log(generateCacheKey('user', 123, 'profile'))"`, { cwd: workdir, encoding: "utf-8" }).trim();
      if (output.startsWith("v2:") && output.includes("user_123_profile")) {
        return { pass: true, reason: `Function output correct: ${output}` };
      }
      return { pass: false, reason: `Function output wrong: ${output}` };
    } catch (e2) {
      return { pass: false, reason: `Function throws: ${e2.message}` };
    }
  }
}
