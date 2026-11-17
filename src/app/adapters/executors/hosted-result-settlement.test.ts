import { expect, test } from "bun:test";
import type { AppDefinition, AppTaskBlockedSettlement } from "@may-agent/sdk/app";
import { run, type RunResult } from "@may-agent/sdk/standalone";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskAgentInput } from "../../core/tasks/execution.js";
import { translateHostedExecutionResult } from "./hosted-result-settlement.js";

function input(app: Partial<AppDefinition> = {}): TaskAgentInput {
  return {
    descriptor: {
      id: "sample",
      appDir: "/portable/sample.app",
      projectDir: "/portable/sample",
      app: {
        id: "sample",
        version: 1,
        agent: "owner",
        inputSchema: { type: "object" },
        ...app,
      } as AppDefinition,
    },
    attempt: {
      task: { id: "work", generation: 1, outcome: "Finish the bounded work" },
    },
  } as unknown as TaskAgentInput;
}

function runResult(
  contribution: Record<string, unknown> | undefined,
  overrides: Partial<RunResult> = {},
): RunResult {
  return {
    ok: true,
    started: true,
    status: "done",
    result: contribution,
    report: {
      executionId: "run-1",
      cleanup: { confirmed: true },
    },
    childSessions: [],
    ...overrides,
  } as unknown as RunResult;
}

test("done preserves domain objects containing state instead of admitting them as Task commands", () => {
  const output = { state: "waiting", status: "domain-only", nested: { state: "done" } };
  const translated = translateHostedExecutionResult(
    runResult({ type: "done", summary: "Domain work complete", output, facts: { source: "fixture" } }),
    input(),
  );
  expect(translated).toMatchObject({
    hostCompletion: "finite-done",
    runId: "run-1",
    handlerResult: {
      state: "converged",
      summary: "Domain work complete",
      result: output,
      facts: ['execution-facts:{"source":"fixture"}'],
    },
  });
});

