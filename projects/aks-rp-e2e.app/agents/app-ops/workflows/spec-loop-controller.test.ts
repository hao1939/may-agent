import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./spec-loop-controller";

async function workspace(spec: Record<string, unknown>, represented = false) {
  const root = await mkdtemp(join(tmpdir(), "spec-loop-v2-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(appDir, ".state", "spec-loop", "state.json"),
    JSON.stringify({
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 5,
      cursor: 0,
      prioritySpecIds: [],
      specs: { "spec.example": spec },
    }),
  );
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({
      tasks: represented
        ? { "existing-spec-task": { id: "existing-spec-task" } }
        : {},
      resources: {},
      receipts: {},
    }),
  );
  return { appDir, projectDir };
}

function context(appDir: string, projectDir: string) {
  return {
    task: `app: ${appDir}\nproject: ${projectDir}\n## Trigger Event\n\`\`\`json\n${JSON.stringify({ type: "project.task.tick", action: "spec-loop", taskId: "aks-spec-verification-loop" })}\n\`\`\``,
    agent: "aks-explorer",
    done: (message: string, output?: unknown) => ({
      status: "done",
      message,
      output,
    }),
  } as any;
}

describe("spec loop reconciliation workflow", () => {
  test("converges when every spec has a passing result", async () => {
    const ws = await workspace({
      status: "pass",
      attempts: 1,
      lastRunId: "42",
      lastResultPath: "result.json",
      lastPrUrl: null,
      updatedAt: "2026-07-19T00:00:00Z",
    });
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });
  });

  test("declares bounded owner work without mutating or assigning the graph", async () => {
    const ws = await workspace({
      status: "pending",
      attempts: 0,
      lastRunId: null,
      lastResultPath: null,
      lastPrUrl: null,
      updatedAt: "2026-07-19T00:00:00Z",
    });
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            parentId: "aks-spec-verification-loop",
            owner: "aks-explorer",
            input: { specId: "spec.example" },
          },
        ],
      },
    });
  });

  test("waits on an exact Condition when work is already represented", async () => {
    const ws = await workspace(
      {
        status: "running",
        taskId: "existing-spec-task",
        attempts: 1,
        lastRunId: "42",
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: "2026-07-19T00:00:00Z",
      },
      true,
    );
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "waiting",
        actions: [],
        conditions: [
          {
            type: "project.task.reconciled",
            subject: "task:existing-spec-task",
          },
        ],
      },
    });
  });
});
