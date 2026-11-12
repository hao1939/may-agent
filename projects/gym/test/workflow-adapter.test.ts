import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflowTest } from "../../may-agent/packages/sdk/src/testing.js";
import * as reviewChangeExemplar from "../../alex.app/docs/examples/review-change";
import {
  prepareDirectAgentExecution,
  type DirectAgentRunResult,
} from "../../may-agent/src/app/direct-agent.js";
import { fakeModel } from "../../may-agent/test/fixtures/model.js";
import {
  buildGymToolDenials,
  createGymAgentWorkflowTool,
  runGymWorkflowEntry,
} from "../src/workflow-adapter";

const tempRoots: string[] = [];
afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Gym Host-free workflow support & executable-skill exemplar", () => {
  test("runs canonical docs/examples/review-change.ts through runWorkflowTest with inputSchema and fixture checks", async () => {
    const badInput = await runWorkflowTest(reviewChangeExemplar, {
      input: { subjectRef: "" },
      agents: {
        reviewer: { output: { subjectRef: "HEAD", summary: "unused" } },
      },
    });
    expect(badInput.ok).toBe(false);
    expect(badInput.started).toBe(false);

    const partialPass = await runWorkflowTest(reviewChangeExemplar, {
      input: { subjectRef: "HEAD~1..HEAD" },
      agents: {
        reviewer: [
          {
            status: "blocked",
            summary: "Partial findings",
            output: {
              subjectRef: "HEAD~1..HEAD",
              verdict: "changes-needed",
              summary: "Found one boundary issue; live test still pending",
            },
          },
        ],
      },
    });
    expect(partialPass.ok).toBe(true);
    expect(partialPass.status).toBe("done");
    expect(partialPass.unconsumedFixtures).toEqual([]);
    expect(partialPass.result?.output).toMatchObject({
      reviewExecutionId: "s_test_reviewer_0",
      review: {
        subjectRef: "HEAD~1..HEAD",
        verdict: "changes-needed",
      },
    });
  });

  test("executes direct workflow_entry scenarios in Gym with lab-overlaid prompts, workflow-run.json, and combined transcripts", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-workflow-entry-"));
    tempRoots.push(root);
    const repoRoot = join(root, "repo");
    const workDir = join(root, "work");
    const gymState = join(root, "state");
    const agentsRoot = join(root, "agents-lab");
    const projectsRoot = join(repoRoot, "projects");
    const sharedRoot = join(repoRoot, "shared");
    const globalAgentsRoot = join(repoRoot, "agents");
    mkdirSync(workDir, { recursive: true });
    mkdirSync(gymState, { recursive: true });
    mkdirSync(projectsRoot, { recursive: true });
    mkdirSync(sharedRoot, { recursive: true });
    mkdirSync(globalAgentsRoot, { recursive: true });

    for (const [name, tools, prompt] of [
      ["owner", ["coding", "workflow", "message", "finish"], "Lab owner prompt"],
      ["reviewer", ["coding", "finish"], "Lab reviewer v3 prompt"],
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
      writeFileSync(join(dir, "AGENTS.md"), `# ${name}\n\n${prompt}\n`);
    }

    writeFileSync(
      join(agentsRoot, "owner", "workflows", "two-step-check.ts"),
      `
export const name = "two-step-check";
export const description = "Runs reviewer twice and returns combined summary";
export const inputSchema = {
  type: "object",
  properties: { target: { type: "string", minLength: 1 } },
  required: ["target"],
  additionalProperties: false,
};
export async function execute(ctx) {
  const first = await ctx.agents.call("reviewer", "Phase 1: " + ctx.input.target, { tools: "readonly" });
  const second = await ctx.agents.call("reviewer", "Phase 2: " + ctx.input.target);
  return ctx.done(first.summary + " + " + second.summary, { target: ctx.input.target });
}
`,
    );

    let stepNum = 0;
    const seenEffectiveTools: string[][] = [];
    const seenSystemPrompts: string[] = [];

    const outcome = await runGymWorkflowEntry({
      entry: { workflow: "two-step-check", input: { target: "src/cli.ts" } },
      defaultAgentName: "owner",
      taskText: "Fallback task text",
      repoRoot,
      workDir,
      gymState,
      agentsRoot,
      projectsRoot,
      sharedRoot,
      globalAgentsRoot,
      models: { test: fakeModel() as any },
      timeoutMs: 30_000,
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        const prep = await prepareDirectAgentExecution(opts);
        try {
          stepNum++;
          seenEffectiveTools.push(prep.executionManifest.effectiveTools);
          seenSystemPrompts.push(prep.prepared.systemPrompt);
          mkdirSync(prep.sessionPath, { recursive: true });
          writeFileSync(
            join(prep.sessionPath, "session.jsonl"),
            `${JSON.stringify({ role: "assistant", step: stepNum })}\n`,
          );
          return {
            sessionId: prep.sessionId,
            sessionPath: prep.sessionPath,
            systemPrompt: prep.prepared.systemPrompt,
            model: prep.model,
            executionManifest: prep.executionManifest,
            status: "done",
            lastAssistantText: `step-${stepNum}`,
            messages: [],
            durationMs: 5,
            finishResult: { status: "success", summary: `step-${stepNum}` },
            usage: prep.prepared.preparation as any,
            cleanupConfirmed: await prep.cleanupAsync(),
          };
        } finally {
          prep.cleanup();
        }
      },
    });

    expect(outcome.status).toBe("success");
    expect(seenSystemPrompts[0]).toContain("Lab reviewer v3 prompt");
    // Step 1 used { tools: "readonly" }; Step 2 used full coding tools
    expect(seenEffectiveTools[0]).toEqual(["read", "finish"]);
    expect(seenEffectiveTools[1]).toContain("bash");

    const runReportPath = join(workDir, "workflow-run.json");
    expect(existsSync(runReportPath)).toBe(true);
    const report = JSON.parse(readFileSync(runReportPath, "utf8"));
    expect(report.status).toBe("done");
    expect(report.steps).toHaveLength(2);
    expect(report.result.summary).toBe("step-1 + step-2");

    const combinedTranscript = readFileSync(
      join(outcome.sessionPath, "session.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(combinedTranscript).toEqual([
      { role: "assistant", step: 1 },
      { role: "assistant", step: 2 },
    ]);
  });

  test("denies workflow tool by default in Gym and exposes sandboxed workflow tool when allow_workflow is enabled", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-allow-workflow-"));
    tempRoots.push(root);
    const ownerDir = join(root, "agents", "owner");
    mkdirSync(join(ownerDir, "workflows"), { recursive: true });
    mkdirSync(join(root, "shared"), { recursive: true });
    mkdirSync(join(root, "work"), { recursive: true });
    writeFileSync(
      join(ownerDir, "agent.json"),
      JSON.stringify({
        name: "owner",
        description: "Owner",
        domain: "test",
        model: "test",
        tools: ["coding", "workflow", "message", "finish"],
      }),
    );
    writeFileSync(
      join(ownerDir, "workflows", "ping.ts"),
      `
export const name = "ping";
export const description = "Simple ping workflow";
export async function execute(ctx) {
  return ctx.done("pong:" + String(ctx.input));
}
`,
    );

    const defaultDenials = buildGymToolDenials(ownerDir);
    expect(defaultDenials.map((d) => d.name)).toEqual(["workflow", "message"]);

    const optedInDenials = buildGymToolDenials(ownerDir, { allowWorkflow: true });
    expect(optedInDenials.map((d) => d.name)).toEqual(["message"]);

    const wfTool = createGymAgentWorkflowTool({
      agentName: "owner",
      agentDir: ownerDir,
      repoRoot: root,
      workDir: join(root, "work"),
      gymState: join(root, "state"),
      agentsRoot: join(root, "agents"),
      projectsRoot: join(root, "projects"),
      sharedRoot: join(root, "shared"),
      globalAgentsRoot: join(root, "agents"),
      models: { test: fakeModel() as any },
      timeoutMs: 10_000,
    });

    const prep = await prepareDirectAgentExecution({
      agentName: "owner",
      task: "Run ping workflow",
      projectRoot: root,
      workRoot: join(root, "work"),
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      outputRoot: join(root, "state"),
      models: { test: fakeModel() as any },
      toolDenials: optedInDenials,
      workflowTool: wfTool,
    });
    try {
      expect(prep.executionManifest.effectiveTools).toContain("workflow");
      const raw = await wfTool.execute("tc_ping", {
        action: "run",
        name: "ping",
        input: "gym",
      } as any);
      expect(JSON.parse((raw.content[0] as { text: string }).text)).toMatchObject({
        type: "done",
        status: "done",
        summary: "pong:gym",
      });
    } finally {
      await prep.cleanupAsync();
    }
  });
});
