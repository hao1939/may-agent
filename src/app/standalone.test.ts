import { afterEach, describe, expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
  WorkflowValidationError,
} from "@may-agent/sdk/testing";
import { Type } from "typebox";
import { executePreparedAgent } from "../lib/agent-execution.js";
import { runCliAgent } from "../lib/cli-agent.js";
import { fakeModel } from "../../test/fixtures/model.js";
import { usageReply } from "../../test/fixtures/execution-usage.js";
import { controlledWorkflowImport, observeBoundedResult } from "../../test/fixtures/workflow-import.js";
import { prepareDirectAgentExecution, type DirectAgentRunResult } from "./direct-agent.js";
import { listStandaloneTargets, run, runDirect, runDirectWorkflow } from "./standalone.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function setupDirectLayout() {
  const root = mkdtempSync(join(tmpdir(), "may-direct-workflow-"));
  roots.push(root);
  const projectRoot = join(root, "install");
  const workRoot = join(root, "work");
  const agentsRoot = join(projectRoot, "agents");
  const sharedRoot = join(projectRoot, "shared");
  const outputRoot = join(root, "output");
  const traceDir = join(root, "trace");
  mkdirSync(workRoot, { recursive: true });
  mkdirSync(sharedRoot, { recursive: true });

  for (const [name, tools, promptText] of [
    ["owner", ["coding", "workflow", "checkpoint", "finish"], "Owner instructions"],
    ["reviewer", ["coding", "agents", "finish"], "Lab-forked reviewer instructions v2"],
  ] as const) {
    const dir = join(agentsRoot, name);
    mkdirSync(join(dir, "workflows"), { recursive: true });
    writeFileSync(
      join(dir, "agent.json"),
      JSON.stringify({
        name,
        description: `${name} agent`,
        domain: "test",
        model: "test",
        tools,
      }),
    );
    writeFileSync(join(dir, "AGENTS.md"), `# ${name}\n\n${promptText}\n`);
  }

  writeFileSync(
    join(agentsRoot, "owner", "workflows", "review-change.ts"),
    `
export const name = "review-change";
export const description = "Review one ref with schema check";
export const inputSchema = {
  type: "object",
  properties: { subjectRef: { type: "string", minLength: 1 } },
  required: ["subjectRef"],
  additionalProperties: false,
};
const ReviewSchema = {
  type: "object",
  properties: {
    subjectRef: { type: "string", minLength: 1 },
    verdict: { type: "string", enum: ["pass", "changes-needed"] },
    summary: { type: "string", minLength: 1 },
  },
  required: ["subjectRef", "summary"],
  additionalProperties: false,
};
export async function execute(ctx) {
  ctx.log.info("starting direct review");
  const review = await ctx.call("reviewer", "Inspect " + ctx.input.subjectRef, {
    schema: ReviewSchema,
  });
  if (!review.output) {
    return ctx.blocked("Missing review output", { review });
  }
  return ctx.done("Reviewed " + ctx.input.subjectRef, {
    review: review.output,
    workspaceRoot: ctx.workspace?.root,
  });
}
`,
  );

  return { root, projectRoot, workRoot, agentsRoot, sharedRoot, outputRoot, traceDir };
}

