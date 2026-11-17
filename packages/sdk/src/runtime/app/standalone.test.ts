import { afterEach, describe, expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
} from "@may-agent/sdk/testing";
import { Type } from "typebox";
import { fakeModel } from "../../../../../test/fixtures/model.js";
import { usageReply } from "../../../../../test/fixtures/execution-usage.js";
import { controlledWorkflowImport, observeBoundedResult } from "../../../../../test/fixtures/workflow-import.js";
import {
  executePreparedAgent,
  inferWorkspaceRoot,
  listTargets as listStandaloneTargets,
  prepareDirectAgentExecution,
  run,
  runDirectWorkflow,
  runDirectWorkflow as runDirect,
  type DirectAgentRunResult,
} from "@may-agent/sdk/runtime";

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
    ["owner", ["coding", "agents", "finish"], "Owner instructions"],
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
  properties: {
    prompt: { type: "string", minLength: 1 },
    data: { type: "object", properties: { subjectRef: { type: "string", minLength: 1 } }, required: ["subjectRef"], additionalProperties: false },
  },
  required: ["prompt", "data"],
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
  const review = await ctx.call("global/reviewer", { prompt: "Inspect " + ctx.input.data.subjectRef }, {
    schema: ReviewSchema,
  });
  if (!review.output) {
    return ctx.blocked("Missing review output", { review });
  }
  return ctx.done("Reviewed " + ctx.input.data.subjectRef, {
    review: review.output,
    workspaceRoot: ctx.workspace?.root,
  });
}
`,
  );

  return { root, projectRoot, workRoot, agentsRoot, sharedRoot, outputRoot, traceDir };
}

describe("runDirectWorkflow & createDirectWorkflowTool (Host-free Gym support)", () => {
  test("inferWorkspaceRoot searches workspace ancestors from startDir or a nested launch directory", () => {
    const env = setupDirectLayout();
    const nestedLaunchDir = join(env.projectRoot, "projects", "example.app", "nested");
    mkdirSync(nestedLaunchDir, { recursive: true });
    const externalTmpDir = mkdtempSync(join(tmpdir(), "may-external-workspace-"));
    roots.push(externalTmpDir);

    const prevCwd = process.cwd();
    try {
      process.chdir(nestedLaunchDir);
      expect(inferWorkspaceRoot(externalTmpDir)).toBe(resolve(env.projectRoot));
    } finally {
      process.chdir(prevCwd);
    }

    // When neither startDir nor launchDir is inside a workspace tree, returns resolve(startDir):
    const otherExternalDir = mkdtempSync(join(tmpdir(), "may-external-launch-"));
    roots.push(otherExternalDir);
    expect(inferWorkspaceRoot(externalTmpDir, otherExternalDir)).toBe(resolve(externalTmpDir));
  });

  test("runs workflow with lab-overlaid agentsRoot, binds declared common-kernel agents, and writes run.json without SQLite/EventBus", async () => {
    const env = setupDirectLayout();
    const seenCalls: Array<{ agent: string; systemPrompt: string; effectiveTools: string[] }> = [];

    const run = await runDirectWorkflow({
      agentName: "owner",
      workflowName: "review-change",
      input: { prompt: "Review change", data: { subjectRef: "HEAD~1..HEAD" } },
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
              status: "done",
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
    expect(seenCalls[0]?.effectiveTools).toContain("agents");
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

  test("executes the supplied agents capability binding without substituting intrinsic delegation", async () => {
    const env = setupDirectLayout();
    const providerCalls: string[] = [];
    const toolCalls: unknown[] = [];
    let cleaned = 0;
    const result = await runDirectWorkflow({
      target: "global/owner",
      input: { prompt: "Use the explicitly bound agents service" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      capabilityProviders: {
        agents: ({ agentName }) => {
          providerCalls.push(agentName);
          return {
            tools: [{
              name: "agents",
              label: "Bound agents fixture",
              description: "Uses the caller-supplied service binding",
              parameters: { type: "object", properties: {} } as any,
              execute: async (_id, params) => {
                toolCalls.push(params);
                return { content: [{ type: "text", text: JSON.stringify({ denied: "fixture policy" }) }] };
              },
            }],
            cleanup: () => { cleaned += 1; },
          };
        },
      },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        let turn = 0;
        prep.prepared.runner.streamFn = () => {
          const stream = createAssistantMessageEventStream();
          turn += 1;
          const content = turn === 1
            ? [{ type: "toolCall" as const, id: "tc_agents", name: "agents", arguments: {
                action: "call", agent: "global/reviewer", input: { prompt: "must use the supplied binding" },
              } }]
            : [{ type: "toolCall" as const, id: "tc_finish", name: "finish", arguments: {
                status: "done", summary: "bound provider executed",
              } }];
          stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content }) });
          return stream;
        };
        try {
          const executed = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
          });
          prep.cleanup();
          return {
            ...executed,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } catch (error) {
          await prep.cleanupAsync();
          throw error;
        }
      },
    });

    expect(result.ok).toBeTrue();
    expect(result.result).toMatchObject({ type: "done", summary: "bound provider executed" });
    expect(providerCalls).toEqual(["owner"]);
    expect(toolCalls).toEqual([{ action: "call", agent: "global/reviewer", input: { prompt: "must use the supplied binding" } }]);
    expect(result.childSessions.map((session) => session.agent)).toEqual(["global/owner"]);
    expect(cleaned).toBe(1);
  });

  test("injects the built-in agents tool independently of declarations and invocation denials", async () => {
    const runCase = async (declared: boolean, deny: boolean) => {
      const env = setupDirectLayout();
      writeFileSync(
        join(env.agentsRoot, "reviewer", "agent.json"),
        JSON.stringify({
          name: "reviewer",
          description: "reviewer agent",
          domain: "test",
          model: "test",
          tools: declared ? ["coding", "agents", "finish"] : ["coding", "finish"],
        }),
      );
      let effectiveTools: string[] = [];
      const result = await runDirectWorkflow({
        agentName: "owner",
        workflowName: "review-change",
        input: { prompt: "Review HEAD", data: { subjectRef: "HEAD" } },
        projectRoot: env.projectRoot,
        workRoot: env.workRoot,
        agentsRoot: env.agentsRoot,
        sharedRoot: env.sharedRoot,
        outputRoot: env.outputRoot,
        models: { test: fakeModel() as any },
        ...(deny ? {
          resolveToolDenials: (_agent: string, tools: readonly string[]) =>
            tools.includes("agents") ? [{ name: "agents", reason: "explicit test denial" }] : [],
        } : {}),
        runAgent: async (opts): Promise<DirectAgentRunResult> => {
          const prep = await prepareDirectAgentExecution(opts);
          effectiveTools = prep.executionManifest.effectiveTools;
          try {
            return {
              sessionId: prep.sessionId,
              sessionPath: prep.sessionPath,
              systemPrompt: prep.prepared.systemPrompt,
              model: prep.model,
              executionManifest: prep.executionManifest,
              status: "done",
              lastAssistantText: "reviewed",
              messages: [],
              durationMs: 1,
              finishResult: {
                status: "done",
                summary: "reviewed",
                output: { subjectRef: "HEAD", summary: "ok" },
              },
              structuredResult: { subjectRef: "HEAD", summary: "ok" },
              usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
              cleanupConfirmed: await prep.cleanupAsync(),
            };
          } finally {
            prep.cleanup();
          }
        },
      });
      expect(result.ok).toBeTrue();
      return effectiveTools;
    };

    expect(await runCase(false, false)).toContain("agents");
    expect(await runCase(true, true)).toContain("agents");
  });

  test("delegates prompt-to-prompt and prompt-to-code through the model-visible common-kernel agents binding", async () => {
    const env = setupDirectLayout();
    writeFileSync(
      join(env.agentsRoot, "owner", "workflows", "summarize.ts"),
      `
