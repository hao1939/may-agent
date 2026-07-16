/**
 * Success Criteria for "materialize-intermediate-findings"
 *
 * Tests the materialize-intermediate-findings skill: agents should persist
 * intermediate analysis results to workspace files as they investigate,
 * rather than keeping all findings only in tool output.
 *
 * The scenario requires analyzing 5 service logs + 3 data files to produce
 * a root-cause report. An ideal agent should:
 *   1. Read logs and data files (8+ read/bash analysis calls)
 *   2. Write intermediate findings to workspace files every 3-4 analysis calls
 *   3. Produce a final root-cause report referencing those findings
 *
 * Product:
 *   P1: root-cause-report.md exists with correct root cause (Redis maintenance)
 *   P2: Report mentions affected services (auth, payment, user, notification)
 *
 * Behavior (materialize-intermediate-findings):
 *   B1: First write happens before 50% of total tool calls
 *   B2: At least 2 workspace writes occur before the final report
 *   B3: Workspace files contain intermediate data (error counts, timelines, etc.)
 *   B4: Maximum gap between write operations is ≤6 analysis calls
 *
 * Efficiency:
 *   E1: Total operations ≤ 25
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Helpers ───────────────────────────────────────────────────────────

/** Check if a tool call is an "analysis" operation (read, grep, cat, etc.) */
function isAnalysisOp(entry) {
  const tool = entry.tool || entry.name || "";
  if (tool === "read") return true;
  if (tool === "bash") {
    const cmd = String((entry.arguments || {}).command || "");
    // Analysis: grep, cat, head, tail, wc, awk, sed (read mode), find, ls, stat, jq
    if (/\b(grep|rg|cat|head|tail|wc|awk|less|find|ls|stat|jq|sort|uniq|cut)\b/.test(cmd)) return true;
    // Reading data files
    if (/\.(log|csv|json|md)\b/.test(cmd) && !/>>|>(?!>)/.test(cmd)) return true;
  }
  return false;
}

/** Check if a tool call is a "write" operation to workspace */
function isWorkspaceWrite(entry) {
  const tool = entry.tool || entry.name || "";
  if (tool === "write" || tool === "edit") {
    const p = String((entry.arguments || {}).path || "");
    return p.includes("workspace");
  }
  if (tool === "bash") {
    const cmd = String((entry.arguments || {}).command || "");
    // Bash write: echo/cat >> workspace/..., or tee to workspace
    return (cmd.includes("workspace/") || cmd.includes("workspace\\")) &&
           (/>>|>(?!>)|tee\b/.test(cmd) || /\bcat\b.*<</.test(cmd));
  }
  return false;
}

// ── Product Checks ────────────────────────────────────────────────────

s.checkProduct("report-exists", "workspace/root-cause-report.md exists with root cause analysis", () => {
  const raw = s.readFile("workspace/root-cause-report.md");
  if (!raw) return false;
  // Must mention Redis as root cause
  const mentionsRedis = /redis/i.test(raw);
  // Must be substantive (not just a placeholder)
  return mentionsRedis && raw.length > 200;
});

s.checkProduct("report-identifies-affected-services", "Report mentions at least 3 affected services", () => {
  const raw = s.readFile("workspace/root-cause-report.md");
  if (!raw) return false;
  const services = ["auth", "payment", "user", "notification"];
  const mentioned = services.filter(svc => raw.toLowerCase().includes(svc));
  return mentioned.length >= 3;
});

s.checkProduct("report-identifies-trigger", "Report identifies Redis maintenance (cfg-201) as the trigger", () => {
  const raw = s.readFile("workspace/root-cause-report.md");
  if (!raw) return false;
  // Should mention maintenance, config change, or the simultaneous restart
  const mentionsMaintenance = /maintenance|cfg-201|simultaneous.*restart|orchestration.*bug|rolling.*restart/i.test(raw);
  return mentionsMaintenance;
});

// ── Behavioral Checks (Materialize Intermediate Findings) ─────────────

