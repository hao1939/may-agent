import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
} from "@may-agent/sdk/workflow-kernel";
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
    ["owner", ["coding", "workflow", "message", "finish"], "Owner instructions"],
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
      toolDenials: [{ name: "message", reason: "isolated scenario" }],
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
});
