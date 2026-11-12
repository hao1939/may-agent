import { describe, expect, test } from "bun:test";
import { Type, type Static, type WorkflowContext } from "./index.js";
import { runWorkflowTest } from "./testing.js";
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
  requires: { agents: ["reviewer"] },
  async execute(ctx: WorkflowContext<Static<typeof ReviewInput>>) {
    ctx.log.info(`reviewing ${ctx.input.subjectRef}`);
    const review = await ctx.agents.call("reviewer", `Review ${ctx.input.subjectRef}`, {
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

  test("rejects invalid input and missing required capabilities before execute() runs", async () => {
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

    const missingAgent = await runWorkflowTest(mod, {
      input: { subjectRef: "HEAD" },
      agents: {},
    });
    expect(missingAgent.ok).toBe(false);
    expect(missingAgent.started).toBe(false);
    expect(missingAgent.error).toBeInstanceOf(WorkflowValidationError);
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
        const slowSibling = ctx.agents.call("slow", "work");
        const fastFail = ctx.agents.call("fast", "fail");
        try {
          await fastFail;
        } finally {
          void Promise.resolve().then(async () => {
            await new Promise((r) => setTimeout(r, 25));
            try {
              await ctx.agents.call("late", "after completion");
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
        await ctx.agents.call("worker", "nested work");
        return ctx.done("child done");
      },
    };
    const parentDeadlockMod = {
      name: "parent-wf",
      description: "Calls nested workflow under maxConcurrentCalls=1",
      async execute(ctx: WorkflowContext) {
        await ctx.workflows.run("child-wf", {});
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
        await ctx.agents.call("worker", "run");
        return ctx.done("completed work", { value: 42 });
      },
    };

    const observerRun = await runWorkflowTest(simpleMod, {
      input: {},
      agents: { worker: { summary: "ok" } },
      onStep: async () => {
        throw new Error("async observer exploded");
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
        await ctx.agents.call("worker", "leak");
        return ctx.done("child done");
      },
    };
    const catchingParent = {
      name: "catching-parent",
      description: "Catches child error and returns done",
      async execute(ctx: WorkflowContext) {
        try {
          await ctx.workflows.run("leaky-child", {});
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

  test("bounds non-settling async observers instead of hanging completed workflow invocations", async () => {
    const mod = {
      name: "fast-done",
      description: "Returns done while observers hang",
      async execute(ctx: WorkflowContext) {
        ctx.log.info("observer log");
        await ctx.agents.call("worker", "quick");
        return ctx.done("finished");
      },
    };

    const started = Date.now();
    const run = await runWorkflowTest(mod, {
      input: {},
      observerDrainMs: 20,
      agents: { worker: { summary: "ok" } },
      onStep: () => new Promise<void>(() => {}),
      onLog: () => new Promise<void>(() => {}),
    });
    const elapsed = Date.now() - started;

    expect(run.ok).toBe(true);
    expect(run.status).toBe("done");
    expect(elapsed).toBeLessThan(500);
    expect(run.report.observerErrors.some((msg) => msg.includes("Timed out after 20ms"))).toBe(true);
  });
});
