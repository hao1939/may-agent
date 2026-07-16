/**
 * Success Criteria for "worker-task-completion" (EXP-595)
 *
 * Tests whether agent completes a worker-style task with proper
 * deliverables and finish() call. No heartbeat framing.
 *
 * Product:
 *   P1: Validation logic added to createUser
 *   P2: Test file created
 *
 * Behavior:
 *   B1: Read source file before editing (read-before-edit)
 *   B2: Called finish() with deliverables
 *   B3: Made at least 1 edit/write to user-service.js
 *
 * Efficiency:
 *   E1: Total operations ≤ 25
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("validation-added", "createUser has input validation", () => {
  // Check if the source file now contains validation logic
  const srcPath = path.join(workDir, "src", "user-service.js");
  if (!fs.existsSync(srcPath)) return false;
  const content = fs.readFileSync(srcPath, "utf-8");
  // Must reference ValidationError in createUser and check name/email/age
  return (
    content.includes("ValidationError") &&
    (content.includes("throw") || content.includes("Throw")) &&
    (content.includes("name") && content.includes("email") && content.includes("age"))
  );
});

s.checkProduct("test-written", "Test file created for validation", () => {
  // Check for test file in various possible locations
  const candidates = [
    path.join(workDir, "src", "user-service.test.js"),
    path.join(workDir, "user-service.test.js"),
    path.join(workDir, "src", "user-service.spec.js"),
    path.join(workDir, "test", "user-service.test.js"),
  ];
  return candidates.some((p) => fs.existsSync(p));
});

// ── Behavior ───────────────────────────────────────────────────────────

s.checkBehavior("read-before-edit", "Agent read user-service.js before editing", () => {
  const t = s.transcript;
  if (!t) return false;
  const allCalls = t.toolCalls;
  let firstReadIdx = -1;
  let firstEditIdx = -1;

  for (let i = 0; i < allCalls.length; i++) {
    const tc = allCalls[i];
    const name = tc.tool || tc.name || "";
    const args = tc.arguments || {};
    const target = String(args.path || args.command || "");

    if (firstReadIdx === -1 && (name === "read" || name === "bash") && /user-service\.js/i.test(target)) {
      firstReadIdx = i;
    }
    if (firstEditIdx === -1 && (name === "edit" || name === "write") && /user-service\.js/i.test(target)) {
      firstEditIdx = i;
    }
  }

  return firstReadIdx !== -1 && firstEditIdx !== -1 && firstReadIdx < firstEditIdx;
});

s.checkBehavior("finish-with-deliverables", "finish() called with deliverables", () => {
  const finishCalls = s.toolCalls("finish");
  if (finishCalls.length === 0) return false;
  const args = finishCalls[0].arguments || {};
  const deliverables = args.deliverables || [];
  return deliverables.length > 0;
});

s.checkBehavior("made-source-edit", "Agent edited user-service.js", () => {
  const t = s.transcript;
  if (!t) return false;
  return t.toolCalls.some((tc) => {
    const name = tc.tool || tc.name || "";
    if (name !== "edit" && name !== "write") return false;
    const p = String((tc.arguments || {}).path || "");
    return /user-service\.js/i.test(p);
  });
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
