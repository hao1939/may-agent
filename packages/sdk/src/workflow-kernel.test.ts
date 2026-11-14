import { describe, expect, test } from "bun:test";
import { Type, type AgentContext, type Static, type WorkflowContext } from "./index.js";
import { listTargets, run as sdkRun } from "./standalone.js";
import { createTestAppWorkflowContext, resolveCallable, runWorkflowTest } from "./testing.js";
import {
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
  WorkflowValidationError,
} from "./workflow-kernel.js";

const ReviewInput = Type.Object(
  { subjectRef: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
const ReviewReport = Type.Object(
  {
    subjectRef: Type.String({ minLength: 1 }),
    verdict: Type.Optional(Type.Union([Type.Literal("pass"), Type.Literal("changes-needed")])),
    summary: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
const ReviewOutput = Type.Object(
  {
    reviewExecutionId: Type.String({ minLength: 1 }),
    review: ReviewReport,
    helperStatus: Type.String(),
  },
  { additionalProperties: false },
);

const reviewWorkflow = {
  name: "review-change",
  description: "Review one subject reference",
  inputSchema: ReviewInput,
  outputSchema: ReviewOutput,
  async execute(ctx: WorkflowContext<Static<typeof ReviewInput>>) {
    ctx.log.info(`reviewing ${ctx.input.subjectRef}`);
    const review = await ctx.call("reviewer", `Review ${ctx.input.subjectRef}`, {
      schema: ReviewReport,
    });
    if (!review.output || review.output.subjectRef !== ctx.input.subjectRef) {
      return ctx.blocked("Reviewer did not return a valid report", { review });
    }
    return ctx.done("Review report collected", {
      reviewExecutionId: review.id,
      review: review.output,
      helperStatus: review.status,
    });
  },
};

describe("portable workflow kernel & runWorkflowTest", () => {
  test("executes readable module, preserves schema-valid partial output, and checks fixture consumption", async () => {
    const run = await runWorkflowTest(reviewWorkflow, {
      input: { subjectRef: "HEAD~1..HEAD" },
      agents: {
        reviewer: [
          {
            status: "blocked",
            summary: "Partial review with missing integration check",
            output: {
              subjectRef: "HEAD~1..HEAD",
              summary: "Static diff checked; runtime test still needed",
            },
          },
        ],
      },
    });

    expect(run.ok).toBe(true);
    expect(run.status).toBe("done");
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]?.status).toBe("blocked");
    expect(run.result).toEqual({
      type: "done",
      summary: "Review report collected",
      output: {
        reviewExecutionId: "s_test_reviewer_0",
        review: {
          subjectRef: "HEAD~1..HEAD",
          summary: "Static diff checked; runtime test still needed",
        },
        helperStatus: "blocked",
      },
    });
    expect(run.logs[0]?.message).toBe("reviewing HEAD~1..HEAD");
    expect(run.unconsumedFixtures).toEqual([]);
  });

  test("rejects invalid input before execute() runs", async () => {
    let executed = false;
    const mod = {
      ...reviewWorkflow,
      async execute(ctx: WorkflowContext<Static<typeof ReviewInput>>) {
        executed = true;
        return reviewWorkflow.execute(ctx);
      },
    };

    const badInput = await runWorkflowTest(mod, {
      input: { subjectRef: "" } as any,
      agents: { reviewer: { output: { subjectRef: "x", summary: "ok" } } },
    });
    expect(badInput.ok).toBe(false);
    expect(badInput.started).toBe(false);
    expect(badInput.error).toBeInstanceOf(WorkflowValidationError);
    expect(executed).toBe(false);
  });

  test("catches step-schema mismatch, unexpected calls, unconsumed fixtures, and outputSchema mismatch", async () => {
    const stepSchemaFail = await runWorkflowTest(reviewWorkflow, {
      input: { subjectRef: "HEAD" },
      agents: {
        reviewer: {
          status: "done",
          summary: "Invalid output shape",
          output: { subjectRef: "HEAD" }, // missing summary
        },
      },
    });
    expect(stepSchemaFail.ok).toBe(true);
    expect(stepSchemaFail.status).toBe("blocked");
    expect(stepSchemaFail.steps[0]?.status).toBe("error");
    expect((stepSchemaFail.steps[0]?.facts as any)?.invalidOutput).toEqual({ subjectRef: "HEAD" });

    const unconsumed = await runWorkflowTest(reviewWorkflow, {
      input: { subjectRef: "HEAD" },
      agents: {
        reviewer: [
          { output: { subjectRef: "HEAD", summary: "first" } },
          { output: { subjectRef: "HEAD", summary: "unused second" } },
        ],
      },
    });
    expect(unconsumed.ok).toBe(false);
    expect(unconsumed.unconsumedFixtures).toEqual([{ kind: "agent", target: "reviewer", remaining: 1 }]);

    const badOutputMod = {
      name: "bad-out",
      description: "Returns invalid outputSchema",
      outputSchema: Type.Object({ count: Type.Number() }),
      async execute(ctx: WorkflowContext) {
        return ctx.done("bad", { count: "not-a-number" } as any);
      },
    };
    const outFail = await runWorkflowTest(badOutputMod, { input: {} });
    expect(outFail.ok).toBe(false);
    expect(outFail.error).toBeInstanceOf(WorkflowValidationError);
    expect((outFail.report.result?.facts as any)?.invalidOutput).toEqual({ count: "not-a-number" });
  });

  test("aborts and joins active sibling calls on throw/abort and fences late floating calls", async () => {
    let siblingAborted = false;
    let siblingSettled = false;
    let lateAgentRejection: unknown;
    let lateEventRejection: unknown;

    const parallelMod = {
      name: "parallel-join",
      description: "Joins sibling calls before returning",
      async execute(ctx: WorkflowContext) {
        const slowSibling = ctx.call("slow", "work");
        const fastFail = ctx.call("fast", "fail");
        try {
          await fastFail;
        } finally {
          void Promise.resolve().then(async () => {
            await new Promise((r) => setTimeout(r, 25));
            try {
              await ctx.call("late", "after completion");
            } catch (err) {
              lateAgentRejection = err;
            }
            try {
              await ctx.events.emit({ type: "late.event", data: {} });
            } catch (err) {
              lateEventRejection = err;
            }
          });
        }
        await slowSibling;
        return ctx.done("unreachable");
      },
    };

    const run = await runWorkflowTest(parallelMod, {
      input: {},
      events: { emit: async () => undefined },
      agents: {
        slow: async ({ signal }) => {
          await new Promise<void>((resolve) => {
            signal.addEventListener(
              "abort",
              () => {
                siblingAborted = true;
                setTimeout(() => {
                  siblingSettled = true;
                  resolve();
                }, 15);
              },
              { once: true },
            );
          });
          return { status: "interrupted", summary: "cancelled" };
        },
        fast: async () => {
          throw new Error("fast branch boom");
        },
      },
    });

    expect(run.ok).toBe(false);
    expect(siblingAborted).toBe(true);
    expect(siblingSettled).toBe(true);

    await new Promise((r) => setTimeout(r, 40));
    expect(String(lateAgentRejection)).toContain("context is closed");
    expect(String(lateEventRejection)).toContain("context is closed");
  });

  test("enforces inherited deadline, shared concurrency allowance, isolated observers, and cleanup confirmation", async () => {
    const nestedChild = {
      name: "child-wf",
      description: "Nested workflow",
      async execute(ctx: WorkflowContext) {
        // Attempting to acquire a 2nd concurrent slot while parent holds slot #1 must fail immediately.
        await ctx.call("worker", "nested work");
        return ctx.done("child done");
      },
    };
    const parentDeadlockMod = {
      name: "parent-wf",
      description: "Calls nested workflow under maxConcurrentCalls=1",
      async execute(ctx: WorkflowContext) {
        await ctx.call("child-wf", {});
        return ctx.done("parent done");
      },
    };

    const saturated = await runWorkflowTest(parentDeadlockMod, {
      input: {},
      maxConcurrentCalls: 1,
      workflows: { "child-wf": nestedChild },
      agents: { worker: { summary: "ok" } },
    });
    expect(saturated.ok).toBe(false);
    expect(saturated.error).toBeInstanceOf(WorkflowAllowanceExhaustedError);

    // Observer throws/rejects are isolated; unconfirmed cleanup fails the run while retaining contribution.
    const simpleMod = {
      name: "cleanup-and-observer",
      description: "Tests observer isolation and cleanup confirmation",
      async execute(ctx: WorkflowContext) {
        ctx.log.info("step note");
        await ctx.call("worker", "run");
        return ctx.done("completed work", { value: 42 });
      },
    };

    const observerRun = await runWorkflowTest(simpleMod, {
      input: {},
      agents: { worker: { summary: "ok" } },
      onStep: () => {
        throw new Error("sync step observer exploded");
      },
      onLog: () => {
        throw new Error("sync log observer exploded");
      },
    });
    expect(observerRun.ok).toBe(true);
    expect(observerRun.report.observerErrors).toHaveLength(2);

    const dirtyCleanup = await runWorkflowTest(simpleMod, {
      input: {},
      agents: { worker: { summary: "ok", cleanupConfirmed: false, sessionId: "s_leaked" } },
    });
    expect(dirtyCleanup.ok).toBe(false);
    expect(dirtyCleanup.error).toBeInstanceOf(WorkflowUnconfirmedCleanupError);
    expect(dirtyCleanup.report.cleanup.confirmed).toBe(false);
    expect(dirtyCleanup.report.result).toEqual({
      type: "done",
      summary: "completed work",
      output: { value: 42 },
    });
  });

  test("preserves unconfirmed child cleanup even when parent catches nested workflow failure", async () => {
    const leakyChild = {
      name: "leaky-child",
      description: "Nested workflow with unconfirmed step cleanup",
      async execute(ctx: WorkflowContext) {
        await ctx.call("worker", "leak");
        return ctx.done("child done");
      },
    };
    const catchingParent = {
      name: "catching-parent",
      description: "Catches child error and returns done",
      async execute(ctx: WorkflowContext) {
        try {
          await ctx.call("leaky-child", {});
        } catch {
          // Business code tries to recover, but resource cleanup taint must survive.
        }
        return ctx.done("recovered despite child error", { recovered: true });
      },
    };

    const run = await runWorkflowTest(catchingParent, {
      input: {},
      workflows: { "leaky-child": leakyChild },
      agents: { worker: { summary: "ok", cleanupConfirmed: false, sessionId: "s_nested_leak" } },
    });

    expect(run.ok).toBe(false);
    expect(run.status).toBe("error");
    expect(run.error).toBeInstanceOf(WorkflowUnconfirmedCleanupError);
    expect(run.report.cleanup).toEqual({
      confirmed: false,
      unconfirmed: ["agent:worker (s_nested_leak)"],
    });
    expect(run.report.result).toEqual({
      type: "done",
      summary: "recovered despite child error",
      output: { recovered: true },
    });
  });

  test("enforces shorter per-step timeoutMs before workflow deadline for cooperative and late-resolving fixtures", async () => {
    let cooperativeSignalAborted = false;
    const cooperativeTimeoutMod = {
      name: "step-timeout-cooperative",
      description: "Cancels cooperative fixture at step timeoutMs",
      async execute(ctx: WorkflowContext) {
        await ctx.call("slow", "bounded step", { timeoutMs: 25 });
        return ctx.done("unreachable");
      },
    };

    const started = Date.now();
    const coopRun = await runWorkflowTest(cooperativeTimeoutMod, {
      input: {},
      timeoutMs: 5_000,
      agents: {
        slow: async ({ signal }) => {
          await new Promise<void>((_, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                cooperativeSignalAborted = true;
                reject(signal.reason);
              },
              { once: true },
            );
          });
          return { summary: "unreachable" };
        },
      },
    });
    expect(coopRun.ok).toBe(false);
    expect(cooperativeSignalAborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(String(coopRun.error)).toContain('Agent step "slow" timed out after 25ms');
    expect(coopRun.steps).toHaveLength(1);
    expect(coopRun.steps[0]?.status).toBe("error");
    expect(coopRun.steps[0]?.id).toBeNull();

    // Non-cooperative fixture ignoring signal and returning after stepDeadlineAt is still rejected.
    const lateFixtureRun = await runWorkflowTest(cooperativeTimeoutMod, {
      input: {},
      timeoutMs: 5_000,
      agents: {
        slow: async () => {
          await new Promise((r) => setTimeout(r, 45));
          return { id: "s_late", status: "done", summary: "too late" };
        },
      },
    });
    expect(lateFixtureRun.ok).toBe(false);
    expect(String(lateFixtureRun.error)).toContain('Agent step "slow" timed out after 25ms');
    expect(lateFixtureRun.steps[0]?.status).toBe("error");
    expect(lateFixtureRun.steps[0]?.id).toBe("s_late");
  });

  test("records rejected agent and nested-workflow calls in report.steps and onStep across caught and uncaught failures", async () => {
    const observedSteps: Array<{ target: string; status: string; id: string | null }> = [];
    const failingChild = {
      name: "failing-child",
      description: "Throws after starting",
      async execute(_ctx: WorkflowContext): Promise<never> {
        throw new Error("nested explosion");
      },
    };

    // 1. Caught failures: workflow recovers and returns done, while failed steps remain visible in trace.
    const caughtMod = {
      name: "caught-failures",
      description: "Catches failed agent and nested workflow calls",
      async execute(ctx: WorkflowContext) {
        try {
          await ctx.call("missing-agent", "try missing");
        } catch {
          // caught unstarted agent failure
        }
        try {
          await ctx.call("failing-child", { x: 1 });
        } catch {
          // caught started nested workflow failure
        }
        const ok = await ctx.call("worker", "fallback work");
        return ctx.done(ok.summary);
      },
    };

    const caughtRun = await runWorkflowTest(caughtMod, {
      input: {},
      workflows: { "failing-child": failingChild },
      agents: { worker: { summary: "fallback succeeded" } },
      onStep: (step) => observedSteps.push({ target: step.target, status: step.status, id: step.id }),
    });
    expect(caughtRun.ok).toBe(true);
    expect(caughtRun.steps).toHaveLength(3);
    expect(caughtRun.steps[0]).toMatchObject({
      kind: "agent",
      target: "missing-agent",
      prompt: "try missing",
      status: "error",
      id: null,
      error: { message: expect.stringContaining('unconfigured agent "missing-agent"') },
    });
    expect(caughtRun.steps[1]).toMatchObject({
      kind: "workflow",
      target: "failing-child",
      status: "error",
      id: expect.stringMatching(/^wr_/),
      error: { message: "nested explosion" },
    });
    expect(caughtRun.steps[2]).toMatchObject({
      kind: "agent",
      target: "worker",
      status: "done",
      id: "s_test_worker_2",
    });
    expect(observedSteps).toHaveLength(3);

    // 2. Uncaught failure: rejected call is still recorded in report.steps before bubbling out.
    const uncaughtRun = await runWorkflowTest(
      {
        name: "uncaught-failure",
        description: "Propagates rejected agent call",
        async execute(ctx: WorkflowContext) {
          await ctx.call("boom", "explode");
          return ctx.done("unreachable");
        },
      },
      {
        input: {},
        agents: {
          boom: async () => {
            throw new Error("provider socket reset");
          },
        },
      },
    );
    expect(uncaughtRun.ok).toBe(false);
    expect(uncaughtRun.steps).toHaveLength(1);
    expect(uncaughtRun.steps[0]).toMatchObject({
      kind: "agent",
      target: "boom",
      prompt: "explode",
      status: "error",
      id: null,
      error: { message: "provider socket reset" },
    });
  });

  test("preserves optional read.tasks.workload override in createTestAppRead and runWorkflowTest", async () => {
    const workloadRun = await runWorkflowTest(
      {
        name: "workload-reader",
        description: "Reads tasks.workload",
        async execute(ctx: WorkflowContext) {
          const page = await ctx.read.tasks.workload!({ limit: 5 });
          return ctx.done("read workload", page);
        },
      },
      {
        input: {},
        read: {
          tasks: {
            list: async () => ({ items: [] }),
            outcomes: async () => ({
              projection: "outcomes",
              manifestVersion: null,
              sourceCount: 0,
              outcomeCount: 0,
              outcomes: [],
            }),
            get: async () => null,
            workload: async ({ limit } = {}) =>
              ({ items: [], summary: { requestedLimit: limit ?? 0 } }) as any,
          },
        },
      },
    );
    expect(workloadRun.ok).toBe(true);
    expect(workloadRun.result?.output).toEqual({
      items: [],
      summary: { requestedLimit: 5 },
    });
  });

  test("routes test-context calls through an explicitly supplied unified caller", async () => {
    const calls: string[] = [];
    const call = (async (target: string) => {
      calls.push(target);
      return { id: "s_test", kind: "agent", status: "done", summary: target };
    }) as WorkflowContext["call"];
    const ctx = createTestAppWorkflowContext({ input: {}, call });
    await ctx.call("unified", "input");
    expect(calls).toEqual(["unified"]);
  });

  test("uses a queued mock's explicit kind before validating call options", async () => {
    const run = await runWorkflowTest({
      name: "caller", description: "Calls code with string input",
      async execute(ctx: WorkflowContext) {
        return ctx.call("code", "input", { skill: "prompt-only" });
      },
    }, { input: {}, mocks: { code: [{ kind: "workflow", summary: "must not run" }] } });
    expect(run.ok).toBe(false);
    expect(String(run.error)).toContain('Call option "skill" is only supported for prompt targets');
    expect(run.unconsumedFixtures).toEqual([{ kind: "workflow", target: "code", remaining: 1 }]);
  });

  test.each(["blocked", "error", "interrupted"] as const)(
    "preserves %s code contribution evidence even when it does not satisfy the completion schema",
    async (status) => {
      const run = await runWorkflowTest({
        name: "caller",
        description: "Preserves partial child evidence",
        async execute(ctx: WorkflowContext) {
          const child = await ctx.call("owner/child", {}, {
            schema: Type.Object({ completed: Type.Boolean() }),
          });
          return ctx.done("received", child);
        },
      }, {
        input: {},
        mocks: { "owner/child": { status, output: { partial: true }, facts: { evidence: "retained" } } },
      });
      expect(run.ok).toBe(true);
      expect(run.result).toMatchObject({ output: {
        status, output: { partial: true }, facts: { evidence: "retained" },
      } });
      expect(run.steps[0]).toMatchObject({ status, output: { partial: true } });
    },
  );

  test.each([{ skill: "review" }, { operationAllowance: 2 }])(
    "classifies a string-input prompt mock before validating prompt-only options: %j",
    async (options) => {
      const run = await runWorkflowTest({
        name: "caller",
        description: "Calls an ordinary prompt mock",
        async execute(ctx: WorkflowContext) {
          const child = await ctx.call("reviewer", "Review HEAD", options);
          return ctx.done(child.summary);
        },
      }, { input: {}, mocks: { reviewer: { summary: "reviewed" } } });
      expect(run.ok).toBe(true);
      expect(run.result).toMatchObject({ type: "done", summary: "reviewed" });
      expect(run.steps[0]?.kind).toBe("agent");
      expect(run.unconsumedFixtures).toEqual([]);
    },
  );

  test("supports unified ctx.call, resolveCallable, mocks, dual output schemas, and readonly enforcement", async () => {
    const childCodeMod = {
      name: "child-proc",
      description: "Readonly code procedure",
      readonly: true as const,
      inputSchema: Type.Object({ item: Type.String({ minLength: 1 }) }),
      outputSchema: Type.Object({ item: Type.String(), score: Type.Number() }),
      async execute(ctx: AgentContext<{ item: string }>) {
        expect(ctx.reviseTask).toBeUndefined();
        expect(ctx.closeTask).toBeUndefined();
        expect(ctx.applyTaskChanges).toBeUndefined();
        const promptStep = await ctx.call("reviewer", `Check ${ctx.input.item}`);
        return ctx.done(promptStep.summary, { item: ctx.input.item, score: 95 });
      },
    };

    const snapshot = {
      prompts: new Map([["reviewer", { owner: "reviewer", definition: { name: "reviewer" } }]]),
      proceduresByOwner: new Map([["owner", new Map([["child-proc", childCodeMod]])]]),
    };
    expect(resolveCallable("owner", "child-proc", snapshot)).toMatchObject({
      kind: "code",
      name: "child-proc",
      owner: "owner",
      readonly: true,
    });
    expect(resolveCallable("owner", "owner/child-proc", snapshot)).toMatchObject({
      kind: "code",
      name: "child-proc",
      owner: "owner",
    });
    expect(resolveCallable("owner", "reviewer", snapshot)).toMatchObject({
      kind: "prompt",
      name: "reviewer",
      owner: "reviewer",
    });
    expect(() => resolveCallable("other", "child-proc", snapshot)).toThrow(
      'Callable target "child-proc" not found for owner "other"',
    );

    const parentMod = {
      name: "parent-proc",
      description: "Calls child code and prompt via ctx.call",
      async execute(ctx: AgentContext<{ item: string }>) {
        const res = await ctx.call("owner/child-proc", { item: ctx.input.item }, {
          tools: "readonly",
          schema: Type.Object({
            item: Type.String(),
            score: Type.Number({ minimum: 90 }),
          }),
        });
        return ctx.done("unified call ok", res.output);
      },
    };

    const run = await runWorkflowTest(parentMod, {
      input: { item: "alpha" },
      reviseTask: async () => ({} as any),
      mocks: {
        "owner/child-proc": childCodeMod,
        reviewer: { status: "done", summary: "reviewed alpha" },
      },
    });
    expect(run.ok).toBe(true);
    expect(run.result).toEqual({
      type: "done",
      summary: "unified call ok",
      output: { item: "alpha", score: 95 },
    });
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]).toMatchObject({
      kind: "workflow",
      target: "owner/child-proc",
      prompt: '{"item":"alpha"}',
      status: "done",
    });

    // Rejects calling a non-readonly code module with tools: "readonly"
    const mutatingMod = {
      name: "mutating-proc",
      description: "Mutating procedure without readonly: true",
      async execute(ctx: AgentContext) {
        return ctx.done("mutated");
      },
    };
    const readonlyRejected = await runWorkflowTest(
      {
        name: "caller",
        description: "Calls mutating procedure with readonly",
        async execute(ctx: AgentContext) {
          await ctx.call("owner/mutating-proc", {}, { tools: "readonly" });
          return ctx.done("unreachable");
        },
      },
      {
        input: {},
        mocks: { "owner/mutating-proc": mutatingMod },
      },
    );
    expect(readonlyRejected.ok).toBe(false);
    expect(String(readonlyRejected.error)).toContain('cannot run with tools: "readonly"');

    // Rejects prompt-only options (skill / operationAllowance) on code targets
    const skillOnCode = await runWorkflowTest(
      {
        name: "caller-skill",
        description: "Passes skill to code target",
        async execute(ctx: AgentContext) {
          await ctx.call("owner/child-proc", { item: "beta" }, { skill: "some-skill" });
          return ctx.done("unreachable");
        },
      },
      {
        input: {},
        mocks: { "owner/child-proc": childCodeMod },
      },
    );
    expect(skillOnCode.ok).toBe(false);
    expect(String(skillOnCode.error)).toContain('Call option "skill" is only supported for prompt targets');

    // SDK-only string target execution via runWorkflowTest
    expect(typeof listTargets).toBe("function");
    const sdkDirectPrompt = await runWorkflowTest("reviewer", {
      input: "Check HEAD",
      tools: "readonly",
      mocks: {
        reviewer: ({ task, options }) => ({
          status: "done",
          summary: `SDK prompt: ${task} (${options?.tools ?? "default"})`,
          facts: { checkedFiles: 3 },
        }),
      },
    });
    expect(sdkDirectPrompt.ok).toBe(true);
    expect(sdkDirectPrompt.result).toEqual({
      type: "done",
      summary: "SDK prompt: Check HEAD (readonly)",
      facts: { checkedFiles: 3 },
    });

    for (const nonSuccessStatus of ["blocked", "error", "interrupted"] as const) {
      const nonSuccessRun = await runWorkflowTest("reviewer", {
        input: "Check HEAD",
        mocks: {
          reviewer: {
            status: nonSuccessStatus,
            summary: `ended:${nonSuccessStatus}`,
            output: { partial: true },
            facts: { reasonCode: nonSuccessStatus },
          },
        },
      });
      expect(nonSuccessRun.ok).toBe(true);
      expect(nonSuccessRun.status).toBe(nonSuccessStatus);
      expect(nonSuccessRun.result).toMatchObject({
        type: nonSuccessStatus,
        reason: `ended:${nonSuccessStatus}`,
        output: { partial: true },
        facts: { reasonCode: nonSuccessStatus },
      });
    }

    const sdkDirectCode = await runWorkflowTest("owner/review-change", {
      input: { subjectRef: "HEAD~1..HEAD" },
      mocks: {
        "owner/review-change": reviewWorkflow,
        reviewer: {
          status: "done",
          summary: "Clean diff",
          output: {
            subjectRef: "HEAD~1..HEAD",
            verdict: "pass",
            summary: "All good",
          },
        },
      },
    });
    expect(sdkDirectCode.ok).toBe(true);
    expect(sdkDirectCode.result?.type).toBe("done");

    const sdkStandaloneRun = await sdkRun("reviewer", "Audit via @may-agent/sdk/standalone", {
      tools: "readonly",
      models: {},
      agentFixtures: {
        reviewer: async (call) => ({
          id: "sdk_run_1",
          kind: "agent",
          status: "done",
          summary: `SDK run: ${call.task} (${call.options?.tools ?? "full"})`,
        }),
      },
    });
    expect(sdkStandaloneRun.ok).toBe(true);
    expect(sdkStandaloneRun.result).toEqual({
      type: "done",
      summary: "SDK run: Audit via @may-agent/sdk/standalone (readonly)",
    });
  });
});
