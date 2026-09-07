import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SubagentManager } from "./manager.js";
import type { SubagentDefinition, TaskResult } from "./types.js";
import { closeDb, getWorkflowRun } from "./requests.js";
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

describe("guard repairs share bounded workflow execution", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function setup(
    options: {
      stage?: "step_done" | "workflow_done";
      result?: TaskResult;
      pending?: Promise<TaskResult>;
      timeoutMs?: number;
      signal?: AbortSignal;
      secondRepair?: boolean;
      blockFailedRepair?: boolean;
    } = {},
  ) {
    const root = mkdtempSync(join(tmpdir(), "workflow-repair-"));
    roots.push(root);
    const workflowDir = join(root, "workflows");
    const guardsDir = join(root, "guards");
    mkdirSync(workflowDir);
    mkdirSync(guardsDir);
    writeFileSync(
      join(workflowDir, "bounded.ts"),
      `
export const name = "bounded";
export const description = "One bounded attempt with a repair check";
export async function execute(ctx) {
  await ctx.agents.call("worker", "Do the work");
  return ctx.done("Workflow finished");
}
`,
    );
    writeFileSync(
      join(guardsDir, "repair.ts"),
      `
export const guard = {
  name: "fixture-repair",
  handle(event) {
    if (${Boolean(options.blockFailedRepair)} && event.type === "workflow_done" &&
        event.completedSteps.some(step => step.step === "guard:verify" && step.result.status === "error")) {
      return [{ type: "block", reason: "Required repair failed" }];
    }
    if (event.type !== ${JSON.stringify(options.stage ?? "workflow_done")}) return [];
    return [{ type: "repair", reason: "Check the work",
      step: { agent: "repairer", task: "Verify the work", label: "guard:verify" } },
      ...(${Boolean(options.secondRepair)} ? [{ type: "run_step", reason: "Check again",
        step: { agent: "second-repairer", task: "Must not run after cancellation", label: "guard:second" } }] : [])];
  }
};
`,
    );
    const calls: Array<{ agent: string; options: CallOptions; definition?: SubagentDefinition }> = [];
    const completions: Array<{ step: string; result: TaskResult }> = [];
    const cancelled: string[] = [];
    const started = Promise.withResolvers<void>();
    const definition = { name: "repairer" } as SubagentDefinition;
    const binding = { appId: "fixture", taskId: "work/one", generation: 3, attemptId: "attempt-one" };
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
      cancel: (sessionId: string) => cancelled.push(sessionId),
    } as unknown as SubagentManager;
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      guardsDir,
      persistDir: root,
      agentName: "owner",
      projectId: "fixture",
      callerSessionId: "parent-session",
      agentDefinitions: new Map([["repairer", definition]]),
      taskBinding: binding,
      recoveryOwner: "app-task",
      executionPaths: { appDir: root, projectDir: root, workspaceDir: join(root, "workspace") },
      executionTimeoutMs: options.timeoutMs,
      signal: options.signal,
      onEvent: (event) => {
        if (event.type === "workflow.step_completed") completions.push(event);
      },
    });
    return { root, runner, calls, completions, cancelled, started: started.promise, definition, binding };
  }

  for (const stage of ["step_done", "workflow_done"] as const) {
    it(`keeps ${stage} repairs in the same Task, workspace and pinned agent definition`, async () => {
      const h = setup({ stage });
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
        source: "guard",
        stepLabel: "guard:verify",
        requireFinish: true,
      });
      if (result.type === "done") expect(result.steps.map((step) => step.agent)).toEqual(["worker", "guard:verify"]);
    });
  }

  for (const [label, result] of [
    ["missing finish result", { ...success(), finishResult: undefined }],
    ["failure", { ...success(), finishResult: { status: "failure", summary: "Check failed" } }],
    ["blocked", { ...success(), finishResult: { status: "blocked", summary: "Cannot verify" } }],
    ["interrupted", { ...success(), status: "interrupted" }],
  ] as const) {
    it(`exposes ${label} as repair evidence without inventing a blocking policy`, async () => {
      const h = setup({ result });
      const outcome = await h.runner.run("bounded", "test");
      expect(outcome.type).toBe("done");
      expect(h.calls.map((call) => call.agent)).toEqual(["worker", "repairer"]);
      const recorded = h.completions.find((step) => step.step === "guard:verify")?.result;
      if (!result.finishResult) {
        expect(recorded).toMatchObject({ status: "error", error: expect.stringContaining("required finish() result") });
      } else {
        expect(recorded).toEqual(result);
      }
    });
  }

  it("honors an explicit completion guard that blocks on an invalid repair result", async () => {
    const h = setup({ stage: "step_done", result: { ...success(), finishResult: undefined }, blockFailedRepair: true });
    expect(await h.runner.run("bounded", "test")).toMatchObject({ type: "blocked", reason: "Required repair failed" });
    expect(getWorkflowRun(h.root, h.calls[0].options!.workflowRunId!)?.status).toBe("blocked");
  });

  it("honors steering between completion repairs without starting another step", async () => {
    const repair = Promise.withResolvers<TaskResult>();
    const h = setup({ pending: repair.promise, secondRepair: true });
    const running = h.runner.run("bounded", "test");
    try {
      await h.started;
      expect(h.runner.steer("Review the new requirement first")).toBe(true);
      repair.resolve(success());
      expect(await running).toMatchObject({ type: "interrupted", steeringMessage: "Review the new requirement first" });
      expect(h.calls.map((call) => call.agent)).toEqual(["worker", "repairer"]);
      expect(getWorkflowRun(h.root, h.calls[0].options!.workflowRunId!)?.status).toBe("interrupted");
    } finally {
      repair.resolve(success());
      await running;
    }
  });

  for (const stop of ["timeout", "abort"] as const) {
    it(`keeps ${stop} active through completion repairs and rejects late repair results`, async () => {
      const repair = Promise.withResolvers<TaskResult>();
      const abort = new AbortController();
      const h = setup({
        pending: repair.promise,
        timeoutMs: stop === "timeout" ? 50 : undefined,
        signal: abort.signal,
        secondRepair: true,
      });
      const running = h.runner.run("bounded", "test");
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      try {
        await h.started;
        if (stop === "abort") abort.abort(new Error("Owning Task cancelled"));
        const outcome = await Promise.race([
          running,
          new Promise<"watchdog">((resolve) => {
            watchdog = setTimeout(() => resolve("watchdog"), 500);
          }),
        ]);
        expect(outcome).not.toBe("watchdog");
        expect(outcome).toMatchObject({
          type: "error",
          error: expect.stringContaining(stop === "timeout" ? "timed out after 50ms" : "Owning Task cancelled"),
        });
        expect(h.cancelled).toEqual(["repair-session"]);
        repair.resolve(success());
        // Let the ignored provider result unwind before inspecting durable state.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        expect(h.calls.map((call) => call.agent)).toEqual(["worker", "repairer"]);
        expect(getWorkflowRun(h.root, h.calls[0].options!.workflowRunId!)?.status).toBe("error");
      } finally {
        if (watchdog) clearTimeout(watchdog);
        repair.resolve(success());
        await running;
      }
    });
  }
});