export const name = "summarize";
export const description = "Summarize structured input";
export async function execute(ctx) {
  return ctx.done("code helper done", { echoed: ctx.input.data.value });
}
`,
    );
    const visibleResults: unknown[] = [];
    const ownerTurns = new Map<string, number>();

    const run = await runDirectWorkflow({
      target: "global/owner",
      input: { prompt: "Delegate both helper kinds" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        const agentsTool = prep.prepared.tools.find((tool) => tool.name === "agents");
        if (agentsTool) {
          const execute = agentsTool.execute.bind(agentsTool);
          agentsTool.execute = async (...args) => {
            const result = await execute(...args);
            const text = result.content.find((item) => item.type === "text")?.text;
            if (text) visibleResults.push(JSON.parse(text));
            return result;
          };
        }
        prep.prepared.runner.streamFn = () => {
          const stream = createAssistantMessageEventStream();
          const turn = (ownerTurns.get(opts.agentName) ?? 0) + 1;
          ownerTurns.set(opts.agentName, turn);
          const content = opts.agentName === "reviewer"
            ? [{ type: "toolCall" as const, id: "reviewer_finish", name: "finish", arguments: {
                status: "done", summary: "prompt helper done", output: { reviewed: true },
              } }]
            : turn === 1
              ? [{ type: "toolCall" as const, id: "owner_prompt", name: "agents", arguments: {
                  action: "call", agent: "global/reviewer", input: { prompt: "Review this" },
                } }]
              : turn === 2
                ? [{ type: "toolCall" as const, id: "owner_code", name: "agents", arguments: {
                    action: "call", agent: "global/summarize", input: { prompt: "Summarize", data: { value: 7 } },
                  } }]
                : [{ type: "toolCall" as const, id: "owner_finish", name: "finish", arguments: {
                    status: "done", summary: "parent handled both helpers",
                  } }];
          stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content }) });
          return stream;
        };
        try {
          const executed = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
          });
          prep.cleanup();
          return {
            ...executed,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } catch (error) {
          await prep.cleanupAsync();
          throw error;
        }
      },
    });

    expect(run.ok).toBeTrue();
    expect(run.result).toMatchObject({ type: "done", summary: "parent handled both helpers" });
    expect(visibleResults).toEqual([
      expect.objectContaining({ status: "done", summary: "prompt helper done", output: { reviewed: true } }),
      expect.objectContaining({ status: "done", summary: "code helper done", output: { echoed: 7 } }),
    ]);
    expect((visibleResults[0] as { id?: string }).id).toBeString();
    expect((visibleResults[1] as { id?: string }).id).toBeString();
    expect(run.childSessions.map((session) => session.agent)).toEqual(["global/reviewer", "global/owner"]);
    expect(run.report.steps.map((step) => [step.kind, step.target, step.status])).toEqual([
      ["agent", "global/reviewer", "done"],
      ["workflow", "global/summarize", "done"],
      ["agent", "global/owner", "done"],
    ]);
  });

  test("pins prompt identity and model for one callable tree while a later invocation captures updated configuration", async () => {
    const env = setupDirectLayout();
    const reviewerConfigPath = join(env.agentsRoot, "reviewer", "agent.json");
    const observed: Array<{ agentName: string; model: string; description: string | undefined }> = [];
    const models = {
      test: { id: "original-model" } as any,
      updated: { id: "updated-model" } as any,
    };
    const runAgent = async (opts: Parameters<typeof prepareDirectAgentExecution>[0]): Promise<DirectAgentRunResult> => {
      const prep = await prepareDirectAgentExecution(opts);
      try {
        observed.push({
          agentName: opts.agentName,
          model: prep.model,
          description: opts.agentConfig?.description,
        });
        return {
          sessionId: prep.sessionId,
          sessionPath: prep.sessionPath,
          systemPrompt: prep.prepared.systemPrompt,
          model: prep.model,
          executionManifest: prep.executionManifest,
          status: "done",
          lastAssistantText: "configured",
          messages: [],
          durationMs: 1,
          finishResult: { status: "done", summary: "configured" },
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
          cleanupConfirmed: await prep.cleanupAsync(),
        };
      } finally {
        prep.cleanup();
      }
    };

    const first = await runDirectWorkflow({
      module: {
        name: "mutate-after-capture",
        description: "Mutates the source configuration after this tree captures its catalog",
        async execute(ctx) {
          writeFileSync(reviewerConfigPath, JSON.stringify({
            name: "reviewer-v2",
            description: "updated reviewer",
            domain: "test",
            model: "updated",
            tools: ["finish"],
          }));
          const child = await ctx.call("global/reviewer", { prompt: "Use the captured configuration" });
          return ctx.done("first tree complete", child);
        },
      },
      agentName: "owner",
      input: { prompt: "Run the first tree" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models,
      runAgent,
    });

    const second = await runDirectWorkflow({
      module: {
        name: "capture-updated-config",
        description: "Uses a fresh independently prepared catalog",
        async execute(ctx) {
          const child = await ctx.call("global/reviewer-v2", { prompt: "Use the updated configuration" });
          return ctx.done("second tree complete", child);
        },
      },
      agentName: "owner",
      input: { prompt: "Run the second tree" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models,
      runAgent,
    });

    expect(first.ok).toBeTrue();
    expect(second.ok).toBeTrue();
    expect(observed).toEqual([
      { agentName: "reviewer", model: "test", description: "reviewer agent" },
      { agentName: "reviewer-v2", model: "updated", description: "updated reviewer" },
    ]);
  });

  test("uses exact canonical workflow names before and after another catalog call", async () => {
    const env = setupDirectLayout();
    const utilityDir = join(env.agentsRoot, "utility");
    mkdirSync(join(utilityDir, "workflows"), { recursive: true });
    writeFileSync(join(utilityDir, "agent.json"), JSON.stringify({
      name: "utility", description: "Global prompt namesake", domain: "test", model: "test", tools: ["finish"],
    }));
    writeFileSync(join(utilityDir, "AGENTS.md"), "GLOBAL UTILITY PROMPT");
    writeFileSync(join(env.agentsRoot, "reviewer", "workflows", "reviewer-utility.ts"), `
