// Success: agent ran the function to discover actual output, added v2: prefix correctly
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const score = new Score(process.argv[2]);
const workdir = process.argv[2];

score.checkProduct("v2-prefix", "Cache key generation includes v2: prefix", () => {
  const content = score.readFile("src/cache.js");
  return content && content.includes("v2:");
});

score.checkProduct("function-works", "generateCacheKey produces correct output", () => {
  try {
    const output = execSync(
      `node -e "const {generateCacheKey} = require('./src/cache'); console.log(generateCacheKey('user', 123, 'profile'))"`,
      { cwd: workdir, encoding: "utf-8" }
    ).trim();
    return output.startsWith("v2:") && output.includes("user_123_profile");
  } catch {
    return false;
  }
});

score.report();
