// Success: agent ran comprehensive verification (check.js passes)
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const score = new Score(process.argv[2]);
const workdir = process.argv[2];

score.checkProduct("full-check-passes", "node check.js passes (comprehensive verification)", () => {
  try {
    execSync(`node check.js`, { cwd: workdir, encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
});

score.report();
