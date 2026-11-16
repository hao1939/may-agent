const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

s.checkProduct("workflow-created", "daily-review.json exists and is valid JSON", () => {
  const raw = s.readFile("workflows/definitions/daily-review.json");
  if (!raw) return false;
  try { const d = JSON.parse(raw); return d.name === "daily-review"; } catch { return false; }
});

s.checkProduct("correct-steps", "Steps are gather-metrics, analyze-trends, write-summary", () => {
  const raw = s.readFile("workflows/definitions/daily-review.json");
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    const names = d.steps.map(s => s.name);
    return names.includes("gather-metrics") && names.includes("analyze-trends") && names.includes("write-summary");
  } catch { return false; }
});

s.checkProduct("schedule-correct", "Schedule is 0 8 * * *", () => {
  const raw = s.readFile("workflows/definitions/daily-review.json");
  if (!raw) return false;
  try { return JSON.parse(raw).schedule === "0 8 * * *"; } catch { return false; }
});

s.checkProduct("schema-preserved", "version and schema from template", () => {
  const raw = s.readFile("workflows/definitions/daily-review.json");
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    return d.version === "1.0" && d.schema === "workflow-v2";
  } catch { return false; }
});

s.checkProduct("template-unchanged", "Template file not modified", () => {
  const raw = s.readFile("workflows/definitions/template.json");
  if (!raw) return false;
  try { return JSON.parse(raw).name === "TEMPLATE"; } catch { return false; }
});

s.checkConvention("C1", "read-template-first", () => {
  if (!s.hasTranscript()) return true;
  return s.hasReadBeforeWrite("template.json");
});

s.report();
