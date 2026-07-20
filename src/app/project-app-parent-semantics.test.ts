import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claimProjectAppTask,
  completeProjectAppTask,
  deferProjectAppTask,
  readProjectAppTaskIntent,
  taskReconciliationConfig,
} from "./project-app-task-reconciler.ts";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `project-app-parent-semantics-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify(
      {
        root_task_id: "root",
        groups: {
          root: { id: "root", parent_id: null, owner: "app-owner" },
        },
        resources: {
          parent: {
            metadata: { id: "parent", generation: 1, resourceVersion: 1 },
            spec: {
              parentId: "root",
              outcome: "Keep the parent responsibility healthy",
              acceptance: ["The parent is healthy"],
              mode: "maintain",
            },
            status: {
              observedGeneration: 0,
              phase: "pending",
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
          },
          child: {
            metadata: { id: "child", generation: 1, resourceVersion: 1 },
            spec: {
              parentId: "parent",
              outcome: "Finish one bounded child",
              acceptance: ["The child is finished"],
              mode: "achieve",
            },
            status: {
              observedGeneration: 0,
              phase: "pending",
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  return taskReconciliationConfig({
    appDir,
    projectDir: appDir,
    owner: "app-owner",
    maxConcurrent: 2,
  });
}

function claimChild(config: ReturnType<typeof taskReconciliationConfig>) {
  const intent = readProjectAppTaskIntent(config, "child");
  if (!intent) throw new Error("fixture child intent is missing");
  const claim = claimProjectAppTask(config, {
    intent,
    appOwner: "app-owner",
    handler: "owner",
    reason: "test",
  });
  if (claim.kind !== "claimed") throw new Error(`expected child claim, got ${claim.kind}`);
  return claim;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("project app parent semantics", () => {
  it("does not schedule a parent merely because its child completes", () => {
    const config = fixture();
    const result = completeProjectAppTask(config, claimChild(config), {
      summary: "child complete",
      evidence: ["proof"],
    });

    expect(result).toMatchObject({ status: "applied", dependentTaskIds: [] });
    expect(readProjectAppTaskIntent(config, "parent")).not.toBeNull();
  });

  it("does not schedule a parent merely because its child starts waiting", () => {
    const config = fixture();
    const result = deferProjectAppTask(config, claimChild(config), {
      disposition: "waiting",
      summary: "waiting for exact child evidence",
      evidence: ["wait registered"],
      conditions: [
        {
          id: "child-proof",
          type: "sample.child.observed",
          subject: "task:child",
          expected: "done",
        },
      ],
    });

    expect(result).toMatchObject({ status: "applied", reconcileTaskIds: [] });
    expect(readProjectAppTaskIntent(config, "parent")).not.toBeNull();
  });
});
