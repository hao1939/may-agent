import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkflowRunner } from "./workflow-tool.js";

const roots: string[] = [];
function workflowRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("workflow execution boundaries", () => {
  it("uses the canonical App read capability supplied by its owning Runtime", async () => {
    const root = workflowRoot("workflow-app-read-");
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
  });

  it("cancels the active step when its owning Task attempt is aborted", async () => {
    const root = workflowRoot("workflow-cancel-");
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "cancel.ts"),
      `
export const name = "cancel";
export const description = "Cancellation test workflow";
export async function execute(ctx) {
  await ctx.agents.call("worker", "wait forever");
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
    const root = workflowRoot("workflow-timeout-");
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "timeout.ts"),
      `
export const name = "timeout";
export const description = "Timeout test workflow";
export async function execute(ctx) {
  try {
    await ctx.agents.call("worker", "wait forever");
  } catch {}
  await ctx.events.emit({ type: "test.late-effect", data: {} });
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
    const root = workflowRoot("workflow-timeout-override-");
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

  it.each(["caller", "deadline"] as const)(
    "passes %s cancellation into nested helpers, without extending the parent bound",
    async (cause) => {
      const root = workflowRoot("workflow-nested-cancel-");
      writeFileSync(
        join(root, "parent.ts"),
        `
      export const name = "parent";
      export const description = "Parent bound fixture";
      export async function execute(ctx) { return await ctx.workflows.run("child", {}); }
    `,
      );
      writeFileSync(
        join(root, "child.ts"),
        `
      export const name = "child";
      export const description = "Longer child bound fixture";
      export const executionTimeoutMs = 1000;
      export async function execute(ctx) {
        await ctx.read.execution(ctx.signal);
        return ctx.done("must not finish");
      }
    `,
      );
      const entered = Promise.withResolvers<AbortSignal>();
      const childFailed = Promise.withResolvers<void>();
      const controller = new AbortController();
      const events: any[] = [];
      const runner = createWorkflowRunner({
        manager: { status: () => [] } as any,
        workflowDir: root,
        signal: controller.signal,
        executionTimeoutMs: cause === "deadline" ? 100 : 5000,
        read: {
          execution: (signal: AbortSignal) => {
            entered.resolve(signal);
            return new Promise((_, reject) =>
              signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
            );
          },
        } as any,
        runtimeCtx: {
          emit(event: any) {
            events.push(event);
            if (event.type === "workflow.failed" && event.data.workflow === "child") childFailed.resolve();
          },
        } as any,
      });
      const pending = runner.run("parent", "test");
      const signal = await entered.promise;
      expect(signal.aborted).toBe(false);
      if (cause === "caller") controller.abort(new Error("Owner cancelled"));
      const result = await pending;
      await childFailed.promise;
      const reason = cause === "caller" ? "Owner cancelled" : 'Workflow "parent" timed out after 100ms';
      expect(result).toMatchObject({ type: "error", error: reason });
      expect(signal.aborted).toBe(true);
      expect(signal.reason.message).toBe(reason);
      expect(
        events
          .filter((e) => e.type === "workflow.failed")
          .map((e) => e.data.workflow)
          .sort(),
      ).toEqual(["child", "parent"]);
      expect(events.some((e) => e.type === "workflow.completed")).toBe(false);
    },
  );

  it("does not enter authored code when already cancelled", async () => {
    const root = workflowRoot("workflow-already-cancelled-");
    writeFileSync(
      join(root, "skip.ts"),
      `
      export const name = "skip";
      export const description = "Already cancelled fixture";
      export async function execute() { throw new Error("must not enter"); }
    `,
    );
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir: root,
      signal: AbortSignal.abort(new Error("already stopped")),
    });
    expect(await runner.run("skip", "test")).toMatchObject({ type: "error", error: "already stopped" });
  });

  it("settles cancellation even if step cleanup fails and authored code catches it", async () => {
    const root = workflowRoot("workflow-cancel-cleanup-");
    writeFileSync(
      join(root, "catch.ts"),
      `
      export const name = "catch";
      export const description = "Noncooperative fixture";
      export async function execute(ctx) {
        try { await ctx.read.execution(ctx.signal); } catch {}
        ctx.log.info("late evidence");
        return ctx.done("late result", {wrong: true});
      }
    `,
    );
    const controller = new AbortController();
    const runner = createWorkflowRunner({
      manager: {
        status() {
          throw new Error("cleanup failed");
        },
      } as any,
      workflowDir: root,
      signal: controller.signal,
      read: {
        execution: (signal: AbortSignal) => {
          controller.abort(new Error("synchronous caller cancellation"));
          signal.throwIfAborted();
        },
      } as any,
    });
    expect(await runner.run("catch", "test")).toMatchObject({
      type: "error",
      error: "synchronous caller cancellation",
    });
  });

  it("ends a settled run's signal without cancelling the parent or independent work", async () => {
    const root = workflowRoot("workflow-settled-signal-");
    writeFileSync(
      join(root, "finish.ts"),
      `
      export const name = "finish";
      export const description = "Signal lifetime fixture";
      export async function execute(ctx) {
        await ctx.read.execution(ctx.signal);
        return ctx.done("finished");
      }
    `,
    );
    const signals: AbortSignal[] = [];
    const controller = new AbortController();
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir: root,
      signal: controller.signal,
      read: {
        execution: (signal: AbortSignal) => {
          expect(signal.aborted).toBe(false);
          signals.push(signal);
        },
      } as any,
    });
    expect((await runner.run("finish", "first")).type).toBe("done");
    expect(signals[0]?.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false);
    expect((await runner.run("finish", "second")).type).toBe("done");
    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
  });
});

