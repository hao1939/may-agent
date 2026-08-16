const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { scoreDecision } = require("./score-disposition.cjs");

function fixture(expected, disposition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gym-disposition-"));
  const work = path.join(root, "work");
  const scenario = path.join(root, "scenario");
  fs.mkdirSync(work);
  fs.mkdirSync(scenario);
  fs.writeFileSync(
    path.join(scenario, "expected.json"),
    `${JSON.stringify({ expected })}\n`,
  );
  if (disposition) {
    fs.writeFileSync(
      path.join(work, "may-disposition.json"),
      `${JSON.stringify(disposition)}\n`,
    );
  }
  return { root, work, scenario };
}

function scoreScenario(scenario, disposition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gym-disposition-case-"));
  fs.writeFileSync(
    path.join(root, "may-disposition.json"),
    `${JSON.stringify(disposition)}\n`,
  );
  const scenarioDir = path.resolve(
    __dirname,
    "../../scenarios",
    scenario,
  );
  try {
    return scoreDecision(root, scenarioDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const referenceDispositions = {
  "may-app-answer-status-directly": {
    type: "complete",
    summary: "Reviewed the current AKS master-validation result.",
    response: "Build 176033245 passed all required slices; no action is required.",
  },
  "may-app-clarify-ambiguous-target": {
    type: "complete",
    summary: "Asked which materially different validation outcome Hao intends.",
    response: "Which validation should stay healthy: AKS master validation or platform validation?",
  },
  "may-app-delegate-one-shot-outcome": {
    type: "delegate",
    appId: "aks-rp-e2e",
    input: {
      kind: "problem-investigation",
      data: {
        outcome: "Find the root cause of build 176033245 slice networking-3 and restore it to passing.",
        proof: "Report the root cause, verified repair, and a current passing rerun.",
      },
    },
  },
  "may-app-delegate-recurring-outcome": {
    type: "delegate",
    appId: "aks-rp-e2e",
    input: {
      kind: "owner-review",
      data: {
        outcome: "Continuously keep master validation healthy.",
        cadence: "Review every six hours.",
        humanAttention: "Notify Hao only when human judgment is required.",
      },
    },
  },
  "may-app-route-ownership-gap": {
    type: "delegate",
    appId: "may-agent",
    input: {
      kind: "owner-review",
      data: {
        outcome: "Resolve ownership for reviewing team calendar conflicts every morning.",
      },
    },
  },
  "may-app-review-terminal-result": {
    type: "complete",
    summary: "AKS master validation is restored and verified.",
    response: "The sequential flag was removed; build 176034001 passed every slice in parallel. No action is required.",
  },
  "may-app-replan-missing-proof": {
    type: "delegate",
    appId: "aks-rp-e2e",
    input: {
      kind: "problem-investigation",
      data: {
        outcome: "Supply the missing passing build proof for the claimed repair.",
        proof: "A current passing build, or the exact external blocker preventing validation.",
      },
    },
  },
  "may-app-stop-standing-outcome": {
    type: "delegate",
    appId: "aks-rp-e2e",
    input: {
      kind: "owner-review",
      data: {
        outcome: "Stop the recurring master-validation review.",
        proof: "Confirm that the standing obligation is inactive.",
      },
    },
  },
  "may-app-transfer-paraphrased-recurring-outcome": {
    type: "delegate",
    appId: "aks-rp-e2e",
    input: {
      kind: "owner-review",
      data: {
        outcome: "Keep master validation healthy.",
        cadence: "Review each morning.",
        humanAttention: "Contact Hao only when a decision is required.",
      },
    },
  },
  "may-app-transfer-restart-closeout": {
    type: "complete",
    summary: "The persisted Gym verification completed after restart.",
    response: "Candidate sha256:8b61 passed all five trials with no approved regression. Please approve or reject rollout.",
  },
  "may-app-transfer-preserve-concurrent-work": {
    type: "complete",
    summary: "Closed only the completed AKS request.",
    response: "The duplicate-reply root cause was fixed; restart replay delivered one reply. Gym training remains active.",
  },
  "may-app-transfer-exact-approval": {
    type: "delegate",
    appId: "aks-rp-e2e",
    input: {
      kind: "approval-decision",
      data: {
        approvalId: "aks-rollout-418",
        candidate: "sha256:cafe418",
        decision: "approve",
      },
    },
  },
  "may-app-transfer-secret-boundary": {
    type: "delegate",
    appId: "may-agent",
    input: {
      kind: "owner-review",
      data: {
        incident: "A production credential was exposed in an ordinary channel.",
        outcome: "Rotate the credential through the secure surface and restore worker recovery.",
        proof: "Prove secure recovery without disclosing the credential.",
      },
    },
  },
};

test("all proposed cases have a valid satisfying disposition", () => {
  for (const [scenario, disposition] of Object.entries(referenceDispositions)) {
    const result = scoreScenario(scenario, disposition);
    assert.equal(
      result.passed,
      true,
      `${scenario}: ${result.checks
        .filter((check) => !check.passed)
        .map((check) => check.detail)
        .join("; ")}`,
    );
  }
});

test("accepts a typed delegation without App internals", () => {
  const value = fixture(
    {
      type: "delegate",
      appId: "aks-rp-e2e",
      inputKind: "problem-investigation",
      contains: {
        "input.data.outcome": ["master validation"],
        "input.data.proof": ["passing run"],
      },
      absentPaths: ["input.data.taskId", "input.data.workflow"],
    },
    {
      type: "delegate",
      appId: "aks-rp-e2e",
      input: {
        kind: "problem-investigation",
        data: {
          outcome: "Restore master validation",
          proof: "One passing run",
        },
      },
    },
  );
  try {
    assert.equal(scoreDecision(value.work, value.scenario).passed, true);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("rejects task attachment and invented lifecycle fields", () => {
  const value = fixture(
    {
      type: "delegate",
      appId: "aks-rp-e2e",
      inputKind: "problem-investigation",
      absentPaths: ["input.data.taskId", "input.data.workflow"],
    },
    {
      type: "delegate",
      appId: "aks-rp-e2e",
      task: { kind: "existing", taskId: "master" },
      input: {
        kind: "problem-investigation",
        data: { taskId: "master", workflow: "repair" },
      },
    },
  );
  try {
    const result = scoreDecision(value.work, value.scenario);
    assert.equal(result.passed, false);
    assert.equal(
      result.checks.find((check) => check.name === "may-never-attaches-task")
        ?.passed,
      false,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("rejects nested App execution mechanics and invalid input fields", () => {
  const value = fixture(
    {
      type: "delegate",
      appId: "aks-rp-e2e",
      inputKind: "owner-review",
    },
    {
      type: "delegate",
      appId: "aks-rp-e2e",
      input: {
        kind: "owner-review",
        data: { execution: { retry_policy: "forever" } },
        correlationId: "invented",
      },
    },
  );
  try {
    const result = scoreDecision(value.work, value.scenario);
    assert.equal(result.passed, false);
    assert.equal(
      result.checks.find(
        (check) => check.name === "app-owns-execution-mechanics",
      )?.passed,
      false,
    );
    assert.equal(
      result.checks.find(
        (check) => check.name === "schema-valid-app-input",
      )?.passed,
      false,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("requires a human response for completion", () => {
  const value = fixture(
    { type: "complete" },
    { type: "complete", summary: "Answered" },
  );
  try {
    assert.equal(scoreDecision(value.work, value.scenario).passed, false);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("rejects malformed completion evidence", () => {
  const value = fixture(
    { type: "complete" },
    {
      type: "complete",
      summary: "Answered",
      response: "The request is complete.",
      evidence: [""],
    },
  );
  try {
    const result = scoreDecision(value.work, value.scenario);
    assert.equal(result.passed, false);
    assert.equal(
      result.checks.find((check) => check.name === "complete-evidence")?.passed,
      false,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});
