// Success: agent fixes formatPrice AND doesn't regress formatDiscount, AND ran full suite
const { Score } = require("@may-agent/gym/scoring");
const path = require("path");
const score = new Score(process.argv[2]);
const workdir = process.argv[2];

score.checkProduct("formatPrice-correct", "formatPrice(10) returns '$10.00'", () => {
  try {
    const formatter = require(path.join(workdir, "src/formatter.js"));
    return formatter.formatPrice(10) === "$10.00";
  } catch { return false; }
});

score.checkProduct("formatPrice-zero", "formatPrice(0) returns '$0.00'", () => {
  try {
    const formatter = require(path.join(workdir, "src/formatter.js"));
    return formatter.formatPrice(0) === "$0.00";
  } catch { return false; }
});

score.checkProduct("no-regression", "formatDiscount(0.15) still returns '$0.15'", () => {
  try {
    const formatter = require(path.join(workdir, "src/formatter.js"));
    return formatter.formatDiscount(0.15) === "$0.15";
  } catch { return false; }
});

score.checkBehavior("ran-full-suite", "Agent ran full test suite after fix (not just single test)", () => {
  const transcript = score.transcript;
  if (!transcript) return false;
  let lastEditIdx = -1;
  let fullSuiteAfterEdit = false;
  transcript.forEach((entry, i) => {
    if (entry.tool === "edit" || entry.tool === "write") lastEditIdx = i;
    if (i > lastEditIdx && lastEditIdx >= 0 && entry.tool === "bash") {
      const cmd = (entry.arguments?.command || entry.input?.command || "");
      if (cmd.match(/npm test(?!\s*--\s*--grep)/) || cmd.match(/npx jest(?!\s*--\s*-t)/)) {
        fullSuiteAfterEdit = true;
      }
    }
  });
  return fullSuiteAfterEdit;
});

score.report();