describe("runDirectWorkflow & createDirectWorkflowTool (Host-free Gym support)", () => {
  test("runs workflow with lab-overlaid agentsRoot, denies hosted tools, and writes run.json without SQLite/EventBus", async () => {
    const env = setupDirectLayout();
    const seenCalls: Array<{ agent: string; systemPrompt: string; effectiveTools: string[] }> = [];

    const run = await runDirectWorkflow({
      agentName: "owner",
      workflowName: "review-change",
      input: { subjectRef: "HEAD~1..HEAD" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      traceDir: env.traceDir,
      models: { test: { id: "test-model" } as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        // Prepare real direct agent to verify prompt overlay + hosted tool denial manifest!
        const prep = await prepareDirectAgentExecution(opts);
        try {
          seenCalls.push({
            agent: opts.agentName,
            systemPrompt: prep.prepared.systemPrompt,
            effectiveTools: prep.executionManifest.effectiveTools,
          });
          mkdirSync(prep.sessionPath, { recursive: true });
          writeFileSync(join(prep.sessionPath, "session.jsonl"), '{"role":"assistant"}\n');
          return {
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            status: "done",
            lastAssistantText: "Reviewed",
            messages: [],
            durationMs: 12,
            finishResult: {
              status: "success",
              summary: "Reviewed cleanly",
              result: {
                subjectRef: "HEAD~1..HEAD",
                verdict: "pass",
                summary: "Looks good",
              },
            },
            structuredResult: {
              subjectRef: "HEAD~1..HEAD",
              verdict: "pass",
              summary: "Looks good",
            },
            usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally {
          prep.cleanup();
        }
      },
    });

    expect(run.ok).toBe(true);
    expect(run.status).toBe("done");
    expect(seenCalls).toHaveLength(1);
    expect(seenCalls[0]?.systemPrompt).toContain("Lab-forked reviewer instructions v2");
    expect(seenCalls[0]?.effectiveTools).not.toContain("agents");
    expect(run.result).toMatchObject({
      type: "done",
      summary: "Reviewed HEAD~1..HEAD",
      output: {
        review: { subjectRef: "HEAD~1..HEAD", verdict: "pass", summary: "Looks good" },
        workspaceRoot: env.workRoot,
      },
    });
    expect(run.reportPath).toBe(join(env.traceDir, "run.json"));
    expect(existsSync(run.reportPath!)).toBe(true);
    const persistedReport = JSON.parse(readFileSync(run.reportPath!, "utf8"));
    expect(persistedReport.steps).toHaveLength(1);
    expect(persistedReport.steps[0].transcriptPath).toEndWith("session.jsonl");
    expect(persistedReport.cleanup).toEqual({ confirmed: true });
  });

  test("surfaces unconfirmed descendant cleanup as an explicit error while retaining workspace and report evidence", async () => {
    const env = setupDirectLayout();
    writeFileSync(join(env.workRoot, "candidate.txt"), "important evidence");

    const run = await runDirectWorkflow({
      agentName: "owner",
      workflowName: "review-change",
      input: { subjectRef: "HEAD" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      traceDir: env.traceDir,
      models: { test: { id: "test-model" } as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => ({
        sessionId: "s_stuck",
        sessionPath: join(opts.outputRoot, "sessions", "s_stuck"),
        systemPrompt: "",
        model: "test",
        executionManifest: { agent: opts.agentName, configuredTools: [], deniedTools: [], effectiveTools: [] },
        status: "done",
        lastAssistantText: "Done",
        messages: [],
        durationMs: 5,
        finishResult: {
          status: "success",
          summary: "Done",
          result: { subjectRef: "HEAD", summary: "ok" },
        },
        structuredResult: { subjectRef: "HEAD", summary: "ok" },
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
        cleanupConfirmed: false,
      }),
    });

    expect(run.ok).toBe(false);
    expect(run.status).toBe("error");
    expect(run.error).toBeInstanceOf(WorkflowUnconfirmedCleanupError);
    expect(run.report.cleanup).toEqual({
      confirmed: false,
      unconfirmed: ["agent:reviewer (s_stuck)"],
    });
    expect(run.report.result?.type).toBe("done");
    expect(readFileSync(join(env.workRoot, "candidate.txt"), "utf8")).toBe("important evidence");
  });

  test("enforces shared root maxConcurrentCalls across nested workflows", async () => {
    const env = setupDirectLayout();
    const ownerWorkflowsDir = join(env.agentsRoot, "owner", "workflows");
    writeFileSync(
      join(ownerWorkflowsDir, "outer.ts"),
      `
export const name = "outer";
export const description = "Calls nested review-change";
export async function execute(ctx) {
  return ctx.call("review-change", { subjectRef: "HEAD" });
}
`,
    );

    const saturated = await runDirectWorkflow({
      agentName: "owner",
      workflowName: "outer",
      input: {},
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: { id: "test-model" } as any },
      maxConcurrentCalls: 1,
      agentFixtures: {
        reviewer: async () => ({
          id: "s_1",
          kind: "agent",
          status: "done",
          summary: "ok",
          output: { subjectRef: "HEAD", summary: "ok" },
        }),
      },
    });
    expect(saturated.ok).toBe(false);
    expect(saturated.error).toBeInstanceOf(WorkflowAllowanceExhaustedError);
  });

  test("forwards readonly toolPolicy after concrete and local tool expansion in direct agent steps", async () => {
    const env = setupDirectLayout();
    const reviewerToolsDir = join(env.agentsRoot, "reviewer", "tools");
    mkdirSync(reviewerToolsDir, { recursive: true });
    writeFileSync(
      join(reviewerToolsDir, "custom-mutate.ts"),
      `
export default function createCustomTool() {
  return {
    name: "custom_mutate",
    label: "custom_mutate",
    description: "Mutating local tool",
    parameters: { type: "object", properties: {} },
    async execute() { return { content: [{ type: "text", text: "mutated" }] }; },
  };
}
`,
    );

    let effectiveTools: string[] = [];
    const run = await runDirectWorkflow({
      module: {
        name: "readonly-step",
        description: "Calls coding+local agent with readonly policy",
        async execute(ctx) {
          const res = await ctx.call("reviewer", "Inspect only", { tools: "readonly" });
          return ctx.done(res.summary);
        },
      },
      input: {},
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        try {
          effectiveTools = prep.executionManifest.effectiveTools;
          return {
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            status: "done",
            lastAssistantText: "Inspected",
            messages: [],
            durationMs: 5,
            finishResult: { status: "success", summary: "Inspected safely" },
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally {
          prep.cleanup();
        }
      },
    });

    expect(run.ok).toBe(true);
    expect(effectiveTools).toEqual(["read", "finish"]);
  });

  test("enforces maxDepth at entry, isolates nested executionIds, and pins captured agent.json config across mid-flight disk edits", async () => {
    const env = setupDirectLayout();
    const ownerWorkflowsDir = join(env.agentsRoot, "owner", "workflows");
    writeFileSync(
      join(ownerWorkflowsDir, "nested-pair.ts"),
      `
export const name = "nested-pair";
export const description = "Runs two nested workflows and returns their IDs";
export async function execute(ctx) {
  const first = await ctx.call("review-change", { subjectRef: "A" });
  const second = await ctx.call("review-change", { subjectRef: "B" });
  return ctx.done("pair", { parentId: ctx.done("probe").id, firstId: first.id, secondId: second.id });
}
`,
    );

    // 1. Explicit executionId applies only to root; nested workflows receive distinct IDs.
    const distinctIds = await runDirectWorkflow({
      executionId: "wr_explicit_root",
      agentName: "owner",
      workflowName: "nested-pair",
      input: {},
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      agentFixtures: {
        reviewer: async ({ task }) => ({
          id: "s_rev",
          kind: "agent",
          status: "done",
          summary: "ok",
          output: { subjectRef: task.replace("Inspect ", ""), summary: "ok" },
        }),
      },
    });
    expect(distinctIds.ok).toBe(true);
    expect(distinctIds.report.executionId).toBe("wr_explicit_root");
    const idsOut = distinctIds.result?.output as { parentId: string; firstId: string; secondId: string };
    expect(idsOut.parentId).toBe("wr_explicit_root");
    expect(idsOut.firstId).not.toBe("wr_explicit_root");
    expect(idsOut.secondId).not.toBe("wr_explicit_root");
    expect(idsOut.firstId).not.toBe(idsOut.secondId);

    // 2. maxDepth=1 blocks nested code calls at depth 2.
    const depthLimited = await runDirectWorkflow({
      module: {
        name: "root-depth-1",
        description: "Calls nested review-change at depth 2 with maxDepth=1",
        async execute(ctx) {
          const step = await ctx.call("owner/review-change", { subjectRef: "HEAD" });
          return ctx.done(step.summary);
        },
      },
      agentName: "owner",
      input: {},
      maxDepth: 1,
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
    });
    expect(depthLimited.ok).toBe(false);
    expect(String(depthLimited.error)).toContain("Maximum workflow nesting depth (1) exceeded");

    // 3. Captured prompt config in PreparedCatalog stays pinned even if agent.json is disabled on disk mid-run.
    let seenTools: string[] = [];
    const snapshotPinned = await runDirectWorkflow({
      module: {
        name: "mid-flight-config-edit",
        description: "Mutates reviewer agent.json on disk before calling reviewer",
        async execute(ctx) {
          writeFileSync(
            join(env.agentsRoot, "reviewer", "agent.json"),
            JSON.stringify({ name: "reviewer", disabled: true }),
          );
          const step = await ctx.call("reviewer", "Still runs from captured snapshot");
          return ctx.done(step.summary);
        },
      },
      agentName: "owner",
      input: {},
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        try {
          seenTools = prep.executionManifest.effectiveTools;
          return {
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            status: "done",
            lastAssistantText: "pinned",
            messages: [],
            durationMs: 1,
            finishResult: { status: "success", summary: "pinned-ok" },
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally {
          prep.cleanup();
        }
      },
    });
    expect(snapshotPinned.ok).toBe(true);
    expect(snapshotPinned.result).toMatchObject({ type: "done", summary: "pinned-ok" });
    expect(seenTools).toContain("finish");
  });

  test("preserves read.tasks.workload and honors step operationAllowance in real direct execution", async () => {
    const env = setupDirectLayout();
    writeFileSync(join(env.workRoot, "note.txt"), "hello allowance");

    // 1. Optional read.tasks.workload override reaches workflows in runDirectWorkflow.
    const workloadDirect = await runDirectWorkflow({
      module: {
        name: "direct-workload",
        description: "Reads workload in direct mode",
        async execute(ctx) {
          const wl = await ctx.read.tasks.workload!({ limit: 3 });
          return ctx.done("ok", wl);
        },
      },
      input: {},
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
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
          workload: async ({ limit } = {}) => ({ items: [], limit }) as any,
        },
      },
    });
    expect(workloadDirect.ok).toBe(true);
    expect(workloadDirect.result?.output).toEqual({ items: [], limit: 3 });

    // 2. Invalid operationAllowance fails immediately; operationAllowance=1 triggers bounded finish steering on call #1.
    const badAllowance = await runDirectWorkflow({
      module: {
        name: "bad-allowance",
        description: "Invalid operationAllowance",
        async execute(ctx) {
          await ctx.call("reviewer", "Check", { operationAllowance: 0 });
          return ctx.done("unreachable");
        },
      },
      input: {},
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
    });
    expect(badAllowance.ok).toBe(false);
    expect(String(badAllowance.error)).toContain("operationAllowance");

    const seenPrompts: string[][] = [];
    let turn = 0;
    const allowanceRun = await runDirectWorkflow({
      module: {
        name: "allowance-one",
        description: "Schema-less step with operationAllowance: 1",
        async execute(ctx) {
          const step = await ctx.call("reviewer", "Inspect note.txt", {
            tools: "readonly",
            operationAllowance: 1,
          });
          return ctx.done(step.summary);
        },
      },
      input: {},
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        prep.prepared.runner.streamFn = (_model, context) => {
          seenPrompts.push(
            context.messages.map((m: any) =>
              typeof m.content === "string"
                ? m.content
                : Array.isArray(m.content)
                  ? m.content.map((c: any) => c.text ?? "").join("")
                  : "",
            ),
          );
          const stream = createAssistantMessageEventStream();
          turn++;
          if (turn === 1) {
            stream.push({
              type: "done",
              reason: "toolUse",
              message: usageReply({
                stopReason: "toolUse",
                content: [{ type: "toolCall", id: "tc_read_1", name: "read", arguments: { path: "note.txt" } }],
              }),
            });
          } else {
            stream.push({
              type: "done",
              reason: "toolUse",
              message: usageReply({
                stopReason: "toolUse",
                content: [
                  {
                    type: "toolCall",
                    id: "tc_finish_1",
                    name: "finish",
                    arguments: { status: "success", summary: "Bounded after 1 operation" },
                  },
                ],
              }),
            });
          }
          return stream;
        };
        try {
          const execRes = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
            operationAllowance: opts.operationAllowance,
          });
          return {
            ...execRes,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally {
          prep.cleanup();
        }
      },
    });

    expect(allowanceRun.ok).toBe(true);
    expect(allowanceRun.result?.type === "done" ? allowanceRun.result.summary : "").toBe(
      "Bounded after 1 operation",
    );
    expect(seenPrompts).toHaveLength(2);
    expect(seenPrompts[1]?.some((msg) => msg.includes("finish()"))).toBe(true);
  });

  test.each([false, true])("excludes a malformed unused agent and retains its diagnostic (lookup=%s)", async (lookup) => {
    const env = setupDirectLayout();
    const brokenDir = join(env.agentsRoot, "broken");
    mkdirSync(brokenDir, { recursive: true });
    writeFileSync(join(brokenDir, "agent.json"), "{ malformed JSON");
    const run = await runDirectWorkflow({
      ...env, agentName: "owner", input: {}, models: {},
      module: {
        name: "healthy", description: "Independent supplied module",
        async execute(ctx) {
          if (lookup) {
            try { await ctx.call("broken", "must not run"); }
            catch (error) { return ctx.done("healthy", String(error)); }
            throw new Error("Malformed owner was admitted");
          }
          return ctx.done("healthy");
        },
      },
    });
    expect(run.ok).toBe(true);
    expect(run.result).toMatchObject({ type: "done", summary: "healthy" });
    if (lookup) {
      expect(run.result?.output).toContain("Catalog diagnostics");
      expect(run.result?.output).toContain(join(brokenDir, "agent.json"));
    }
  });

  test.each(["unused", "timeout", "cancel"])("defers unrelated imports and bounds called owner catalog preparation on %s", async (mode) => {
    const env = setupDirectLayout();
    const gate = await controlledWorkflowImport(env.root);
    const reviewerDir = join(env.agentsRoot, "reviewer", "workflows");
    const marker = join(env.root, "imported-after-stop");
    writeFileSync(join(reviewerDir, "a-slow.ts"), gate.source);
    writeFileSync(join(reviewerDir, "z-after.ts"), `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "imported");
export const name = "after";
export const description = "Must not import after cancellation";
export async function execute(ctx) { return ctx.done("after"); }
`);
    if (mode === "unused") {
      const run = await observeBoundedResult(runDirectWorkflow({
        ...env, agentName: "owner", input: {}, models: {}, timeoutMs: 500,
        module: { name: "healthy", description: "Does not touch reviewer/*", async execute(ctx) {
          return ctx.done("healthy");
        } },
      }));
      expect(run?.result.ok).toBe(true);
      expect(run?.result.result).toMatchObject({ type: "done", summary: "healthy" });
      expect(existsSync(marker)).toBe(false);
      return;
    }
    const controller = new AbortController();
    let settledAfterCall = false;
    const run = runDirectWorkflow({
      ...env, agentName: "owner", input: {}, models: {},
      signal: controller.signal, timeoutMs: mode === "timeout" ? 500 : 10_000,
      module: { name: "caller", description: "Calls reviewer/after whose catalog import stalls", async execute(ctx) {
        await ctx.call("reviewer/after", {});
        settledAfterCall = true;
        return ctx.done("must not complete");
      } },
    });
    try {
      expect(await observeBoundedResult(gate.started)).toBeDefined();
      if (mode === "cancel") controller.abort(new Error("cancel catalog preparation"));
      const stopped = await observeBoundedResult(run);
      expect(stopped).toBeDefined();
      expect(stopped?.result.ok).toBe(false);
      expect(stopped?.result.report.cleanup.confirmed).toBe(false);
    } finally {
      gate.release();
      await observeBoundedResult(gate.completed);
      await observeBoundedResult(run);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(settledAfterCall).toBe(false);
    expect(existsSync(marker)).toBe(false);
  });

  test.each(["global", "app-local"])("isolates %s callers from other Apps' procedures", async (layout) => {
    const env = setupDirectLayout();
    const projectsRoot = join(env.projectRoot, "projects");
    const foreignDir = join(projectsRoot, "foreign.app");
    const foreignOwner = join(foreignDir, "agents", "foreign-owner");
    mkdirSync(join(foreignOwner, "workflows"), { recursive: true });
    writeFileSync(join(foreignDir, "app.ts"), "export default {};");
    writeFileSync(join(foreignOwner, "agent.json"), JSON.stringify({
      name: "foreign-owner", model: "test", description: "Foreign", domain: "test", tools: [],
    }));
    writeFileSync(join(foreignOwner, "workflows", "secret.ts"), `
export const name = "secret";
export const description = "Must not be visible";
export async function execute(ctx) { return ctx.done("foreign execution"); }
`);
    let agentsRoot = env.agentsRoot;
    if (layout === "app-local") {
      const appDir = join(projectsRoot, "local.app");
      agentsRoot = join(appDir, "agents");
      mkdirSync(join(agentsRoot, "owner", "workflows"), { recursive: true });
      writeFileSync(join(appDir, "app.ts"), "export default {};");
      writeFileSync(join(agentsRoot, "owner", "agent.json"), JSON.stringify({
        name: "owner", model: "test", description: "Local", domain: "test", tools: [],
      }));
    }
    const run = await runDirectWorkflow({
      ...env, agentsRoot, projectsRoot, agentName: "owner", input: {}, models: {},
      module: { name: "caller", description: "Boundary probe", async execute(ctx) {
        const failures = [];
        for (const probe of [
          () => ctx.call("foreign-owner/secret", {}),
          () => ctx.call("foreign-owner", "probe"),
        ]) {
          try { await probe(); } catch (err) { failures.push(String(err)); }
        }
        return ctx.done("isolated", failures);
      } },
    });
    expect(run.ok).toBe(true);
    expect(run.result).toMatchObject({
      type: "done",
      output: [
        expect.stringContaining('Callable procedure "foreign-owner/secret" not found'),
        expect.stringContaining('Callable target "foreign-owner" not found'),
      ],
    });
  });

  test("executes the App-local prompt admitted by the catalog instead of resolving a global namesake", async () => {
    const env = setupDirectLayout();
    const projectsRoot = join(env.projectRoot, "projects");
    const appDir = join(projectsRoot, "local.app");
    const localAgentsRoot = join(appDir, "agents");
    for (const name of ["owner", "reviewer"]) {
      const dir = join(localAgentsRoot, name);
      mkdirSync(join(dir, "workflows"), { recursive: true });
      writeFileSync(join(dir, "agent.json"), JSON.stringify({
        name, description: "Local", domain: "test", model: "test", tools: ["finish"],
      }));
      writeFileSync(join(dir, "AGENTS.md"), `APP LOCAL ${name} INSTRUCTIONS`);
    }
    writeFileSync(join(appDir, "app.ts"), "export default {};");
    const run = await runDirectWorkflow({
      ...env, projectsRoot, agentName: "owner", workflowDir: join(localAgentsRoot, "owner", "workflows"),
      input: {}, models: { test: fakeModel() as any },
      module: { name: "caller", description: "Calls captured prompt", async execute(ctx) {
        return ctx.call("reviewer", "Review HEAD");
      } },
      runAgent: async (opts) => {
        const prep = await prepareDirectAgentExecution(opts);
        try {
          expect(prep.prepared.systemPrompt).toContain("APP LOCAL reviewer INSTRUCTIONS");
          expect(prep.prepared.systemPrompt).not.toContain("Lab-forked reviewer");
          return {
            sessionId: prep.sessionId, sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt, model: prep.model, executionManifest: prep.executionManifest,
            status: "done", lastAssistantText: "ok", messages: [], durationMs: 1,
            finishResult: { status: "success", summary: "local executed" },
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally { prep.cleanup(); }
      },
    });
    expect(run.ok).toBe(true);
    expect(run.result).toMatchObject({ type: "done", summary: "local executed" });
  });

  test("resolves local and cross-owner <owner>/<name> procedures via ctx.call while preserving Task reconciliation owner", async () => {
    const env = setupDirectLayout();
    const reviewerWorkflowsDir = join(env.agentsRoot, "reviewer", "workflows");
    writeFileSync(
      join(reviewerWorkflowsDir, "local-helper.ts"),
      `
export const name = "local-helper";
export const description = "Reviewer local helper";
export const readonly = true;
export async function execute(ctx) {
  return ctx.done("helper:" + ctx.reconciliation?.agent, {
    taskOwner: ctx.reconciliation?.agent,
    reviseExposed: Boolean(ctx.reviseTask),
  });
}
`,
    );
    writeFileSync(
      join(reviewerWorkflowsDir, "deep-review.ts"),
      `
export const name = "deep-review";
export const description = "Cross-owner procedure that calls unqualified local-helper and prompt reviewer";
export const readonly = true;
export async function execute(ctx) {
  const helper = await ctx.call("local-helper", {});
  const agentStep = await ctx.call("reviewer", "Inspect " + ctx.input.subjectRef);
  return ctx.done(helper.summary + ":" + agentStep.summary, {
    helper: helper.output,
    agentSummary: agentStep.summary,
  });
}
`,
    );
    writeFileSync(
      join(env.agentsRoot, "owner", "workflows", "delegate-cross-owner.ts"),
      `
export const name = "delegate-cross-owner";
export const description = "Owner calls reviewer/deep-review via ctx.call";
export async function execute(ctx) {
  const sub = await ctx.call("reviewer/deep-review", { subjectRef: "HEAD" }, { tools: "readonly" });
  return ctx.done(sub.summary, sub.output);
}
`,
    );

    const run = await runDirectWorkflow({
      agentName: "owner",
      workflowName: "delegate-cross-owner",
      input: {},
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      task: {
        id: "task-1",
        status: "running",
        generation: 1,
        outcome: "Verify cross-owner lexical vs Task authority owner",
        parentId: "root",
        acceptance: ["Owner stays owner"],
        input: {},
        agent: "owner",
        conditions: [],
        acceptedEvidence: { available: true, maxPageSize: 8 },
      },
      agentFixtures: {
        reviewer: async () => ({
          id: "s_rev_1",
          kind: "agent",
          status: "done",
          summary: "prompt-ok",
        }),
      },
    });

    expect(run.ok).toBe(true);
    expect(run.result).toEqual({
      type: "done",
      summary: "helper:owner:prompt-ok",
      output: {
        helper: {
          taskOwner: "owner",
          reviseExposed: false,
        },
        agentSummary: "prompt-ok",
      },
    });
  });

  test("runDirect dispatches both prompt targets and code targets through one standalone entrypoint", async () => {
    const env = setupDirectLayout();
    const promptRun = await runDirect({
      target: "reviewer",
      input: "Inspect HEAD",
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      agentFixtures: {
        reviewer: async ({ task }) => ({
          id: "s_direct_prompt",
          kind: "agent",
          status: "done",
          summary: `reviewed:${task}`,
          output: { verdict: "pass" },
        }),
      },
    });
    expect(promptRun.ok).toBe(true);
    expect(promptRun.result).toMatchObject({
      type: "done",
      summary: "reviewed:Inspect HEAD",
      output: { verdict: "pass" },
    });

    const codeRun = await runDirect({
      target: "owner/review-change",
      input: { subjectRef: "HEAD~1..HEAD" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      agentFixtures: {
        reviewer: async () => ({
          id: "s_direct_code_child",
          kind: "agent",
          status: "done",
          summary: "ok",
          output: { subjectRef: "HEAD~1..HEAD", verdict: "pass", summary: "Clean" },
        }),
      },
    });
    expect(codeRun.ok).toBe(true);
    expect(codeRun.result).toMatchObject({
      type: "done",
      summary: "Reviewed HEAD~1..HEAD",
    });

    // Regression: when agentName="owner" calls prompt target="reviewer", and reviewer also owns
    // a procedure named "reviewer", runDirect must invoke the resolved prompt (not the procedure),
    // and must forward tools: "readonly" without failing readonly module checks.
    writeFileSync(
      join(env.agentsRoot, "reviewer", "workflows", "reviewer.ts"),
      `
export const name = "reviewer";
export const description = "Procedure with same name as owning prompt agent";
export const readonly = true;
export async function execute(ctx) {
  return ctx.done("wrong-procedure-invoked");
}
`,
    );
    let seenToolsPolicy: string | undefined;
    const collisionAndReadonlyRun = await runDirect({
      agentName: "owner",
      target: "reviewer",
      input: "Readonly prompt check",
      tools: "readonly",
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      agentFixtures: {
        reviewer: async ({ task, options: stepOpts }) => {
          seenToolsPolicy = stepOpts?.tools;
          return {
            id: "s_direct_readonly_prompt",
            kind: "agent",
            status: "done",
            summary: `prompt:${task}`,
          };
        },
      },
    });
    expect(collisionAndReadonlyRun.ok).toBe(true);
    expect(seenToolsPolicy).toBe("readonly");
    expect(collisionAndReadonlyRun.result).toMatchObject({
      type: "done",
      summary: "prompt:Readonly prompt check",
    });

    // Exercise the real executeCliStep adapter (not agentFixtures.codex):
    let seenCliProjectRoot: string | undefined;
    const codexSchema = Type.Object({ ok: Type.Boolean(), files: Type.Number() });
    const codexRun = await run("codex", "Inspect package.json", {
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      outputSchema: codexSchema,
      models: { test: fakeModel() as any },
      runCli: async (cliInput, cliOpts) => {
        seenCliProjectRoot = cliOpts.projectRoot;
        expect(cliInput.tool).toBe("codex");
        expect(cliInput.expectedOutput).toEqual({ format: "json" });
        return {
          taskId: "cli_codex_real",
          tool: "codex",
          status: "completed",
          summary: "Inspected JSON",
          outputText: JSON.stringify({ ok: true, files: 4 }),
          cleanupConfirmed: true,
          resultPath: "/tmp/result.md",
          structuredResultPath: "/tmp/result.json",
          eventsPath: "/tmp/events.jsonl",
          factsRefs: [],
          effectiveSandbox: "danger-full-access",
        };
      },
    });
    expect(codexRun.ok).toBe(true);
    expect(seenCliProjectRoot).toBe(env.workRoot);
    expect(codexRun.result).toEqual({
      type: "done",
      summary: "Inspected JSON",
      output: { ok: true, files: 4 },
      facts: {
        tool: "codex",
        resultPath: "/tmp/result.md",
        eventsPath: "/tmp/events.jsonl",
      },
    });

    // Reject readonly native CLI calls before spawning:
    let spawnedOnReadonly = false;
    const readonlyCliRejected = await run("codex", "Must not run", {
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      tools: "readonly",
      models: {},
      runCli: async () => {
        spawnedOnReadonly = true;
        throw new Error("unreachable");
      },
    });
    expect(readonlyCliRejected.ok).toBe(false);
    expect(spawnedOnReadonly).toBe(false);
    expect(String(readonlyCliRejected.error)).toContain('cannot enforce tools: "readonly"');

    // Propagate unconfirmed CLI process-group drain:
    const failedDrainCli = await run("codex", "Spawn leaky child", {
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      models: {},
      runCli: async () => ({
        taskId: "cli_leaky",
        tool: "codex",
        status: "failed",
        summary: "CLI process group did not drain",
        error: "CLI process group did not drain",
        cleanupConfirmed: false,
        resultPath: "/tmp/result.md",
        structuredResultPath: "/tmp/result.json",
        eventsPath: "/tmp/events.jsonl",
        factsRefs: [],
        effectiveSandbox: "danger-full-access",
      }),
    });
    expect(failedDrainCli.ok).toBe(false);
    expect(failedDrainCli.error).toBeInstanceOf(WorkflowUnconfirmedCleanupError);
    expect(failedDrainCli.report.cleanup.confirmed).toBe(false);
  });

  test.each(["timeout", "cancel"] as const)(
    "bounds root runDirect({ target }) catalog preparation on %s and reports unconfirmed import cleanup",
    async (mode) => {
      const env = setupDirectLayout();
      const gate = await controlledWorkflowImport(env.root);
      const reviewerDir = join(env.agentsRoot, "reviewer", "workflows");
      const marker = join(env.root, "imported-after-root-stop");
      writeFileSync(join(reviewerDir, "a-slow.ts"), gate.source);
      writeFileSync(
        join(reviewerDir, "z-probe.ts"),
        `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "imported");
export const name = "probe";
export const description = "Must not import after root target timeout/cancel";
export async function execute(ctx) { return ctx.done("probe"); }
`,
      );
      const controller = new AbortController();
      const run = runDirect({
        ...env,
        agentName: "owner",
        target: "reviewer/probe",
        input: {},
        models: {},
        signal: controller.signal,
        timeoutMs: mode === "timeout" ? 500 : 10_000,
      });
      try {
        expect(await observeBoundedResult(gate.started)).toBeDefined();
        if (mode === "cancel") controller.abort(new Error("cancel root target preparation"));
        const stopped = await observeBoundedResult(run);
        expect(stopped).toBeDefined();
        expect(stopped?.result.ok).toBe(false);
        expect(stopped?.result.started).toBe(false);
        expect(stopped?.result.error).toBeInstanceOf(WorkflowUnconfirmedCleanupError);
        expect(stopped?.result.report.cleanup.confirmed).toBe(false);
      } finally {
        gate.release();
        await observeBoundedResult(gate.completed);
        await observeBoundedResult(run);
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      expect(existsSync(marker)).toBe(false);
    },
  );

  test("handles malformed sibling workflow without unhandledRejection, preserves pinned helper revision on workflowName runs, carries prep deadline, and rejects expired deadline before import", async () => {
    const env = setupDirectLayout();
    const ownerDir = join(env.agentsRoot, "owner", "workflows");

    // 1. Malformed sibling workflow + pinned helper revision on workflowName runs:
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const helperPath = join(ownerDir, "pinned-helper.ts");
      writeFileSync(
        join(ownerDir, "a-malformed.ts"),
        `export const name = 123;\n`, // invalid export fails validation in loadWorkflowModuleFromFile
      );
      writeFileSync(
        helperPath,
        `
export const name = "pinned-helper";
export const description = "Initial helper v1";
export async function execute(ctx) { return ctx.done("v1"); }
`,
      );
      writeFileSync(
        join(ownerDir, "mutate-and-call.ts"),
        `
import { writeFileSync } from "node:fs";
export const name = "mutate-and-call";
export const description = "Mutates helper on disk after root prep and calls it";
export async function execute(ctx) {
  writeFileSync(${JSON.stringify(helperPath)}, \`
export const name = "pinned-helper";
export const description = "Mutated helper v2";
export async function execute(ctx) { return ctx.done("v2"); }
\`);
  const sub = await ctx.call("pinned-helper", {});
  return ctx.done("ran:" + sub.summary);
}
`,
      );
      const pinnedRun = await runDirectWorkflow({
        ...env,
        agentName: "owner",
        workflowName: "mutate-and-call",
        input: {},
        models: {},
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
      expect(unhandled).toEqual([]);
      expect(pinnedRun.ok).toBe(true);
      expect(pinnedRun.result).toMatchObject({ type: "done", summary: "ran:v1" });
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }

    // 2. Expired deadline fails before starting any catalog import:
    const importMarker = join(env.root, "expired-should-not-import");
    writeFileSync(
      join(env.agentsRoot, "reviewer", "workflows", "marker.ts"),
      `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(importMarker)}, "started");
export const name = "marker";
export const description = "Should not import when deadlineAt is already expired";
export async function execute(ctx) { return ctx.done("ok"); }
`,
    );
    const expiredRun = await runDirect({
      ...env,
      agentName: "owner",
      target: "reviewer/marker",
      input: {},
      models: {},
      deadlineAt: Date.now() - 100,
    });
    expect(expiredRun.ok).toBe(false);
    expect(expiredRun.started).toBe(false);
    expect(String(expiredRun.error)).toContain("deadline expired");
    expect(existsSync(importMarker)).toBe(false);

    // 3. Preparation time counts against the shared execution budget:
    const budgetDir = join(env.agentsRoot, "reviewer", "workflows");
    writeFileSync(
      join(budgetDir, "slow-prep-then-exec.ts"),
      `
await new Promise((r) => setTimeout(r, 180));
export const name = "slow-prep-then-exec";
export const description = "Consumes 180ms during import and 180ms during execute";
export async function execute(ctx) {
  await new Promise((r, reject) => {
    const t = setTimeout(r, 180);
    ctx.signal.addEventListener("abort", () => { clearTimeout(t); reject(ctx.signal.reason); }, { once: true });
  });
  return ctx.done("should-have-timed-out");
}
`,
    );
    const budgetRun = await runDirect({
      ...env,
      agentName: "owner",
      target: "reviewer/slow-prep-then-exec",
      input: {},
      models: {},
      timeoutMs: 260,
    });
    expect(budgetRun.ok).toBe(false);
    expect(String(budgetRun.error)).toContain("timed out");

    // 4. Module-declared executionTimeoutMs takes precedence over caller fallback timeoutMs across target/workflowName entrypoints:
    writeFileSync(
      join(budgetDir, "longer-module-timeout.ts"),
      `
export const name = "longer-module-timeout";
export const description = "Module declares 1000ms timeout while caller supplies 100ms fallback";
export const executionTimeoutMs = 1000;
export async function execute(ctx) {
  await new Promise((r, reject) => {
    const t = setTimeout(r, 180);
    ctx.signal.addEventListener("abort", () => { clearTimeout(t); reject(ctx.signal.reason); }, { once: true });
  });
  return ctx.done("completed-within-module-timeout");
}
`,
    );
    const parityRun = await runDirect({
      ...env,
      agentName: "owner",
      target: "reviewer/longer-module-timeout",
      input: {},
      models: {},
      timeoutMs: 100,
    });
    expect(parityRun.ok).toBe(true);
    expect(parityRun.result).toMatchObject({
      type: "done",
      summary: "completed-within-module-timeout",
    });
  });

  test("auto-discovers App-local owners in run(target, input) without --app, enforces dual outputSchema, prefers local procedures named codex, and skips prompt owner procedure imports", async () => {
    const env = setupDirectLayout();
    const projectsRoot = join(env.projectRoot, "projects");
    const appDir = join(projectsRoot, "alpha.app");
    const alphaAgentDir = join(appDir, "agents", "alpha-lead");
    mkdirSync(join(alphaAgentDir, "workflows"), { recursive: true });
    writeFileSync(join(appDir, "app.ts"), "export default {};\n");
    writeFileSync(
      join(alphaAgentDir, "agent.json"),
      JSON.stringify({
        name: "alpha-lead",
        description: "Alpha App lead",
        domain: "test",
        model: "test",
        tools: ["finish"],
      }),
    );
    writeFileSync(join(alphaAgentDir, "AGENTS.md"), "# alpha-lead\n");
    writeFileSync(
      join(alphaAgentDir, "workflows", "verify-alpha.ts"),
      `
export const name = "verify-alpha";
export const description = "Module with loose outputSchema";
export const outputSchema = {
  type: "object",
  properties: { score: { type: "number" } },
  required: ["score"],
  additionalProperties: false,
};
export async function execute(ctx) {
  return ctx.done("scored", { score: ctx.input.score });
}
`,
    );
    // Local procedure named "codex" must take precedence over built-in codex CLI executor:
    writeFileSync(
      join(alphaAgentDir, "workflows", "codex.ts"),
      `
export const name = "codex";
export const description = "Local procedure named codex";
export async function execute(ctx) {
  return ctx.done("local-codex-procedure", { received: ctx.input });
}
`,
    );

    // 1. Auto-discovers alpha-lead/verify-alpha in projects/alpha.app without `app` option:
    const autoRun = await run(
      "alpha-lead/verify-alpha",
      { score: 95 },
      {
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
      },
    );
    expect(autoRun.ok).toBe(true);
    expect(autoRun.result).toEqual({
      type: "done",
      summary: "scored",
      output: { score: 95 },
    });

    // 2. Caller outputSchema is enforced in addition to module.outputSchema:
    const stricterCallerSchemaFail = await run(
      "alpha-lead/verify-alpha",
      { score: 50 }, // passes module.outputSchema (Number), fails caller outputSchema (minimum: 90)
      {
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
        outputSchema: Type.Object({ score: Type.Number({ minimum: 90 }) }),
      },
    );
    expect(stricterCallerSchemaFail.ok).toBe(false);
    expect(stricterCallerSchemaFail.error).toBeInstanceOf(WorkflowValidationError);

    // 3. Local procedure named "codex" wins over native CLI executor when agentName="alpha-lead":
    const localCodexProc = await run(
      "codex",
      { customObject: true },
      {
        projectRoot: env.projectRoot,
        agentName: "alpha-lead",
        models: { test: fakeModel() as any },
        runCli: async () => {
          throw new Error("Native codex CLI must not intercept local procedure");
        },
      },
    );
    expect(localCodexProc.ok).toBe(true);
    expect(localCodexProc.result).toEqual({
      type: "done",
      summary: "local-codex-procedure",
      output: { received: { customObject: true } },
    });

    // 4. Bare root prompt target `run("reviewer", ...)` does not import reviewer/workflows/*.ts:
    const gate = await controlledWorkflowImport(env.root);
    writeFileSync(join(env.agentsRoot, "reviewer", "workflows", "stalled-unused.ts"), gate.source);
    try {
      const barePrompt = await observeBoundedResult(
        run("reviewer", "Fast prompt without importing workflows", {
          projectRoot: env.projectRoot,
          timeoutMs: 500,
          models: { test: fakeModel() as any },
          agentFixtures: {
            reviewer: async ({ task }) => ({
              id: "s_fast_prompt",
              kind: "agent",
              status: "done",
              summary: `fast:${task}`,
            }),
          },
        }),
      );
      expect(barePrompt?.result.ok).toBe(true);
      expect(barePrompt?.result.result).toMatchObject({
        type: "done",
        summary: "fast:Fast prompt without importing workflows",
      });
    } finally {
      gate.release();
    }
  });

  test("recovers App-local prompt callerProjectId without agentFixtures, admits global agents from App procedures, enforces explicit App scope, defaults workRoot to cwd, retains scratch outputRoot on unconfirmed cleanup, supports array outputSchema on CLI runner, and lists exported procedure names", async () => {
    const env = setupDirectLayout();
    const projectsRoot = join(env.projectRoot, "projects");
    const alphaAppDir = join(projectsRoot, "alpha.app");
    const betaAppDir = join(projectsRoot, "beta.app");
    const alphaLeadDir = join(alphaAppDir, "agents", "alpha-lead");
    const betaOwnerDir = join(betaAppDir, "agents", "beta-owner");

    mkdirSync(join(alphaLeadDir, "workflows"), { recursive: true });
    mkdirSync(join(betaOwnerDir, "workflows"), { recursive: true });
    writeFileSync(join(alphaAppDir, "app.ts"), "export default {};\n");
    writeFileSync(join(betaAppDir, "app.ts"), "export default {};\n");

    writeFileSync(
      join(alphaLeadDir, "agent.json"),
      JSON.stringify({
        name: "alpha-lead",
        description: "Alpha App lead",
        domain: "test",
        model: "test",
        tools: ["finish"],
      }),
    );
    writeFileSync(join(alphaLeadDir, "AGENTS.md"), "# alpha-lead\n");

    writeFileSync(
      join(betaOwnerDir, "agent.json"),
      JSON.stringify({
        name: "beta-owner",
        description: "Beta App owner",
        domain: "test",
        model: "test",
        tools: ["finish"],
      }),
    );
    writeFileSync(join(betaOwnerDir, "AGENTS.md"), "# beta-owner\n");
    writeFileSync(
      join(betaOwnerDir, "workflows", "beta-probe.ts"),
      `
export const name = "beta-probe";
export const description = "Beta procedure";
export async function execute(ctx) {
  return ctx.done("beta-ran");
}
`,
    );

    // File named z-aliased.ts exporting name = "aliased-proc" (and calling global "reviewer"):
    writeFileSync(
      join(alphaLeadDir, "workflows", "z-aliased.ts"),
      `
export const name = "aliased-proc";
export const description = "Aliased procedure calling global reviewer";
export async function execute(ctx) {
  const step = await ctx.call("reviewer", "Check from App procedure");
  return ctx.done("alpha->global:" + step.summary);
}
`,
    );
    // Duplicate exported name in another file to verify ambiguity exclusion in listStandaloneTargets:
    writeFileSync(
      join(betaOwnerDir, "workflows", "dup-a.ts"),
      `
export const name = "dup-proc";
export const description = "Duplicate A";
export async function execute(ctx) { return ctx.done("a"); }
`,
    );
    writeFileSync(
      join(betaOwnerDir, "workflows", "dup-b.ts"),
      `
export const name = "dup-proc";
export const description = "Duplicate B";
export async function execute(ctx) { return ctx.done("b"); }
`,
    );

    // 1. Bare App-local prompt target AND App-prefixed prompt target WITHOUT agentFixtures:
    const seenRunAgentWorkRoots: string[] = [];
    const nestedCwd = join(env.workRoot, "nested-repo");
    mkdirSync(nestedCwd, { recursive: true });

    for (const promptTarget of ["alpha-lead", "alpha.app/alpha-lead"] as const) {
      const bareAppPrompt = await run(promptTarget, "Run bare App prompt", {
        cwd: nestedCwd,
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
        runAgent: async (agentOpts) => {
          seenRunAgentWorkRoots.push(agentOpts.workRoot);
          return {
            sessionId: "s_alpha_prompt",
            sessionPath: join(agentOpts.outputRoot, "s_alpha_prompt"),
            status: "completed",
            lastAssistantText: "done",
            messages: [],
            durationMs: 5,
            finishResult: {
              status: "success",
              summary: `ran:${agentOpts.agentName}:${agentOpts.task}`,
            },
          };
        },
      });
      expect(bareAppPrompt.ok).toBe(true);
      expect(bareAppPrompt.result).toMatchObject({
        type: "done",
        summary: "ran:alpha-lead:Run bare App prompt",
      });
    }
    // 2. workRoot defaults to cwd (nestedCwd) rather than inferred projectRoot:
    expect(seenRunAgentWorkRoots).toEqual([nestedCwd, nestedCwd]);

    // 3. Auto-discovered App procedure can call a global agent ("reviewer") without agentFixtures:
    const appCallsGlobal = await run(
      "alpha-lead/aliased-proc",
      {},
      {
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
        runAgent: async (agentOpts) => ({
          sessionId: "s_global_reviewer",
          sessionPath: join(agentOpts.outputRoot, "s_global_reviewer"),
          status: "completed",
          lastAssistantText: "done",
          messages: [],
          durationMs: 5,
          finishResult: {
            status: "success",
            summary: `global-${agentOpts.agentName}`,
          },
        }),
      },
    );
    expect(appCallsGlobal.ok).toBe(true);
    expect(appCallsGlobal.result).toEqual({
      type: "done",
      summary: "alpha->global:global-reviewer",
    });

    // 4. Explicit App scope (--app or <app>.app/<target>) rejects sibling App procedures:
    await expect(
      run(
        "beta-owner/beta-probe",
        {},
        {
          projectRoot: env.projectRoot,
          app: "alpha",
          models: { test: fakeModel() as any },
        },
      ),
    ).rejects.toThrow("beta-owner/beta-probe");

    await expect(
      run(
        "alpha.app/beta-owner/beta-probe",
        {},
        {
          projectRoot: env.projectRoot,
          models: { test: fakeModel() as any },
        },
      ),
    ).rejects.toThrow("beta-owner/beta-probe");

    // 5. listStandaloneTargets advertises exported `name` ("alpha-lead/aliased-proc", not "alpha-lead/z-aliased") and excludes ambiguous duplicates:
    const listed = await listStandaloneTargets({ projectRoot: env.projectRoot });
    const targetNames = listed.map((item) => item.target);
    expect(targetNames).toContain("alpha-lead/aliased-proc");
    expect(targetNames).not.toContain("alpha-lead/z-aliased");
    expect(targetNames).not.toContain("beta-owner/dup-proc");

    // 6. Array outputSchema through the real runCliAgent runner + scratch outputRoot retention when drainProcessGroup returns false:
    const arraySchema = Type.Array(Type.String());
    const arrayCliRun = await run("codex", "Return JSON array", {
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      outputSchema: arraySchema,
      models: {},
      runCli: (cliInput, cliOpts) =>
        runCliAgent(cliInput, {
          ...cliOpts,
          spawnCommand: (() => {
            const { EventEmitter } = require("node:events");
            const { PassThrough } = require("node:stream");
            const child = new EventEmitter();
            child.pid = 42424;
            child.stdout = new PassThrough();
            child.stderr = new PassThrough();
            child.kill = () => true;
            setImmediate(() => {
              const outIdx = cliInput.tool === "codex" ? 9 : -1;
              void outIdx;
              // Write JSON array to resultPath via finalText in codex stream:
              child.stdout.write(
                `${JSON.stringify({
                  type: "item.completed",
                  item: { type: "agent_message", text: '["alpha","beta"]' },
                })}\n${JSON.stringify({ type: "turn.completed" })}\n`,
              );
              child.stdout.end();
              child.stderr.end();
              child.emit("exit", 0, null);
              child.emit("close", 0, null);
            });
            return child;
          }) as any,
          drainProcessGroup: async () => true,
        }),
    });
    expect(arrayCliRun.ok).toBe(true);
    expect(arrayCliRun.result).toMatchObject({
      type: "done",
      output: ["alpha", "beta"],
    });

    // 7. Scratch outputRoot is retained when drainProcessGroup returns false (unconfirmed cleanup) and outputRoot was omitted:
    const unconfirmedScratchRun = await run("codex", "Leaky process group", {
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      models: {},
      drainProcessGroup: async () => false,
      runCli: (cliInput, cliOpts) =>
        runCliAgent(cliInput, {
          ...cliOpts,
          spawnCommand: (() => {
            const { EventEmitter } = require("node:events");
            const { PassThrough } = require("node:stream");
            const child = new EventEmitter();
            child.pid = 52525;
            child.stdout = new PassThrough();
            child.stderr = new PassThrough();
            child.kill = () => true;
            setImmediate(() => {
              child.stdout.write(
                `${JSON.stringify({
                  type: "item.completed",
                  item: { type: "agent_message", text: "ok" },
                })}\n${JSON.stringify({ type: "turn.completed" })}\n`,
              );
              child.stdout.end();
              child.stderr.end();
              child.emit("exit", 0, null);
              child.emit("close", 0, null);
            });
            return child;
          }) as any,
        }),
    });
    expect(unconfirmedScratchRun.ok).toBe(false);
    expect(unconfirmedScratchRun.report.cleanup.confirmed).toBe(false);
    expect(unconfirmedScratchRun.outputRoot).toBeDefined();
    roots.push(unconfirmedScratchRun.outputRoot!);
    expect(existsSync(unconfirmedScratchRun.outputRoot!)).toBe(true);
    const stepSessionId = unconfirmedScratchRun.report.steps[0]?.sessionId;
    expect(stepSessionId).toBeDefined();
    expect(
      existsSync(join(unconfirmedScratchRun.outputRoot!, "sessions", stepSessionId!, "bash-process-groups.json")),
    ).toBe(true);

    // 8. Duplicate owner in alpha.app and beta.app with cwd inside beta.app executes beta's procedure (not alpha's):
    const alphaSharedDir = join(alphaAppDir, "agents", "shared-owner");
    const betaSharedDir = join(betaAppDir, "agents", "shared-owner");
    mkdirSync(join(alphaSharedDir, "workflows"), { recursive: true });
    mkdirSync(join(betaSharedDir, "workflows"), { recursive: true });
    for (const [dir, label] of [
      [alphaSharedDir, "alpha"],
      [betaSharedDir, "beta"],
    ] as const) {
      writeFileSync(
        join(dir, "agent.json"),
        JSON.stringify({
          name: "shared-owner",
          description: `${label} shared owner`,
          domain: "test",
          model: "test",
          tools: ["finish"],
        }),
      );
      writeFileSync(join(dir, "AGENTS.md"), `# ${label} shared-owner\n`);
      writeFileSync(
        join(dir, "workflows", "which-app.ts"),
        `
export const name = "which-app";
export const description = "Reports owning app";
export async function execute(ctx) {
  return ctx.done(${JSON.stringify(label)});
}
`,
      );
    }

    const betaCwdRun = await run(
      "shared-owner/which-app",
      {},
      {
        cwd: betaAppDir,
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
      },
    );
    expect(betaCwdRun.ok).toBe(true);
    expect(betaCwdRun.result).toEqual({
      type: "done",
      summary: "beta",
    });

    // 9. Explicit app scope ("alpha") combined with sibling agentsRoot ("beta.app/agents") is rejected before importing beta procedures:
    await expect(
      run(
        "beta-owner/beta-probe",
        {},
        {
          projectRoot: env.projectRoot,
          app: "alpha",
          agentsRoot: join(betaAppDir, "agents"),
          models: { test: fakeModel() as any },
        },
      ),
    ).rejects.toThrow("Conflicting App scope");

    // 10. listStandaloneTargets bounds stalled top-level await imports via timeoutMs/signal:
    const gate = await controlledWorkflowImport(env.root);
    writeFileSync(join(alphaLeadDir, "workflows", "stalled-list.ts"), gate.source);
    try {
      const listPromise = listStandaloneTargets({
        projectRoot: env.projectRoot,
        app: "alpha",
        timeoutMs: 150,
      });
      expect(await observeBoundedResult(gate.started)).toBeDefined();
      await expect(listPromise).rejects.toThrow("timed out");
    } finally {
      gate.release();
      await observeBoundedResult(gate.completed);
    }
  });
});
