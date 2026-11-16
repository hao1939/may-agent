import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflowTest } from "@may-agent/sdk/testing";
import * as diagnoseImprovementWorkflow from "./diagnose-improvement.js";

interface TrialFixture {
  scenario: string;
  verdict?: "pass" | "fail" | "invalid";
  agentStatus?: string;
  checks?: Array<{ name: string; passed: boolean; detail?: string }>;
  rawResult?: string;
  requirement?: string;
  output?: string;
  transcript?: string;
  usage?: { turns: number; ops: number; total_tokens: number };
  labelStatus?: string;
  missing?: "result" | "requirement" | "artifact" | "transcript";
  artifactDirectory?: boolean;
}

function makeBaseline(target: string, trials: TrialFixture[]) {
  const root = mkdtempSync(join(tmpdir(), "gym-diag-baseline-"));
  const manifestTrials = trials.map((trial, index) => {
    const trialDir = join(root, "cases", trial.scenario, `trial-${index + 1}`);
    mkdirSync(trialDir, { recursive: true });
    const resultPath = join(trialDir, "result.json");
    const artifactPath = join(trialDir, "task-result.json");
    const transcriptPath = join(trialDir, "transcript.jsonl");
    const requirementPath = join(trialDir, "task.md");
    if (trial.missing !== "result") {
      writeFileSync(
        resultPath,
        trial.rawResult ?? JSON.stringify({
          agent_status: trial.agentStatus ?? "success",
          checks: trial.checks ?? [{ name: "quality", passed: trial.verdict !== "fail" }],
          prompt_hash: `prompt-${index + 1}`,
          framework_sha: "framework-history",
          model: "fixture-model",
        }),
      );
    }
    if (trial.missing !== "requirement") {
      writeFileSync(requirementPath, trial.requirement ?? "Return the required supported result.\n");
    }
    if (trial.missing !== "artifact") {
      if (trial.artifactDirectory) mkdirSync(artifactPath);
      else writeFileSync(artifactPath, trial.output ?? '{"response":"fixture output"}\n');
    }
    if (trial.missing !== "transcript") {
      writeFileSync(transcriptPath, `${trial.transcript ?? "fixture retained transcript"}\n`);
    }
    return {
      scenario: trial.scenario,
      trial: index + 1,
      machine_verdict: trial.verdict,
      label_status: trial.labelStatus,
      usage: trial.usage ?? { turns: 1, ops: 1, total_tokens: 1000 },
      result_path: `cases/${trial.scenario}/trial-${index + 1}/result.json`,
      artifact_path: `cases/${trial.scenario}/trial-${index + 1}/task-result.json`,
      transcript_path: `cases/${trial.scenario}/trial-${index + 1}/transcript.jsonl`,
      provenance: {
        prompt_fingerprint: `manifest-prompt-${index + 1}`,
        framework_revision: "manifest-framework",
        model: "manifest-model",
      },
    };
  });
  writeFileSync(
    join(root, "manifest.json"),
    JSON.stringify({
      agent: target,
      benchmark: "bounded-diagnosis",
      scenarios: trials.map((trial) => trial.scenario),
      proof: { candidate_fingerprint: "historical-candidate-fingerprint" },
      source: { candidate_snapshot: "candidate" },
      trials: manifestTrials,
    }),
  );
  return root;
}

function addAgent(root: string, target: string, location: "global" | "app" = "app") {
  const owner = target.split("/", 1)[0];
  const dir = location === "global"
    ? join(root, "agents", owner)
    : join(root, "projects", "fixture.app", "agents", owner);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "agent.json"), "{}\n");
  writeFileSync(join(dir, "AGENTS.md"), `# ${owner}\n`);
  return dir;
}