describe("App workflow authoring context", () => {
  it("returns a direct Task result only under a Task owner and forwards published-fact reads", async () => {
    const root = workflowRoot("task-workflow-result-");
    writeFileSync(
      join(root, "report.ts"),
      `
export const name = "report";
export const description = "Direct Task report";
export async function execute(ctx) {
  const fact = await ctx.events.read("sample.observed", "sample");
  return { state: "stopped", summary: "Source unavailable", evidence: ["event:" + fact.eventId] };
}`,
    );
    const reads: string[][] = [];
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir: root,
      taskBinding: { appId: "sample", taskId: "review", generation: 1, attemptId: "attempt-1" },
      taskEmitter: {
        read(type, key) {
          reads.push([type, key]);
          return { eventId: 41, data: {} };
        },
        publish: () => {
          throw new Error("Read must not publish");
        },
        onEvent: () => () => {},
      },
    });
    expect(await runner.run("report", "review")).toMatchObject({
      type: "done",
      output: { state: "stopped", evidence: ["event:41"] },
    });
    expect(reads).toEqual([["sample.observed", "sample"]]);
    const unowned = createWorkflowRunner({ manager: {} as any, workflowDir: root });
    expect(await unowned.run("report", "review")).toMatchObject({
      type: "error",
      error: expect.stringContaining("Only a Task-owned workflow"),
    });
    writeFileSync(
      join(root, "plain.ts"),
      `
export const name = "plain";
export const description = "Unowned direct result";
export async function execute() { return { state: "converged", summary: "Answer", evidence: [] }; }
`,
    );
    expect(await unowned.run("plain", "review")).toMatchObject({
      type: "error",
      error: expect.stringContaining("invalid terminal execution result"),
    });
  });

  it("does not let a resource-backed Task bypass the fenced event capability", async () => {
    const root = workflowRoot("app-workflow-unfenced-event-");
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "emit.ts"),
      `
export const name = "emit";
export const description = "Unfenced event test";
export async function execute(ctx) {
  await ctx.events.emit({ type: "test.child.requested", data: { child: "one" } });
  return ctx.done("must not finish");
}
`,
    );
    const runner = createWorkflowRunner({
      manager: {} as any,
      workflowDir,
      taskEmitter: { read: () => null, publish: () => 41, onEvent: () => () => {} },
    });

    expect(await runner.run("emit", "test")).toMatchObject({
      type: "error",
      error: expect.stringContaining("stable localKey"),
    });

  });

  it("requires and forwards a stable local key through the fenced Task emitter", async () => {
    const root = workflowRoot("app-workflow-fenced-event-");
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
        read: () => null,
        publish(localKey, event) {
          emissions.push({ localKey, type: event.type });
          return 41;
        },
        onEvent: () => () => {},
      },
    });

    expect(await runner.run("emit", "test")).toMatchObject({ type: "done" });
    expect(emissions).toEqual([{ localKey: "child-one", type: "test.child.requested" }]);

  });

  it("makes a coordination event visible before the emitting workflow finishes", async () => {
    const root = workflowRoot("app-workflow-immediate-event-");
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
    const root = workflowRoot("app-workflow-task-event-");
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
        read: () => null,
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

  });

  it("adapts bounded Agent execution to the single execution result", async () => {
    const root = workflowRoot("app-workflow-agent-");
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
    const cliCall = {
      sessionId: "s_app_step",
      toolCallId: "native-call",
      taskId: "cli_1",
      tool: "codex",
      status: "completed",
      resultPath: "/evidence/result.md",
      structuredResultPath: "/evidence/result.json",
      eventsPath: "/evidence/events.jsonl",
    };
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
            messages: [
              {
                role: "toolResult",
                toolName: "run_cli_agent",
                toolCallId: "native-call",
                details: { cliCall },
                content: [],
                isError: false,
                timestamp: Date.now(),
              },
            ],
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
        cliCalls: [cliCall],
        evidence: { status: "success", summary: "bounded move complete", result: { ok: true } },
      },
    });
    expect(agentSessionSource).toBe("heartbeat");
    expect(operationAllowance).toBe(50);
    expect(logged).toEqual([expect.stringMatching(/^\[workflow:wr_[^\]]+\] \[info\] bounded move complete$/)]);
  });

  it("rejects invalid operation allowances before provider execution", async () => {
    const root = workflowRoot("app-workflow-invalid-allowance-");
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
    const root = workflowRoot("app-workflow-error-");
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
    const root = workflowRoot("app-workflow-nested-");
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
    const root = workflowRoot("app-workflow-workspace-");
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
    const root = workflowRoot("app-workflow-input-");
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