export const name = "reviewer-utility";
export const description = "Reviewer utility with an exact canonical address";
export async function execute(ctx) {
  return ctx.done("reviewer utility", { received: ctx.input.prompt });
}
`);
    writeFileSync(join(env.agentsRoot, "reviewer", "workflows", "prime.ts"), `
export const name = "prime";
export const description = "Explicit owner catalog load";
export async function execute(ctx) { return ctx.done("primed"); }
`);

    const visibleResults: unknown[] = [];
    let reviewerTurn = 0;
    let globalUtilityExecutions = 0;
    const result = await runDirectWorkflow({
      target: "global/reviewer",
      input: { prompt: "Use the local utility twice" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        if (opts.agentName === "utility") globalUtilityExecutions += 1;
        const prep = await prepareDirectAgentExecution(opts);
        const agentsTool = prep.prepared.tools.find((tool) => tool.name === "agents");
        if (agentsTool) {
          const execute = agentsTool.execute.bind(agentsTool);
          agentsTool.execute = async (...args) => {
            const toolResult = await execute(...args);
            const text = toolResult.content.find((item) => item.type === "text")?.text;
            if (text) visibleResults.push(JSON.parse(text));
            return toolResult;
          };
        }
        prep.prepared.runner.streamFn = () => {
          const stream = createAssistantMessageEventStream();
          reviewerTurn += 1;
          const content = reviewerTurn === 1
            ? [{ type: "toolCall" as const, id: "local_before", name: "agents", arguments: {
                action: "call", agent: "global/reviewer-utility", input: { prompt: "before" },
              } }]
            : reviewerTurn === 2
              ? [{ type: "toolCall" as const, id: "explicit_load", name: "agents", arguments: {
                  action: "call", agent: "global/prime", input: { prompt: "prime" },
                } }]
              : reviewerTurn === 3
                ? [{ type: "toolCall" as const, id: "local_after", name: "agents", arguments: {
                    action: "call", agent: "global/reviewer-utility", input: { prompt: "after" },
                  } }]
                : [{ type: "toolCall" as const, id: "finish_local_precedence", name: "finish", arguments: {
                    status: "done", summary: "local precedence stable",
                  } }];
          stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content }) });
          return stream;
        };
        try {
          const executed = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
          });
          prep.cleanup();
          return {
            ...executed,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } catch (error) {
          await prep.cleanupAsync();
          throw error;
        }
      },
    });

    expect(result.ok).toBeTrue();
    expect(globalUtilityExecutions).toBe(0);
    expect(visibleResults).toEqual([
      expect.objectContaining({ status: "done", summary: "reviewer utility", output: { received: "before" } }),
      expect.objectContaining({ status: "done", summary: "primed" }),
      expect.objectContaining({ status: "done", summary: "reviewer utility", output: { received: "after" } }),
    ]);
  });

  test("records the resolved workflow kind and child identity when an enveloped model-visible code helper fails", async () => {
    const env = setupDirectLayout();
    writeFileSync(join(env.agentsRoot, "owner", "workflows", "string-failure.ts"), `
export const name = "string-failure";
export const description = "Fails after code execution starts";
export async function execute(ctx) { throw new Error("string helper exploded: " + ctx.input.prompt); }
`);
    let turn = 0;
    const result = await runDirectWorkflow({
      target: "global/owner",
      input: { prompt: "Call the failing string helper" },
      executionId: "wr_parent_failure_trace",
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        prep.prepared.runner.streamFn = () => {
          const stream = createAssistantMessageEventStream();
          turn += 1;
          const content = turn === 1
            ? [{ type: "toolCall" as const, id: "string_failure", name: "agents", arguments: {
                action: "call", agent: "global/string-failure", input: { prompt: "payload" },
              } }]
            : [{ type: "toolCall" as const, id: "finish_after_string_failure", name: "finish", arguments: {
                status: "done", summary: "handled string helper failure",
              } }];
          stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content }) });
          return stream;
        };
        try {
          const executed = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
          });
          prep.cleanup();
          return {
            ...executed,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } catch (error) {
          await prep.cleanupAsync();
          throw error;
        }
      },
    });

    expect(result.ok).toBeTrue();
    const failedHelper = result.report.steps.find((step) => step.target === "global/string-failure");
    expect(failedHelper).toMatchObject({
      kind: "workflow",
      status: "error",
      error: { message: "string helper exploded: payload" },
      id: expect.stringMatching(/^wr_/),
    });
    expect(failedHelper?.id).not.toBe(result.report.executionId);
    expect(result.report.executionId).toBe("wr_parent_failure_trace");
  });

  test("rejects a saturated model-visible helper before its code body starts", async () => {
    const env = setupDirectLayout();
    const marker = join(env.workRoot, "helper-started.txt");
    writeFileSync(
      join(env.agentsRoot, "owner", "workflows", "side-effect.ts"),
      `
import { writeFileSync } from "node:fs";
export const name = "side-effect";
export const description = "Marks body start";
export async function execute(ctx) {
  writeFileSync(${JSON.stringify(marker)}, "started");
  return ctx.done("started");
}
`,
    );
    let turn = 0;
    const run = await runDirectWorkflow({
      target: "global/owner",
      input: { prompt: "Try one saturated helper" },
      maxConcurrentCalls: 1,
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        prep.prepared.runner.streamFn = () => {
          const stream = createAssistantMessageEventStream();
          turn += 1;
          const content = turn === 1
            ? [{ type: "toolCall" as const, id: "saturated_call", name: "agents", arguments: {
                action: "call", agent: "global/side-effect", input: { prompt: "run" },
              } }]
            : [{ type: "toolCall" as const, id: "finish_after_denial", name: "finish", arguments: {
                status: "done", summary: "handled saturation",
              } }];
          stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content }) });
          return stream;
        };
        try {
          const executed = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
          });
          prep.cleanup();
          return {
            ...executed,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } catch (error) {
          await prep.cleanupAsync();
          throw error;
        }
      },
    });

    expect(run.ok).toBeTrue();
    expect(run.result).toMatchObject({ type: "done", summary: "handled saturation" });
    expect(existsSync(marker)).toBeFalse();
  });

  test("caps a long-declared code helper at the model tool deadline and still lets the parent finish", async () => {
    const env = setupDirectLayout();
    const enteredMarker = join(env.root, "long-helper-entered");
    const cancelledMarker = join(env.root, "long-helper-cancelled");
    writeFileSync(
      join(env.agentsRoot, "owner", "workflows", "a-warm-helper.ts"),
      `
