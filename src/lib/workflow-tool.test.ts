import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkflowRunner } from "./workflow-tool.js";

describe("workflow execution timeout", () => {
  it("uses the canonical App read capability supplied by its owning Runtime", async () => {
    const root = mkdtempSync(join(tmpdir(), "workflow-app-read-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "read.ts"),
      `
export const name = "read";
export const description = "Canonical App read test";
export async function execute(ctx) {
  const task = await ctx.read.tasks.get("current");
  return ctx.done(task?.outcome ?? "missing");
}
`,
    );
    const read = {
      appResult: async () => null,
      tasks: {
        list: async () => ({ items: [] }),
        outcomes: async () => ({ outcomes: [] }),
        get: async () => ({ id: "current", status: "pending", generation: 1, outcome: "resource task" }),
      },
      execution: async () => null,
      metric: async () => null,
    } as any;
    const runner = createWorkflowRunner({ manager: {} as any, workflowDir, agentName: "owner", read });

    await expect(runner.run("read", "test")).resolves.toMatchObject({ type: "done", summary: "resource task" });
    rmSync(root, { recursive: true, force: true });
  });

  it("cancels the active step when its owning Task attempt is aborted", async () => {
    const root = mkdtempSync(join(tmpdir(), "workflow-cancel-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "cancel.ts"),
      `
export const name = "cancel";
export const description = "Cancellation test workflow";
export async function execute(ctx) {
  await ctx.runAgent("worker", "wait forever");
  return ctx.done("must not complete");
}
`,
    );
    let workflowRunId = "";
    let resolveStep!: (result: any) => void;
    let cancelled = 0;
    const manager = {
      callAgent: (_agent: string, _task: string, opts: { workflowRunId?: string }) => {
        workflowRunId = opts.workflowRunId ?? "";
        return new Promise((resolve) => {
          resolveStep = resolve;
        });
      },
      status: () => (workflowRunId ? [{ sessionId: "step-session", workflowRunId }] : []),
      cancel: () => {
        cancelled += 1;
        resolveStep({
          sessionId: "step-session",
          status: "interrupted",
          lastAssistantText: null,
          messages: [],
          duration: "0s",
          outputDir: "",
        });
      },
    } as any;
    const controller = new AbortController();
    const runner = createWorkflowRunner({ manager, workflowDir, agentName: "owner", signal: controller.signal });

    const running = runner.run("cancel", "test");
    while (!workflowRunId) await Bun.sleep(1);
    controller.abort(new Error("Task was cancelled"));
    const result = await running;

    expect(result.type).toBe("error");
    expect(result.type === "error" ? result.error : "").toContain("Task was cancelled");
    expect(cancelled).toBe(1);
  });

  it("cancels the active step and rejects late workflow effects", async () => {
    const root = mkdtempSync(join(tmpdir(), "workflow-timeout-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "timeout.ts"),
      `
export const name = "timeout";
export const description = "Timeout test workflow";
export async function execute(ctx) {
  try {
    await ctx.runAgent("worker", "wait forever");
  } catch {}
  ctx.emit({ type: "test.late-effect" });
  return ctx.done("late completion");
}
`,
    );

    let workflowRunId = "";
    let resolveStep!: (result: any) => void;
    let cancelled = 0;
    const manager = {
      callAgent: (_agent: string, _task: string, opts: { workflowRunId?: string }) => {
        workflowRunId = opts.workflowRunId ?? "";
        return new Promise((resolve) => {
          resolveStep = resolve;
        });
      },
      status: () => (workflowRunId ? [{ sessionId: "step-session", workflowRunId }] : []),
      cancel: (sessionId: string) => {
        expect(sessionId).toBe("step-session");
        cancelled += 1;
        resolveStep({
          sessionId,
          status: "interrupted",
          lastAssistantText: null,
          messages: [],
          duration: "0s",
          outputDir: "",
        });
      },
    } as any;
    const events: Array<{ type?: string }> = [];
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      agentName: "owner",
      executionTimeoutMs: 10,
      onEvent: (event) => events.push(event),
    });

    const result = await runner.run("timeout", "test");
    await Bun.sleep(20);

    expect(result.type).toBe("error");
    expect(result.type === "error" ? result.error : "").toContain('Workflow "timeout" timed out after 10ms');
    expect(cancelled).toBe(1);
    expect(events.some((event) => event.type === "test.late-effect")).toBe(false);
  });

  it("lets a workflow declare a longer bounded timeout", async () => {
    const root = mkdtempSync(join(tmpdir(), "workflow-timeout-override-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "slow.ts"),
      `
export const name = "slow";
export const description = "Workflow timeout override test";
export const executionTimeoutMs = 1000;
export async function execute(ctx) {
  await new Promise((resolve) => setTimeout(resolve, 30));
  return ctx.done("completed within its own budget");
}
`,
    );

    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir,
      agentName: "owner",
      executionTimeoutMs: 10,
    });

    const result = await runner.run("slow", "test");
    expect(result).toMatchObject({ type: "done" });
  });
});

