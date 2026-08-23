import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claimObservedAppTask,
  completeAppTask,
  observeAppTaskIntent,
  taskReconciliationConfig,
} from "../../src/app/app-task-reconciler.js";
import { admitCodexGoalTaskResult } from "./codex-goal-result.js";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `codex-goal-fencing-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify({
      root_task_id: "root",
      groups: {
        root: { id: "root", parent_id: null, state: "backlog", owner: "app-owner", children: ["operations"] },
        operations: { id: "operations", parent_id: "root", state: "backlog", children: [] },
      },
    })}\n`,
  );
  return taskReconciliationConfig({ appDir, projectDir: appDir, owner: "app-owner", maxConcurrent: 1 });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Codex goal Task generation fencing", () => {
  it("rejects an admitted Codex result when its Task generation was superseded", () => {
    const config = fixture();
    const firstIntent = {
      id: "review:design",
      parentId: "operations",
      outcome: "Review the design",
      acceptance: ["The review cites current evidence"],
      mode: "achieve" as const,
      input: { revision: 1 },
    };
    const observed = observeAppTaskIntent(config, { intent: firstIntent, appAgent: "app-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: observed.taskId,
      appAgent: "app-owner",
      handler: "agent:codex-goal-poc",
    });
    if (claim.kind !== "claimed") throw new Error(`expected claim, got ${claim.kind}`);

    const admitted = admitCodexGoalTaskResult(
      JSON.stringify({
        state: "converged",
        summary: "Revision one was reviewed",
        response: "The review is ready.",
        evidence: ["review-v1.md"],
      }),
      { allowNeedsAgent: false, defaultParentId: "operations" },
    );
    if (admitted.kind !== "accepted") throw new Error(`expected admitted result: ${admitted.reason}`);

    const revised = observeAppTaskIntent(config, {
      intent: { ...firstIntent, input: { revision: 2 } },
      appAgent: "app-owner",
    });
    expect(revised).toMatchObject({ kind: "observed", taskId: claim.taskId, generation: claim.generation + 1 });

    expect(
      completeAppTask(config, claim, {
        summary: admitted.result.summary,
        response: admitted.result.response,
        evidence: admitted.result.evidence,
        actions: admitted.result.actions,
      }),
    ).toMatchObject({ status: "stale", actionsApplied: [] });
  });
});
