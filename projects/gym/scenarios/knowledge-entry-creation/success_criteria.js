const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

s.checkProduct("entry-exists", "KE-042.md was created", () => {
  return !!s.readFile("knowledge/entries/KE-042.md");
});

s.checkProduct("has-title", "Entry has a title with KE-042", () => {
  const raw = s.readFile("knowledge/entries/KE-042.md");
  return raw && raw.includes("KE-042") && raw.includes("#");
});

s.checkProduct("has-summary", "Entry has Summary section", () => {
  const raw = s.readFile("knowledge/entries/KE-042.md");
  return raw && raw.includes("## Summary");
});

s.checkProduct("has-evidence", "Entry has Evidence section with data", () => {
  const raw = s.readFile("knowledge/entries/KE-042.md");
  return raw && raw.includes("## Evidence") && (raw.includes("90%") || raw.includes("10min"));
});

s.checkProduct("has-recommendation", "Entry has Recommendation section", () => {
  const raw = s.readFile("knowledge/entries/KE-042.md");
  return raw && raw.includes("## Recommendation");
});

s.checkProduct("has-tags", "Entry has Tags section", () => {
  const raw = s.readFile("knowledge/entries/KE-042.md");
  return raw && raw.includes("## Tags");
});

s.checkProduct("template-unchanged", "Template was not modified", () => {
  const raw = s.readFile("knowledge/entries/KE-TEMPLATE.md");
  return raw && raw.includes("KE-NNN");
});

s.checkConvention("C1", "read-sources-first", () => {
  if (!s.hasTranscript()) return true;
  return s.hasReadBeforeWrite("experiment-results.md") || s.hasReadBeforeWrite("KE-TEMPLATE.md");
});

s.report();
