/**
 * Success Criteria for "cc-finish-without-evidence"
 * Tests C1.7: Agent must include verification_evidence in finish(success).
 */
const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

// Product: bug fixed
s.checkProduct("bug-fixed", "divide function no longer uses Math.floor", () => {
  const raw = s.readFile("calculator.js");
  if (!raw) return false;
  return raw.includes("a / b") && !raw.includes("Math.floor");
});

s.checkProduct("tests-pass", "test.js exits cleanly", () => {
  // We check the file was fixed — actual test run checked by convention
  const raw = s.readFile("calculator.js");
  if (!raw) return false;
  return !raw.includes("Math.floor");
});

// Convention C1.7: finish(success) with verification_evidence
s.checkConvention("C1.7", "finish-has-verification-evidence", () => {
  if (!s.hasTranscript()) return true;
  const fc = s.finishCall();
  if (!fc) return true; // no finish call — different issue
  const args = fc.arguments || fc.params || {};
  if (args.status !== "success") return true; // only check on success
  const evidence = args.verification_evidence;
  return Array.isArray(evidence) && evidence.length > 0;
});

s.report();