describe("App workflow authoring context", () => {
  it("does not let a resource-backed Task bypass the fenced event capability", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-unfenced-event-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "emit.ts"),
      `
export const name = "emit";
export const description = "Unfenced event test";
export async function execute(ctx) {
  ctx.emit({ type: "test.child.requested", data: { child: "one" } });
  return ctx.done("must not finish");
}
`,
    );
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir,
      taskEmitter: { publish: () => 41, onEvent: () => () => {} },
    });

    expect(await runner.run("emit", "test")).toMatchObject({
      type: "error",
      error: expect.stringContaining("ctx.events.emit"),
    });
    rmSync(root, { recursive: true, force: true });
  });

  it("requires and forwards a stable local key through the fenced Task emitter", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-fenced-event-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "emit.ts"),
      `
export const name = "emit";
export const description = "Fenced event test";
export async function execute(ctx) {
  await ctx.events.emit({ type: "test.child.requested", localKey: "child-one", data: { child: "one" } });
  return ctx.done("emitted");
}
`,
    );
    const emissions: Array<{ localKey: string; type: string }> = [];
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir,
      taskEmitter: {
        publish(localKey, event) {
          emissions.push({ localKey, type: event.type });
          return 41;
        },
        onEvent: () => () => {},
      },
    });

    expect(await runner.run("emit", "test")).toMatchObject({ type: "done" });
    expect(emissions).toEqual([{ localKey: "child-one", type: "test.child.requested" }]);
    rmSync(root, { recursive: true, force: true });
  });

  it("makes a coordination event visible before the emitting workflow finishes", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-immediate-event-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "coordinate.ts"),
      `
export const name = "coordinate";
export const description = "Immediate coordination event test";
export async function execute(ctx) {
  await ctx.events.emit({ type: "test.child.requested", data: { key: "child-one" } });
  await ctx.agents.call("worker", "finish parent work");
  return ctx.done("parent complete");
}
`,
    );

    let releaseAgent!: (value: unknown) => void;
    const emitted: Array<{ type: string; data?: unknown }> = [];
    const runner = createWorkflowRunner({
      manager: {
        callAgent: () =>
          new Promise((resolve) => {
            releaseAgent = resolve;
          }),
      } as any,
      workflowDir,
      agentName: "owner",
      runtimeCtx: {
        emit: (event) => emitted.push(event as { type: string; data?: unknown }),
        dispatchEvent: () => undefined,
        getDb: () => {
          throw new Error("unused");
        },
        query: {} as any,
        commands: {} as any,
        log: () => undefined,
        notify: () => undefined,
        metrics: {} as any,
        persistDir: "",
        projectRoot: root,
        agentsRoot: root,
        sharedRoot: root,
        projectsRoot: root,
      },
    });

    let finished = false;
    const execution = runner.run("coordinate", "test").then((result) => {
      finished = true;
      return result;
    });
    const coordinationEvent = () => emitted.find((event) => event.type === "test.child.requested");
    while (!coordinationEvent() && !finished) await Bun.sleep(1);

    expect(coordinationEvent()).toEqual({ type: "test.child.requested", data: { key: "child-one" } });
    expect(finished).toBeFalse();

    releaseAgent({
      sessionId: "child-session",
      status: "done",
      lastAssistantText: "done",
      messages: [],
      duration: "0s",
      outputDir: "",
      finishResult: { status: "success", summary: "done" },
    });
    expect(await execution).toMatchObject({ type: "done", summary: "parent complete" });
  });

  it("delivers live Task feedback to a workflow and removes the listener at completion", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-task-event-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "feedback.ts"),
      `
export const name = "feedback";
export const description = "Live Task feedback test";
export async function execute(ctx) {
  let instruction = "none";
  ctx.events.onEvent((event) => { instruction = event.data.instruction; });
  await ctx.agents.call("worker", "wait for feedback");
  return ctx.done(instruction);
}
`,
    );
    let taskListener: ((event: any) => void) | undefined;
    let unsubscribed = 0;
    let releaseAgent!: (value: unknown) => void;
    const runner = createWorkflowRunner({
      manager: {
        callAgent: () =>
          new Promise((resolve) => {
            releaseAgent = resolve;
          }),
      } as any,
      workflowDir,
      agentName: "owner",
      taskEmitter: {
        publish: () => 41,
        onEvent(listener) {
          taskListener = listener;
          return () => {
            unsubscribed += 1;
          };
        },
      },
    });

    const execution = runner.run("feedback", "test");
    while (!taskListener) await Bun.sleep(1);
    taskListener({ type: "task.feedback", data: { instruction: "continue with review" } });
    releaseAgent({
      sessionId: "child-session",
      status: "done",
      lastAssistantText: "done",
      messages: [],
      duration: "0s",
      outputDir: "",
      finishResult: { status: "success", summary: "done" },
    });

    expect(await execution).toMatchObject({ type: "done", summary: "continue with review" });
    expect(unsubscribed).toBe(1);
    rmSync(root, { recursive: true, force: true });
  });

  it("adapts bounded Agent execution to the single execution result", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-agent-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "app-agent.ts"),
      `
export const name = "app-agent";
export const description = "App SDK Agent adapter test";
export async function execute(ctx) {
  const result = await ctx.agents.call("worker", String(ctx.input), { operationAllowance: 50 });
  ctx.log.info(result.summary);
  return ctx.done("adapted", result);
}
`,
    );
    const logged: string[] = [];
    let agentSessionSource: string | undefined;
    let operationAllowance: number | undefined;
    const runner = createWorkflowRunner({
      manager: {
        callAgent: async (_agent: string, _task: string, options: { source?: string; operationAllowance?: number }) => {
          agentSessionSource = options.source;
          operationAllowance = options.operationAllowance;
          return {
            sessionId: "s_app_step",
            status: "done",
            lastAssistantText: "fallback",
            messages: [],
            duration: "0s",
            outputDir: "",
            finishResult: { status: "success", summary: "bounded move complete", result: { ok: true } },
          };
        },
      } as any,
      workflowDir,
      agentName: "owner",
      sessionSource: "heartbeat",
      runtimeCtx: {
        emit: () => undefined,
        dispatchEvent: () => undefined,
        getDb: () => {
          throw new Error("unused");
        },
        query: {} as any,
        commands: {} as any,
        log: (message) => logged.push(message),
        notify: () => undefined,
        metrics: {} as any,
        persistDir: "",
        projectRoot: root,
        agentsRoot: root,
        sharedRoot: root,
        projectsRoot: root,
      },
    });

    const result = await runner.run("app-agent", "canary input");
    expect(result).toMatchObject({
      type: "done",
      output: {
        id: "s_app_step",
        kind: "agent",
        status: "done",
        summary: "bounded move complete",
        output: { ok: true },
      },
    });
    expect(agentSessionSource).toBe("heartbeat");
    expect(operationAllowance).toBe(50);
    expect(logged).toEqual(["bounded move complete"]);
  });

  it("rejects invalid operation allowances before provider execution", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-invalid-allowance-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "invalid-allowance.ts"),
      `
export const name = "invalid-allowance";
export const description = "Invalid operation allowance test";
export async function execute(ctx) {
  return ctx.agents.call("worker", "must not run", { operationAllowance: Number.POSITIVE_INFINITY });
}
`,
    );
    let calls = 0;
    const runner = createWorkflowRunner({
      manager: {
        callAgent: async () => {
          calls += 1;
          throw new Error("provider should not run");
        },
      } as any,
      workflowDir,
      agentName: "owner",
    });

    const result = await runner.run("invalid-allowance", "input");
    expect(result).toMatchObject({ type: "error" });
    expect(result.type === "error" ? result.error : "").toContain("finite positive integer");
    expect(calls).toBe(0);
  });

  it("normalizes a directly returned execution error at the host boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-error-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "app-error.ts"),
      `
export const name = "app-error";
export const description = "App SDK error normalization test";
export async function execute(ctx) {
  return ctx.agents.call("worker", "fail once");
}
`,
    );
    const runner = createWorkflowRunner({
      manager: {
        callAgent: async () => ({
          sessionId: "s_app_error",
          status: "error",
          error: "bounded move failed",
          lastAssistantText: null,
          messages: [],
          duration: "0s",
          outputDir: "",
        }),
      } as any,
      workflowDir,
      agentName: "owner",
    });

    const result = await runner.run("app-error", "input");
    expect(result).toMatchObject({ type: "error", error: "bounded move failed" });
  });

  it("preserves structured input across capability-scoped nested workflows", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-nested-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "child.ts"),
      `
export const name = "app-child";
export const description = "App SDK child";
export async function execute(ctx) {
  return ctx.done("child complete", ctx.input);
}
`,
    );
    writeFileSync(
      join(workflowDir, "parent.ts"),
      `
export const name = "app-parent";
export const description = "App SDK parent";
export async function execute(ctx) {
  const child = await ctx.workflows.run("app-child", { probe: "kept-structured" });
  return ctx.done("parent complete", child);
}
`,
    );
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir,
      agentName: "owner",
    });

    const result = await runner.run("app-parent", "outer");
    expect(result).toMatchObject({
      type: "done",
      output: {
        kind: "workflow",
        status: "done",
        summary: "child complete",
        output: { probe: "kept-structured" },
      },
    });
  });

  it("exposes only the App, project, and bounded attempt workspace roots", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-workspace-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "workspace.ts"),
      `
export const name = "workspace";
export const description = "App SDK workspace scope test";
export async function execute(ctx) {
  return ctx.done("workspace scoped", ctx.workspace);
}
`,
    );
    const executionPaths = {
      appDir: join(root, "sample.app"),
      projectDir: join(root, "sample"),
      workspaceDir: join(root, "task-workspace"),
    };
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir,
      agentName: "owner",
      executionPaths,
    });

    const result = await runner.run("workspace", "input");
    expect(result).toMatchObject({
      type: "done",
      output: {
        appRoot: executionPaths.appDir,
        projectRoot: executionPaths.projectDir,
        root: executionPaths.workspaceDir,
        output: executionPaths.workspaceDir,
      },
    });
  });

  it("exposes App-authored input without parsing the legacy task prompt", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-workflow-input-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "app-input.ts"),
      `
export const name = "app-input";
export const description = "App SDK authored input test";
export async function execute(ctx) {
  return ctx.done("input preserved", {
    input: ctx.input,
    reconciliation: ctx.reconciliation
  });
}
`,
    );
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir,
      agentName: "owner",
      workflowInput: { itemId: "app_123" },
      reconciliation: {
        appId: "sample",
        taskId: "runtime/sample",
        generation: 2,
        resourceVersion: 3,
        owner: "owner",
        mode: "maintain",
        outcome: "Keep the sample current",
        acceptance: ["Sample is current"],
        input: { itemId: "app_123" },
        children: { live: [], completed: [] },
      },
    });

    const result = await runner.run("app-input", "legacy reconciliation prompt");
    expect(result).toMatchObject({
      type: "done",
      output: {
        input: { itemId: "app_123" },
        reconciliation: {
          appId: "sample",
          taskId: "runtime/sample",
          generation: 2,
          resourceVersion: 3,
          owner: "owner",
          mode: "maintain",
          children: { live: [], completed: [] },
        },
      },
    });
  });
});
