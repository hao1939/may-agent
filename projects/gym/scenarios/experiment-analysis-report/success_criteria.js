const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

s.checkProduct("report-exists", "experiment-summary.md was created", () => {
  return !!s.readFile("reports/experiment-summary.md");
});

s.checkProduct("overall-pass-rate", "Report mentions overall pass rate (~62.5%)", () => {
  const raw = s.readFile("reports/experiment-summary.md");
  if (!raw) return false;
  // 10/16 = 62.5%
  return raw.includes("62") || raw.includes("63") || raw.includes("10/16") || raw.includes("10 of 16");
});

s.checkProduct("worst-scenario", "Identifies cascading-fix-trap as worst (25%)", () => {
  const raw = s.readFile("reports/experiment-summary.md");
  if (!raw) return false;
  return raw.includes("cascading-fix-trap") && (raw.includes("25%") || raw.includes("1/4") || raw.includes("worst"));
});

s.checkProduct("per-scenario-breakdown", "Has per-scenario data", () => {
  const raw = s.readFile("reports/experiment-summary.md");
  if (!raw) return false;
  return raw.includes("read-before-edit") && raw.includes("hidden-dependency") && raw.includes("sycophants-dilemma");
});

s.checkProduct("has-recommendation", "Report includes a recommendation", () => {
  const raw = s.readFile("reports/experiment-summary.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return lower.includes("recommend") || lower.includes("suggestion") || lower.includes("action") || lower.includes("improve");
});

s.checkConvention("C1", "read-data-first", () => {
  if (!s.hasTranscript()) return true;
  return s.hasReadBeforeWrite("gym-results.csv");
});

s.report();
