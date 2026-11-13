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
import { prepareDirectAgentExecution, type DirectAgentRunResult } from "./direct-agent.js";
import { createDirectWorkflowTool, runDirectWorkflow } from "./direct-workflow.js";

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

  test("enforces shared root maxConcurrentCalls across nested workflows and exposes sandboxed workflow tool to opted-in direct agents", async () => {
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

    // Opted-in direct agent receives a working Host-free workflow tool
    const wfTool = createDirectWorkflowTool({
      agentName: "owner",
      workflowDir: ownerWorkflowsDir,
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: { id: "test-model" } as any },
      agentFixtures: {
        reviewer: async () => ({
          id: "s_fix",
          kind: "agent",
          status: "done",
          summary: "ok",
          output: { subjectRef: "HEAD", verdict: "pass", summary: "Fixture review" },
        }),
      },
    });

    const prep = await prepareDirectAgentExecution({
      agentName: "owner",
      task: "Use your workflow tool",
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: { id: "test-model" } as any },
      toolDenials: [{ name: "checkpoint", reason: "isolated scenario" }],
      workflowTool: wfTool,
    });
    try {
      expect(prep.executionManifest.effectiveTools).toContain("workflow");
      const listed = JSON.parse(
        (await wfTool.execute("tc_list", { action: "list" } as any)).content[0]!.text as string,
      );
      expect(listed.workflows.map((w: any) => w.name)).toEqual(["outer", "review-change"]);

      const executed = JSON.parse(
        (
          await wfTool.execute("tc_run", {
            action: "run",
            name: "review-change",
            input: { subjectRef: "HEAD" },
          } as any)
        ).content[0]!.text as string,
      );
      expect(executed).toMatchObject({
        type: "done",
        status: "done",
        summary: "Reviewed HEAD",
      });
    } finally {
      await prep.cleanupAsync();
    }
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

  test("propagates unconfirmed cleanup from tool-dispatched child workflows, enforces maxDepth at entry, and isolates nested executionIds", async () => {
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

    // 2. maxDepth=1 blocks child-agent workflow tool dispatch (depth 2 > 1).
    let toolDepthReply: any;
    const depthLimited = await runDirectWorkflow({
      module: {
        name: "root-depth-1",
        description: "Calls owner agent which tries to invoke workflow tool at depth 2",
        async execute(ctx) {
          const step = await ctx.agents.call("owner", "Try nested workflow");
          return ctx.done(step.summary);
        },
      },
      input: {},
      maxDepth: 1,
      allowChildAgentWorkflowTool: true,
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const res = await opts.workflowTool!.execute("tc_depth", {
          action: "run",
          name: "review-change",
          input: { subjectRef: "HEAD" },
        } as any);
        toolDepthReply = JSON.parse(res.content[0]!.text as string);
        return {
          sessionId: "s_owner_depth",
          sessionPath: join(opts.outputRoot, "sessions", "s_owner_depth"),
          systemPrompt: "",
          model: "test",
          executionManifest: { agent: "owner", configuredTools: [], deniedTools: [], effectiveTools: [] },
          status: "done",
          lastAssistantText: "handled",
          messages: [],
          durationMs: 1,
          finishResult: { status: "success", summary: "handled" },
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
          cleanupConfirmed: true,
        };
      },
    });
    expect(depthLimited.ok).toBe(true);
    expect(toolDepthReply).toMatchObject({
      type: "error",
      started: false,
      error: expect.stringContaining("Maximum workflow nesting depth (1) exceeded"),
    });

    // 3. Unconfirmed cleanup inside tool-dispatched child workflow taints enclosing agent step & outer workflow.
    const leakedViaTool = await runDirectWorkflow({
      module: {
        name: "outer-tool-leak",
        description: "Agent swallows tool error, but unconfirmed cleanup still propagates",
        async execute(ctx) {
          await ctx.agents.call("owner", "Run review-change tool");
          return ctx.done("agent reported success");
        },
      },
      input: {},
      maxDepth: 3,
      allowChildAgentWorkflowTool: true,
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        if (opts.agentName === "owner") {
          await opts.workflowTool!.execute("tc_leak", {
            action: "run",
            name: "review-change",
            input: { subjectRef: "HEAD" },
          } as any);
          // Even though owner finishes cleanly with cleanupConfirmed=true on its own session,
          // the nested workflow's unconfirmed cleanup must taint this step!
          return {
            sessionId: "s_owner_ok",
            sessionPath: join(opts.outputRoot, "sessions", "s_owner_ok"),
            systemPrompt: "",
            model: "test",
            executionManifest: { agent: "owner", configuredTools: [], deniedTools: [], effectiveTools: [] },
            status: "done",
            lastAssistantText: "done",
            messages: [],
            durationMs: 2,
            finishResult: { status: "success", summary: "ignored tool error" },
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: true,
          };
        }
        return {
          sessionId: "s_reviewer_leaked",
          sessionPath: join(opts.outputRoot, "sessions", "s_reviewer_leaked"),
          systemPrompt: "",
          model: "test",
          executionManifest: { agent: "reviewer", configuredTools: [], deniedTools: [], effectiveTools: [] },
          status: "done",
          lastAssistantText: "done",
          messages: [],
          durationMs: 2,
          finishResult: {
            status: "success",
            summary: "done",
            result: { subjectRef: "HEAD", summary: "ok" },
          },
          structuredResult: { subjectRef: "HEAD", summary: "ok" },
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
          cleanupConfirmed: false,
        };
      },
    });
    expect(leakedViaTool.ok).toBe(false);
    expect(leakedViaTool.status).toBe("error");
    expect(leakedViaTool.error).toBeInstanceOf(WorkflowUnconfirmedCleanupError);
    expect(leakedViaTool.report.cleanup.confirmed).toBe(false);
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
});
