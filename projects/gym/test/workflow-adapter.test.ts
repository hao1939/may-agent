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

  test("executes and scores real alex.app develop-change workflow_entry scenario end to end", async () => {
    const { spawnSync } = await import("node:child_process");
    const scenarioDir = join(
      import.meta.dirname,
      "../scenarios/verified-coder-repair-loop",
    );
    const meta = JSON.parse(
      readFileSync(join(scenarioDir, "scenario.json"), "utf8"),
    );
    expect(meta).toMatchObject({
      agent_type: "alex",
      workflow_entry: {
        agent: "alex",
        workflow: "develop-change",
        input: { verify: ["node", "verify.cjs"] },
      },
    });
    const root = mkdtempSync(join(tmpdir(), "gym-develop-change-scenario-"));
    tempRoots.push(root);
    const workDir = join(root, "work");
    const gymState = join(root, "state");
    mkdirSync(workDir, { recursive: true });
    mkdirSync(gymState, { recursive: true });
    cpSync(join(scenarioDir, "environment"), workDir, { recursive: true });
    const git = (cwd: string, ...args: string[]) =>
      execFileSync("git", ["-C", cwd, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();

    const repoRoot = join(import.meta.dirname, "../../..");
    let implementationAttempts = 0;
    const stages: string[] = [];
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
      agentFixtures: {
        bob: ({ task }) => {
          if (task.includes("Development step: design")) {
            stages.push("design");
            return {
              id: "gym-design",
              kind: "agent",
              status: "done",
              summary: "Designed focused repair",
              output: {
                decision: "implement",
                reason: "The arithmetic operator is localized",
                design: "Preserve the CommonJS export and return a + b",
              },
            };
          }
          stages.push("review");
          return {
            id: "gym-review",
            kind: "agent",
            status: "done",
            summary: "Reviewed verified candidate",
            output: {
              decision: "pass",
              reason: "The committed candidate satisfies the Task and checks",
              commit: git(workDir, "rev-parse", "HEAD"),
              findings: [],
            },
          };
        },
        "tech-lead": () => {
          implementationAttempts += 1;
          stages.push(`implementation-${implementationAttempts}`);
          if (implementationAttempts === 2) {
            writeFileSync(
              join(workDir, "math.cjs"),
              "exports.add = function add(a, b) { return a + b; };\n",
            );
            git(workDir, "add", "math.cjs");
            git(workDir, "commit", "-m", "fix addition");
          }
          return {
            id: `gym-implementation-${implementationAttempts}`,
            kind: "agent",
            status: "done",
            summary:
              implementationAttempts === 1
                ? "Inspected but left the failing candidate"
                : "Fixed and committed addition",
            output: {
              decision: "ready",
              reason:
                implementationAttempts === 1
                  ? "Candidate ready for verification"
                  : "Repair committed",
            },
          };
        },
      },
    });

    expect(outcome.status).toBe("success");
    expect(readFileSync(join(workDir, ".git"), "utf8")).toContain("gitdir:");
    expect(git(workDir, "check-ignore", ".state/probe")).toBe(".state/probe");
    expect(git(workDir, "check-ignore", "transcript.jsonl")).toBe(
      "transcript.jsonl",
    );
    expect(stages).toEqual([
      "design",
      "implementation-1",
      "implementation-2",
      "review",
    ]);
    const report = JSON.parse(
      readFileSync(join(workDir, "workflow-run.json"), "utf8"),
    );
    expect(report).toMatchObject({
      workflow: "develop-change",
      status: "done",
      result: { output: { state: "converged" } },
      cleanup: { confirmed: true },
    });

    // The ordinary Gym CLI exports this harness artifact before scoring.
    writeFileSync(
      join(workDir, "transcript.jsonl"),
      `${JSON.stringify({ note: "workflow transcript exported" })}\n`,
    );
    expect(git(workDir, "status", "--porcelain")).toBe("");

    const built = spawnSync("bun", ["run", "build"], {
      cwd: join(import.meta.dirname, ".."),
      encoding: "utf8",
    });
    expect({
      status: built.status,
      stdout: built.stdout,
      stderr: built.stderr,
    }).toMatchObject({ status: 0 });
    const scored = spawnSync(
      "node",
      [join(scenarioDir, "success_criteria.js"), workDir],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_PATH: join(import.meta.dirname, "../dist"),
        },
      },
    );
    expect({
      status: scored.status,
      stdout: scored.stdout,
      stderr: scored.stderr,
    }).toMatchObject({ status: 0 });
    expect(JSON.parse(scored.stdout)).toMatchObject({
      passed: true,
      summary:
        "✓ [product] verify-script-passes\n✓ [behavior] workflow-run-report-recorded",
    });

    const evidencePath = report.result.output.result.development.evidence.path;
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    const passingReport = evidence.reports.find((item: any) => {
      if (item.stage !== "verification") return false;
      const record = JSON.parse(readFileSync(item.record.path, "utf8"));
      return record.passed === true && record.receipt?.exitCode === 0;
    });
    expect(passingReport).toBeDefined();
    const firstAttemptEvidence = structuredClone(evidence);
    firstAttemptEvidence.reports = evidence.reports.filter(
      (item: any) => item.stage !== "verification" || item === passingReport,
    );
    writeFileSync(
      evidencePath,
      `${JSON.stringify(firstAttemptEvidence, null, 2)}\n`,
    );
    const firstAttemptScored = spawnSync(
      "node",
      [join(scenarioDir, "success_criteria.js"), workDir],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_PATH: join(import.meta.dirname, "../dist"),
        },
      },
    );
    expect(firstAttemptScored.status).toBe(0);
    expect(JSON.parse(firstAttemptScored.stdout)).toMatchObject({
      passed: true,
    });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

    const runReportPath = join(workDir, "workflow-run.json");
    const incompleteReport = structuredClone(report);
    incompleteReport.result.output.state = "incomplete";
    writeFileSync(runReportPath, `${JSON.stringify(incompleteReport)}\n`);
    const rejected = spawnSync(
      "node",
      [join(scenarioDir, "success_criteria.js"), workDir],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_PATH: join(import.meta.dirname, "../dist"),
        },
      },
    );
    expect(rejected.status).toBe(0);
    expect(JSON.parse(rejected.stdout)).toMatchObject({ passed: false });
    writeFileSync(runReportPath, `${JSON.stringify(report, null, 2)}\n`);
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
  const step = await ctx.call("sample-reviewer", "Review " + String(ctx.input), { tools: "readonly" });
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
    expect(scorer.hasWorkflowStep("sample-reviewer", "done")).toBe(true);
    expect(scorer.workflowSteps()).toHaveLength(1);
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
