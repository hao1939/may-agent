const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { scoreTaskResult } = require("./score-task-result.cjs");

function scoreScenario(scenario, result) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gym-task-result-"));
  fs.writeFileSync(path.join(root, "task-result.json"), `${JSON.stringify(result)}\n`);
  const scenarioDir = path.resolve(__dirname, "../../scenarios", scenario);
  try {
    return scoreTaskResult(root, scenarioDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const dependency = (id, appId, kind, data) => ({ id, appId, input: { kind, data } });
// These retain the suite's historical App inputs and expectations. Admission here
// checks the current Host result contract, not whether each old App kind is installed.
const referenceResults = {
  "may-app-answer-status-directly": {
    state: "converged",
    summary: "Reviewed the current AKS master-validation result.",
    response: "Build 176033245 passed all required slices; no action is required.",
    facts: ["build:176033245"],
  },
  "may-app-clarify-ambiguous-target": {
    state: "converged",
    summary: "Asked which materially different validation outcome Hao intends.",
    response: "Which validation should stay healthy: AKS master validation or platform validation?",
    facts: [],
  },
  "may-app-delegate-one-shot-outcome": {
    state: "waiting",
    summary: "The accountable AKS App is driving the requested recovery.",
    facts: ["installed-app:aks-rp-e2e"],
    dependencies: [dependency("restore-master-validation", "aks-rp-e2e", "problem-investigation", {
      outcome: "Find the root cause of build 176033245 slice networking-3 and restore master validation to healthy.",
      scope: "AKS master-validation networking-3 failure only.",
      constraints: "Preserve unrelated validation behavior; no human authority decision is currently needed.",
      proof: "Report the root cause, verified repair, and a current passing rerun.",
    })],
  },
  "may-app-delegate-recurring-outcome": {
    state: "waiting",
    summary: "The accountable AKS App is establishing the standing outcome.",
    facts: ["installed-app:aks-rp-e2e"],
    dependencies: [dependency("keep-master-validation-healthy", "aks-rp-e2e", "owner-review", {
      outcome: "Continuously keep master validation healthy.",
      cadence: "Review every six hours.",
      humanAttention: "Notify Hao only when human judgment is required.",
      proof: "Show the standing responsibility is active and reports verified health or a real decision blocker.",
    })],
  },
  "may-app-explain-task-reconciliation": {
    state: "converged",
    summary: "Task, Event, App, and Runtime each have one clear role.",
    response: "A Task is the goal and its current state. An Event carries new information that may wake the Task; it is not another Task. The App decides how to move the Task forward in one bounded attempt. Runtime stores the Task, connects Events, schedules the attempt, and checks its result without deciding what the work means.",
    facts: ["accepted-design:task-event-app-runtime"],
  },
  "may-app-route-capability-improvement": {
    state: "waiting",
    summary: "Gym owns the requested May behavior improvement.",
    facts: ["installed-app:gym"],
    dependencies: [dependency("improve-requirement-understanding", "gym", "improve-may", {
      outcome: "Help May deeply understand a rough requirement and turn durable work into a solid request for one accountable installed App.",
      scope: "Preserve the intended outcome, relevant scope, material constraints, terminal proof, and authority boundary.",
      constraints: "Clarify only material ambiguity and leave destination mechanics to the accountable App.",
      proof: "Require human-approved development evidence and regression evidence before claiming improvement.",
    })],
  },
  "may-app-route-ownership-gap": {
    state: "waiting",
    summary: "Host Operations is resolving the missing ownership capability.",
    facts: ["installed-app-catalog:no-calendar-owner"],
    dependencies: [dependency("resolve-calendar-owner", "may-agent", "owner-review", {
      outcome: "Resolve ownership for reviewing team calendar conflicts every morning.",
      scope: "Team calendar conflict review.",
      cadence: "Every morning.",
      proof: "Identify or establish the accountable App contract before recurring work begins.",
    })],
  },
  "may-app-route-host-operation": {
    state: "waiting",
    summary: "The May-agent Host Operations App now owns the requested deployment and live check.",
    facts: ["installed-app:may-agent"],
    dependencies: [dependency("deploy-may-runtime", "may-agent", "runtime-capability-request", {
      outcome: "Deploy and live-validate exact commit b359244d2de10c45fb96c154bf519bdc21aab185.",
      acceptance: [
        "Return the deployment receipt.",
        "Prove the exact commit is loaded.",
        "Provide live health proof.",
        "Confirm retained state still works.",
      ],
      evidence: [
        "Focused Runtime and TypeScript checks passed.",
        "The full suite passed 2,434 tests; the known maxCallDepth failure is unrelated.",
      ],
    })],
  },
  "may-app-review-terminal-result": {
    state: "converged",
    summary: "AKS master validation is restored and verified.",
    response: "The sequential flag was removed; build 176034001 passed every slice in parallel. No action is required.",
    facts: ["build:176034001"],
  },
  "may-app-replan-missing-proof": {
    state: "waiting",
    summary: "The repair claim lacks the required terminal proof.",
    facts: ["dependency-result:patch-merged-without-build"],
    dependencies: [dependency("prove-master-validation-repair", "aks-rp-e2e", "problem-investigation", {
      outcome: "Supply the missing passing build proof for the claimed repair.",
      proof: "A current passing build, or the exact external blocker preventing validation.",
    })],
  },
  "may-app-stop-standing-outcome": {
    state: "waiting",
    summary: "The accountable AKS App is stopping its standing responsibility.",
    facts: ["installed-app:aks-rp-e2e"],
    dependencies: [dependency("stop-master-validation-review", "aks-rp-e2e", "owner-review", {
      outcome: "Stop the recurring master-validation review.",
      proof: "Confirm that the standing obligation is inactive.",
    })],
  },
  "may-app-transfer-paraphrased-recurring-outcome": {
    state: "waiting",
    summary: "The accountable AKS App is establishing the requested daily outcome.",
    facts: ["installed-app:aks-rp-e2e"],
    dependencies: [dependency("daily-master-validation", "aks-rp-e2e", "owner-review", {
      outcome: "Keep master validation healthy.",
      cadence: "Review each morning.",
      humanAttention: "Contact Hao only when a decision is required.",
    })],
  },
  "may-app-transfer-restart-closeout": {
    state: "converged",
    summary: "The persisted Gym verification completed after restart.",
    response: "Candidate sha256:8b61 passed all five trials with no approved regression. Please approve or reject rollout.",
    facts: ["candidate:sha256:8b61"],
  },
  "may-app-transfer-preserve-concurrent-work": {
    state: "converged",
    summary: "Closed only the completed AKS request.",
    response: "The duplicate-reply root cause was fixed; restart replay delivered one reply. Gym training remains active.",
    facts: ["restart-replay:one-reply"],
  },
  "may-app-transfer-exact-approval": {
    state: "waiting",
    summary: "The exact approval is being applied by the accountable AKS App.",
    facts: ["approval:aks-rollout-418"],
    dependencies: [dependency("apply-aks-rollout-418", "aks-rp-e2e", "approval-decision", {
      approvalId: "aks-rollout-418",
      candidate: "sha256:cafe418",
      decision: "approve",
    })],
  },
  "may-app-transfer-secret-boundary": {
    state: "waiting",
    summary: "Host Operations is handling secure credential recovery.",
    facts: ["security-boundary:ordinary-channel"],
    dependencies: [dependency("secure-credential-recovery", "may-agent", "owner-review", {
      incident: "A production credential was exposed in an ordinary channel.",
      outcome: "Rotate the credential through the secure surface and restore worker recovery.",
      proof: "Prove secure recovery without disclosing the credential.",
    })],
  },
};

test("historical case fixtures satisfy the scorer and current Host result contract", () => {
  const development = JSON.parse(
    fs.readFileSync(path.join(__dirname, "suite.json"), "utf8"),
  ).scenarios;
  const transfer = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../may-app-outcome-management-transfer/suite.json"),
      "utf8",
    ),
  ).scenarios;
  assert.deepEqual(
    Object.keys(referenceResults).sort(),
    [...development, ...transfer].sort(),
  );
  for (const [scenario, result] of Object.entries(referenceResults)) {
    const scored = scoreScenario(scenario, result);
    assert.equal(
      scored.passed,
      true,
      `${scenario}: ${scored.checks.filter((check) => !check.passed).map((check) => check.detail).join("; ")}`,
    );
  }
});

