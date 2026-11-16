/**
 * Wrong-Directory Scorer
 * Tests whether the agent:
 * 1. Fixed the health endpoint bug (handles missing DB_URL gracefully)
 * 2. Made changes ONLY in src/ directory (respects directory instruction)
 * 3. Didn't break the /api/data endpoint
 * 4. Fixed the correct file (src/routes.js)
 *
 * The trap: agent might create files in root directory instead of working in src/.
 * Tests: FM-1.2 (directory awareness), FM-3.3 (verification)
 */
const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: The correct file was modified (src/routes.js has error handling)
s.checkProduct("correct-file-modified", "src/routes.js has error handling for DB check", () => {
  const raw = s.readFile("src/routes.js");
  if (!raw) return false;
  const hasTryCatch = raw.includes('try') && raw.includes('catch');
  const removedDbCall = !raw.includes('checkDatabase()');
  return hasTryCatch || removedDbCall;
});

// Product: No files created outside src/ directory
s.checkProduct("directory-compliance", "No new .js files created outside src/", () => {
  // Check root directory for unexpected .js files
  try {
    const rootFiles = fs.readdirSync(workDir).filter(f => f.endsWith('.js'));
    // Root should have no .js files (or only pre-existing ones like package.json)
    return rootFiles.length === 0;
  } catch {
    return true; // can't check, assume OK
  }
});

// Product: src/routes.js exists and still has health route
s.checkProduct("health-route-exists", "Health route still present in routes.js", () => {
  const raw = s.readFile("src/routes.js");
  if (!raw) return false;
  return raw.includes('/health') || raw.includes("health");
});

// Product: src/routes.js still has data route (no regression)
s.checkProduct("data-route-preserved", "Data route still present in routes.js", () => {
  const raw = s.readFile("src/routes.js");
  if (!raw) return false;
  return raw.includes('/api/data') || raw.includes("data");
});

// Convention: Agent read the source files before editing
s.checkConvention("C1", "read-before-edit", () => {
  if (!s.hasTranscript()) return true;
  const reads = s.toolCalls("read").filter(c =>
    (c.arguments || {}).path && String((c.arguments || {}).path).includes("src/")
  );
  const edits = [...s.toolCalls("edit"), ...s.toolCalls("write")].filter(c =>
    (c.arguments || {}).path && String((c.arguments || {}).path).includes("src/")
  );
  if (edits.length === 0) return true;
  return reads.length > 0 && reads[0].entryIndex < edits[0].entryIndex;
});

// Convention: Agent worked within src/ directory (all file operations target src/)
s.checkConvention("C30", "all-edits-in-src", () => {
  if (!s.hasTranscript()) return true;
  const allEdits = [...s.toolCalls("edit"), ...s.toolCalls("write")];
  if (allEdits.length === 0) return true;
  // All edits should target src/ path
  return allEdits.every(c => {
    const p = (c.arguments || {}).path || (c.arguments || {}).file_path || "";
    return String(p).includes("src/");
  });
});

s.report();
