import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskWorkflowRunner } from "./workflow.js";
import { EventBus } from "../../core/events/bus.js";
import type { TaskWorkflowInput } from "../../core/tasks/execution.js";
import { closeDb, getWorkflowRun } from "../../../lib/requests.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

it.each(["error", "interrupted"] as const)("retains the %s run reference without changing Task failure recovery", async (status) => {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-failure-"));
  roots.push(root);
  const workflowDir = join(root, "owner", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(workflowDir, "review.ts"), `
export const name = "review";
export const description = "Unfinished contribution with retained evidence";
export async function execute(ctx) {
  return { ...ctx.done("Inspection stopped"), status: ${JSON.stringify(status)},
    output: { report: "partial.md" }, facts: { inspected: true } };
}`);
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: new EventBus() });
  const result = await runner.execute({
    source: { projectsRoot: root, projectRoot: root, persistDir: root, agentsRoot: root, sharedRoot: join(root, "shared") },
    descriptor: { id: "fixture", appDir: join(root, "sample.app"), projectDir: root, app: {} },
    capability: { workflow: "review", task: "Review the candidate" }, handler: "workflow:review",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    childContext: { live: [], completed: [] }, taskSnapshot: { live: [], truncated: false },
    taskRead: {}, taskEvents: {}, executionTimeoutMs: 1000,
    attempt: {
      task: { id: "review", generation: 1, outcome: "Review", acceptance: [], input: {} },
      attemptId: "attempt", role: { agent: "owner" }, resourceVersion: 1,
      events: { items: [], truncated: false }, waits: [], children: [], declaredOutputPaths: [],
      signal: new AbortController().signal, onEvent: () => () => {},
    },
  } as unknown as TaskWorkflowInput);
  expect(result.executionFailed).toBe(true);
  expect(result.handlerResult).toMatchObject({ state: "error", facts: [`workflow-run:${result.runId}`] });
  expect(result.runId).toBeTruthy();
  expect(getWorkflowRun(root, result.runId!)?.result_payload).toMatchObject({
    kind: "result", state: "available", value: { output: { report: "partial.md" }, facts: { inspected: true } },
  });
});

it("inspects the current workflow definition without executing it", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-inspection-"));
  roots.push(root);
  mkdirSync(join(root, "owner", "workflows"), { recursive: true });
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: {} as never });
  const inspect = (agent = "owner") => runner.inspect({
    source: {
      projectsRoot: root,
      projectRoot: root,
      agentsRoot: root,
      persistDir: join(root, "state"),
      sharedRoot: join(root, "shared"),
    },
    appDir: join(root, "sample.app"),
    agent,
    workflow: "verify",
  });
  expect((await inspect()).available).toBeFalse();
  const path = join(root, "owner", "workflows", "verify.ts");
  writeFileSync(
    path,
    `export const name = "verify";
export const description = "Availability fixture";
export function execute() { throw new Error("Must not execute during lookup"); }`,
  );
  expect((await inspect()).available).toBeTrue();
  expect((await inspect("other")).available).toBeFalse();
  writeFileSync(path, 'export const name = "verify";');
  expect((await inspect()).available).toBeFalse();
});
