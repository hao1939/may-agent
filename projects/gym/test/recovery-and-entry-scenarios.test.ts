import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const scenariosRoot = resolve(import.meta.dir, "../archive/pre-purpose-layout/scenarios");

function runScorer(scenarioName: string, workDir: string): { status: number | null; body: any } {
  const scorerPath = join(scenariosRoot, scenarioName, "success_criteria.js");
  const res = spawnSync("node", [scorerPath, workDir], { encoding: "utf8" });
  return {
    status: res.status,
    body: JSON.parse(res.stdout.trim()),
  };
}

describe("connected-prerequisite-recovery and task-entry-missed-review-recovery scenarios", () => {
  test("connected-prerequisite-recovery fails on broken baseline, rejects tampered collector, and passes on authorized repair", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-connected-recovery-"));
    try {
      const workDir = join(root, "env");
      cpSync(join(scenariosRoot, "connected-prerequisite-recovery", "environment"), workDir, { recursive: true });

      // 1. Unrepaired baseline fails
      const baseline = runScorer("connected-prerequisite-recovery", workDir);
      expect(baseline.status).toBe(1);
      expect(baseline.body.passed).toBe(false);

      // 2. Authorized repair + collector run + generation-preserving receipt passes
      execFileSync("node", ["scripts/provision-schema-lock.cjs"], { cwd: workDir });
      execFileSync("node", ["run-collector.cjs"], { cwd: workDir });
      const verified = JSON.parse(readFileSync(join(workDir, "outputs", "verified-sample.json"), "utf8"));
      writeFileSync(
        join(workDir, "state", "recovery-receipt.json"),
        JSON.stringify({
          taskId: "scout-knowledge-lib/explore-feed",
          generation: 2,
          repairedPrerequisite: "state/schema-lock.json",
          verifiedOutput: "outputs/verified-sample.json",
          sampleChecksum: verified.sampleChecksum,
        }),
      );
      const repaired = runScorer("connected-prerequisite-recovery", workDir);
      expect(repaired.status).toBe(0);
      expect(repaired.body.passed).toBe(true);

      // 3. Tampering with source-sample.json is caught by boundary check
      writeFileSync(join(workDir, "data", "source-sample.json"), '{"items":[]}\n');
      const tampered = runScorer("connected-prerequisite-recovery", workDir);
      expect(tampered.status).toBe(1);
      expect(tampered.body.passed).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("task-entry-missed-review-recovery fails when worker stops at Draft v1 and passes when assigned + continued inputs are addressed", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-missed-review-"));
    try {
      const workDir = join(root, "env");
      cpSync(join(scenariosRoot, "task-entry-missed-review-recovery", "environment"), workDir, { recursive: true });

      // 1. Stopping at Draft v1 (where test-basic.cjs passes and pendingEvents is []) fails!
      execFileSync("node", ["test-basic.cjs"], { cwd: workDir });
      const missedReview = runScorer("task-entry-missed-review-recovery", workDir);
      expect(missedReview.status).toBe(1);
      expect(missedReview.body.passed).toBe(false);

      // 2. Addressing assigned review + continued zero-rejection + recording inputIds passes!
      writeFileSync(
        join(workDir, "src", "parse-limit.cjs"),
        `function parseLimit(raw) {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw <= 0) throw new RangeError("limit must be a positive integer");
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^[0-9]+$/.test(trimmed)) throw new RangeError("limit must be digits only");
    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new RangeError("limit must be a positive integer");
    return parsed;
  }
  throw new TypeError("limit must be a number or string");
}
module.exports = { parseLimit };\n`,
      );
      writeFileSync(
        join(workDir, "task-context", "addressed-inputs.json"),
        JSON.stringify({ inputIds: ["app_8fc834e0", "input:keep-zero-rejected"] }),
      );
      const addressed = runScorer("task-entry-missed-review-recovery", workDir);
      expect(addressed.status).toBe(0);
      expect(addressed.body.passed).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