export const name = "warm-helper";
export const description = "Warms the owner's code-helper catalog";
export async function execute(ctx) { return ctx.done("catalog ready"); }
`,
    );
    writeFileSync(
      join(env.agentsRoot, "owner", "workflows", "long-helper.ts"),
      `
import { writeFileSync } from "node:fs";
export const name = "long-helper";
export const description = "Long declared helper";
export const executionTimeoutMs = 1000;
export async function execute(ctx) {
  writeFileSync(${JSON.stringify(enteredMarker)}, "entered");
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 500);
    ctx.signal.addEventListener("abort", () => {
      clearTimeout(timer);
      writeFileSync(${JSON.stringify(cancelledMarker)}, String(ctx.signal.reason));
      reject(ctx.signal.reason);
    }, { once: true });
  });
  return ctx.done("too late");
}
`,
    );
    let turn = 0;
    let measuredStartedAt: number | undefined;
    const visibleResults: unknown[] = [];
    const helperErrors: string[] = [];
    const run = await runDirectWorkflow({
      target: "global/owner",
      input: { prompt: "Bound the helper" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        const agentsTool = prep.prepared.tools.find((tool) => tool.name === "agents");
        if (agentsTool) {
          const execute = agentsTool.execute.bind(agentsTool);
          agentsTool.execute = async (...args) => {
            const call = args[1] as { agent?: string } | undefined;
            try {
              const toolResult = await execute(...args);
              const text = toolResult.content.find((item) => item.type === "text")?.text;
              if (text) visibleResults.push(JSON.parse(text));
              if (call?.agent === "global/warm-helper") measuredStartedAt = Date.now();
              return toolResult;
            } catch (error) {
              if (call?.agent === "global/long-helper") helperErrors.push(String(error));
              throw error;
            }
          };
        }
        prep.prepared.runner.streamFn = () => {
          const stream = createAssistantMessageEventStream();
          turn += 1;
          const content = turn === 1
            ? [{ type: "toolCall" as const, id: "warm_helper", name: "agents", arguments: {
                action: "call", agent: "global/warm-helper", input: { prompt: "warm" },
              } }]
            : turn === 2
              ? [{ type: "toolCall" as const, id: "bounded_helper", name: "agents", arguments: {
                  action: "call", agent: "global/long-helper", input: { prompt: "long" }, options: { timeoutMs: 20 },
                } }]
              : [{ type: "toolCall" as const, id: "finish_after_timeout", name: "finish", arguments: {
                  status: "done", summary: "parent handled helper timeout",
                } }];
          stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content }) });
          return stream;
        };
        try {
          const executed = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
          });
          prep.cleanup();
          return {
            ...executed,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } catch (error) {
          await prep.cleanupAsync();
          throw error;
        }
      },
    });

    expect(run.ok).toBeTrue();
    expect(run.result).toMatchObject({ type: "done", summary: "parent handled helper timeout" });
    expect(measuredStartedAt).toBeNumber();
    expect(Date.now() - measuredStartedAt!).toBeLessThan(400);
    expect(readFileSync(enteredMarker, "utf8")).toBe("entered");
    expect(readFileSync(cancelledMarker, "utf8")).toContain('Workflow step "global/long-helper" timed out after 20ms');
    expect(visibleResults).toEqual([
      expect.objectContaining({ status: "done", summary: "catalog ready" }),
    ]);
    expect(helperErrors).toEqual([
      expect.stringContaining('Workflow step "global/long-helper" timed out after 20ms'),
    ]);
    expect(run.report.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "workflow", target: "global/warm-helper", status: "done", cleanupConfirmed: true }),
      expect.objectContaining({ kind: "workflow", target: "global/long-helper", status: "error", cleanupConfirmed: true }),
    ]));
  });

  test("forwards the actual model tool work-stop signal to a running helper", async () => {
    const env = setupDirectLayout();
    writeFileSync(
      join(env.agentsRoot, "owner", "workflows", "work-stop-helper.ts"),
      `
