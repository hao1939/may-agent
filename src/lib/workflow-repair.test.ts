import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { getDb } from "./db/connection.js";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SubagentManager } from "./manager.js";
import type { SubagentDefinition, TaskResult } from "./types.js";
import { closeDb } from "./db/connection.js";
import { getWorkflowRun } from "./db/workflows.js";
import { createWorkflowRunner } from "./workflow-tool.js";

type CallOptions = Parameters<SubagentManager["callAgent"]>[2];

function success(sessionId = "repair-session"): TaskResult {
  return {
    sessionId,
    status: "done",
    lastAssistantText: "Verified",
    messages: [],
    duration: "0s",
    outputDir: "",
    finishResult: { status: "success", summary: "Verified" },
  };
}

describe("explicit authored workflow repair and completion guards share bounded execution", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function setup(
    options: {
      result?: TaskResult;
      pending?: Promise<TaskResult>;
      timeoutMs?: number;
      signal?: AbortSignal;
      extraStep?: boolean;
    } = {},
  ) {
    const root = mkdtempSync(join(tmpdir(), "workflow-repair-"));
    roots.push(root);
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "bounded.ts"),
      `
export const name = "bounded";
export const description = "One bounded attempt with explicit authored repair check";
export async function execute(ctx) {
  await ctx.agents.call("worker", "Do the work");
  await ctx.agents.call("repairer", "Verify the work");
  if (${Boolean(options.extraStep)}) {
    await ctx.agents.call("second-repairer", "Must not run after steering or cancellation");
  }
  return ctx.done("Workflow finished");
}
`,
    );
    const calls: Array<{ agent: string; options: CallOptions; definition?: SubagentDefinition }> = [];
    const completions: Array<{ step: string; result: TaskResult }> = [];
    const cancelled: string[] = [];
    const started = Promise.withResolvers<void>();
    const stopped = Promise.withResolvers<void>();
    const workerDef = { name: "worker" } as SubagentDefinition;
    const definition = { name: "repairer" } as SubagentDefinition;
    const binding = { appId: "fixture", taskId: "work/one", generation: 3, attemptId: "attempt-one" };
    AppTaskResourceStore.fromDb(getDb(root), binding.appId).bootstrapSnapshot(
      {
        project: binding.appId,
        resources: {
          [binding.taskId]: {
            metadata: { id: binding.taskId, generation: binding.generation, resourceVersion: 1 },
            spec: { parentId: "root", outcome: "Work", acceptance: ["Done"] },
            status: { phase: "running", observedGeneration: 0, currentAttemptId: binding.attemptId },
          },
        },
        attempts: {
          [binding.attemptId]: {
            metadata: { id: binding.attemptId, resourceVersion: 1 },
            taskId: binding.taskId,
            taskGeneration: binding.generation,
            specHash: "hash",
            owner: "owner",
            handler: "workflow:bounded",
            runtimeId: "rt",
            state: "running",
            reason: "event",
            startedAt: new Date().toISOString(),
          },
        },
      },
      "fixture",
    );
    const call = async (agent: string, _task: string, callOptions: CallOptions, pinned?: SubagentDefinition) => {
      calls.push({ agent, options: callOptions, definition: pinned });
      if (agent !== "repairer") return success(`${agent}-session`);
      started.resolve();
      return options.pending ?? options.result ?? success();
    };
    const manager = {
      callAgent: call,
      callAgentDefinition: (pinned: SubagentDefinition, task: string, callOptions: CallOptions) =>
        call(pinned.name, task, callOptions, pinned),
      status: () => [{ sessionId: "repair-session", workflowRunId: calls.at(-1)?.options?.workflowRunId }],
      cancel: (sessionId: string) => {
        cancelled.push(sessionId);
        stopped.resolve();
      },
    } as unknown as SubagentManager;
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      persistDir: root,
      agentName: "owner",
      projectId: "fixture",
      callerSessionId: "parent-session",
      agentDefinitions: new Map([
        ["worker", workerDef],
        ["repairer", definition],
      ]),
      taskBinding: binding,
      recoveryOwner: "app-task",
      executionPaths: { appDir: root, projectDir: root, workspaceDir: join(root, "workspace") },
      executionTimeoutMs: options.timeoutMs,
      signal: options.signal,
      onEvent: (event) => {
        if (event.type === "workflow.step_completed") completions.push(event);
      },
    });
    return { root, workflowDir, runner, calls, completions, cancelled, started: started.promise, stopped: stopped.promise, definition, binding };
  }

  it("keeps authored verification steps in the same Task, workspace and pinned agent definition", async () => {
    const h = setup();
    const result = await h.runner.run("bounded", "test");
    expect(result.type).toBe("done");
    expect(h.calls.map((call) => call.agent)).toEqual(["worker", "repairer"]);
    expect(h.calls[1].definition).toBe(h.definition);
    expect(h.calls[1].options).toMatchObject({
      parentSessionId: "parent-session",
      workflowRunId: h.calls[0].options?.workflowRunId,
      projectId: "fixture",
      taskBinding: h.binding,
      recoveryOwner: "app-task",
      executionRoot: join(h.root, "workspace"),
      stepLabel: "repairer",
      requireFinish: true,
    });
    if (result.type === "done") expect(result.steps.map((step) => step.agent)).toEqual(["worker", "repairer"]);
  });

  for (const [label, result] of [
    ["missing finish result", { ...success(), finishResult: undefined }],
    ["failure", { ...success(), finishResult: { status: "failure", summary: "Check failed" } }],
    ["blocked", { ...success(), finishResult: { status: "blocked", summary: "Cannot verify" } }],
    ["interrupted", { ...success(), status: "interrupted" }],
  ] as const) {
    it(`exposes ${label} as step facts without inventing a blocking policy`, async () => {
      const h = setup({ result });
      const outcome = await h.runner.run("bounded", "test");
      expect(outcome.type).toBe("done");
      expect(h.calls.map((call) => call.agent)).toEqual(["worker", "repairer"]);
      const recorded = h.completions.find((step) => step.step === "repairer")?.result;
      if (!result.finishResult) {
        expect(recorded).toMatchObject({ status: "error", error: expect.stringContaining("required finish() result") });
      } else {
        expect(recorded).toEqual(result);
      }
    });
  }

  it("retains the exact steering reason after reopening storage without starting the next step", async () => {
    const repair = Promise.withResolvers<TaskResult>();
    const h = setup({ pending: repair.promise, extraStep: true });
    const running = h.runner.run("bounded", "test");
    try {
      await h.started;
      const reason = "Review the new requirement first.\nDo not start another repair.";
      expect(h.runner.steer(reason)).toBe(true);
      repair.resolve(success());
      const result = await running;
      expect(result).toMatchObject({
        type: "interrupted",
        workflowRunId: h.calls[0].options!.workflowRunId!,
        steeringMessage: reason,
      });
      expect(h.calls.map((call) => call.agent)).toEqual(["worker", "repairer"]);
      if (result.type !== "interrupted") throw new Error("Expected steered run");
      closeDb(h.root);
      expect(getWorkflowRun(h.root, result.workflowRunId)).toMatchObject({
        status: "interrupted",
        result_reason: reason,
        endedAt: expect.any(Number),
      });
    } finally {
      repair.resolve(success());
      await running;
    }
  });

  for (const stop of ["timeout", "abort"] as const) {
    it(`keeps ${stop} active through authored verification and waits for cancelled steps to settle`, async () => {
      const repair = Promise.withResolvers<TaskResult>();
      const abort = new AbortController();
      const h = setup({
        pending: repair.promise,
        timeoutMs: stop === "timeout" ? 1_000 : undefined,
        signal: abort.signal,
        extraStep: true,
      });
      let settled = false;
      const running = h.runner.run("bounded", "test").then((result) => {
        settled = true;
        return result;
      });
      try {
        await h.started;
        if (stop === "abort") abort.abort(new Error("Owning Task cancelled"));
        await h.stopped;
        expect(settled).toBe(false);
        expect(getWorkflowRun(h.root, h.calls[0].options!.workflowRunId!)?.status).toBe("running");
        repair.resolve(success());
        const outcome = await running;
        expect(outcome).toMatchObject({
          type: "error",
          error: expect.stringContaining(stop === "timeout" ? "timed out after 1000ms" : "Owning Task cancelled"),
        });
        expect(h.cancelled).toEqual(["repair-session"]);
        expect(h.calls.map((call) => call.agent)).toEqual(["worker", "repairer"]);
        expect(getWorkflowRun(h.root, h.calls[0].options!.workflowRunId!)?.status).toBe("error");
      } finally {
        repair.resolve(success());
        await running;
      }
    });
  }

  it("enforces declared inputSchema and outputSchema in Host execution", async () => {
    const h = setup();
    writeFileSync(
      join(h.workflowDir, "typed.ts"),
      `
export const name = "typed";
export const description = "Typed workflow";
export const inputSchema = { type: "object", properties: { ref: { type: "string", minLength: 2 } }, required: ["ref"] };
export const outputSchema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };
export async function execute(ctx) {
  return ctx.done("ok", { ok: ctx.input.ref === "bad-out" ? "nope" : true });
}
`,
    );

    const invalidInput = await createWorkflowRunner({
      manager: { callAgent: async () => success() } as unknown as SubagentManager,
      workflowDir: h.workflowDir,
      persistDir: h.root,
      workflowInput: { ref: "" },
    }).run("typed", "bad");
    expect(invalidInput.type).toBe("error");
    if (invalidInput.type === "error") expect(invalidInput.error).toContain("Invalid workflow input");

    const invalidOutput = await createWorkflowRunner({
      manager: { callAgent: async () => success() } as unknown as SubagentManager,
      workflowDir: h.workflowDir,
      persistDir: h.root,
      workflowInput: { ref: "bad-out" },
    }).run("typed", "bad-out");
    expect(invalidOutput.type).toBe("error");
    if (invalidOutput.type === "error") expect(invalidOutput.error).toContain("Invalid workflow output");
  });
});
