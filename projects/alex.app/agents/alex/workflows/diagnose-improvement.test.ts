import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflowTest } from "@may-agent/sdk/testing";
import * as diagnoseImprovementWorkflow from "./diagnose-improvement.js";

interface TrialFixture {
  scenario: string;
  verdict?: "pass" | "fail" | "invalid";
  result?: unknown;
  rawResult?: string;
  transcript?: string;
  usage?: { turns: number; ops: number; total_tokens: number };
}

function makeBaseline(target: string, trials: TrialFixture[]) {
  const root = mkdtempSync(join(tmpdir(), "gym-diag-baseline-"));
  const manifestTrials = trials.map((trial, index) => {
    const trialDir = join(root, "cases", trial.scenario, `trial-${index + 1}`);
    mkdirSync(trialDir, { recursive: true });
    const resultPath = join(trialDir, "result.json");
    if (trial.rawResult !== undefined) writeFileSync(resultPath, trial.rawResult);
    else if (trial.result !== undefined) writeFileSync(resultPath, JSON.stringify(trial.result));
    if (trial.transcript !== undefined) {
      writeFileSync(join(trialDir, "transcript.jsonl"), `${trial.transcript}\n`);
    }
    return {
      scenario: trial.scenario,
      machine_verdict: trial.verdict,
      usage: trial.usage ?? { turns: 1, ops: 1, total_tokens: 1000 },
      result_path: `cases/${trial.scenario}/trial-${index + 1}/result.json`,
      transcript_path: trial.transcript === undefined
        ? undefined
        : `cases/${trial.scenario}/trial-${index + 1}/transcript.jsonl`,
    };
  });
  writeFileSync(
    join(root, "manifest.json"),
    JSON.stringify({
      agent: target,
      benchmark: "bounded-diagnosis",
      scenarios: trials.map((trial) => trial.scenario),
      trials: manifestTrials,
    }),
  );
  return root;
}

function noActionProposal(disposition: "no_change" | "insufficient_evidence") {
  return {
    target: "ignored",
    disposition,
    detected_regimes: ["ignored"],
    root_cause_summary: disposition === "no_change" ? "No supported change." : "Evidence is incomplete.",
    proposed_changes: [],
  };
}