function proposal(
  file: string,
  citations = {
    requirement: ["synthetic-explicit-contradiction#1:requirement"],
    output: ["synthetic-explicit-contradiction#1:output"],
  },
) {
  return {
    target: "ignored",
    disposition: "actionable" as const,
    recommended_stage: "stage2_skill" as const,
    detected_regimes: ["ignored"],
    root_cause_summary: "The labeled synthetic output directly contradicts the explicit retained requirement.",
    proposed_changes: [{ file, change_summary: "Add the missing explicit rule.", evidence_citations: citations }],
    verification_plan: { benchmark: "ignored", scenarios: ["ignored"], objective: "ops" as const },
  };
}

function output(run: Awaited<ReturnType<typeof runWorkflowTest>>) {
  return (run.report.result?.output as any)?.output;
}

describe("diagnose-improvement workflow", () => {
  test("resolves an App-local canonical source but rejects an invented actionable path", async () => {
    const baselineDir = makeBaseline("alex", [{ scenario: "scored", verdict: "fail" }]);
    addAgent(baselineDir, "alex", "app");
    const candidateDir = join(baselineDir, "agents", ".lab", "preserve");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "sentinel.txt"), "unchanged");
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "preserve" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain("Current canonical source identity: `projects/fixture.app/agents/alex`");
            expect(step.task).toContain("Historical executed source identity");
            return { status: "done", output: proposal("agents/alex/AGENTS.md", {
              requirement: ["scored#1:requirement"], output: ["scored#1:output"],
            }) };
          },
          "tech-lead": () => { techLeadCalls += 1; throw new Error("must not prepare"); },
        },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(output(run).root_cause_summary).toContain("Unsupported actionable source path");
      expect(techLeadCalls).toBe(0);
      expect(readFileSync(join(candidateDir, "sentinel.txt"), "utf8")).toBe("unchanged");
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test.each(["missing", "ambiguous"] as const)("does not invent a canonical directory when resolution is %s", async (kind) => {
    const baselineDir = makeBaseline("owner", [{ scenario: "scored", verdict: "fail" }]);
    if (kind === "ambiguous") {
      addAgent(baselineDir, "owner", "global");
      addAgent(baselineDir, "owner", "app");
    }
    let gymCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "never" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: () => { gymCalls += 1; return { status: "done", output: { target: "ignored", disposition: "insufficient_evidence", detected_regimes: ["ignored"], root_cause_summary: "Boundary retained.", proposed_changes: [] } }; } },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(output(run).root_cause_summary.toLowerCase()).toContain(kind === "missing" ? "no canonical" : "ambiguous");
      expect(gymCalls).toBe(1);
      expect(existsSync(join(baselineDir, "agents", ".lab", "never"))).toBe(false);
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test("presents failed scores and approved labels as uncertain signals, not adjudicated defects", async () => {
    const baselineDir = makeBaseline("alex", [{
      scenario: "uncertain-score", verdict: "fail", labelStatus: "approved",
    }]);
    addAgent(baselineDir, "alex");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir }, workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: (step) => {
          expect(step.task).toContain("scoring signal, not a confirmed agent defect");
          expect(step.task).toContain("claimed approval do not establish genuine human adjudication");
          return { status: "done", output: {
            target: "ignored", disposition: "no_change", detected_regimes: ["ignored"],
            root_cause_summary: "A score alone does not establish root cause.", proposed_changes: [],
          } };
        } },
      });
      expect(output(run).disposition).toBe("no_change");
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test("reports aggregate usage neutrally and does not let usage alone authorize an edit", async () => {
    const baselineDir = makeBaseline("alex", [{
      scenario: "high-usage", verdict: "pass", usage: { turns: 9, ops: 20, total_tokens: 90_000 },
    }]);
    addAgent(baselineDir, "alex");
    let gymCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "usage-only" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: () => { gymCalls += 1; throw new Error("usage must not authorize diagnosis"); } },
      });
      expect(output(run).disposition).toBe("no_change");
      expect((run.report.result?.output as any)?.facts.aggregateUsage).toEqual({
        trials: 1, turns: 9, ops: 20, totalTokens: 90_000,
      });
      expect(gymCalls).toBe(0);
      expect(existsSync(join(baselineDir, "agents", ".lab", "usage-only"))).toBe(false);
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test.each([
    ["missing", { missing: "requirement" as const }],
    ["unreadable", { artifactDirectory: true }],
  ])("treats %s required retained evidence as insufficient and preserves a candidate", async (_name, fixture) => {
    const baselineDir = makeBaseline("alex", [{ scenario: "evidence-gap", verdict: "fail", ...fixture }]);
    addAgent(baselineDir, "alex");
    const candidateDir = join(baselineDir, "agents", ".lab", "preserve-evidence");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "sentinel.txt"), "unchanged");
    let gymCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "preserve-evidence" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: () => { gymCalls += 1; return { status: "done", output: { target: "ignored", disposition: "insufficient_evidence", detected_regimes: ["ignored"], root_cause_summary: "Boundary retained.", proposed_changes: [] } }; } },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(gymCalls).toBe(1);
      expect(readFileSync(join(candidateDir, "sentinel.txt"), "utf8")).toBe("unchanged");
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test.each([
    ["missing result", { missing: "result" as const }, "result evidence file is missing"],
    ["malformed result", { rawResult: "{not-json" }, "result evidence is malformed"],
    ["invalid scoring verdict", { verdict: "invalid" as const }, "machine_verdict is invalid"],
    ["missing scoring verdict", { verdict: undefined }, "machine_verdict is missing"],
    ["missing artifact", { missing: "artifact" as const }, "artifact evidence file is missing"],
    ["missing transcript", { missing: "transcript" as const }, "transcript evidence file is missing"],
  ])("preserves prior %s evidence-boundary behavior", async (_name, fixture, expectedIssue) => {
    const baselineDir = makeBaseline("alex", [{ scenario: "prior-regression", verdict: "fail", ...fixture }]);
    addAgent(baselineDir, "alex");
    const candidateDir = join(baselineDir, "agents", ".lab", "prior-preserve");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "sentinel.txt"), "unchanged");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "prior-preserve" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: (step) => {
          expect(step.task).toContain(expectedIssue);
          return { status: "done", output: {
            target: "ignored", disposition: "insufficient_evidence", detected_regimes: ["ignored"],
            root_cause_summary: "Boundary retained.", proposed_changes: [],
          } };
        } },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(readFileSync(join(candidateDir, "sentinel.txt"), "utf8")).toBe("unchanged");
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test("treats an empty baseline as insufficient evidence without preparing a candidate", async () => {
    const baselineDir = makeBaseline("alex", []);
    addAgent(baselineDir, "alex");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "empty" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: () => ({ status: "done", output: {
          target: "ignored", disposition: "insufficient_evidence", detected_regimes: ["ignored"],
          root_cause_summary: "Empty baseline.", proposed_changes: [],
        } }) },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(existsSync(join(baselineDir, "agents", ".lab", "empty"))).toBe(false);
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test("rejects retained evidence whose parent symlink escapes the baseline", async () => {
    const baselineDir = makeBaseline("alex", [{ scenario: "escaped", verdict: "fail" }]);
    const outsideDir = mkdtempSync(join(tmpdir(), "gym-diag-outside-"));
    addAgent(baselineDir, "alex");
    writeFileSync(join(outsideDir, "result.json"), JSON.stringify({
      agent_status: "success", checks: [{ name: "quality", passed: false }],
    }));
    writeFileSync(join(outsideDir, "task.md"), "External requirement must not be trusted.\n");
    writeFileSync(join(outsideDir, "task-result.json"), "{\"response\":\"external\"}\n");
    writeFileSync(join(outsideDir, "transcript.jsonl"), "external transcript\n");
    symlinkSync(outsideDir, join(baselineDir, "escaped-parent"), "dir");
    const manifestPath = join(baselineDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.trials[0].result_path = "escaped-parent/result.json";
    manifest.trials[0].requirement_path = "escaped-parent/task.md";
    manifest.trials[0].artifact_path = "escaped-parent/task-result.json";
    manifest.trials[0].transcript_path = "escaped-parent/transcript.jsonl";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "escaped" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: (step) => {
          expect(step.task).toContain("real path escapes baseline");
          return { status: "done", output: {
            target: "ignored", disposition: "insufficient_evidence", detected_regimes: ["ignored"],
            root_cause_summary: "Escaped evidence rejected.", proposed_changes: [],
          } };
        } },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(existsSync(join(baselineDir, "agents", ".lab", "escaped"))).toBe(false);
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  test("parses a valid large result fully while handing off only a bounded excerpt", async () => {
    const rawResult = JSON.stringify({
      padding: "x".repeat(7_000),
      agent_status: "success",
      checks: [{ name: "quality", passed: false, detail: "retained failure" }],
    });
    const baselineDir = makeBaseline("alex", [{ scenario: "large-result", verdict: "fail", rawResult }]);
    addAgent(baselineDir, "alex");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir }, workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: (step) => {
          expect(step.task).toContain('"truncated": true');
          expect(step.task).toContain("retained failure");
          expect(step.task).toContain(`Retained baseline directory: ${baselineDir}`);
          expect(step.task).toContain(`Current canonical source directory: ${join(baselineDir, "projects/fixture.app/agents/alex")}`);
          expect(step.task).not.toContain("Do NOT call tools");
          return { status: "done", output: proposal(
            "projects/fixture.app/agents/alex/AGENTS.md",
            { requirement: ["large-result#1:requirement"], output: ["large-result#1:output"] },
          ) };
        } },
      });
      expect(output(run).disposition).toBe("actionable");
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test("rejects an actionable response with unsupported evidence claims", async () => {
    const baselineDir = makeBaseline("alex", [{ scenario: "scored", verdict: "fail" }]);
    addAgent(baselineDir, "alex");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir }, workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: () => ({ status: "done", output: proposal(
          "projects/fixture.app/agents/alex/AGENTS.md",
          { requirement: ["invented:requirement"], output: ["scored#1:output"] },
        ) }) },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(output(run).root_cause_summary).toContain("unsupported requirement evidence");
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test("labeled synthetic explicit requirement/output contradiction permits supported actionable output", async () => {
    const scenario = "synthetic-explicit-contradiction";
    const baselineDir = makeBaseline("alex/diagnose-improvement", [{
      scenario,
      verdict: "fail",
      requirement: "SYNTHETIC POSITIVE CONTROL: response must preserve the creator test and fix source.\n",
      output: '{"response":"Change the creator test instead of the source."}\n',
      transcript: "Synthetic run retained for positive-control diagnosis.",
    }]);
    addAgent(baselineDir, "alex");
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "supported" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain("SYNTHETIC POSITIVE CONTROL");
            expect(step.task).toContain("matching is structural support only");
            return { status: "done", output: proposal("projects/fixture.app/agents/alex/AGENTS.md") };
          },
          "tech-lead": (step) => {
            techLeadCalls += 1;
            expect(step.task).toContain("synthetic-explicit-contradiction#1:requirement");
            expect(step.task).toContain("Historical executed source identity");
            return { status: "done", output: { modified_files: ["AGENTS.md"], summary: "Prepared cited rule." } };
          },
        },
      });
      expect(run.status).toBe("done");
      expect(output(run).disposition).toBe("actionable");
      expect(output(run).recommended_stage).toBe("stage3_workflow");
      expect(output(run).verification_plan.objective).toBe("quality");
      expect(techLeadCalls).toBe(1);
      expect(existsSync(join(baselineDir, "agents", ".lab", "supported", "agent.json"))).toBe(true);
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });

  test("uses the explicit isolated work repository for hosted App-shaped roots and .lab operations", async () => {
    const repo = mkdtempSync(join(tmpdir(), "gym-diag-hosted-repo-"));
    const domainRoot = mkdtempSync(join(tmpdir(), "gym-diag-hosted-domain-"));
    const baselineDir = makeBaseline("scout", [{ scenario: "hosted", verdict: "fail" }]);
    const canonicalDir = addAgent(repo, "scout");
    const appRoot = join(domainRoot, "projects", "alex.app");
    mkdirSync(join(appRoot, "agents", "alex"), { recursive: true });
    writeFileSync(join(appRoot, "agents", "alex", "agent.json"), "{}\n");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "hosted-candidate" },
        workspace: { appRoot, projectRoot: appRoot, root: repo, output: repo },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain(`Current canonical source directory: ${canonicalDir}`);
            expect(step.task).toContain("Current canonical source identity: `projects/fixture.app/agents/scout`");
            return { status: "done", output: proposal(
              "projects/fixture.app/agents/scout/AGENTS.md",
              { requirement: ["hosted#1:requirement"], output: ["hosted#1:output"] },
            ) };
          },
          "tech-lead": (step) => {
            expect(step.task).toContain(join(repo, "agents", ".lab", "hosted-candidate"));
            return { status: "done", output: { modified_files: ["AGENTS.md"], summary: "Prepared hosted candidate." } };
          },
        },
      });
      expect(run.status).toBe("done");
      expect(output(run).disposition).toBe("actionable");
      expect((run.report.result?.output as any)?.facts.sourceRoot).toBe(repo);
      expect((run.report.result?.output as any)?.facts.sourceRootSelection).toContain("explicit work root");
      expect((run.report.result?.output as any)?.facts.preparedLabDir).toBe(join(repo, "agents", ".lab", "hosted-candidate"));
      expect(existsSync(join(repo, "agents", ".lab", "hosted-candidate", "agent.json"))).toBe(true);
      expect(existsSync(join(appRoot, "agents", ".lab", "hosted-candidate"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(domainRoot, { recursive: true, force: true });
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test("preserves a separate project source root when the work root is only scratch", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "gym-diag-scratch-"));
    const source = mkdtempSync(join(tmpdir(), "gym-diag-source-"));
    const baselineDir = makeBaseline("alex", [{ scenario: "separate", verdict: "fail" }]);
    addAgent(source, "alex");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir }, workspace: { appRoot: source, projectRoot: source, root: scratch, output: scratch },
        mocks: { gym: () => ({ status: "done", output: proposal(
          "projects/fixture.app/agents/alex/AGENTS.md",
          { requirement: ["separate#1:requirement"], output: ["separate#1:output"] },
        ) }) },
      });
      expect(output(run).disposition).toBe("actionable");
      expect((run.report.result?.output as any)?.facts.sourceRoot).toBe(source);
      expect((run.report.result?.output as any)?.facts.sourceRootSelection).toContain("explicit project root");
    } finally {
      rmSync(scratch, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test("keeps the isolated work repository authoritative when another explicit root also has source", async () => {
    const isolated = mkdtempSync(join(tmpdir(), "gym-diag-isolated-"));
    const otherSource = mkdtempSync(join(tmpdir(), "gym-diag-other-source-"));
    const baselineDir = makeBaseline("scout", [{ scenario: "competing", verdict: "fail" }]);
    const isolatedCanonical = addAgent(isolated, "scout");
    addAgent(otherSource, "scout");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir }, workspace: { projectRoot: otherSource, root: isolated },
        mocks: { gym: (step) => {
          expect(step.task).toContain(`Current canonical source directory: ${isolatedCanonical}`);
          expect(step.task).not.toContain(`Current canonical source directory: ${join(otherSource, "projects/fixture.app/agents/scout")}`);
          return { status: "done", output: proposal(
            "projects/fixture.app/agents/scout/AGENTS.md",
            { requirement: ["competing#1:requirement"], output: ["competing#1:output"] },
          ) };
        } },
      });
      expect(output(run).disposition).toBe("actionable");
      expect((run.report.result?.output as any)?.facts.sourceRoot).toBe(isolated);
    } finally {
      rmSync(isolated, { recursive: true, force: true });
      rmSync(otherSource, { recursive: true, force: true });
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test("fails closed when a selected repository mixes a local target with an escaping duplicate", async () => {
    const isolated = mkdtempSync(join(tmpdir(), "gym-diag-mixed-escape-"));
    const outside = mkdtempSync(join(tmpdir(), "gym-diag-mixed-outside-"));
    const baselineDir = makeBaseline("scout", [{ scenario: "mixed-escape", verdict: "fail" }]);
    addAgent(isolated, "scout", "app");
    const outsideAgent = addAgent(outside, "scout", "global");
    mkdirSync(join(isolated, "agents"), { recursive: true });
    symlinkSync(outsideAgent, join(isolated, "agents", "scout"), "dir");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir }, workspace: { projectRoot: isolated, root: isolated },
        mocks: { gym: (step) => {
          expect(step.task).toContain("ambiguous or escape the selected source root");
          return { status: "done", output: {
            target: "ignored", disposition: "insufficient_evidence", detected_regimes: ["ignored"],
            root_cause_summary: "Boundary retained.", proposed_changes: [],
          } };
        } },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(output(run).root_cause_summary).toContain("ambiguous or escape");
      expect((run.report.result?.output as any)?.facts.currentSourceIdentity).toBeUndefined();
    } finally {
      rmSync(isolated, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test("does not fall back to another explicit root when the selected repository is ambiguous", async () => {
    const isolated = mkdtempSync(join(tmpdir(), "gym-diag-ambiguous-isolated-"));
    const otherSource = mkdtempSync(join(tmpdir(), "gym-diag-unambiguous-other-"));
    const baselineDir = makeBaseline("scout", [{ scenario: "ambiguous-selected", verdict: "fail" }]);
    addAgent(isolated, "scout", "global");
    addAgent(isolated, "scout", "app");
    addAgent(otherSource, "scout");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir }, workspace: { projectRoot: otherSource, root: isolated },
        mocks: { gym: () => ({ status: "done", output: {
          target: "ignored", disposition: "insufficient_evidence", detected_regimes: ["ignored"],
          root_cause_summary: "Boundary retained.", proposed_changes: [],
        } }) },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(output(run).root_cause_summary).toContain("ambiguous");
      expect((run.report.result?.output as any)?.facts.sourceRoot).toBe(isolated);
      expect((run.report.result?.output as any)?.facts.currentSourceIdentity).toBeUndefined();
    } finally {
      rmSync(isolated, { recursive: true, force: true });
      rmSync(otherSource, { recursive: true, force: true });
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test("preserves authoritative blocked status and candidate protection", async () => {
    const baselineDir = makeBaseline("alex", [{
      scenario: "blocked", verdict: "fail", agentStatus: "blocked",
      transcript: "BLOCKED: no file-writing tool was available with readonly tools.",
    }]);
    addAgent(baselineDir, "alex");
    const candidateDir = join(baselineDir, "agents", ".lab", "blocked-preserve");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "sentinel.txt"), "unchanged");
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "blocked-preserve" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: { gym: () => ({ status: "done", output: { target: "ignored", disposition: "insufficient_evidence", detected_regimes: ["ignored"], root_cause_summary: "Blocked execution.", proposed_changes: [] } }) },
      });
      expect(output(run).disposition).toBe("insufficient_evidence");
      expect(output(run).detected_regimes).toContain("execution_failure");
      expect(output(run).detected_regimes).toContain("readonly_write_conflict");
      expect(readFileSync(join(candidateDir, "sentinel.txt"), "utf8")).toBe("unchanged");
    } finally { rmSync(baselineDir, { recursive: true, force: true }); }
  });
});