export const name = "work-stop-helper";
export const description = "Waits for model work stop";
export const executionTimeoutMs = 2000;
export async function execute(ctx) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 1000);
    ctx.signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(ctx.signal.reason);
    }, { once: true });
  });
  return ctx.done("too late");
}
`,
    );
    let turn = 0;
    const run = await runDirectWorkflow({
      target: "global/owner",
      input: { prompt: "Stop helper work but reserve finish time" },
      timeoutMs: 300,
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        prep.prepared.runner.streamFn = () => {
          const stream = createAssistantMessageEventStream();
          turn += 1;
          const content = turn === 1
            ? [{ type: "toolCall" as const, id: "work_stop_helper", name: "agents", arguments: {
                action: "call", agent: "global/work-stop-helper", input: { prompt: "work" },
              } }]
            : [{ type: "toolCall" as const, id: "finish_in_reserve", name: "finish", arguments: {
                status: "done", summary: "finished in reserved interval",
              } }];
          stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content }) });
          return stream;
        };
        try {
          const executed = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
          });
          prep.cleanup();
          return {
            ...executed,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } catch (error) {
          await prep.cleanupAsync();
          throw error;
        }
      },
    });

    expect(run.ok).toBeTrue();
    expect(run.result).toMatchObject({ type: "done", summary: "finished in reserved interval" });
    expect(run.report.durationMs).toBeLessThan(300);
    expect(run.report.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "workflow", target: "global/work-stop-helper", status: "error", cleanupConfirmed: true }),
    ]));
  });

  test("keeps model-visible helper cleanup uncertainty after the parent handles the tool result and finishes", async () => {
    const env = setupDirectLayout();
    let ownerTurn = 0;
    const run = await runDirectWorkflow({
      target: "global/owner",
      input: { prompt: "Handle helper cleanup uncertainty" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        if (opts.agentName === "reviewer") {
          return {
            sessionId: "reviewer_unconfirmed",
            sessionPath: join(env.outputRoot, "sessions", "reviewer_unconfirmed"),
            systemPrompt: "",
            model: "test",
            executionManifest: { agent: "reviewer", configuredTools: [], deniedTools: [], effectiveTools: [] },
            status: "done",
            lastAssistantText: "done",
            messages: [],
            durationMs: 1,
            finishResult: { status: "done", summary: "helper business result" },
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: false,
          };
        }
        const prep = await prepareDirectAgentExecution(opts);
        prep.prepared.runner.streamFn = () => {
          const stream = createAssistantMessageEventStream();
          ownerTurn += 1;
          const content = ownerTurn === 1
            ? [{ type: "toolCall" as const, id: "uncertain_helper", name: "agents", arguments: {
                action: "call", agent: "global/reviewer", input: { prompt: "Return a result" },
              } }]
            : [{ type: "toolCall" as const, id: "parent_finish", name: "finish", arguments: {
                status: "done", summary: "parent handled helper result",
              } }];
          stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content }) });
          return stream;
        };
        try {
          const executed = await executePreparedAgent(prep.prepared, {
            timeoutMs: opts.timeoutMs,
            signal: opts.signal,
            deadlineAt: opts.deadlineAt,
          });
          prep.cleanup();
          return {
            ...executed,
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } catch (error) {
          await prep.cleanupAsync();
          throw error;
        }
      },
    });

    expect(run.ok).toBeFalse();
    expect(run.error).toBeInstanceOf(WorkflowUnconfirmedCleanupError);
    expect(run.report.result).toMatchObject({ type: "done", summary: "parent handled helper result" });
    expect(run.report.cleanup).toEqual({
      confirmed: false,
      unconfirmed: ["agent:global/reviewer (reviewer_unconfirmed)"],
    });
  });

  test("surfaces unconfirmed descendant cleanup as an explicit error while retaining workspace and report evidence", async () => {
    const env = setupDirectLayout();
    writeFileSync(join(env.workRoot, "candidate.txt"), "important evidence");

    const run = await runDirectWorkflow({
      agentName: "owner",
      workflowName: "review-change",
      input: { prompt: "Review HEAD", data: { subjectRef: "HEAD" } },
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
          status: "done",
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
      unconfirmed: ["agent:global/reviewer (s_stuck)"],
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
  return ctx.call("global/review-change", { prompt: "Review HEAD", data: { subjectRef: "HEAD" } });
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
          const res = await ctx.call("global/reviewer", { prompt: "Inspect only" });
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
            finishResult: { status: "done", summary: "Inspected safely" },
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally {
          prep.cleanup();
        }
      },
    });

    expect(run.ok).toBe(true);
    expect(effectiveTools).toEqual(["read", "bash", "edit", "write", "agents", "finish", "custom_mutate"]);
  });

  test("enforces maxDepth at entry and isolates nested executionIds", async () => {
    const env = setupDirectLayout();
    const ownerWorkflowsDir = join(env.agentsRoot, "owner", "workflows");
    writeFileSync(
      join(ownerWorkflowsDir, "nested-pair.ts"),
      `