test("settles the actual public run() result from a pure code procedure", async () => {
  const root = mkdtempSync(join(tmpdir(), "hosted-result-settlement-"));
  try {
    const workflowDir = join(root, "projects", "sample.app", "agents", "owner", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(root, "projects", "sample.app", "app.ts"), "export default {};\n");
    writeFileSync(
      join(root, "projects", "sample.app", "agents", "owner", "agent.json"),
      JSON.stringify({ name: "owner", description: "Fixture owner", domain: "test", model: "test", tools: ["finish"] }),
    );
    writeFileSync(join(root, "projects", "sample.app", "agents", "owner", "AGENTS.md"), "# Fixture owner\n");
    writeFileSync(
      join(workflowDir, "finite.ts"),
      `export const name = "finite";
export const description = "Truthful finite fixture";
export async function execute(ctx) {
  return ctx.done("fixture complete", { state: "domain-data", value: ctx.input.value });
}
`,
    );
    const publicResult = await run("owner/finite", { value: 42 }, { projectRoot: root, models: {} });
    expect(publicResult.ok).toBe(true);
    expect(translateHostedExecutionResult(publicResult, input())).toMatchObject({
      hostCompletion: "finite-done",
      handlerResult: {
        state: "converged",
        result: { state: "domain-data", value: 42 },
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("settles oversized facts from the actual public run() without inventing a workflow reference", async () => {
  const root = mkdtempSync(join(tmpdir(), "hosted-result-large-facts-"));
  try {
    const workflowDir = join(root, "projects", "sample.app", "agents", "owner", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(root, "projects", "sample.app", "app.ts"), "export default {};\n");
    writeFileSync(
      join(root, "projects", "sample.app", "agents", "owner", "agent.json"),
      JSON.stringify({ name: "owner", description: "Fixture owner", domain: "test", model: "test", tools: ["finish"] }),
    );
    writeFileSync(join(root, "projects", "sample.app", "agents", "owner", "AGENTS.md"), "# Fixture owner\n");
    writeFileSync(
      join(workflowDir, "blocked.ts"),
      `export const name = "blocked";
export const description = "Oversized public evidence fixture";
export async function execute(ctx) {
  return { ...ctx.blocked("fixture blocked", { payload: "x".repeat(9000) }), output: false };
}
`,
    );
    const publicResult = await run("owner/blocked", {}, { projectRoot: root, models: {} });
    const facts = { payload: "x".repeat(9000) };
    expect(publicResult.ok).toBe(true);
    expect(translateHostedExecutionResult(publicResult, input())).toMatchObject({
      handlerBlocked: true,
      handlerResult: {
        state: "waiting",
        result: { value: false },
        facts: [`execution-facts:${JSON.stringify(facts)}`],
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.each([
  [false, { value: false }],
  [null, { value: null }],
  ["plain", { value: "plain" }],
  [17, { value: 17 }],
] as const)("done preserves primitive output %p", (output, expected) => {
  expect(
    translateHostedExecutionResult(runResult({ type: "done", summary: "Complete", output }), input()).handlerResult.result,
  ).toEqual(expected);
});

test("done output is admitted before Host finite-completion provenance is granted", () => {
  const maxTaskResultBytes = 16 * 1024;
  const wrapperBytes = new TextEncoder().encode(JSON.stringify({ value: "" })).byteLength;
  const boundaryOutput = "x".repeat(maxTaskResultBytes - wrapperBytes);
  const admitted = translateHostedExecutionResult(
    runResult({ type: "done", summary: "Boundary output", output: boundaryOutput }),
    input(),
  );
  expect(admitted).toMatchObject({
    hostCompletion: "finite-done",
    runId: "run-1",
    handlerResult: { state: "converged", result: { value: boundaryOutput } },
  });

  const rejected = translateHostedExecutionResult(
    runResult({
      type: "done",
      summary: "Oversized output",
      output: `${boundaryOutput}x`,
      facts: Array.from({ length: 33 }, (_, index) => `fact-${index + 1}`),
    }),
    input(),
  );
  expect(rejected).toMatchObject({
    runId: "run-1",
    handlerResult: {
      state: "error",
      resultRejected: true,
      summary: expect.stringContaining("16384-byte limit"),
    },
  });
  expect(rejected.hostCompletion).toBeUndefined();
});

test("done without output remains an admitted finite completion", () => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "done", summary: "No output required" }),
    input(),
  );
  expect(translated).toMatchObject({
    hostCompletion: "finite-done",
    handlerResult: { state: "converged", summary: "No output required" },
  });
  expect(translated.handlerResult.result).toBeUndefined();
});

test("large public fact arrays retain exact evidence through the Task-compatible fallback", () => {
  const facts = Array.from({ length: 33 }, (_, index) => `fact-${index + 1}`);
  const serialized = `execution-facts:${JSON.stringify(facts)}`;

  const blocked = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Await external review", facts }),
    input(),
  );
  expect(blocked).toMatchObject({
    handlerBlocked: true,
    handlerResult: { state: "waiting", facts: [serialized] },
  });
  expect(blocked.handlerResult.resultRejected).toBeUndefined();

  const done = translateHostedExecutionResult(
    runResult({ type: "done", summary: "Evidence complete", facts }),
    input(),
  );
  expect(done).toMatchObject({
    hostCompletion: "finite-done",
    handlerResult: { state: "converged", facts: [serialized] },
  });

  const direct = facts.slice(0, 32);
  expect(
    translateHostedExecutionResult(runResult({ type: "done", summary: "Direct evidence", facts: direct }), input())
      .handlerResult.facts,
  ).toEqual(direct);
});

test.each(["done", "blocked"] as const)("oversized public %s facts remain inline and lossless", (type) => {
  const facts = { payload: "x".repeat(9000) };
  const translated = translateHostedExecutionResult(
    runResult(type === "done"
      ? { type, summary: "Evidence complete", facts }
      : { type, reason: "Await external review", facts }),
    input(),
  );
  expect(translated.handlerResult.facts).toEqual([`execution-facts:${JSON.stringify(facts)}`]);
  expect(translated.handlerResult.facts[0]).not.toContain("workflow-run:");
});

test.each([
  ["done", "empty", ["", "observed"]],
  ["done", "spaces", ["  "]],
  ["done", "tabs and newlines", ["\t", "observed\nvalue"]],
  ["blocked", "empty", ["", "observed"]],
  ["blocked", "spaces", ["  "]],
  ["blocked", "tabs and newlines", ["\t", "observed\nvalue"]],
] as const)("%s public fact arrays with blank entries use exact JSON fallback: %s", (type, _label, facts) => {
  const serialized = `execution-facts:${JSON.stringify(facts)}`;
  const translated = translateHostedExecutionResult(
    runResult(
      type === "done"
        ? { type, summary: "Evidence complete", facts }
        : { type, reason: "Await external review", facts },
    ),
    input(),
  );

  if (type === "done") {
    expect(translated).toMatchObject({
      hostCompletion: "finite-done",
      handlerResult: { state: "converged", facts: [serialized] },
    });
  } else {
    expect(translated).toMatchObject({
      handlerBlocked: true,
      handlerResult: { state: "waiting", facts: [serialized] },
    });
    expect(translated.hostCompletion).toBeUndefined();
  }
  expect(translated.handlerResult.resultRejected).toBeUndefined();
});

test("blocked uses the App translator and controlled clock for continuation, Conditions and requests", () => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Await review", facts: { phase: "review" }, output: false }),
    input({
      tasks: {
        translateBlockedResult: ({ facts }) => ({
          retryAfterMs: (facts as { phase: string }).phase === "review" ? 250 : 500,
          conditions: [
            { id: "approval", type: "review.approved", subject: "change:1", owner: "agent:reviewer", expected: true },
            { requestId: "review" },
          ],
          requests: [{ id: "review", appId: "evaluation", input: { kind: "review", data: {} } }],
          actions: [{
            kind: "retire-condition",
            conditionId: "obsolete-review",
            expectedConditionGeneration: 1,
            reason: "The new review supersedes the old wait",
          }],
          report: true,
        }),
      },
    }),
    { now: () => 1_000 },
  );
  expect(translated).toMatchObject({
    handlerBlocked: true,
    handlerResult: {
      state: "waiting",
      reviewAt: 1_250,
      result: { value: false },
      report: true,
      conditions: [{ id: "approval" }, { requestId: "review" }],
      requests: [{ id: "review", appId: "evaluation" }],
      actions: [{ kind: "retire-condition", conditionId: "obsolete-review" }],
    },
  });
});

test.each([
  [false, { value: false }],
  [null, { value: null }],
  [{ checkpoint: "partial" }, { checkpoint: "partial" }],
] as const)("blocked preserves non-Task checkpoint data %p", (output, expected) => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Checkpoint retained", output, facts: ["checkpoint:saved"] }),
    input({ tasks: { translateBlockedResult: () => ({ continue: true }) } }),
  );
  expect(translated).toMatchObject({
    handlerBlocked: true,
    handlerResult: {
      state: "waiting",
      continue: true,
      result: expected,
      facts: ["checkpoint:saved"],
    },
  });
});

test("blocked translator null intentionally retains an unqualified wait", () => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Wait without a fabricated prerequisite", output: { checkpoint: 1 } }),
    input({ tasks: { translateBlockedResult: () => null } }),
  );
  expect(translated).toMatchObject({
    handlerBlocked: true,
    handlerResult: {
      state: "waiting",
      summary: "Wait without a fabricated prerequisite",
      result: { checkpoint: 1 },
    },
  });
  expect(translated.handlerResult.reviewAt).toBeUndefined();
  expect(translated.handlerResult.conditions).toBeUndefined();
  expect(translated.handlerResult.requests).toBeUndefined();
});

class NonPlainWaitDescriptor {
  retryAfterMs = 25;
}

test.each([
  ["undefined", undefined],
  ["Promise", Promise.resolve({ retryAfterMs: 25 })],
  ["unsupported key", { retryAfterMss: 25 }],
  ["nonplain object", new NonPlainWaitDescriptor()],
] as const)("blocked translator rejects %s instead of silently admitting an empty wait", (_label, malformed) => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Malformed translated wait" }),
    input({
      tasks: {
        translateBlockedResult: () => malformed as unknown as AppTaskBlockedSettlement | null,
      },
    }),
  );
  expect(translated).toMatchObject({
    handlerBlocked: true,
    handlerResult: { state: "error", resultRejected: true },
  });
});