describe("diagnose-improvement workflow", () => {
  test("uses result.json execution status and abstains when execution is blocked", async () => {
    const baselineDir = makeBaseline("may/bounded-cleanup", [
      {
        scenario: "blocked-run",
        verdict: "invalid",
        result: { agent_status: "blocked", checks: [] },
        transcript: "BLOCKED: no file-writing tool was available with readonly tools.",
      },
    ]);
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "must-not-be-prepared" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain('"agentStatus": "blocked"');
            expect(step.task).toContain("execution_failure");
            expect(step.task).toContain("readonly_write_conflict");
            return { status: "done", output: noActionProposal("insufficient_evidence") };
          },
          "tech-lead": () => {
            techLeadCalls += 1;
            throw new Error("tech-lead must not be called");
          },
        },
      });
      expect(run.status).toBe("done");
      expect(techLeadCalls).toBe(0);
      expect((run.report.result?.output as any)?.output?.disposition).toBe("insufficient_evidence");
      expect(existsSync(join(baselineDir, "agents", ".lab", "must-not-be-prepared"))).toBe(false);
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test.each([
    ["missing", undefined, undefined, "result.json not found"],
    ["malformed", undefined, "{not-json", "result.json is malformed"],
  ])("reports %s result evidence explicitly and does not prepare a candidate", async (_name, result, rawResult, expectedDiagnostic) => {
    const baselineDir = makeBaseline("alex", [
      { scenario: "evidence-gap", verdict: "invalid", result, rawResult },
    ]);
    const candidateDir = join(baselineDir, "agents", ".lab", "preserve-me");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "sentinel.txt"), "unchanged");
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "preserve-me" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain(expectedDiagnostic);
            return { status: "done", output: noActionProposal("insufficient_evidence") };
          },
          "tech-lead": () => {
            techLeadCalls += 1;
            throw new Error("tech-lead must not be called");
          },
        },
      });
      expect(run.status).toBe("done");
      expect(techLeadCalls).toBe(0);
      expect(readFileSync(join(candidateDir, "sentinel.txt"), "utf8")).toBe("unchanged");
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test("returns no-change for healthy trials without preparing a candidate", async () => {
    const baselineDir = makeBaseline("alex", [
      { scenario: "healthy", verdict: "pass", result: { agent_status: "success", checks: [{ name: "ok", passed: true }] } },
    ]);
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "unneeded" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain("healthy_baseline");
            expect(step.task).toContain("Deterministic evidence disposition: `no_change`");
            return { status: "done", output: noActionProposal("no_change") };
          },
          "tech-lead": () => {
            techLeadCalls += 1;
            throw new Error("tech-lead must not be called");
          },
        },
      });
      expect(run.status).toBe("done");
      expect(techLeadCalls).toBe(0);
      expect((run.report.result?.output as any)?.output?.proposed_changes).toEqual([]);
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test.each([
    ["invalid", "invalid" as const],
    ["missing", undefined],
  ])("treats %s scoring verdict as insufficient evidence even at high usage", async (_name, verdict) => {
    const baselineDir = makeBaseline("alex", [
      {
        scenario: "unscored-high-usage",
        verdict,
        result: { agent_status: "success", checks: [{ name: "ok", passed: true }] },
        usage: { turns: 4, ops: 5, total_tokens: 40_000 },
      },
    ]);
    const candidateDir = join(baselineDir, "agents", ".lab", "preserve-invalid");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "sentinel.txt"), "unchanged");
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "preserve-invalid" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain("insufficient_evidence");
            expect(step.task).not.toContain('"token_or_op_bloat"');
            return { status: "done", output: noActionProposal("insufficient_evidence") };
          },
          "tech-lead": () => {
            techLeadCalls += 1;
            throw new Error("tech-lead must not be called");
          },
        },
      });
      expect(run.status).toBe("done");
      expect(techLeadCalls).toBe(0);
      expect((run.report.result?.output as any)?.output?.disposition).toBe("insufficient_evidence");
      expect(readFileSync(join(candidateDir, "sentinel.txt"), "utf8")).toBe("unchanged");
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test("treats an empty baseline as insufficient evidence", async () => {
    const baselineDir = makeBaseline("alex", []);
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "empty-must-not-prepare" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain("Deterministic evidence disposition: `insufficient_evidence`");
            return { status: "done", output: noActionProposal("insufficient_evidence") };
          },
          "tech-lead": () => {
            techLeadCalls += 1;
            throw new Error("tech-lead must not be called");
          },
        },
      });
      expect(run.status).toBe("done");
      expect(techLeadCalls).toBe(0);
      expect((run.report.result?.output as any)?.output?.disposition).toBe("insufficient_evidence");
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test.each([
    ["quality failure", "fail" as const, { turns: 1, ops: 1, total_tokens: 1000 }, "no_change" as const],
    ["high usage", "pass" as const, { turns: 4, ops: 5, total_tokens: 40_000 }, "insufficient_evidence" as const],
  ])("accepts specialist abstention for an otherwise actionable %s", async (_name, verdict, usage, specialistDisposition) => {
    const baselineDir = makeBaseline("alex", [
      {
        scenario: "actionable-but-declined",
        verdict,
        result: {
          agent_status: "success",
          checks: [{ name: "quality", passed: verdict === "pass", detail: "candidate not worthwhile" }],
        },
        usage,
      },
    ]);
    const candidateDir = join(baselineDir, "agents", ".lab", "declined");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "sentinel.txt"), "unchanged");
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "declined" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain("Deterministic evidence disposition: `actionable`");
            return { status: "done", output: noActionProposal(specialistDisposition) };
          },
          "tech-lead": () => {
            techLeadCalls += 1;
            throw new Error("tech-lead must not be called");
          },
        },
      });
      expect(run.status).toBe("done");
      expect(techLeadCalls).toBe(0);
      expect((run.report.result?.output as any)?.output?.disposition).toBe(specialistDisposition);
      expect(readFileSync(join(candidateDir, "sentinel.txt"), "utf8")).toBe("unchanged");
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });

  test("prepares a candidate only for a genuine quality failure", async () => {
    const baselineDir = makeBaseline("alex", [
      {
        scenario: "quality-failure",
        verdict: "fail",
        result: {
          agent_status: "success",
          checks: [{ name: "answer-correct", passed: false, detail: "wrong answer" }],
        },
      },
    ]);
    const canonicalDir = join(baselineDir, "agents", "alex");
    mkdirSync(canonicalDir, { recursive: true });
    writeFileSync(join(canonicalDir, "agent.json"), "{}\n");
    writeFileSync(join(canonicalDir, "AGENTS.md"), "# Alex\n");
    let techLeadCalls = 0;
    try {
      const run = await runWorkflowTest(diagnoseImprovementWorkflow, {
        input: { baselineDir, candidateName: "quality-fix" },
        workspace: { projectRoot: baselineDir, workRoot: baselineDir },
        mocks: {
          gym: (step) => {
            expect(step.task).toContain("quality_failure");
            return {
              status: "done",
              output: {
                target: "ignored",
                disposition: "actionable",
                recommended_stage: "stage2_skill",
                detected_regimes: ["ignored"],
                root_cause_summary: "A successful execution failed a required quality check.",
                proposed_changes: [{ file: "agents/alex/AGENTS.md", change_summary: "Add the missing rule." }],
                verification_plan: { benchmark: "ignored", scenarios: ["ignored"], objective: "duration_ms" },
              },
            };
          },
          "tech-lead": (step) => {
            techLeadCalls += 1;
            expect(step.task).toContain("quality_failure");
            return { status: "done", output: { modified_files: ["AGENTS.md"], summary: "Prepared minimal rule." } };
          },
        },
      });
      expect(run.status).toBe("done");
      expect(techLeadCalls).toBe(1);
      expect((run.report.result?.output as any)?.output?.disposition).toBe("actionable");
      expect((run.report.result?.output as any)?.output?.verification_plan?.objective).toBe("quality");
      expect(existsSync(join(baselineDir, "agents", ".lab", "quality-fix", "agent.json"))).toBe(true);
    } finally {
      rmSync(baselineDir, { recursive: true, force: true });
    }
  });
});
