import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runLoop, verifyLoop } from "../src/loop/run";
import {
  configureGymRoot,
  gymRoot,
  loadLabels,
} from "../src/loop/store";
import type { BenchmarkSuite, GroundTruthLabel } from "../src/loop/types";
import { withTempDir, withTempDirAsync } from "./support/temp-dir";

const approval: GroundTruthLabel = {
  status: "approved",
  source: "synthetic",
  rationale: "Synthetic approval fixture, not approval of real benchmark truth",
  approved_by: "fixture-reviewer",
  approved_at: "2026-01-01T00:00:00Z",
};

describe("benchmark label approval", () => {
  test("missing inline and ad hoc labels remain drafts without invented approvals", () => {
    withTempDir((root) => {
      const suites: BenchmarkSuite[] = [
        {
          name: "inline", version: 1, scenarios: ["case-a"],
          cases: [{ id: "case-a", task: "Diagnostic case" }],
        },
        { name: "adhoc", version: 1, scenarios: ["case-a"] },
      ];
      for (const suite of suites) {
        const label = loadLabels(suite.name, suite, root).catalog?.labels["case-a"];
        expect(label?.status).toBe("draft");
        expect(label?.approved_by).toBeNull();
        expect(label?.approved_at).toBeNull();
      }
    });
  });

  test("preserves explicit inline approval and catalog precedence", () => {
    withTempDir((root) => {
      const suite: BenchmarkSuite = {
        name: "inline", version: 1, scenarios: ["case-a"],
        cases: [{ id: "case-a", task: "Diagnostic case", label: approval }],
      };
      expect(loadLabels("inline", suite, root).catalog?.labels["case-a"]).toEqual(approval);
      const dir = join(root, "benchmarks", "inline");
      mkdirSync(dir, { recursive: true });
      const draft: GroundTruthLabel = { ...approval, status: "draft", approved_by: null, approved_at: null };
      writeFileSync(join(dir, "labels.json"), JSON.stringify({
        version: 1, benchmark: "inline", labels: { "case-a": draft },
      }));
      expect(loadLabels("inline", suite, root).catalog?.labels["case-a"]).toEqual(draft);
    });
  });

  test("rejects claimed approval without a reviewer and valid timestamp", () => {
    withTempDir((root) => {
      const invalid = [
        { status: "approved" as const },
        { ...approval, approved_by: " " },
        { ...approval, approved_at: "not-a-date" },
      ];
      for (const label of invalid) {
        const suite: BenchmarkSuite = {
          name: "inline", version: 1, scenarios: ["case-a"],
          cases: [{ id: "case-a", task: "Diagnostic case", label }],
        };
        expect(() => loadLabels("inline", suite, root)).toThrow("approval metadata");
      }
      const dir = join(root, "benchmarks", "inline");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "labels.json"), JSON.stringify({
        version: 1, benchmark: "inline", labels: { "case-a": invalid[0] },
      }));
      expect(() => loadLabels("inline", {
        name: "inline", version: 1, scenarios: ["case-a"],
      }, root)).toThrow("approval metadata");
    });
  });

  test("a passing diagnostic trial cannot authorize verification with inline or ad hoc drafts", async () => {
    await withTempDirAsync(async (root) => {
      const previousRoot = gymRoot;
      const previousState = process.env["GYM_STATE_DIR"];
      configureGymRoot(root);
      process.env["GYM_STATE_DIR"] = join(root, ".state");
      try {
        const dir = join(root, "benchmarks", "inline");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "suite.json"), JSON.stringify({
          name: "inline", version: 1,
          cases: [{ id: "case-a", task: "Diagnostic case" }],
        }));
        const scenarioDir = join(root, "scenarios", "case-a");
        mkdirSync(join(scenarioDir, "environment"), { recursive: true });
        writeFileSync(join(scenarioDir, "task.md"), "Diagnostic case\n");
        writeFileSync(join(scenarioDir, "scenario.json"), JSON.stringify({ name: "case-a" }));
        writeFileSync(join(scenarioDir, "success_criteria.js"), "// Fake executor supplies scoring\n");

        for (const benchmark of ["inline", "adhoc"]) {
          const baseline = await runLoop({
            phase: "test", benchmark, scenarios: ["case-a"], agent: "fixture-agent",
            candidate: "baseline", trials: 1,
          }, async ({ scenario, agent }) => ({
            result: {
              scenario, agent, passed: true, agent_status: "success",
              checks: [{ name: "diagnostic", passed: true }],
              prompt_hash: "fixture-prompt", framework_sha: "fixture-framework", model: "fixture-model",
            },
            stderr: "",
          }));
          expect(baseline.manifest.trials[0]?.machine_verdict).toBe("pass");
          expect(baseline.manifest.trials[0]?.label_status).toBe("draft");
          const labels = JSON.parse(readFileSync(join(
            baseline.runDir, baseline.manifest.source.labels_snapshot!,
          ), "utf8"));
          expect(labels.labels["case-a"].approved_by).toBeNull();
          // Approval must be checked before resolving or executing this nonexistent candidate.
          await expect(verifyLoop({ baseline: baseline.runDir, candidate: "must-not-execute" }))
            .rejects.toThrow("Verification requires approved labels: case-a");
        }
      } finally {
        configureGymRoot(previousRoot);
        if (previousState === undefined) delete process.env["GYM_STATE_DIR"];
        else process.env["GYM_STATE_DIR"] = previousState;
      }
    });
  });
});
