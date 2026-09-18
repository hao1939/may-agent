export type SemanticVerdict = "pass" | "fail";

export interface SemanticRuleResult {
  rule: string;
  verdict: SemanticVerdict;
  evidence: string[];
  contradictions: string[];
  confidence: number;
}

export interface SemanticCaseResult {
  id: string;
  overall: SemanticVerdict;
  rules: SemanticRuleResult[];
  reason: string;
}

export interface SemanticJudgeReport {
  cases: SemanticCaseResult[];
}

export interface SemanticJudgeRun {
  agent: string;
  model: string | null;
  report?: unknown;
  error?: string;
  status?: string;
  session_path?: string;
  execution_manifest?: unknown;
  provider_error?: string;
}

export interface SemanticJudgeAssessment {
  agent: string;
  model: string | null;
  valid: boolean;
  candidate_verdict: SemanticVerdict | null;
  controls_passed: boolean;
  errors: string[];
}

export interface SemanticEvaluation {
  status: "pass" | "fail" | "invalid";
  passed: boolean;
  valid: boolean;
  summary: string;
  judges: SemanticJudgeAssessment[];
}

export interface SemanticControlCase {
  id: string;
  decision: unknown;
  expected: SemanticVerdict;
}

export interface SemanticControlSet {
  required_rules: string[];
  cases: SemanticControlCase[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVerdict(value: unknown): value is SemanticVerdict {
  return value === "pass" || value === "fail";
}

function nonEmptyStrings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

export function validateSemanticControlSet(value: unknown): SemanticControlSet {
  if (!isRecord(value)) throw new Error("semantic controls must be an object");
  if (!nonEmptyStrings(value.required_rules)) {
    throw new Error("semantic controls require a non-empty required_rules list");
  }
  if (new Set(value.required_rules).size !== value.required_rules.length) {
    throw new Error("semantic controls contain duplicate required rules");
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0) {
    throw new Error("semantic controls require at least one labeled case");
  }
  const cases = value.cases.map((item, index) => {
    if (!isRecord(item)) throw new Error(`semantic control ${index} must be an object`);
    if (typeof item.id !== "string" || !item.id.trim()) {
      throw new Error(`semantic control ${index} requires an id`);
    }
    if (!isVerdict(item.expected)) {
      throw new Error(`semantic control ${item.id} requires pass or fail`);
    }
    if (!("decision" in item)) {
      throw new Error(`semantic control ${item.id} requires a decision`);
    }
    return { id: item.id, decision: item.decision, expected: item.expected };
  });
  if (new Set(cases.map((item) => item.id)).size !== cases.length) {
    throw new Error("semantic controls contain duplicate case ids");
  }
  return { required_rules: value.required_rules, cases };
}

export function buildSemanticJudgeInput(
  candidate: unknown,
  controls: SemanticControlSet,
): { cases: Array<{ id: string; decision: unknown }> } {
  return {
    cases: [
      { id: "candidate", decision: candidate },
      ...controls.cases.map(({ id, decision }) => ({ id, decision })),
    ],
  };
}

function assessJudgeRun(
  run: SemanticJudgeRun,
  controls: SemanticControlSet,
): SemanticJudgeAssessment {
  const errors: string[] = [];
  if (run.error) errors.push(run.error);
  if (run.provider_error) errors.push(run.provider_error);
  if (run.status && run.status !== "done" && run.status !== "success") {
    errors.push(`judge execution status ${run.status}`);
  }
  if (!isRecord(run.report) || !Array.isArray(run.report.cases)) {
    errors.push("judge report must contain a cases array");
    return {
      agent: run.agent,
      model: run.model,
      valid: false,
      candidate_verdict: null,
      controls_passed: false,
      errors,
    };
  }

  const expectedIds = ["candidate", ...controls.cases.map((item) => item.id)];
  const caseResults = new Map<string, SemanticCaseResult>();
  for (const [caseIndex, rawCase] of run.report.cases.entries()) {
    if (!isRecord(rawCase) || typeof rawCase.id !== "string" || !rawCase.id.trim()) {
      errors.push(`case ${caseIndex} requires an id`);
      continue;
    }
    if (caseResults.has(rawCase.id)) {
      errors.push(`duplicate case ${rawCase.id}`);
      continue;
    }
    if (!expectedIds.includes(rawCase.id)) {
      errors.push(`unexpected case ${rawCase.id}`);
      continue;
    }
    if (!isVerdict(rawCase.overall)) {
      errors.push(`case ${rawCase.id} requires pass or fail overall`);
      continue;
    }
    if (typeof rawCase.reason !== "string" || !rawCase.reason.trim()) {
      errors.push(`case ${rawCase.id} requires a reason`);
      continue;
    }
    if (!Array.isArray(rawCase.rules)) {
      errors.push(`case ${rawCase.id} requires rules`);
      continue;
    }

    const rules = new Map<string, SemanticRuleResult>();
    for (const [ruleIndex, rawRule] of rawCase.rules.entries()) {
      if (!isRecord(rawRule) || typeof rawRule.rule !== "string" || !rawRule.rule.trim()) {
        errors.push(`case ${rawCase.id} rule ${ruleIndex} requires a name`);
        continue;
      }
      if (rules.has(rawRule.rule)) {
        errors.push(`case ${rawCase.id} has duplicate rule ${rawRule.rule}`);
        continue;
      }
      if (!controls.required_rules.includes(rawRule.rule)) {
        errors.push(`case ${rawCase.id} has unexpected rule ${rawRule.rule}`);
        continue;
      }
      if (!isVerdict(rawRule.verdict)) {
        errors.push(`case ${rawCase.id} rule ${rawRule.rule} requires pass or fail`);
        continue;
      }
      if (!stringArray(rawRule.evidence)) {
        errors.push(`case ${rawCase.id} rule ${rawRule.rule} has invalid evidence`);
        continue;
      }
      if (!stringArray(rawRule.contradictions)) {
        errors.push(`case ${rawCase.id} rule ${rawRule.rule} has invalid contradictions`);
        continue;
      }
      if (rawRule.evidence.length === 0 && rawRule.contradictions.length === 0) {
        errors.push(
          `case ${rawCase.id} rule ${rawRule.rule} requires a quoted reason`,
        );
        continue;
      }
      if (
        typeof rawRule.confidence !== "number" ||
        rawRule.confidence < 0 ||
        rawRule.confidence > 1
      ) {
        errors.push(`case ${rawCase.id} rule ${rawRule.rule} has invalid confidence`);
        continue;
      }
      rules.set(rawRule.rule, {
        rule: rawRule.rule,
        verdict: rawRule.verdict,
        evidence: rawRule.evidence,
        contradictions: rawRule.contradictions,
        confidence: rawRule.confidence,
      });
    }

    for (const rule of controls.required_rules) {
      if (!rules.has(rule)) errors.push(`case ${rawCase.id} is missing rule ${rule}`);
    }
    const derived = controls.required_rules.every(
      (rule) => rules.get(rule)?.verdict === "pass",
    )
      ? "pass"
      : "fail";
    if (rawCase.overall !== derived) {
      errors.push(`case ${rawCase.id} overall does not match its rule verdicts`);
    }
    caseResults.set(rawCase.id, {
      id: rawCase.id,
      overall: rawCase.overall,
      rules: [...rules.values()],
      reason: rawCase.reason,
    });
  }

  for (const id of expectedIds) {
    if (!caseResults.has(id)) errors.push(`missing case ${id}`);
  }
  const controlsPassed = controls.cases.every(
    (control) => caseResults.get(control.id)?.overall === control.expected,
  );
  if (!controlsPassed) errors.push("judge missed one or more calibration controls");

  return {
    agent: run.agent,
    model: run.model,
    valid: errors.length === 0,
    candidate_verdict: caseResults.get("candidate")?.overall ?? null,
    controls_passed: controlsPassed,
    errors,
  };
}

export function evaluateSemanticJudgeRuns(
  runs: SemanticJudgeRun[],
  controls: SemanticControlSet,
): SemanticEvaluation {
  if (runs.length < 2) {
    return {
      status: "invalid",
      passed: false,
      valid: false,
      summary: "semantic evaluation requires two independent judges",
      judges: runs.map((run) => assessJudgeRun(run, controls)),
    };
  }
  const judges = runs.map((run) => assessJudgeRun(run, controls));
  const agentIds = runs.map((run) => run.agent?.trim()).filter(Boolean);
  const modelIds = runs.map((run) => run.model?.trim()).filter(Boolean);
  if (
    agentIds.length !== runs.length || modelIds.length !== runs.length ||
    new Set(agentIds).size !== runs.length || new Set(modelIds).size !== runs.length
  ) {
    return {
      status: "invalid",
      passed: false,
      valid: false,
      summary: "semantic evaluation requires distinct nonempty judge and model identities",
      judges,
    };
  }
  if (judges.some((judge) => !judge.valid)) {
    return {
      status: "invalid",
      passed: false,
      valid: false,
      summary: "semantic evaluation is invalid because a judge or calibration failed",
      judges,
    };
  }
  const verdicts = judges.map((judge) => judge.candidate_verdict);
  if (new Set(verdicts).size !== 1) {
    return {
      status: "invalid",
      passed: false,
      valid: false,
      summary: "semantic judges disagree; human review is required",
      judges,
    };
  }
  const passed = verdicts[0] === "pass";
  return {
    status: passed ? "pass" : "fail",
    passed,
    valid: true,
    summary: passed
      ? "both semantic judges passed the candidate and all controls"
      : "both semantic judges rejected the candidate",
    judges,
  };
}