test("blocked fallback accepts only the explicit lightweight wait descriptor", () => {
  const translated = translateHostedExecutionResult(
    runResult({
      type: "blocked",
      reason: "Continue later",
      facts: { retryAfterMs: 50, conditions: [{ requestId: "saved-review" }] },
    }),
    input(),
    { now: () => 2_000 },
  );
  expect(translated.handlerResult).toMatchObject({
    state: "waiting",
    reviewAt: 2_050,
    conditions: [{ requestId: "saved-review" }],
  });

  const domainFacts = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Domain wait", facts: { state: "awaiting_ci", status: false } }),
    input(),
  );
  expect(domainFacts.handlerResult.state).toBe("waiting");
  expect(domainFacts.handlerResult.reviewAt).toBeUndefined();
  expect(domainFacts.handlerResult.facts).toEqual([
    'execution-facts:{"state":"awaiting_ci","status":false}',
  ]);
});

test("bad hints and rejected App validation are contract failures, not empty success", () => {
  const mixed = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Bad hint", facts: { retryAfterMs: 10, domain: "extra" } }),
    input(),
  );
  expect(mixed.handlerResult).toMatchObject({ state: "error", resultRejected: true });

  const rejected = translateHostedExecutionResult(
    runResult({
      type: "blocked",
      reason: "Rejected wait",
      facts: { conditions: [{ id: "approval", type: "review.approved", subject: "change:1", owner: "agent:reviewer", expected: true }] },
    }),
    input({ tasks: { validateCondition: () => "observer is unavailable" } }),
  );
  expect(rejected.handlerResult).toMatchObject({
    state: "error",
    resultRejected: true,
    summary: expect.stringContaining("observer is unavailable"),
  });
});

