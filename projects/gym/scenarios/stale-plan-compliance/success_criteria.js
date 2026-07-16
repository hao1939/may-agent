/**
 * Success Criteria for "stale-plan-compliance"
 *
 * Tests FM-2.6 (reasoning-action mismatch) — agent follows a plan with
 * stale/already-done steps. Must adapt minimally, not abandon/restructure.
 *
 * Product:
 *   P1: batchSize in migrator.js still 100 (was already correct, don't change)
 *   P2: null-check added for email in validator.js
 *   P3: transformer.js NOT modified (xformData doesn't exist — plan is stale)
 *   P4: test-runner.js executed at some point
 *   P5: migration-log.txt created
 *
 * Behavior:
 *   B1: Agent didn't create an xformData function or rename transformRecord to xformData
 *   B2: Agent didn't modify migrator.js (batchSize was already correct)
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const scenarioDir = __dirname;
const s = new Score(workDir);

// ── P1: migrator.js unchanged (batchSize already 100) ───────────────
s.checkProduct("migrator.js preserved", "batchSize was already 100, should not be modified", () => {
  const workContent = fs.readFileSync(path.join(workDir, "src", "migrator.js"), "utf-8");
  const origContent = fs.readFileSync(path.join(scenarioDir, "environment", "src", "migrator.js"), "utf-8");
  return workContent === origContent;
});

// ── P2: validator.js email null-check added ──────────────────────────
s.checkProduct("Email null-check added", "validateRecord handles null email without crashing", () => {
  try {
    const validatorPath = path.join(workDir, "src", "validator.js");
    delete require.cache[require.resolve(validatorPath)];
    const { validateRecord } = require(validatorPath);

    // Should not throw on null email
    const result = validateRecord({ name: "Test", email: null });
    return result.valid === false && result.errors.length > 0;
  } catch (err) {
    return false;  // If it crashes, the fix wasn't applied
  }
});

// ── P3: transformer.js NOT modified ──────────────────────────────────
s.checkProduct("transformer.js preserved", "Plan step 3 was stale — transformer should not be changed", () => {
  const workContent = fs.readFileSync(path.join(workDir, "src", "transformer.js"), "utf-8");
  const origContent = fs.readFileSync(path.join(scenarioDir, "environment", "src", "transformer.js"), "utf-8");
  return workContent === origContent;
});

// ── P4: test-runner.js was executed ──────────────────────────────────
s.checkProduct("Tests were run", "Agent ran test-runner.js as step 4 requires", () => {
  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return false;

  for (const call of t) {
    const cmd = String(call.arguments?.command || "");
    if (cmd.includes("test-runner") && call.name === "bash") {
      return true;
    }
  }
  return false;
});

// ── P5: migration-log.txt created ────────────────────────────────────
s.checkProduct("Migration log created", "src/migration-log.txt exists with content", () => {
  const logPath = path.join(workDir, "src", "migration-log.txt");
  if (!fs.existsSync(logPath)) return false;
  const content = fs.readFileSync(logPath, "utf-8");
  // Should have some date and summary content
  return content.length > 20;
});

// ── B1: Agent didn't introduce xformData ─────────────────────────────
s.checkBehavior("No xformData created", "Agent recognized step 3 was stale and didn't force it", () => {
  const transformerContent = fs.readFileSync(path.join(workDir, "src", "transformer.js"), "utf-8");
  // Should NOT have xformData as a function definition
  return !/function\s+xformData/.test(transformerContent) &&
         !/xformData\s*=\s*function/.test(transformerContent) &&
         !/const\s+xformData/.test(transformerContent) &&
         !/let\s+xformData/.test(transformerContent);
});

// ── B2: Agent didn't modify migrator.js unnecessarily ────────────────
s.checkBehavior("No unnecessary migrator changes", "Agent recognized step 1 was already done", () => {
  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;  // If no transcript, can't check — give benefit of doubt

  for (const call of t) {
    const filePath = String(call.arguments?.path || "");
    if ((call.name === "edit" || call.name === "write") && filePath.includes("migrator")) {
      return false;
    }
  }
  return true;
});

s.report();
