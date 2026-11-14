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
  type DirectAgentRunOptions,
  type DirectAgentRunResult,
} from "../../may-agent/src/app/direct-agent.js";
import { fakeModel } from "../../may-agent/test/fixtures/model.js";
import {
  buildGymToolDenials,
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
      ["owner", ["coding", "workflow", "checkpoint", "finish"], "Lab owner prompt"],
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
  const first = await ctx.call("reviewer", "Phase 1: " + ctx.input.target, { tools: "readonly" });
  const second = await ctx.call("reviewer", "Phase 2: " + ctx.input.target);
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

  test("denies hosted tools including workflow by default in Gym", async () => {
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
        tools: ["coding", "workflow", "checkpoint", "finish"],
      }),
    );

    const defaultDenials = buildGymToolDenials(ownerDir);
    expect(defaultDenials.map((d) => d.name)).toEqual(["workflow", "checkpoint"]);
  });

  test("executes and scores real alex.app verified-coder workflow_entry scenario end to end", async () => {
    const { cpSync, spawnSync } = await import("node:child_process").then(async (cp) => ({
      cpSync: (await import("node:fs")).cpSync,
      spawnSync: cp.spawnSync,
    }));
    const scenarioDir = join(
      import.meta.dirname,
      "../scenarios/verified-coder-repair-loop",
    );
    const meta = JSON.parse(readFileSync(join(scenarioDir, "scenario.json"), "utf8"));
    const root = mkdtempSync(join(tmpdir(), "gym-verified-coder-scenario-"));
    tempRoots.push(root);
    const workDir = join(root, "work");
    const gymState = join(root, "state");
    mkdirSync(workDir, { recursive: true });
    mkdirSync(gymState, { recursive: true });
    cpSync(join(scenarioDir, "environment"), workDir, { recursive: true });

    const repoRoot = join(import.meta.dirname, "../../..");
    let attempt = 0;
    const outcome = await runGymWorkflowEntry({
      entry: meta.workflow_entry,
      defaultAgentName: meta.agent_type,
      taskText: readFileSync(join(scenarioDir, "task.md"), "utf8"),
      repoRoot,
      workDir,
      gymState,
      agentsRoot: join(repoRoot, "agents"),
      projectsRoot: join(repoRoot, "projects"),
      sharedRoot: join(repoRoot, "shared"),
      globalAgentsRoot: join(repoRoot, "agents"),
      models: { "gpt-5.6-sol": fakeModel() as any },
      timeoutMs: 30_000,
      runAgent: async (opts): Promise<DirectAgentRunResult> => {
        attempt++;
        if (attempt === 2) {
          writeFileSync(
            join(workDir, "math.cjs"),
            "exports.add = function add(a, b) { return a + b; };\n",
          );
        }
        return {
          sessionId: `s_tl_${attempt}`,
          sessionPath: join(opts.outputRoot, "sessions", `s_tl_${attempt}`),
          systemPrompt: "",
          model: "gpt-5.6-sol",
          executionManifest: {
            agent: opts.agentName,
            configuredTools: [],
            deniedTools: [],
            effectiveTools: [],
          },
          status: "done",
          lastAssistantText: `attempt-${attempt}`,
          messages: [],
          durationMs: 5,
          finishResult: {
            status: "success",
            summary: attempt === 1 ? "First try" : "Repaired operator",
          },
          usage: {} as any,
          cleanupConfirmed: true,
        };
      },
    });

    expect(outcome.status).toBe("success");
    const scored = spawnSync(
      "node",
      [join(scenarioDir, "success_criteria.js"), workDir],
      { encoding: "utf8" },
    );
    expect(scored.status).toBe(0);
    expect(JSON.parse(scored.stdout)).toMatchObject({
      passed: true,
      summary: "2/2 checks passed",
    });
  });
});