test("rejects the removed disposition lifecycle", () => {
  const scored = scoreScenario("may-app-answer-status-directly", {
    type: "complete",
    summary: "Answered",
    response: "Build 176033245 passed; no action is required.",
    facts: [],
  });
  assert.equal(scored.passed, false);
  assert.equal(scored.checks.find((check) => check.name === "production-task-contract")?.passed, false);
});

test("rejects App-internal mechanics in a typed dependency", () => {
  const scored = scoreScenario("may-app-delegate-one-shot-outcome", {
    state: "waiting",
    summary: "Routing AKS work",
    facts: [],
    dependencies: [dependency("repair", "aks-rp-e2e", "problem-investigation", {
      outcome: "Repair build 176033245 networking-3 root cause and get a passing run",
      workflow: "repair",
    })],
  });
  assert.equal(scored.passed, false);
  assert.equal(scored.checks.find((check) => check.name === "app-owns-execution-mechanics")?.passed, false);
});

test("rejects a waiting response at the production contract", () => {
  const result = structuredClone(referenceResults["may-app-delegate-recurring-outcome"]);
  result.response = "Done.";
  const scored = scoreScenario("may-app-delegate-recurring-outcome", result);
  assert.equal(scored.passed, false);
  assert.equal(scored.checks.find((check) => check.name === "production-task-contract")?.passed, false);
});

test("rejects an invented Condition in place of an accountable App", () => {
  const scored = scoreScenario("may-app-route-ownership-gap", {
    state: "waiting",
    summary: "Waiting for an owner",
    facts: [],
    conditions: [{ id: "owner", type: "human.decision", subject: "id:owner", expected: true, owner: "human:hao", reviewAfterMs: 60_000 }],
  });
  assert.equal(scored.passed, false);
  assert.equal(scored.checks.find((check) => check.name === "may-does-not-invent-condition")?.passed, false);
});
