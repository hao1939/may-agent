/**
 * Success Criteria for "obstacle-persistence-hard"
 *
 * Tests obstacle persistence on a data migration with non-obvious failures:
 *   1. CSV has a malformed row (Dave's data has comma inside quotes)
 *   2. validate.sh requires a "uid" field not mentioned in transform.json
 *      (agent must discover config/validation-rules.txt)
 *   3. The uid must be derived from email (first 8 chars of MD5 hash)
 *
 * Product:
 *   P1: output/users.json exists
 *   P2: All 5 users present with correct field mappings
 *   P3: Value transforms applied (admin->administrator)
 *   P4: uid field present on all records
 *   P5: Dave's malformed CSV row correctly parsed
 *
 * Behavior:
 *   B1: Migration report documents obstacles
 *
 * Efficiency:
 *   E1: Total operations ≤ 40
 */

const { Score } = require("@may-agent/gym/scoring");
const crypto = require("crypto");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("output-exists", "output/users.json exists", () => {
  return s.fileExists("output/users.json");
});

s.checkProduct("correct-record-count", "All 5 users present", () => {
  const raw = s.readFile("output/users.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length === 5;
  } catch { return false; }
});

s.checkProduct("field-mapping-applied", "Fields renamed per transform.json", () => {
  const raw = s.readFile("output/users.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data.length) return false;
    const first = data[0];
    return first.full_name !== undefined && 
           first.email_address !== undefined &&
           first.access_level !== undefined &&
           first.team !== undefined;
  } catch { return false; }
});

s.checkProduct("value-transforms-applied", "admin->administrator transform applied", () => {
  const raw = s.readFile("output/users.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    const alice = data.find(u => (u.full_name || "").includes("Alice"));
    return alice && alice.access_level === "administrator";
  } catch { return false; }
});

s.checkProduct("uid-field-present", "All records have uid field (from validation-rules.txt)", () => {
  const raw = s.readFile("output/users.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return data.every(u => u.uid !== undefined && String(u.uid).length > 0);
  } catch { return false; }
});

s.checkProduct("csv-malformed-row-handled", "Dave Wilson row correctly parsed despite CSV quoting issue", () => {
  const raw = s.readFile("output/users.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    const dave = data.find(u => (u.full_name || "").includes("Dave"));
    return dave && dave.email_address === "dave@company.com" && dave.team === "Sales";
  } catch { return false; }
});

// ── Behavior ───────────────────────────────────────────────────────────

s.checkBehavior("migration-report-documents-obstacles", "Migration report documents obstacles encountered", () => {
  const raw = s.readFile("output/migration-report.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  let mentions = 0;
  if (lower.includes("csv") || lower.includes("malform") || lower.includes("dave") || lower.includes("quote")) mentions++;
  if (lower.includes("uid") || lower.includes("validation-rules") || lower.includes("primary_key")) mentions++;
  if (lower.includes("validat") || lower.includes("fail") || lower.includes("error")) mentions++;
  return mentions >= 2;
});

// ── Efficiency ─────────────────────────────────────────────────────────

// No efficiency check — focus on whether they can solve the obstacles

s.report();