test.each([
  ["actions null", { actions: null }],
  ["actions object", { actions: {} }],
  ["actions string", { actions: "retire" }],
  ["report false", { report: false }],
  ["report null", { report: null }],
  ["report string", { report: "true" }],
  ["report number", { report: 1 }],
  ["continue false", { continue: false }],
  ["continue null", { continue: null }],
  ["continue string", { continue: "true" }],
  ["continue number", { continue: 1 }],
] as const)("blocked translator rejects supplied invalid descriptor value: %s", (_label, descriptor) => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Malformed descriptor", facts: ["checkpoint:saved"] }),
    input({ tasks: { translateBlockedResult: () => descriptor as unknown as AppTaskBlockedSettlement } }),
  );
  expect(translated).toMatchObject({
    handlerBlocked: true,
    handlerResult: { state: "error", resultRejected: true, actions: [] },
  });
  expect(translated.handlerResult.reviewAt).toBeUndefined();
  expect(translated.handlerResult.conditions).toBeUndefined();
  expect(translated.handlerResult.requests).toBeUndefined();
});

test.each([
  ["absent", {}],
  ["actions undefined", { actions: undefined }],
  ["report undefined", { report: undefined }],
  ["continue undefined", { continue: undefined }],
  ["all optional controls undefined", { actions: undefined, report: undefined, continue: undefined }],
] as const)("blocked translator treats optional undefined controls as omitted: %s", (_label, descriptor) => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Checkpoint retained", facts: ["checkpoint:saved"] }),
    input({ tasks: { translateBlockedResult: () => descriptor } }),
  );
  expect(translated).toMatchObject({
    handlerBlocked: true,
    handlerResult: { state: "waiting", facts: ["checkpoint:saved"], actions: [] },
  });
  expect(translated.handlerResult.report).toBeUndefined();
  expect(translated.handlerResult.continue).toBeUndefined();
  expect(translated.handlerResult.resultRejected).toBeUndefined();
});

test.each([
  ["report", { report: true }],
  ["continue", { continue: true }],
  ["report and continue", { report: true, continue: true }],
  ["actions", { actions: [{ kind: "retire-condition", conditionId: "resolved", expectedConditionGeneration: 1, reason: "Verified" }] }],
] as const)("Host diagnostics cannot provide contribution evidence for %s", (_label, settlement) => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "No agent evidence", facts: [] }),
    input({ tasks: { translateBlockedResult: () => settlement } }),
    { diagnosticFacts: ["workflow-blocker-context:[]"] },
  );
  expect(translated).toMatchObject({
    handlerBlocked: true,
    handlerResult: {
      state: "error",
      resultRejected: true,
      summary: expect.stringContaining("Host diagnostics are not agent evidence"),
      facts: ["execution-run:run-1"],
      actions: [],
    },
  });
});

test.each(["", "   ", "\t\n"])("blank scalar facts remain lossless for an ordinary wait: %p", (facts) => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Wait without progress claim", facts }),
    input({ tasks: { translateBlockedResult: () => null } }),
  );
  expect(translated.handlerResult).toMatchObject({
    state: "waiting",
    facts: [`execution-facts:${JSON.stringify(facts)}`],
  });
  expect(translated.handlerResult.resultRejected).toBeUndefined();
});

