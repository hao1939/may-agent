/**
 * Executable Skill (`diagnose-improvement` workflow) — Stage 3 of the
 * Prompt -> Skill -> Code Workflow progression for Alex (`alex.app` owner).
 *
 * Supports two modes in one workflow owned by `alex`:
 * 1. **Diagnose Only (`candidateName` omitted):**
 *    Pre-reads a frozen Gym baseline (`manifest.json` + failing/slow trial
 *    `result.json` + `transcript.jsonl`), classifies failure and efficiency
 *    regimes in deterministic code, and calls the `gym` specialist (`readonly`)
 *    to produce a structured `ImprovementProposal`.
 * 2. **Diagnose + Prepare `.lab/<candidateName>` (`candidateName` provided):**
 *    After `gym` diagnoses the baseline, seeds `/app/agents/.lab/<candidateName>`
 *    from the target agent's canonical directory and delegates implementation
 *    of the candidate change inside `.lab/<candidateName>` to `tech-lead`.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Type, type Static, type WorkflowContext } from "@may-agent/sdk";

export const name = "diagnose-improvement";
export const description =
  "Analyze a frozen Gym baseline run via the gym specialist and optionally prepare a .lab/<candidateName> improvement via tech-lead.";

export const diagnoseImprovementInputSchema = Type.Object(
  {
    baselineDir: Type.String({ minLength: 1 }),
    outputFile: Type.Optional(Type.String({ minLength: 1 })),
    candidateName: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const improvementProposalSchema = Type.Object(
  {
    target: Type.String({ minLength: 1 }),
    disposition: Type.Union([
      Type.Literal("actionable"),
      Type.Literal("no_change"),
      Type.Literal("insufficient_evidence"),
    ]),
    recommended_stage: Type.Optional(
      Type.Union([
        Type.Literal("stage1_prompt"),
        Type.Literal("stage2_skill"),
        Type.Literal("stage3_workflow"),
      ]),
    ),
    detected_regimes: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    root_cause_summary: Type.String({ minLength: 1 }),
    proposed_changes: Type.Array(
      Type.Object(
        {
          file: Type.String({ minLength: 1 }),
          change_summary: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
    verification_plan: Type.Optional(
      Type.Object(
        {
          benchmark: Type.String({ minLength: 1 }),
          scenarios: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
          objective: Type.Union([
            Type.Literal("quality"),
            Type.Literal("duration_ms"),
            Type.Literal("total_tokens"),
            Type.Literal("ops"),
          ]),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const candidateImplResultSchema = Type.Object(
  {
    modified_files: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    summary: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type DiagnoseImprovementInput = Static<typeof diagnoseImprovementInputSchema>;
export type ImprovementProposal = Static<typeof improvementProposalSchema>;

export interface TrialDiagnostic {
  scenario: string;
  verdict: string;
  agentStatus: string;
  turns: number;
  ops: number;
  totalTokens: number;
  failedChecks: string[];
  evidenceIssues: string[];
  hasReadonlyWriteConflict: boolean;
}

function resolveCanonicalAgentDir(projectRoot: string, agentOrWorkflow: string): string | null {
  const owner = agentOrWorkflow.includes("/")
    ? agentOrWorkflow.slice(0, agentOrWorkflow.indexOf("/"))
    : agentOrWorkflow;
  const globalDir = join(projectRoot, "agents", owner);
  if (existsSync(join(globalDir, "agent.json"))) return globalDir;

  const projectsDir = join(projectRoot, "projects");
  if (!existsSync(projectsDir)) return null;
  for (const entry of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
    const candidate = join(projectsDir, entry.name, "agents", owner);
    if (existsSync(join(candidate, "agent.json"))) return candidate;
  }
  return null;
}

export function extractBaselineDiagnostics(baselineDir: string): {
  target: string;
  benchmark: string;
  scenarios: string[];
  trials: TrialDiagnostic[];
  detectedRegimes: string[];
} {
  const manifestPath = join(baselineDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Baseline manifest.json not found at: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    agent: string;
    benchmark: string;
    scenarios: string[];
    trials: Array<{
      scenario: string;
      machine_verdict?: string;
      agent_status?: string;
      usage?: { turns?: number; ops?: number; total_tokens?: number };
      result_path?: string;
      transcript_path?: string;
    }>;
  };

  const regimes = new Set<string>();
  const trialDiagnostics: TrialDiagnostic[] = [];

  for (const trial of manifest.trials || []) {
    const resPath = trial.result_path ? join(baselineDir, trial.result_path) : "";
    const trPath = trial.transcript_path ? join(baselineDir, trial.transcript_path) : "";
    const evidenceIssues: string[] = [];
    let failedChecks: string[] = [];
    let agentStatus = "unknown";
    const verdict = trial.machine_verdict;

    if (verdict !== "pass" && verdict !== "fail") {
      evidenceIssues.push(
        verdict
          ? `machine_verdict is invalid: ${verdict}`
          : "machine_verdict is missing from the manifest trial",
      );
    }

    if (!resPath) {
      evidenceIssues.push("result_path is missing from the manifest trial");
    } else if (!existsSync(resPath)) {
      evidenceIssues.push(`result.json not found at ${resPath}`);
    } else {
      try {
        const res = JSON.parse(readFileSync(resPath, "utf8")) as {
          agent_status?: string;
          checks?: Array<{ name: string; passed: boolean; gate?: boolean; detail?: string }>;
        };
        if (typeof res.agent_status === "string" && res.agent_status.trim()) {
          agentStatus = res.agent_status;
        } else {
          evidenceIssues.push("result.json is missing agent_status");
        }
        if (!Array.isArray(res.checks)) {
          evidenceIssues.push("result.json is missing checks");
        } else {
          failedChecks = res.checks
            .filter((c) => c && c.passed === false && c.gate !== false)
            .map((c) => `${c.name}: ${c.detail || "failed"}`);
        }
      } catch (error) {
        evidenceIssues.push(
          `result.json is malformed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    let hasReadonlyWriteConflict = false;
    if (trPath && existsSync(trPath)) {
      const trText = readFileSync(trPath, "utf8");
      if (
        agentStatus === "blocked" &&
        (/no file-writing tool/i.test(trText) || /readonly tools/i.test(trText))
      ) {
        hasReadonlyWriteConflict = true;
        regimes.add("readonly_write_conflict");
      }
    }

    const turns = trial.usage?.turns ?? 0;
    const ops = trial.usage?.ops ?? 0;
    const totalTokens = trial.usage?.total_tokens ?? 0;

    if (evidenceIssues.length > 0) {
      regimes.add("insufficient_evidence");
    }
    if (agentStatus !== "unknown" && agentStatus !== "success") {
      regimes.add("execution_failure");
    } else if (evidenceIssues.length === 0 && verdict === "fail") {
      regimes.add("quality_failure");
    }
    if (
      evidenceIssues.length === 0 &&
      agentStatus === "success" &&
      (ops >= 3 || totalTokens >= 25_000)
    ) {
      regimes.add("token_or_op_bloat");
    }

    trialDiagnostics.push({
      scenario: trial.scenario,
      verdict: verdict ?? "missing",
      agentStatus,
      turns,
      ops,
      totalTokens,
      failedChecks,
      evidenceIssues,
      hasReadonlyWriteConflict,
    });
  }

  if (trialDiagnostics.length === 0) {
    regimes.add("insufficient_evidence");
  } else if (regimes.size === 0) {
    regimes.add("healthy_baseline");
  }

  return {
    target: manifest.agent,
    benchmark: manifest.benchmark,
    scenarios: manifest.scenarios || [],
    trials: trialDiagnostics,
    detectedRegimes: [...regimes],
  };
}

export async function execute(ctx: WorkflowContext<DiagnoseImprovementInput>) {
  const workRoot = ctx.workspace?.root ?? ctx.workspace?.projectRoot ?? process.cwd();
  const projectRoot = ctx.workspace?.projectRoot ?? workRoot;
  const baselineDir = resolve(workRoot, ctx.input.baselineDir);
  const diag = extractBaselineDiagnostics(baselineDir);

  const isWorkflowTarget = diag.target.includes("/");
  const hasEvidenceGap =
    diag.trials.length === 0 || diag.trials.some((t) => t.evidenceIssues.length > 0);
  const hasExecutionFailure = diag.trials.some(
    (t) => t.evidenceIssues.length === 0 && t.agentStatus !== "success",
  );
  const hasQualityFailure = diag.trials.some(
    (t) =>
      t.evidenceIssues.length === 0 && t.agentStatus === "success" && t.verdict === "fail",
  );
  const hasEfficiencyProblem = diag.detectedRegimes.includes("token_or_op_bloat");
  const evidenceDisposition: ImprovementProposal["disposition"] =
    hasEvidenceGap || hasExecutionFailure
      ? "insufficient_evidence"
      : hasQualityFailure || hasEfficiencyProblem
        ? "actionable"
        : "no_change";

  // Step 1: Delegate diagnostic analysis to the `gym` specialist (`readonly`)
  const prompt = [
    "# Gym Capability Improvement Diagnosis",
    "",
    `Target: \`${diag.target}\``,
    `Benchmark: \`${diag.benchmark}\``,
    `Detected Regimes: ${diag.detectedRegimes.map((r) => `\`${r}\``).join(", ")}`,
    "",
    "## Trial Diagnostics",
    JSON.stringify(diag.trials, null, 2),
    "",
    "## Evidence Boundary",
    `Deterministic evidence disposition: \`${evidenceDisposition}\``,
    "- Treat result.json `agent_status` as authoritative for execution status; only `pass` or `fail` manifest verdicts are valid scoring evidence.",
    "- Evidence gaps and execution failures require `insufficient_evidence`; do not prescribe a behavioral remediation for them.",
    "- A `no_change` evidence disposition requires `no_change`.",
    "- An `actionable` evidence disposition permits a supported proposal, but you may still return `no_change` or `insufficient_evidence` when no worthwhile remediation is justified.",
    "- For `no_change` or `insufficient_evidence`, return no proposed changes, recommended stage, or verification plan.",
    "- For `actionable`, recommend only the smallest mechanism supported by the diagnostics and include a verification plan.",
    "- Do NOT call any tools. Call `finish(status: \"done\", result: ...)` immediately with the structured proposal.",
  ].join("\n");

  const step = await ctx.call("gym", prompt, {
    tools: "readonly",
    schema: improvementProposalSchema,
  });

  if (step.status !== "done" || !step.output) {
    return ctx.blocked(step.summary || "gym failed to produce an improvement proposal");
  }

  const rawProposal = step.output as ImprovementProposal;
  const disposition: ImprovementProposal["disposition"] =
    evidenceDisposition === "actionable" ? rawProposal.disposition : evidenceDisposition;
  const proposal: ImprovementProposal =
    disposition === "actionable"
      ? {
          ...rawProposal,
          target: diag.target,
          disposition,
          recommended_stage: isWorkflowTarget
            ? "stage3_workflow"
            : rawProposal.recommended_stage,
          detected_regimes: diag.detectedRegimes,
          verification_plan: rawProposal.verification_plan
            ? {
                benchmark: diag.benchmark,
                scenarios: diag.scenarios,
                objective: hasQualityFailure
                  ? "quality"
                  : rawProposal.verification_plan.objective,
              }
            : undefined,
        }
      : {
          target: diag.target,
          disposition,
          detected_regimes: diag.detectedRegimes,
          root_cause_summary: rawProposal.root_cause_summary,
          proposed_changes: [],
        };

  if (
    proposal.disposition === "actionable" &&
    (!proposal.recommended_stage ||
      proposal.proposed_changes.length === 0 ||
      !proposal.verification_plan)
  ) {
    return ctx.blocked("gym returned an incomplete actionable improvement proposal");
  }

  let preparedLabDir: string | undefined;
  let candidateSummary: string | undefined;

  // Step 2 (optional): If `candidateName` is supplied, seed `.lab/<candidateName>`
  // and delegate candidate preparation to `tech-lead`.
  if (ctx.input.candidateName?.trim() && proposal.disposition === "actionable") {
    const candidateName = ctx.input.candidateName.trim();
    const canonicalDir = resolveCanonicalAgentDir(projectRoot, diag.target);
    if (!canonicalDir) {
      return ctx.blocked(`Cannot find canonical agent directory for target: ${diag.target}`);
    }
    preparedLabDir = join(projectRoot, "agents", ".lab", candidateName);
    rmSync(preparedLabDir, { recursive: true, force: true });
    mkdirSync(preparedLabDir, { recursive: true });
    cpSync(canonicalDir, preparedLabDir, { recursive: true });

    const scenarioHints = diag.scenarios
      .map((s) => {
        const expPath = join(projectRoot, "projects", "gym", "scenarios", s, "expected.json");
        const semPath = join(
          projectRoot,
          "projects",
          "gym",
          "scenarios",
          s,
          "semantic_criteria.md",
        );
        const statePath = join(
          projectRoot,
          "projects",
          "gym",
          "scenarios",
          s,
          "environment",
          "system-state.md",
        );
        const exp = existsSync(expPath) ? readFileSync(expPath, "utf8").trim() : "";
        const sem = existsSync(semPath) ? readFileSync(semPath, "utf8").trim() : "";
        const st = existsSync(statePath) ? readFileSync(statePath, "utf8").trim() : "";
        return `### Scenario: ${s}\nState:\n${st}\nExpected:\n${exp}${sem ? `\nSemantic Criteria:\n${sem}` : ""}`;
      })
      .join("\n\n");

    const implPrompt = [
      "# Prepare Gym `.lab` Candidate",
      "",
      `Edit ONLY files inside \`${preparedLabDir}\` (never edit production files outside \`.lab/\`).`,
      "",
      "## Diagnosis from `gym` Specialist",
      JSON.stringify(proposal, null, 2),
      "",
      "## Failing Trial Diagnostics",
      JSON.stringify(diag.trials, null, 2),
      "",
      "## Scenario Expectations, Semantic Rubrics & Evidence",
      scenarioHints,
      "",
      `Read \`${join(preparedLabDir, "AGENTS.md")}\` and the existing skills under \`${join(preparedLabDir, "skills")}\` (for example \`provider-proof-approval/SKILL.md\` and \`system-deputy-decisions/SKILL.md\`).`,
      "IMPORTANT RULES:",
      "1. Prefer refining existing skills and/or adding a concise fast-path bullet in `AGENTS.md` rather than inventing a new catch-all skill that adds an extra `read` turn.",
      "2. Ensure every semantic rubric requirement (such as `canary_and_control`, `concrete_remediation_proposal`, `approval_before_mutation`) and `response_max_words` brevity limit (keep `response_to_hao` <= 55 words) is explicitly enforced.",
      "3. Ensure `preference_updates` stays `[]` unless Hao explicitly stated a durable preference.",
      `Apply the minimal generalizable update inside \`${preparedLabDir}\` and call \`finish(status: "done", result: ...)\`.`,
    ].join("\n");

    const implStep = await ctx.call("tech-lead", implPrompt, {
      schema: candidateImplResultSchema,
    });
    if (implStep.status !== "done" || !implStep.output) {
      return ctx.blocked(implStep.summary || "tech-lead failed to prepare the .lab candidate");
    }
    candidateSummary = (implStep.output as Static<typeof candidateImplResultSchema>).summary;
  }

  if (ctx.input.outputFile) {
    const outPath = resolve(workRoot, ctx.input.outputFile);
    writeFileSync(
      outPath,
      `${JSON.stringify({ proposal, preparedLabDir, candidateSummary }, null, 2)}\n`,
      "utf8",
    );
  }

  return ctx.done(
    candidateSummary
      ? `${proposal.root_cause_summary} | Candidate prepared: ${candidateSummary}`
      : proposal.root_cause_summary,
    {
      output: proposal,
      facts: {
        target: diag.target,
        benchmark: diag.benchmark,
        detectedRegimes: diag.detectedRegimes,
        recommendedStage: proposal.recommended_stage,
        ...(preparedLabDir ? { preparedLabDir } : {}),
        ...(candidateSummary ? { candidateSummary } : {}),
      },
    },
  );
}
