import { afterEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  prepareDirectAgentExecution,
  type DirectAgentRunOptions,
  type DirectAgentRunResult,
} from "@may-agent/sdk/standalone";
import { runWorkflowTest } from "@may-agent/sdk/testing";
import * as reviewChangeExemplar from "../../alex.app/docs/examples/review-change";
import { fakeModel } from "../../may-agent/test/fixtures/model.js";
import { Score } from "../src/scoring/gym-score-utils";
import {
  buildGymToolDenials,
  prepareGymAgentSandbox,
  resolveGymAgentDir,
  resolveGymLabDir,
  runGymWorkflowEntry,
} from "../src/workflow-adapter";
const tempRoots: string[] = [];
afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Gym Host-free workflow support & executable-skill exemplar", () => {
  test("resolves global and App-owned agents and lab overlays", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-resolution-"));
    tempRoots.push(root);
    const agentsRoot = join(root, "agents");
    const projectsRoot = join(root, "projects");
    const globalAgent = join(agentsRoot, "global-owner");
    const appAgents = join(projectsRoot, "sample.app", "agents");
    const appAgent = join(appAgents, "app-owner");
    const globalLab = join(agentsRoot, ".lab", "global-candidate");
    const appLab = join(appAgents, ".lab", "app-candidate");
    for (const dir of [globalAgent, appAgent, globalLab, appLab]) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(join(globalAgent, "agent.json"), "{}");
    writeFileSync(join(appAgent, "agent.json"), "{}");

    expect(resolveGymAgentDir(agentsRoot, "global-owner", projectsRoot)).toBe(
      globalAgent,
    );
    expect(resolveGymAgentDir(agentsRoot, "app-owner", projectsRoot)).toBe(
      appAgent,
    );
    expect(
      resolveGymLabDir(
        agentsRoot,
        "global-candidate",
        "global-owner",
        projectsRoot,
      ),
    ).toBe(globalLab);
    expect(
      resolveGymLabDir(agentsRoot, "app-candidate", "app-owner", projectsRoot),
    ).toBe(appLab);
  });

  test("overlays an exact retained candidate snapshot without resolving the live lab", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-retained-candidate-"));
    tempRoots.push(root);
    const agentsRoot = join(root, "agents");
    const projectsRoot = join(root, "projects");
    const appAgent = join(projectsRoot, "sample.app", "agents", "app-owner");
    const retainedCandidate = join(root, "run", "candidate");
    mkdirSync(appAgent, { recursive: true });
    mkdirSync(retainedCandidate, { recursive: true });
    writeFileSync(join(appAgent, "agent.json"), "{}\n");
    writeFileSync(join(appAgent, "AGENTS.md"), "Base guidance.\n");
    writeFileSync(join(retainedCandidate, "AGENTS.md"), "Retained guidance.\n");

    const sandbox = prepareGymAgentSandbox({
      baseAgentsRoot: agentsRoot,
      projectsRoot,
      gymRoot: join(root, "gym"),
      agentName: "app-owner",
      labFork: "deleted-live-candidate",
      labDir: retainedCandidate,
    });

    expect(readFileSync(join(sandbox, "app-owner", "AGENTS.md"), "utf8")).toBe(
      "Retained guidance.\n",
    );
  });

  test("runs canonical docs/examples/review-change.ts through runWorkflowTest with inputSchema and fixture checks", async () => {
    const badInput = await runWorkflowTest(reviewChangeExemplar, {
      input: { subjectRef: "" },
      mocks: {
        reviewer: { output: { subjectRef: "HEAD", summary: "unused" } },
      },
    });
    expect(badInput.ok).toBe(false);
    expect(badInput.started).toBe(false);

    const partialPass = await runWorkflowTest(reviewChangeExemplar, {
      input: { subjectRef: "HEAD~1..HEAD" },
      mocks: {
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
      ["owner", ["coding", "agents", "finish"], "Lab owner prompt"],
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
  properties: {
    prompt: { type: "string", minLength: 1 },
    data: {
      type: "object",
      properties: { target: { type: "string", minLength: 1 } },
      required: ["target"],
      additionalProperties: false,
    },
  },
  required: ["prompt", "data"],
  additionalProperties: false,
};
export async function execute(ctx) {
  const first = await ctx.call("global/reviewer", { prompt: "Phase 1: " + ctx.input.data.target });
  const second = await ctx.call("global/reviewer", { prompt: "Phase 2: " + ctx.input.data.target });
  return ctx.done(first.summary + " + " + second.summary, { target: ctx.input.data.target });
}
`,
    );

    let stepNum = 0;
    const seenEffectiveTools: string[][] = [];
    const seenSystemPrompts: string[] = [];

    const outcome = await runGymWorkflowEntry({
      entry: {
        workflow: "two-step-check",
        input: { prompt: "Check the CLI change", data: { target: "src/cli.ts" } },
      },
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
            finishResult: { status: "done", summary: `step-${stepNum}` },
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
    // Child tool policy comes from the registered definition/module policy, not retired call options.
    expect(seenEffectiveTools[0]).toContain("bash");
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

  test("denies hosted tools including agents and query_db by default in Gym", async () => {
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
        tools: ["coding", "agents", "query_db", "finish"],
      }),
    );

    const defaultDenials = buildGymToolDenials(ownerDir);
    expect(defaultDenials.map((d) => d.name)).toEqual(["agents", "query_db"]);
  });

  test("reports retained Task-aware develop-change as blocked without forging a Task envelope", async () => {
    const { spawnSync } = await import("node:child_process");
    const scenarioDir = join(
      import.meta.dirname,
      "../archive/pre-purpose-layout/scenarios/verified-coder-repair-loop",
    );
    const meta = JSON.parse(
      readFileSync(join(scenarioDir, "scenario.json"), "utf8"),
    );
    const root = mkdtempSync(join(tmpdir(), "gym-develop-change-boundary-"));
    tempRoots.push(root);
    const workDir = join(root, "work");
    const gymState = join(root, "state");
    mkdirSync(workDir, { recursive: true });
    mkdirSync(gymState, { recursive: true });
    cpSync(join(scenarioDir, "environment"), workDir, { recursive: true });
    const originalSource = readFileSync(join(workDir, "math.cjs"), "utf8");
    const repoRoot = join(import.meta.dirname, "../../..");
    const specialistCalls: string[] = [];
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
      agentFixtures: Object.fromEntries(["bob", "tech-lead"].map((agent) => [
        agent,
        () => {
          specialistCalls.push(agent);
          throw new Error("Task-aware development must stop before calling specialists");
        },
      ])),
    });

    expect(outcome.status).toBe("blocked");
    expect(specialistCalls).toEqual([]);
    expect(readFileSync(join(workDir, "math.cjs"), "utf8")).toBe(originalSource);
    const report = JSON.parse(
      readFileSync(join(workDir, "workflow-run.json"), "utf8"),
    );
    expect(report).toMatchObject({
      workflow: "develop-change",
      status: "blocked",
      result: {
        type: "blocked",
        reason: "Development requires an ordinary Task and its worktree",
      },
      cleanup: { confirmed: true },
    });

    const built = spawnSync("bun", ["run", "build"], {
      cwd: join(import.meta.dirname, ".."),
      encoding: "utf8",
    });
    expect({ status: built.status, stderr: built.stderr }).toMatchObject({ status: 0 });
    const scored = spawnSync(
      "node",
      [join(scenarioDir, "success_criteria.js"), workDir],
      {
        encoding: "utf8",
        env: { ...process.env, NODE_PATH: join(import.meta.dirname, "../dist") },
      },
    );
    expect({ status: scored.status, stderr: scored.stderr }).toMatchObject({ status: 0 });
    expect(JSON.parse(scored.stdout)).toMatchObject({ passed: false });
  });

  test("executes the candidate dependency tree and does not resurrect a deleted workflow", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-candidate-workflow-"));
    tempRoots.push(root);
    const repoRoot = join(root, "repo");
    const projectsRoot = join(repoRoot, "projects");
    const globalAgentsRoot = join(repoRoot, "agents");
    const sharedRoot = join(repoRoot, "shared");
    const canonicalAgent = join(
      projectsRoot,
      "sample.app",
      "agents",
      "sample-owner",
    );
    const canonicalWorkflows = join(canonicalAgent, "workflows");
    const candidateRoot = join(root, "candidate-agents");
    const candidateAgent = join(candidateRoot, "sample-owner");
    const candidateWorkflows = join(candidateAgent, "workflows");
    for (const dir of [
      canonicalWorkflows,
      candidateWorkflows,
      globalAgentsRoot,
      sharedRoot,
    ]) {
      mkdirSync(dir, { recursive: true });
    }
    const config = JSON.stringify({
      name: "sample-owner",
      description: "Sample owner",
      domain: "test",
      model: "test",
      tools: ["finish"],
    });
    writeFileSync(join(canonicalAgent, "agent.json"), config);
    writeFileSync(join(candidateAgent, "agent.json"), config);
    const entry = `
import { value } from "./helper.js";
export const name = "dependency-check";
export const description = "Reads a relative helper";
export async function execute(ctx) { return ctx.done(value); }
`;
    writeFileSync(join(canonicalWorkflows, "dependency-check.ts"), entry);
    writeFileSync(join(candidateWorkflows, "dependency-check.ts"), entry);
    writeFileSync(
      join(canonicalWorkflows, "helper.ts"),
      'export const value = "canonical";\n',
    );
    writeFileSync(
      join(candidateWorkflows, "helper.ts"),
      'export const value = "candidate";\n',
    );

    const baseConfig = {
      entry: { agent: "sample-owner", workflow: "dependency-check" },
      defaultAgentName: "sample-owner",
      taskText: "unused",
      repoRoot,
      projectsRoot,
      sharedRoot,
      globalAgentsRoot,
      agentsRoot: candidateRoot,
      models: { test: fakeModel() as any },
      timeoutMs: 30_000,
    };
    const outcome = await runGymWorkflowEntry({
      ...baseConfig,
      workDir: join(root, "work"),
      gymState: join(root, "state"),
    });
    expect(outcome.workflowRun.report.result).toMatchObject({
      type: "done",
      summary: "candidate",
    });

    rmSync(join(candidateWorkflows, "dependency-check.ts"));
    await expect(
      runGymWorkflowEntry({
        ...baseConfig,
        workDir: join(root, "deleted-work"),
        gymState: join(root, "deleted-state"),
      }),
    ).rejects.toThrow(/dependency-check/);
  });

  test("prepares .lab overlays for App-owned agents and scores workflow-run.json via Score helpers", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-app-lab-overlay-"));
    tempRoots.push(root);
    const repoRoot = join(root, "repo");
    const workDir = join(root, "work");
    const gymState = join(root, "state");
    const baseAgentsRoot = join(repoRoot, "agents");
    const projectsRoot = join(repoRoot, "projects");
    const sharedRoot = join(repoRoot, "shared");
    const appAgentsDir = join(projectsRoot, "sample.app", "agents");
    mkdirSync(workDir, { recursive: true });
    mkdirSync(gymState, { recursive: true });
    mkdirSync(baseAgentsRoot, { recursive: true });
    mkdirSync(sharedRoot, { recursive: true });

    for (const [name, prompt] of [
      ["sample-owner", "Base App owner prompt"],
      ["sample-reviewer", "Base App reviewer prompt"],
    ] as const) {
      const dir = join(appAgentsDir, name);
      mkdirSync(join(dir, "workflows"), { recursive: true });
      mkdirSync(join(dir, "skills", "old-skill"), { recursive: true });
      writeFileSync(
        join(dir, "agent.json"),
        JSON.stringify({
          name,
          description: `${name} in sample.app`,
          domain: "test",
          model: "test",
          tools: ["coding", "finish"],
        }),
      );
      writeFileSync(join(dir, "AGENTS.md"), `# ${name}\n\n${prompt}\n`);
      writeFileSync(
        join(dir, "skills", "old-skill", "SKILL.md"),
        "---\nname: old-skill\ndescription: old\n---\n",
      );
    }

    const labDir = join(baseAgentsRoot, ".lab", "candidate-v2");
    mkdirSync(join(labDir, "workflows"), { recursive: true });
    mkdirSync(join(labDir, "skills", "new-skill"), { recursive: true });
    writeFileSync(
      join(labDir, "AGENTS.md"),
      "# sample-owner\n\nCandidate v2 App owner prompt\n",
    );
    writeFileSync(
      join(labDir, "skills", "new-skill", "SKILL.md"),
      "---\nname: new-skill\ndescription: new\n---\n",
    );
    writeFileSync(
      join(labDir, "workflows", "verify-review.ts"),
      `
export const name = "verify-review";
export const description = "Candidate v2 workflow";
export async function execute(ctx) {
  const step = await ctx.call("global/sample-reviewer", { prompt: "Review " + String(ctx.input) });
  return ctx.done("candidate-v2:" + step.summary, { reviewed: true, stepSummary: step.summary });
}
`,
    );

    const sandboxAgentsRoot = prepareGymAgentSandbox({
      baseAgentsRoot,
      projectsRoot,
      gymRoot: root,
      agentName: "sample-owner",
      labFork: "candidate-v2",
    });

    expect(
      existsSync(
        join(sandboxAgentsRoot, "sample-owner", "skills", "old-skill"),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          sandboxAgentsRoot,
          "sample-owner",
          "skills",
          "new-skill",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(
      readFileSync(
        join(sandboxAgentsRoot, "sample-owner", "AGENTS.md"),
        "utf8",
      ),
    ).toContain("Candidate v2 App owner prompt");

    const outcome = await runGymWorkflowEntry({
      entry: {
        agent: "sample-owner",
        workflow: "verify-review",
        input: "PR-42",
      },
      defaultAgentName: "sample-owner",
      taskText: "Review PR-42",
      repoRoot,
      workDir,
      gymState,
      agentsRoot: sandboxAgentsRoot,
      projectsRoot,
      sharedRoot,
      globalAgentsRoot: baseAgentsRoot,
      models: { test: fakeModel() as any },
      timeoutMs: 30_000,
      agentFixtures: {
        "sample-reviewer": async () => ({
          id: "s_sample_rev_1",
          kind: "agent",
          status: "done",
          summary: "lgtm",
        }),
      },
    });

    expect(outcome.status).toBe("success");

    const scorer = new Score(workDir);
    expect(scorer.hasWorkflowRun()).toBe(true);
    expect(scorer.workflowStatus()).toBe("done");
    expect(scorer.workflowSteps()).toHaveLength(1);
    expect(scorer.workflowSteps()[0]).toMatchObject({ target: "global/sample-reviewer" });
    expect(scorer.workflowSummary()).toBe("candidate-v2:lgtm");
    expect(
      scorer.workflowOutput<{ reviewed: boolean; stepSummary: string }>(),
    ).toEqual({
      reviewed: true,
      stepSummary: "lgtm",
    });
    expect(scorer.workflowCleanupConfirmed()).toBe(true);
  });
});