// B1: First write happens before 50% of total tool calls
s.checkBehavior("early-materialization", "First workspace write occurs before 50% of total tool calls", () => {
  if (!s.hasTranscript()) return true;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  const toolCalls = t.filter(e => e.tool || e.name);
  if (toolCalls.length < 6) return true; // Too few ops to judge

  const totalOps = toolCalls.length;
  const halfwayIdx = Math.floor(totalOps / 2);

  // Find first workspace write among tool calls
  for (let i = 0; i < toolCalls.length; i++) {
    if (isWorkspaceWrite(toolCalls[i])) {
      return i < halfwayIdx;
    }
  }
  return false; // No workspace write found at all
});

// B2: At least 2 workspace writes occur before the final report
s.checkBehavior("multiple-materializations", "At least 2 workspace writes before/including final report", () => {
  if (!s.hasTranscript()) return true;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  const toolCalls = t.filter(e => e.tool || e.name);
  let writeCount = 0;

  for (const entry of toolCalls) {
    if (isWorkspaceWrite(entry)) {
      writeCount++;
    }
  }
  return writeCount >= 2;
});

// B3: Workspace files contain intermediate data (not just the final report)
s.checkBehavior("intermediate-data-persisted", "Workspace contains intermediate findings (not just final report)", () => {
  // Check if any workspace file other than root-cause-report.md exists
  // OR if root-cause-report.md was written to multiple times (incremental)
  const wsDir = path.join(workDir, "workspace");
  if (!fs.existsSync(wsDir)) return false;

  const files = fs.readdirSync(wsDir);
  // Check for any findings/notes/analysis files
  const intermediateFiles = files.filter(f =>
    f !== "root-cause-report.md" &&
    !f.startsWith(".") &&
    (f.endsWith(".md") || f.endsWith(".txt") || f.endsWith(".log") || f.endsWith(".json"))
  );

  if (intermediateFiles.length > 0) return true;

  // Also pass if the report itself contains structured intermediate data
  // (error counts, timelines, service-by-service analysis)
  const report = s.readFile("workspace/root-cause-report.md");
  if (!report) return false;
  // Check for structured data indicators
  const hasStructuredData = /\|.*\|.*\|/.test(report) || // markdown table
    /\d+%/.test(report) || // percentages
    /T\d{2}:\d{2}/.test(report) || // timestamps
    /error.*count|count.*error|\d+\s*(errors|failures)/i.test(report); // error counts
  return hasStructuredData;
});

// B4: Maximum gap between write operations is ≤6 tool calls
s.checkBehavior("regular-materialization-cadence", "Max gap between workspace writes ≤ 6 tool calls", () => {
  if (!s.hasTranscript()) return true;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  const toolCalls = t.filter(e => e.tool || e.name);
  if (toolCalls.length < 8) return true; // Too few ops to judge cadence

  // Find indices of all workspace writes
  const writeIndices = [];
  for (let i = 0; i < toolCalls.length; i++) {
    if (isWorkspaceWrite(toolCalls[i])) {
      writeIndices.push(i);
    }
  }

  if (writeIndices.length < 2) return false; // Need at least 2 writes to check cadence

  // Check gap from start to first write
  if (writeIndices[0] > 6) return false;

  // Check gaps between consecutive writes
  for (let i = 1; i < writeIndices.length; i++) {
    if (writeIndices[i] - writeIndices[i - 1] > 6) return false;
  }

  return true;
});

// ── Efficiency Check ──────────────────────────────────────────────────

s.checkEfficiency("low-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

// ── Convention: finish with deliverables ──────────────────────────────

s.checkBehavior("finish-references-deliverables", "finish() call references workspace deliverables", () => {
  const fc = s.finishCall();
  if (!fc) return false;
  // finishCall() already returns parsed args: {status, summary, deliverables, blockers}
  const deliverables = fc.deliverables || [];
  if (!Array.isArray(deliverables)) return false;
  // Check that at least one deliverable references a workspace file
  return deliverables.some(d => {
    const p = String(d.path || "");
    return p.includes("workspace");
  });
});

s.report();