export const name = "nested-pair";
export const description = "Runs two nested workflows and returns their IDs";
export async function execute(ctx) {
  const first = await ctx.call("global/review-change", { prompt: "Review A", data: { subjectRef: "A" } });
  const second = await ctx.call("global/review-change", { prompt: "Review B", data: { subjectRef: "B" } });
  return ctx.done("pair", { producerId: ctx.done("probe").id, firstId: first.id, secondId: second.id });
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
    const idsOut = distinctIds.result?.output as { producerId?: string; firstId: string; secondId: string };
    expect(idsOut.producerId).toBeUndefined();
    expect(idsOut.firstId).not.toBe("wr_explicit_root");
    expect(idsOut.secondId).not.toBe("wr_explicit_root");
    expect(idsOut.firstId).not.toBe(idsOut.secondId);

    // 2. maxDepth=1 blocks nested code calls at depth 2.
    const depthLimited = await runDirectWorkflow({
      module: {
        name: "root-depth-1",
        description: "Calls nested review-change at depth 2 with maxDepth=1",
        async execute(ctx) {
          const step = await ctx.call("global/review-change", { prompt: "Review HEAD", data: { subjectRef: "HEAD" } });
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
  });

  test("preserves read.tasks.workload in real direct execution", async () => {
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
          get: async () => null,
          workload: async ({ limit } = {}) => ({ items: [], limit }) as any,
        },
      },
    });
    expect(workloadDirect.ok).toBe(true);
    expect(workloadDirect.result?.output).toEqual({ items: [], limit: 3 });


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
            const child = await ctx.call("global/broken", { prompt: "must not run" });
            return ctx.done("healthy", child.summary);
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

  test.each(["timeout", "cancel"])("prepares the complete catalog and bounds stalled imports on %s", async (mode) => {
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
    const controller = new AbortController();
    let settledAfterCall = false;
    const run = runDirectWorkflow({
      ...env, agentName: "owner", input: {}, models: {},
      signal: controller.signal, timeoutMs: mode === "timeout" ? 500 : 10_000,
      module: { name: "caller", description: "Calls reviewer/after whose catalog import stalls", async execute(ctx) {
        await ctx.call("global/after", { prompt: "after" });
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
      expect(stopped?.result.report.cleanup.confirmed).toBe(true);
    } finally {
      gate.release();
      await observeBoundedResult(gate.completed);
      await observeBoundedResult(run);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(settledAfterCall).toBe(false);
    expect(existsSync(marker)).toBe(false);
  });

  test.each(["global", "app-local"])("lets %s callers invoke exact cross-App procedures without grants", async (layout) => {
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
        const result = await ctx.call("foreign/secret", { prompt: "probe" });
        return ctx.done("cross-App call completed", result.summary);
      } },
    });
    expect(run.ok).toBe(true);
    expect(run.result).toMatchObject({
      type: "done",
      summary: "cross-App call completed",
      output: "foreign execution",
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
        return ctx.call("local/reviewer", { prompt: "Review HEAD" });
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
            finishResult: { status: "done", summary: "local executed" },
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally { prep.cleanup(); }
      },
    });
    expect(run.ok).toBe(true);
    expect(run.result).toMatchObject({ type: "done", summary: "local executed" });
  });

  test("resolves local and cross-owner <owner>/<name> procedures without inventing orchestration context", async () => {
    const env = setupDirectLayout();
    const reviewerWorkflowsDir = join(env.agentsRoot, "reviewer", "workflows");
    writeFileSync(
      join(reviewerWorkflowsDir, "local-helper.ts"),
      `
export const name = "local-helper";
export const description = "Reviewer local helper";
export const readonly = true;
export async function execute(ctx) {
  return ctx.done("helper", {
    reconciliationExposed: Boolean(ctx.reconciliation),
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
  const helper = await ctx.call("global/local-helper", { prompt: "run helper" });
  const agentStep = await ctx.call("global/reviewer", { prompt: "Inspect " + ctx.input.data.subjectRef });
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
  const sub = await ctx.call("global/deep-review", { prompt: "Deep review", data: { subjectRef: "HEAD" } });
  return ctx.done(sub.summary, sub.output);
}
`,
    );

    const run = await runDirectWorkflow({
      agentName: "owner",
      workflowName: "delegate-cross-owner",
      input: { prompt: "delegate cross owner" },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
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
      summary: "helper:prompt-ok",
      output: {
        helper: {
          reconciliationExposed: false,
          reviseExposed: false,
        },
        agentSummary: "prompt-ok",
      },
    });
  });

  test("runDirect dispatches both prompt targets and code targets through one standalone entrypoint", async () => {
    const env = setupDirectLayout();
    const promptRun = await runDirect({
      target: "global/reviewer",
      input: { prompt: "Inspect HEAD" },
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
      target: "global/review-change",
      input: { prompt: "Review change", data: { subjectRef: "HEAD~1..HEAD" } },
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

    // A distinct reviewer-owned procedure must not interfere with prompt dispatch, and the
    // prompt call must forward tools: "readonly" without failing readonly module checks.
    writeFileSync(
      join(env.agentsRoot, "reviewer", "workflows", "reviewer-procedure.ts"),
      `
export const name = "reviewer-procedure";
export const description = "Distinct procedure owned by the reviewer prompt agent";
export const readonly = true;
export async function execute(ctx) {
  return ctx.done("wrong-procedure-invoked");
}
`,
    );
    let seenToolsPolicy: string | undefined;
    const collisionAndReadonlyRun = await runDirect({
      agentName: "owner",
      target: "global/reviewer",
      input: { prompt: "Readonly prompt check" },
      tools: "readonly",
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      agentFixtures: {
        reviewer: async ({ task, tools }) => {
          seenToolsPolicy = tools;
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

    // Native CLI backends are execution setup, not unconditional standalone callables.
    const listed = await listStandaloneTargets({ projectRoot: env.projectRoot });
    expect(listed.map((descriptor) => descriptor.name)).not.toContain("global/codex");
    await expect(
      run("codex", { prompt: "Inspect package.json" }, { projectRoot: env.projectRoot, models: {} }),
    ).resolves.toEqual({ status: "error", summary: "Callable target not found: codex" });
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
        target: "global/probe",
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
  const sub = await ctx.call("global/pinned-helper", { prompt: "run pinned helper" });
  return ctx.done("ran:" + sub.summary);
}
`,
      );
      const pinnedRun = await runDirectWorkflow({
        ...env,
        agentName: "owner",
        workflowName: "mutate-and-call",
        input: { prompt: "run mutation probe" },
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
      target: "global/marker",
      input: { prompt: "expired marker probe" },
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
      target: "global/slow-prep-then-exec",
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
      target: "global/longer-module-timeout",
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
export const inputSchema = {
  type: "object",
  properties: {
    prompt: { type: "string", minLength: 1 },
    data: {
      type: "object",
      properties: { score: { type: "number" } },
      required: ["score"],
      additionalProperties: false,
    },
  },
  required: ["prompt", "data"],
  additionalProperties: false,
};
export const outputSchema = {
  type: "object",
  properties: { score: { type: "number" } },
  required: ["score"],
  additionalProperties: false,
};
export async function execute(ctx) {
  return ctx.done("scored", { score: ctx.input.data.score });
}
`,
    );
    writeFileSync(
      join(alphaAgentDir, "workflows", "partial-alpha.ts"),
      `
export const name = "partial-alpha";
export const description = "Returns partial output for root schema validation";
export const inputSchema = {
  type: "object",
  properties: { prompt: { type: "string", minLength: 1 } },
  required: ["prompt"],
  additionalProperties: false,
};
export const outputSchema = {
  type: "object",
  properties: { score: { type: "number" } },
  required: ["score"],
  additionalProperties: false,
};
export async function execute() {
  return { status: "blocked", summary: "partial score", output: { score: "invalid" }, facts: { source: "fixture" } };
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

    // 1. Auto-discovers the exact canonical alpha/verify-alpha name without `app` option:
    const autoRun = await run(
      "alpha/verify-alpha",
      { prompt: "Score alpha", data: { score: 95 } },
      {
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
      },
    );
    expect(autoRun).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "scored",
      output: { score: 95 },
    });

    // 2. Caller outputSchema is enforced in addition to module.outputSchema:
    const stricterCallerSchemaFail = await run(
      "alpha/verify-alpha",
      { prompt: "Score alpha", data: { score: 50 } }, // passes module.outputSchema, fails caller minimum
      {
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
        outputSchema: Type.Object({ score: Type.Number({ minimum: 90 }) }),
      },
    );
    expect(stricterCallerSchemaFail).toMatchObject({
      id: expect.any(String),
      status: "error",
      summary: expect.stringContaining("Invalid caller output schema"),
    });

    // 3. Root partial output is checked against the module schema before run() exposes it.
    const invalidPartialRoot = await run(
      "alpha/partial-alpha",
      { prompt: "Return partial score" },
      {
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
      },
    );
    expect(invalidPartialRoot).toMatchObject({
      id: expect.any(String),
      status: "error",
      summary: expect.stringContaining("Invalid workflow output"),
      facts: { invalidOutput: { score: "invalid" } },
    });
    expect(invalidPartialRoot).not.toHaveProperty("output");

    // 4. Root partial output is also checked against the caller schema.
    writeFileSync(
      join(alphaAgentDir, "workflows", "partial-alpha.ts"),
      readFileSync(join(alphaAgentDir, "workflows", "partial-alpha.ts"), "utf8")
        .replace('{ score: "invalid" }', "{ score: 50 }"),
    );
    const invalidPartialForCaller = await run(
      "alpha/partial-alpha",
      { prompt: "Return partial score" },
      {
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
        outputSchema: Type.Object({ score: Type.Number({ minimum: 90 }) }),
      },
    );
    expect(invalidPartialForCaller).toMatchObject({
      id: expect.any(String),
      status: "error",
      summary: expect.stringContaining("Invalid caller output schema"),
      facts: { invalidOutput: { score: 50 } },
    });
    expect(invalidPartialForCaller).not.toHaveProperty("output");

    // 5. The listed App procedure named "codex" is invoked instead of a native CLI alias:
    const localCodexProc = await run(
      "alpha/codex",
      { prompt: "Run local codex", data: { customObject: true } },
      {
        projectRoot: env.projectRoot,
        agentName: "alpha-lead",
        models: { test: fakeModel() as any },
        runCli: async () => {
          throw new Error("Native codex CLI must not intercept local procedure");
        },
      },
    );
    expect(localCodexProc).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "local-codex-procedure",
      output: { received: { prompt: "Run local codex", data: { customObject: true } } },
    });

    // 4. Canonical global prompt dispatch uses the same prepared catalog as discovery.
    const barePrompt = await run("global/reviewer", { prompt: "Fast canonical prompt" }, {
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
    });
    expect(barePrompt).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "fast:Fast canonical prompt",
    });
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
  const step = await ctx.call("global/reviewer", { prompt: "Check from App procedure" });
  return ctx.done("alpha->global:" + step.summary);
}
`,
    );
    // 1. Invoke the exact canonical App-local prompt name without agentFixtures:
    const seenRunAgentWorkRoots: string[] = [];
    const nestedCwd = join(env.workRoot, "nested-repo");
    mkdirSync(nestedCwd, { recursive: true });

    const bareAppPrompt = await run("alpha/alpha-lead", { prompt: "Run bare App prompt" }, {
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
            status: "done",
            summary: `ran:${agentOpts.agentName}:${agentOpts.task}`,
          },
        };
      },
    });
    expect(bareAppPrompt).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "ran:alpha-lead:Run bare App prompt",
    });
    // 2. workRoot defaults to cwd (nestedCwd) rather than inferred projectRoot:
    expect(seenRunAgentWorkRoots).toEqual([nestedCwd]);

    // 3. Auto-discovered App procedure can call a global agent ("reviewer") without agentFixtures:
    const appCallsGlobal = await run(
      "alpha/aliased-proc",
      { prompt: "Call the global reviewer" },
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
            status: "done",
            summary: `global-${agentOpts.agentName}`,
          },
        }),
      },
    );
    expect(appCallsGlobal).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "alpha->global:global-reviewer",
    });

    // 4. Retired App selection does not narrow the complete captured catalog.
    await expect(
      run(
        "beta/beta-probe",
        { prompt: "Probe beta" },
        {
          projectRoot: env.projectRoot,
          app: "alpha",
          models: { test: fakeModel() as any },
        },
      ),
    ).resolves.toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "beta-ran",
    });

    await expect(
      run(
        "alpha.app/beta-owner/beta-probe",
        { prompt: "Rejected legacy target" },
        {
          projectRoot: env.projectRoot,
          models: { test: fakeModel() as any },
        },
      ),
    ).resolves.toEqual({
      status: "error",
      summary: "Callable target not found: alpha.app/beta-owner/beta-probe",
    });

    // 5. Catalog preparation rejects an ambiguous canonical workflow instead of silently omitting it.
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
    await expect(listStandaloneTargets({ projectRoot: env.projectRoot })).rejects.toThrow(
      'Ambiguous agent workflow name "dup-proc"',
    );
    unlinkSync(join(betaOwnerDir, "workflows", "dup-b.ts"));

    // The repaired catalog uses exact App/global canonical names and exported workflow names.
    const listed = await listStandaloneTargets({ projectRoot: env.projectRoot });
    const targetNames = listed.map((item) => item.name);
    expect(targetNames).toContain("alpha/aliased-proc");
    expect(targetNames).not.toContain("alpha/z-aliased");
    expect(targetNames).toContain("beta/dup-proc");
    expect(listed.every((item) => !("kind" in item) && !("target" in item))).toBe(true);

    // 6. Same owner names in different Apps remain distinct exact canonical routes.
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
      "beta/which-app",
      { prompt: "Report the owning App" },
      {
        cwd: betaAppDir,
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
      },
    );
    expect(betaCwdRun).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "beta",
    });
    await expect(
      run("shared-owner/which-app", { prompt: "Reject legacy owner alias" }, {
        projectRoot: env.projectRoot,
        models: { test: fakeModel() as any },
      }),
    ).resolves.toEqual({
      status: "error",
      summary: "Callable target not found: shared-owner/which-app",
    });

    // 7. App and agentsRoot compatibility options do not filter project App discovery.
    await expect(
      run(
        "beta/beta-probe",
        { prompt: "Probe beta" },
        {
          projectRoot: env.projectRoot,
          app: "alpha",
          agentsRoot: join(alphaAppDir, "agents"),
          models: { test: fakeModel() as any },
        },
      ),
    ).resolves.toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "beta-ran",
    });

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

    // 11. run() passes ordinary domain input unchanged and does not synthesize a Task snapshot.
    writeFileSync(
      join(alphaLeadDir, "workflows", "domain-input-probe.ts"),
      `
export const name = "domain-input-probe";
export const description = "Reports ordinary domain input without Task synthesis";
export const inputSchema = {
  type: "object",
  properties: {
    prompt: { type: "string", minLength: 1 },
    data: {
      type: "object",
      properties: {
        task: { type: "string" },
        outcome: { type: "string" },
        acceptance: { type: "array", items: { type: "string" } },
        constraints: { type: "array", items: { type: "string" } },
        verify: { type: "array", items: { type: "string" } },
      },
      required: ["task", "outcome", "acceptance", "constraints", "verify"],
      additionalProperties: false,
    },
  },
  required: ["prompt", "data"],
  additionalProperties: false,
};
export async function execute(ctx) {
  return ctx.done("domain input retained", {
    input: ctx.input,
    reconciliation: ctx.reconciliation ?? null,
  });
}
`,
    );
    const domainInput = {
      prompt: "Run the domain input probe",
      data: {
        task: "Domain field, not orchestration",
        outcome: "Return unchanged input",
        acceptance: ["No fake TaskDetail"],
        constraints: ["No reconciliation envelope"],
        verify: ["bun", "test"],
      },
    };
    const domainRun = await run("alpha/domain-input-probe", domainInput, {
      projectRoot: env.projectRoot,
      models: { test: fakeModel() as any },
    });
    expect(domainRun).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "domain input retained",
      output: { input: domainInput, reconciliation: null },
    });
  });

  test("invokes the exact canonical workflow name returned by standalone discovery", async () => {
    const env = setupDirectLayout();
    writeFileSync(
      join(env.agentsRoot, "owner", "workflows", "echo.ts"),
      `
export const name = "echo";
export const description = "Echo the canonical envelope";
export async function execute(ctx) { return ctx.done("echoed", ctx.input); }
`,
    );
    writeFileSync(
      join(env.agentsRoot, "owner", "workflows", "invalid-targets.ts"),
      `
export const name = "invalid-targets";
export const description = "Return pre-start failures through the common result envelope";
export async function execute(ctx) {
  const targets = ["echo", "owner/echo", "global/ echo", "global /echo", "global/", "/echo"];
  const results = [];
  for (const target of targets) results.push({ target, result: await ctx.call(target, { prompt: "run" }) });
  return ctx.done("checked invalid targets", results);
}
`,
    );

    const descriptors = await listStandaloneTargets({ projectRoot: env.projectRoot });
    const echo = descriptors.find((descriptor) => descriptor.name === "global/echo");
    expect(echo).toBeDefined();
    expect(descriptors.map((descriptor) => descriptor.name)).not.toContain("global/codex");
    expect(descriptors.map((descriptor) => descriptor.name)).not.toContain("global/claude");

    const input = { prompt: "echo this", data: { marker: "preserved" } };
    const result = await run(echo!.name, input, {
      projectRoot: env.projectRoot,
      cwd: env.projectRoot,
      models: {},
      timeoutMs: 1_000,
    });
    expect(result).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: "echoed",
      output: input,
    });

    const invalidTargets = await run("global/invalid-targets", { prompt: "check invalid targets" }, {
      projectRoot: env.projectRoot,
      cwd: env.projectRoot,
      models: {},
      timeoutMs: 1_000,
    });
    expect(invalidTargets).toMatchObject({
      status: "done",
      summary: "checked invalid targets",
      output: [
        { target: "echo", result: { status: "error", summary: expect.any(String) } },
        { target: "owner/echo", result: { status: "error", summary: expect.any(String) } },
        { target: "global/ echo", result: { status: "error", summary: expect.any(String) } },
        { target: "global /echo", result: { status: "error", summary: expect.any(String) } },
        { target: "global/", result: { status: "error", summary: expect.any(String) } },
        { target: "/echo", result: { status: "error", summary: expect.any(String) } },
      ],
    });
    for (const entry of invalidTargets.output as Array<{ result: Record<string, unknown> }>) {
      expect(entry.result).not.toHaveProperty("id");
    }

    const reviewer = descriptors.find((descriptor) => descriptor.name === "global/reviewer");
    expect(reviewer).toBeDefined();
    const promptRun = await run(reviewer!.name, { prompt: "inspect", data: { ref: "HEAD" } }, {
      projectRoot: env.projectRoot,
      cwd: env.projectRoot,
      models: {},
      timeoutMs: 1_000,
      agentFixtures: {
        reviewer: async ({ task }) => ({
          id: "s_canonical_prompt",
          kind: "agent",
          status: "done",
          summary: task,
        }),
      },
    });
    expect(promptRun).toMatchObject({
      id: expect.any(String),
      status: "done",
      summary: 'inspect\n\nInput data:\n{\n  "ref": "HEAD"\n}',
    });

    for (const [target, invalidInput, expected] of [
      [echo!.name, { data: { marker: "preserved" } }, "Invalid callable input"],
      [echo!.name, { prompt: "   ", data: { marker: "preserved" } }, "non-whitespace"],
      [echo!.name, "echo this", "Invalid callable input"],
      [echo!.name, { prompt: "echo this", task: "retired alias" }, "Invalid callable input"],
      ["owner/echo", { prompt: "echo this" }, "Callable target not found"],
    ] as const) {
      const rejected = await run(target, invalidInput, {
        projectRoot: env.projectRoot,
        cwd: env.projectRoot,
        models: {},
        timeoutMs: 1_000,
      });
      expect(rejected).toMatchObject({
        status: "error",
        summary: expect.stringContaining(expected),
      });
      expect(rejected).not.toHaveProperty("id");
    }
  });

  test("passes domain context and reports explicit missing-service errors", async () => {
    const env = setupDirectLayout();
    const skillDir = join(env.agentsRoot, "reviewer", "skills", "careful-audit");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: careful-audit",
        "description: Audit changes carefully",
        "---",
        "# Careful Audit Skill",
        "Always check boundary conditions first.",
      ].join("\n"),
    );

    let capturedPrompt = "";
    const skillAndContextRun = await runDirectWorkflow({
      module: {
        name: "skill-and-context-step",
        description: "Calls reviewer with domain context and skill",
        async execute(ctx) {
          const assignment = ctx.input as {
            goal: string;
            acceptance: string[];
            constraints: string[];
          };
          const prompt = [
            `Goal: ${assignment.goal}`,
            "Acceptance:",
            ...assignment.acceptance.map((item) => `- ${item}`),
            "Constraints:",
            ...assignment.constraints.map((item) => `- ${item}`),
          ].join("\n");
          const step = await ctx.call("global/reviewer", { prompt });
          return ctx.done(step.summary);
        },
      },
      agentName: "owner",
      input: {
        goal: "Ensure boundary.ts handles empty input",
        acceptance: ["Empty input returns null", "Existing callers pass"],
        constraints: ["No public signature changes"],
      },
      projectRoot: env.projectRoot,
      workRoot: env.workRoot,
      agentsRoot: env.agentsRoot,
      sharedRoot: env.sharedRoot,
      outputRoot: env.outputRoot,
      models: { test: fakeModel() as any },
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        try {
          capturedPrompt = prep.prepared.prompt;
          return {
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            status: "done",
            lastAssistantText: "Audited",
            messages: [],
            durationMs: 1,
            finishResult: { status: "done", summary: "audited-ok" },
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally {
          prep.cleanup();
        }
      },
    });

    expect(skillAndContextRun.ok).toBe(true);
    expect(capturedPrompt).toContain("Goal: Ensure boundary.ts handles empty input");
    expect(capturedPrompt).toContain("- Empty input returns null");
    expect(capturedPrompt).toContain("- No public signature changes");

    // Unconfigured read and partial metric services throw explicit errors instead of returning null or no-op:
    const unconfiguredServicesRun = await runDirectWorkflow({
      module: {
        name: "unconfigured-reads-and-metrics",
        description: "Probes unconfigured standalone read and partial metric methods",
        async execute(ctx) {
          const errors: string[] = [];
          for (const probe of [
            () => ctx.read.metric("health"),
            () => ctx.read.execution("exec-1"),
            () => ctx.read.appResult("item-1"),
            () => ctx.read.tasks.list(),
            () => ctx.read.tasks.get("t-1"),
            async () => ctx.metrics.define({ id: "m1" }),
          ]) {
            try {
              await probe();
            } catch (err) {
              errors.push(err instanceof Error ? err.message : String(err));
            }
          }
          return ctx.done("probed", errors);
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
      metrics: {
        evaluate: () => [],
      },
    });
    expect(unconfiguredServicesRun.ok).toBe(true);
    expect(unconfiguredServicesRun.result?.output).toEqual([
      "read.metric read is not configured in standalone mode",
      "read.execution read is not configured in standalone mode",
      "read.appResult read is not configured in standalone mode",
      "read.tasks.list read is not configured in standalone mode",
      "read.tasks.get read is not configured in standalone mode",
      "metrics.define is not configured in standalone mode",
    ]);
  });
});
