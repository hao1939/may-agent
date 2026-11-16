import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflowTest } from "@may-agent/sdk/testing";
import * as diagnoseImprovementWorkflow from "./diagnose-improvement.js";

describe("diagnose-improvement workflow", () => {
  test("detects readonly_write_conflict and missing_regime_or_heuristic from a baseline run and normalizes the Stage 3 workflow improvement plan", async () => {
    const baselineDir = mkdtempSync(join(tmpdir(), "gym-diag-baseline-"));
    try {
      mkdirSync(join(baselineDir, "cases", "may-align-block-cleanup-on-diff", "trial-1"), {
        recursive: true,
      });
      mkdirSync(join(baselineDir, "cases", "may-align-closure-before-cleanup", "trial-1"), {
        recursive: true,
      });

      writeFileSync(
        join(
          baselineDir,
          "cases",
          "may-align-block-cleanup-on-diff",
          "trial-1",
          "result.json",
        ),
        JSON.stringify({
          checks: [
            {
              name: "decision-produced",
              passed: false,
              gate: true,
              detail: "alignment-decision.json was not produced",
            },
          ],
        }),
      );
      writeFileSync(
        join(
          baselineDir,
          "cases",
          "may-align-block-cleanup-on-diff",
          "trial-1",
          "transcript.jsonl",
        ),
        JSON.stringify({
          role: "toolResult",
          toolName: "finish",
          content: [
            {
              type: "text",
              text: "BLOCKED: no file-writing tool was available to create alignment-decision.json with readonly tools.",
            },
          ],
        }) + "\n",
      );

      writeFileSync(
        join(
          baselineDir,
          "cases",
          "may-align-closure-before-cleanup",
          "trial-1",
          "result.json",
        ),
        JSON.stringify({
          checks: [
            {
              name: "exact:needs_clarification",
              passed: false,
              gate: true,
              detail: "Expected needs_clarification=true; got false",
            },
          ],
        }),
      );
      writeFileSync(
        join(
          baselineDir,
          "cases",
          "may-align-closure-before-cleanup",
          "trial-1",
          "transcript.jsonl",
        ),
        "{}\n",
      );

      writeFileSync(
        join(baselineDir, "manifest.json"),
        JSON.stringify({
          agent: "may/bounded-cleanup",
          benchmark: "may-alignment",
          scenarios: [
            "may-align-block-cleanup-on-diff",
            "may-align-closure-before-cleanup",
          ],
          trials: [
            {
              scenario: "may-align-block-cleanup-on-diff",
              machine_verdict: "invalid",
              agent_status: "blocked",
              usage: { turns: 1, ops: 1, total_tokens: 9059 },
              result_path: "cases/may-align-block-cleanup-on-diff/trial-1/result.json",
              transcript_path: "cases/may-align-block-cleanup-on-diff/trial-1/transcript.jsonl",
            },
            {
              scenario: "may-align-closure-before-cleanup",
              machine_verdict: "fail",
              agent_status: "success",
              usage: { turns: 1, ops: 1, total_tokens: 9070 },
              result_path: "cases/may-align-closure-before-cleanup/trial-1/result.json",
              transcript_path: "cases/may-align-closure-before-cleanup/trial-1/transcript.jsonl",
            },
          ],
        }),
      );

      const outputFile = join(baselineDir, "improvement-proposal.json");
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, outputFile },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain("readonly_write_conflict");
            expect(step.task).toContain("missing_regime_or_heuristic");
            return {
              status: "done",
              summary: "Evolve bounded-cleanup workflow with regime classifier and write-instruction stripping",
              output: {
                target: "may/bounded-cleanup",
                recommended_stage: "stage2_skill", // Normalizer upgrades workflow target to stage3_workflow
                detected_regimes: ["readonly_write_conflict"],
                root_cause_summary:
                  "v1 bounded-cleanup passed raw Write instructions into a readonly child call and lacked a regime branch for missing durable closure paths.",
                proposed_changes: [
                  {
                    file: "projects/may.app/agents/may/workflows/bounded-cleanup.ts",
                    change_summary:
                      "Strip conflicting Write instructions and add classifyCleanupRegime() for non-empty diff and missing durable closure path.",
                  },
                ],
                verification_plan: {
                  benchmark: "may-alignment",
                  scenarios: ["may-align-block-cleanup-on-diff"],
                  objective: "duration_ms", // Normalizer upgrades quality failure to "quality"
                },
              },
            };
          },
        },
      });

      expect(run.status).toBe("done");
      expect(run.unconsumedFixtures).toHaveLength(0);
      const written = JSON.parse(readFileSync(outputFile, "utf8")).proposal;
      expect(written.recommended_stage).toBe("stage3_workflow");
      expect(written.detected_regimes).toEqual([
        "readonly_write_conflict",
        "missing_regime_or_heuristic",
      ]);
      expect(written.verification_plan.objective).toBe("quality");
      expect(written.verification_plan.scenarios).toEqual([
        "may-align-block-cleanup-on-diff",
        "may-align-closure-before-cleanup",
      ]);
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });
});