test.each([
  ["report", { report: true }],
  ["continue", { continue: true }],
  ["report and continue", { report: true, continue: true }],
  ["actions", { actions: [{ kind: "retire-condition", conditionId: "resolved", expectedConditionGeneration: 1, reason: "Verified" }] }],
] as const)("blank scalar facts cannot support %s", (_label, settlement) => {
  for (const facts of ["", "   ", "\t\n"]) {
    const translated = translateHostedExecutionResult(
      runResult({ type: "blocked", reason: "No progress", facts }),
      input({ tasks: { translateBlockedResult: () => settlement } }),
    );
    expect(translated.handlerResult).toMatchObject({ state: "error", resultRejected: true });
  }
});

test.each([
  [false, "execution-facts:false"],
  [null, "execution-facts:null"],
  [{ inspected: false }, 'execution-facts:{"inspected":false}'],
  ["observed", "execution-facts:\"observed\""],
  [["", false, "  ", "observed"], 'execution-facts:["",false,"  ","observed"]'],
] as const)("valid domain progress facts remain eligible: %p", (facts, storedFact) => {
  const translated = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Domain progress", facts }),
    input({ tasks: { translateBlockedResult: () => ({ report: true, continue: true }) } }),
  );
  expect(translated.handlerResult).toMatchObject({
    state: "waiting",
    report: true,
    continue: true,
    facts: [storedFact],
  });
});

test("domain facts remain eligible while a real Condition can wait without facts", () => {
  const progress = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Domain progress", facts: { inspected: false } }),
    input({ tasks: { translateBlockedResult: () => ({ report: true, continue: true }) } }),
  );
  expect(progress.handlerResult).toMatchObject({
    state: "waiting",
    report: true,
    continue: true,
    facts: ['execution-facts:{"inspected":false}'],
  });

  const wait = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Await review" }),
    input({ tasks: { translateBlockedResult: () => ({
      retryAfterMs: 25,
      conditions: [{ requestId: "review" }],
    }) } }),
    { now: () => 100 },
  );
  expect(wait.handlerResult).toMatchObject({
    state: "waiting",
    reviewAt: 125,
    conditions: [{ requestId: "review" }],
    facts: [],
  });
  expect(wait.handlerResult.resultRejected).toBeUndefined();
});

test("blocked translator actions and reports use ordinary Task admission", () => {
  const action = {
    kind: "retire-condition" as const,
    conditionId: "resolved",
    expectedConditionGeneration: 1,
    reason: "Resolution was verified",
  };
  const denied = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Another wait remains", facts: ["review:resolved"] }),
    input({ tasks: {
      translateBlockedResult: () => ({ actions: [action], report: true }),
      validateAction: () => "retirement denied by App policy",
    } }),
  );
  expect(denied.handlerResult).toMatchObject({
    state: "error",
    resultRejected: true,
    summary: expect.stringContaining("retirement denied by App policy"),
  });

  const malformedReport = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "No evidence supplied" }),
    input({ tasks: { translateBlockedResult: () => ({ report: true }) } }),
  );
  expect(malformedReport.handlerResult).toMatchObject({
    state: "error",
    resultRejected: true,
    summary: expect.stringContaining("require non-empty contribution facts"),
  });

  const malformedAction = translateHostedExecutionResult(
    runResult({ type: "blocked", reason: "Malformed retirement", facts: ["review:resolved"] }),
    input({ tasks: { translateBlockedResult: () => ({ actions: [{ kind: "retire-condition" }] }) as AppTaskBlockedSettlement } }),
  );
  expect(malformedAction.handlerResult).toMatchObject({
    state: "error",
    resultRejected: true,
    summary: expect.stringContaining("actions[0].conditionId must be a non-empty string"),
  });
});

test.each(["error", "interrupted"] as const)("%s execution cannot succeed from nested done output", (status) => {
  const translated = translateHostedExecutionResult(
    runResult(
      { type: "done", summary: "Nested done", output: { state: "converged" } },
      { ok: false, status },
    ),
    input(),
  );
  expect(translated).toMatchObject({ executionFailed: true, handlerResult: { state: "error" } });
  expect(translated.hostCompletion).toBeUndefined();
});

test("unconfirmed cleanup is unsuccessful even when execution returned done", () => {
  const result = runResult({ type: "done", summary: "Nested done", output: { value: 1 } });
  (result.report as { cleanup: unknown }).cleanup = { confirmed: false, unconfirmed: ["agent:child"] };
  const translated = translateHostedExecutionResult(result, input());
  expect(translated).toMatchObject({
    executionFailed: true,
    handlerResult: { state: "error", facts: ["execution-run:run-1", "execution-cleanup-unconfirmed:agent:child"] },
  });
});
