import { afterEach, describe, expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
} from "@may-agent/sdk/testing";
import { executePreparedAgent } from "../lib/agent-execution.js";
import { fakeModel } from "../../test/fixtures/model.js";
import { usageReply } from "../../test/fixtures/execution-usage.js";
import { controlledWorkflowImport, observeBoundedResult } from "../../test/fixtures/workflow-import.js";
import { prepareDirectAgentExecution, type DirectAgentRunResult } from "./direct-agent.js";
import { runDirectWorkflow } from "./direct-workflow.js";

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
  const review = await ctx.agents.call("reviewer", "Inspect " + ctx.input.subjectRef, {
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
  return ctx.workflows.run("review-change", { subjectRef: "HEAD" });
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
          const res = await ctx.agents.call("reviewer", "Inspect only", { tools: "readonly" });
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
  const first = await ctx.workflows.run("review-change", { subjectRef: "A" });
  const second = await ctx.workflows.run("review-change", { subjectRef: "B" });
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
          await ctx.agents.call("reviewer", "Check", { operationAllowance: 0 });
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
          const step = await ctx.agents.call("reviewer", "Inspect note.txt", {
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
          () => ctx.agents.call("foreign-owner", "probe"),
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
        expect.stringContaining('Agent "foreign-owner" was not found'),
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
  const legacyHelper = await ctx.workflows.run("local-helper", {});
  if (legacyHelper.summary !== helper.summary) throw new Error("Legacy alias changed lexical owner");
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
});
