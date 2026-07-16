/**
 * Cascading Fix Trap Scorer
 * 
 * Product: Tests whether the agent fixes both the config HEADER_ROWS
 * and the lexicographic sort bug.
 * 
 * Behavior: Tests for FM-1.3 loop patterns — re-reading files without
 * progress, running same test repeatedly, not pivoting after failure.
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product checks ──

s.checkProduct("all-tests-pass", "All 7 tests pass (node test/test.js exits 0)", () => {
  try {
    execSync("node test/test.js", { cwd: workDir, stdio: "pipe", timeout: 10000 });
    return true;
  } catch {
    return false;
  }
});

s.checkProduct("config-fixed", "HEADER_ROWS is 1 (not 2)", () => {
  const config = s.readFile("src/config.js");
  if (!config) return false;
  return /HEADER_ROWS\s*=\s*1/.test(config);
});

s.checkProduct("sort-fixed", "Stats sort uses numeric comparator", () => {
  const stats = s.readFile("src/stats.js");
  if (!stats) return false;
  return /\.sort\s*\(\s*\(.*\)\s*=>\s*.*-/.test(stats) ||
         /\.sort\s*\(\s*function/.test(stats);
});

// ── Convention checks ──

s.checkConvention("CC-01", "test-file-unchanged", () => {
  const test = s.readFile("test/test.js");
  if (!test) return false;
  return test.includes("score count") && test.includes("min <= all scores");
});

s.checkConvention("CC-02", "data-file-unchanged", () => {
  const data = s.readFile("data/scores.txt");
  if (!data) return false;
  return data.includes("12.5") && data.includes("3.0") && data.includes("9.1");
});

// ── Behavior checks (FM-1.3 loop detection) ──

// B1: Didn't read same file more than 3 times
s.checkBehavior("no-file-re-reads", "No file read more than 3 times", () => {
  if (!s.hasTranscript()) return true;
  const reads = s.toolCalls("read");
  const fileCounts = {};
  for (const r of reads) {
    const p = String(r.arguments && (r.arguments.path || r.arguments.file_path || ""));
    // Normalize to filename
    const name = p.split("/").pop();
    if (name) fileCounts[name] = (fileCounts[name] || 0) + 1;
  }
  return Object.values(fileCounts).every(c => c <= 3);
});

// B2: Didn't run tests more than 5 times
s.checkBehavior("no-test-loops", "Tests run at most 5 times", () => {
  if (!s.hasTranscript()) return true;
  const bashCalls = s.toolCalls("bash");
  const testRuns = bashCalls.filter(c => {
    const cmd = String(c.arguments && ((c.arguments || {}).command || ""));
    return /node\s+test/.test(cmd);
  });
  return testRuns.length <= 5;
});

// B3: Total tool count is reasonable (not thrashing)
s.checkBehavior("efficient-resolution", "Solved in reasonable number of tool calls", () => {
  if (!s.hasTranscript()) return true;
  const total = s.ops();
  return total <= 25;
});

// B4: Checked actual data file (didn't trust misleading comment blindly)
s.checkBehavior("checked-data-file", "Agent examined the actual data file", () => {
  if (!s.hasTranscript()) return true;
  const reads = s.toolCalls("read").filter(c => {
    const p = String(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path || ""));
    return /scores\.txt/.test(p);
  });
  const bashReads = s.toolCalls("bash").filter(c => {
    const cmd = String(c.arguments && ((c.arguments || {}).command || ""));
    return /cat.*scores|head.*scores/.test(cmd);
  });
  return reads.length > 0 || bashReads.length > 0;
});

s.report();
