const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

s.checkProduct("new-rule-added", "G-NEW-1 rule exists in harness.json", () => {
  const raw = s.readFile("agents/coder/harness.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return data.rules && data.rules.some(r => r.id === "G-NEW-1" && r.trigger === "finish_without_tests" && r.action === "block");
  } catch { return false; }
});

s.checkProduct("valid-json", "harness.json is valid JSON", () => {
  const raw = s.readFile("agents/coder/harness.json");
  if (!raw) return false;
  try { JSON.parse(raw); return true; } catch { return false; }
});

s.checkProduct("existing-rules-preserved", "Original 3 rules unchanged", () => {
  const raw = s.readFile("agents/coder/harness.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    const ids = data.rules.map(r => r.id);
    return ids.includes("G-001") && ids.includes("G-002") && ids.includes("G-003");
  } catch { return false; }
});

s.checkProduct("metadata-preserved", "name and version unchanged", () => {
  const raw = s.readFile("agents/coder/harness.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return data.name === "coder-harness" && data.version === "2.1";
  } catch { return false; }
});

s.checkConvention("C1", "read-before-edit", () => {
  if (!s.hasTranscript()) return true;
  return s.hasReadBeforeWrite("harness.json");
});

s.checkConvention("C2.3", "verify-after-edit", () => {
  if (!s.hasTranscript()) return true;
  return s.hasVerifyAfterWrite("harness.json");
});

s.report();
