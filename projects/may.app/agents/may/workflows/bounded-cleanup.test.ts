import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { runWorkflowTest } from "@may-agent/sdk/testing";
import * as boundedCleanupWorkflow from "./bounded-cleanup.js";

describe("bounded-cleanup executable skill workflow", () => {
  test("enforces async: true on delegations and writes a production-admitted TaskReconcileResult (task-result.json) for safe obsolete removal", async () => {
    const workRoot = mkdtempSync(join(tmpdir(), "bounded-cleanup-safe-"));
    try {
      const request = [
        "Clean up the old projects.",
        "",
        '# Projects that may be "old"',
        "- `legacy-alerts`: inactive for 120 days and fully superseded.",
        "- `memory-research`: inactive for 45 days, not superseded, and paused by Hao.",
        "- `auth-recovery`: active today.",
        "- All project work is committed in Git, so Git history provides recovery after removal.",
      ].join("\n");

      const run = await runWorkflowTest(boundedCleanupWorkflow, {
        input: { request },
        workspace: { projectRoot: workRoot, workRoot },
        mocks: {
          may: {
            status: "done",
            summary: "Remove legacy-alerts only",
            output: {
              understood_intent:
                "Remove only obsolete legacy-alerts while preserving paused and active work.",
              mode: "remove",
              priority: "legacy-alerts",
              needs_clarification: false,
              next_action:
                "Remove legacy-alerts only; leave memory-research paused and auth-recovery active.",
              delegations: [
                {
                  agent: "may", // Workflow normalizer must rewrite self-delegation to "tech-lead"
                  purpose: "Remove legacy-alerts with Git history as recovery",
                  async: false, // Workflow normalizer must upgrade this to true!
                },
              ],
              constraints: [
                "Git history is recovery",
                "remove only the proved superseded item",
                "preserve paused and active work",
                "no archival copy",
              ],
              preference_updates: ["accidental-pref"], // Workflow normalizer must clear this!
              response_to_hao:
                "I will remove legacy-alerts only because it is fully superseded and Git history provides recovery, while keeping memory-research paused and auth-recovery active.",
            },
          },
        },
      });

      expect(run.status).toBe("done");
      expect(run.unconsumedFixtures).toHaveLength(0);
      const written = JSON.parse(readFileSync(join(workRoot, "task-result.json"), "utf8"));
      expect(admitTaskReconcileResult(written).ok).toBe(true);
      expect(written.state).toBe("waiting");
      expect(written.result.needs_clarification).toBe(false);
      expect(written.result.delegations).toEqual([
        {
          agent: "tech-lead",
          purpose: "Remove legacy-alerts with Git history as recovery",
          async: true,
        },
      ]);
      expect(written.result.preference_updates).toEqual([]);
    } finally {
      rmSync(workRoot, { recursive: true, force: true });
    }
  });

  test("returns state: converged and forces needs_clarification: true when the request reports a non-empty git diff", async () => {
    const workRoot = mkdtempSync(join(tmpdir(), "bounded-cleanup-diff-"));
    try {
      const request = [
        "Review whether the scoped cleanup request may be approved.",
        "",
        "# Cleanup review evidence",
        "- Scoped `git diff -- projects/old-admission-review/` is non-empty and shows uncommitted changes.",
      ].join("\n");

      const run = await runWorkflowTest(boundedCleanupWorkflow, {
        input: { request },
        workspace: { projectRoot: workRoot, workRoot },
        mocks: {
          may: (step) => {
            expect(step.options?.tools).toBe("readonly");
            return {
              status: "done",
              summary: "Block cleanup on non-empty diff",
              output: {
                understood_intent: "Review cleanup approval when scoped git diff is non-empty.",
                mode: "review",
                priority: "preserve non-empty diff",
                needs_clarification: false,
                next_action: "block cleanup because of the non-empty diff and preserve the worktree",
                delegations: [],
                constraints: ["non-empty diff", "preserve worktree"],
                preference_updates: [],
                response_to_hao:
                  "I cannot approve cleanup: the non-empty diff contains uncopied findings and must be preserved until reconciled.",
              },
            };
          },
        },
      });

      expect(run.status).toBe("done");
      const written = JSON.parse(readFileSync(join(workRoot, "task-result.json"), "utf8"));
      expect(admitTaskReconcileResult(written).ok).toBe(true);
      expect(written.state).toBe("converged");
      expect(written.result.needs_clarification).toBe(true);
    } finally {
      rmSync(workRoot, { recursive: true, force: true });
    }
  });

  test("blocks worktree deletion and clears delegations when durable closure submission path is unknown", async () => {
    const workRoot = mkdtempSync(join(tmpdir(), "bounded-cleanup-closure-"));
    try {
      const request = [
        "Decide the correct handling for the worktree cleanup boundary.",
        "",
        "# Closure before worktree cleanup",
        "- The review is no longer actively needed, but the final incident closure/disposition has not yet been durably submitted.",
        "- In the current context, no durable closure submission tool, command, or documented path is exposed.",
        "",
        "Return one production-schema-valid `TaskReconcileResult` ...",
      ].join("\n");

      const run = await runWorkflowTest(boundedCleanupWorkflow, {
        input: { request },
        workspace: { projectRoot: workRoot, workRoot },
        mocks: {
          may: (step) => {
            expect(step.task).not.toContain("Return one production-schema-valid");
            expect(step.task).toContain(
              "Block Destructive Worktree Cleanup Until Durable Closure Path Is Known",
            );
            return {
              status: "done",
              summary: "Block worktree deletion until durable closure path is known",
              output: {
                understood_intent: "Enforce durable closure before worktree cleanup.",
                mode: "cleanup review",
                priority: "durable closure before worktree cleanup safety block",
                needs_clarification: false, // Normalizer must upgrade to true!
                next_action: "block worktree cleanup until durable closure is submitted",
                delegations: [
                  {
                    agent: "tech-lead",
                    purpose: "accidental delegation",
                    async: true,
                  },
                ],
                constraints: [
                  "durable closure before destructive worktree cleanup",
                  "stop when submission path is unknown",
                ],
                preference_updates: [],
                response_to_hao:
                  "I will block and will not delete the worktree because durable closure must be submitted before deleting any worktree, and the real submission path is unknown.",
              },
            };
          },
        },
      });

      expect(run.status).toBe("done");
      const written = JSON.parse(readFileSync(join(workRoot, "task-result.json"), "utf8"));
      expect(admitTaskReconcileResult(written).ok).toBe(true);
      expect(written.state).toBe("converged");
      expect(written.result.needs_clarification).toBe(true);
      expect(written.result.delegations).toEqual([]);
      expect(written.requests).toBeUndefined();
    } finally {
      rmSync(workRoot, { recursive: true, force: true });
    }
  });
});
