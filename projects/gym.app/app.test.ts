import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import type { AppEvent, AppInput, AppTaskInput } from "@may-agent/sdk";
import { Check } from "typebox/value";
import mayCanary from "./config/may-alignment-canary.json";
import benchmarkMayCanary from "../gym/benchmarks/may-alignment/canary.json";
import gymApp, { resolveGymTask, taskForGymInput } from "./app.ts";

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data,
    target: { appId: "gym", project: "gym" },
    ...extra,
  };
}

function admitted(input: AppInput, id = "request-1"): AppTaskInput {
  return {
    id,
    source: { kind: "system" as const, id: "test" },
    input,
  };
}

function validFinishResultComparisonData(): Record<string, unknown> {
  return {
    mode: "finish-result-comparison",
    requestId: "appdep_9be92f70d1f32757a748438d",
    priorRequestId: "appdep_a372e40b096b6d63639c3656",
    outcome: "Compare the exact frozen finish-result baseline and candidate.",
    baseline: {
      artifact: "/app/.state/sessions/s_1787238379742_871/result.json",
      sha256:
        "e4d47ca876d70d8f24ec5896c33d4d1824acaced93d85b7ae128e92b8e870cff",
    },
    candidate: {
      worktree: "/app/projects/may-agent-finish-result-candidate",
      commit: "0ff56f626cbfb3646a098deef4042c8b262d1bd3",
      patchSha256:
        "c09007f96d991be0714f7c500afb53a125a5560550fda3ca3a965a0dd3c4aab7",
    },
    sampleScope: {
      positive: ["schema-valid result survives canonical readback"],
      negative: [
        "malformed",
        "missing",
        "null",
        "failed status",
        "duplicate completion",
        "secret safety",
        "unrelated Gym routing",
      ],
    },
    requiredProof: ["One request-correlated content-hashed terminal artifact."],
    constraints: ["Do not activate May Runtime."],
    returnPath:
      "/app/projects/gym/.state/proofs/finish-result-appdep_9be92f70d1f32757a748438d",
  };
}

function validComparisonData(): Record<string, unknown> {
  return {
    requestId: "appdep_source",
    outcome: "Compare the exact frozen artifacts.",
    scope: {
      baseline: { path: "evidence/baseline.sql", sha256: "a".repeat(64) },
      candidate: { path: "evidence/candidate.sql", sha256: "b".repeat(64) },
      comparisonArtifact: {
        path: "evidence/comparison.json",
        sha256: "c".repeat(64),
      },
      expectedLifecycleTypes: ["positive"],
      negativeControls: ["negative"],
    },
    acceptanceProof: ["Preserve representative rows."],
    constraints: ["Do not substitute the standalone benchmark."],
  };
}

describe("canonical Gym App", () => {
  test("keeps the operational canary selection aligned with the Gym benchmark", () => {
    expect(mayCanary).toEqual(benchmarkMayCanary);
  });

  test("keeps May conversational while Gym owns standing operations", () => {
    const mayConfig = JSON.parse(
      readFileSync(
        new URL("../../agents/may/agent.json", import.meta.url),
        "utf8",
      ),
    ) as { tools: string[] };

    expect(mayConfig.tools).not.toContain("cron");
    expect(
      existsSync(new URL("../../agents/may/cron.json", import.meta.url)),
    ).toBe(false);
    expect(gymApp).toMatchObject({
      id: "gym",
      version: 1,
      agent: "gym",
      description: expect.stringContaining("May behavior learning"),
      workspace: { kind: "local", localPath: "../gym" },
      tasks: { maxConcurrent: 2 },
    });
    expect(gymApp).not.toHaveProperty("inbox");
    expect(gymApp.task).toBe(taskForGymInput);
    expect(gymApp.route).toBeUndefined();
    expect(gymApp.tasks?.resolve).toBe(resolveGymTask);
    expect(gymApp.tasks?.subscriptions).toHaveLength(11);
    expect(gymApp.tasks?.subscriptions).toContainEqual({
      type: "project.approval.submitted",
      project: "gym",
    });
    expect(gymApp).not.toHaveProperty("events");
    expect(gymApp).not.toHaveProperty("onEvent");
    expect(gymApp).not.toHaveProperty("taskRoutes");
    expect(gymApp).not.toHaveProperty("taskWorkflows");
    expect(gymApp).not.toHaveProperty("ownerEntry");
    expect(gymApp).not.toHaveProperty("eventGraph");
  });

  test("declares canonical schedules and no duplicate Telegram scanner", () => {
    expect(gymApp.schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "may-training-refill",
          enabled: true,
          intervalMs: 86_400_000,
          event: {
            type: "gym.improvement.requested",
            target: { appId: "gym", project: "gym" },
            data: expect.objectContaining({
              project: "gym",
              agent: "may",
              reason: "curriculum-refill",
              curriculumDrain: true,
            }),
          },
        }),
        expect.objectContaining({
          id: "codex-learning-drain",
          enabled: true,
          intervalMs: 3_600_000,
          event: {
            type: "gym.codex.learning.requested",
            target: { appId: "gym", project: "gym" },
            data: {
              project: "gym",
              reason: "continuous-source-drain",
              batchSize: 200,
              maxBatches: 5,
            },
          },
        }),
        expect.objectContaining({
          id: "design-alignment-review-daily",
          enabled: true,
          intervalMs: 86_400_000,
          event: {
            type: "gym.design-alignment.requested",
            target: { appId: "gym", project: "gym" },
            data: {
              project: "gym",
              reason: "daily-design-alignment-review",
            },
          },
        }),
      ]),
    );
    expect(gymApp.schedules).toHaveLength(3);
    expect(gymApp.schedules.some(({ id }) => id.includes("telegram"))).toBe(
      false,
    );
    expect(gymApp.tasks?.subscriptions).not.toContain(
      "gym.telegram.field-review.requested",
    );
  });

  test("translates actions into canonical App inputs", () => {
    expect(Object.keys(gymApp.actions)).toEqual([
      "improve-may-now",
      "run-regression",
      "report-incident",
      "collect-codex-learning",
      "review-telegram-field",
    ]);
    expect(gymApp.actions["improve-may-now"]?.toInput({})).toEqual({
      kind: "improve-may",
      data: { reason: "manual" },
    });
    expect(
      gymApp.actions["run-regression"]?.toInput({ scenario: "s1" }),
    ).toEqual({
      kind: "run-regression",
      data: { scenario: "s1" },
    });
    expect(
      gymApp.actions["report-incident"]?.toInput({ sessionId: "s1" }),
    ).toEqual({
      kind: "report-incident",
      data: { reason: "manual", sessionId: "s1" },
    });
    expect(
      gymApp.actions["collect-codex-learning"]?.toInput({ maxBatches: 1 }),
    ).toEqual({
      kind: "collect-codex-learning",
      data: {
        reason: "manual-backfill",
        batchSize: 200,
        maxBatches: 1,
      },
    });
    expect(
      gymApp.actions["review-telegram-field"]?.toInput({ batchSize: 40 }),
    ).toEqual({
      kind: "review-telegram-field",
      data: { reason: "manual-field-review", batchSize: 40 },
    });

    const ownerConfig = JSON.parse(
      readFileSync(new URL("./agents/gym/agent.json", import.meta.url), "utf8"),
    ) as { tools: string[] };
    expect(ownerConfig.tools).toEqual(["read-only", "finish"]);
  });

  test("models Telegram field review as one task with a typed Evaluation dependency", () => {
    expect(
      taskForGymInput(
        admitted({
          kind: "review-telegram-field",
          data: { reason: "manual-field-review", batchSize: 40 },
        }),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        id: "input/request-1",
        input: {
          dependency: {
            id: "evaluation-review",
            appId: "evaluation",
            input: {
              kind: "deep-scan",
              data: { requestedBy: "gym", batchSize: 40 },
            },
          },
        },
      },
    });
  });
});

describe("Gym task reconciliation", () => {
  test("reconciles design alignment through one stable agent task", () => {
    const first = resolveGymTask(
      event("gym.design-alignment.requested", {
        reason: "daily-design-alignment-review",
      }),
    );
    const next = resolveGymTask(
      event("gym.design-alignment.requested", {
        reason: "daily-design-alignment-review",
      }),
    );

    expect(first).toEqual(next);
    expect(first).toMatchObject({
      id: "runtime/design-alignment-review",
      mode: "maintain",
      agent: "gym",
      priority: "P2",
      acceptance: expect.arrayContaining([
        expect.stringContaining("latest accepted May behavior"),
        expect.stringContaining("observed sessions"),
        expect.stringContaining("owning App"),
      ]),
    });
    expect(first).not.toHaveProperty("workflow");
  });

  test("keeps periodic task concerns independent and stable", () => {
    const facts = [
      event("gym.improvement.requested", { reason: "daily" }),
      event("gym.codex.learning.requested", { reason: "daily" }),
      event("gym.design-alignment.requested", { reason: "daily" }),
    ];
    const first = facts.map(resolveGymTask);
    const next = facts.map(resolveGymTask);

    expect(first.map((intent) => intent?.id)).toEqual([
      "improve/may",
      "learning/codex-sessions",
      "runtime/design-alignment-review",
    ]);
    expect(next.map((intent) => intent?.id)).toEqual(
      first.map((intent) => intent?.id),
    );
    expect(new Set(first.map((intent) => intent?.id)).size).toBe(3);
  });

  test("keeps Codex learning incremental", () => {
    expect(
      resolveGymTask(
        event("gym.codex.learning.requested", {
          reason: "daily",
          batchSize: 200,
          maxBatches: 1,
        }),
      ),
    ).toMatchObject({
      id: "learning/codex-sessions",
      mode: "maintain",
      workflow: "codex-learning-intake",
      input: {
        contractRevision: 1,
        reason: "daily",
        batchSize: 200,
        maxBatches: 1,
      },
    });
  });

  test("deduplicates incident and learning evidence by semantic identity", () => {
    const firstIncident = resolveGymTask(
      event("gym.incident.detected", { evaluation: { sessionId: "s_failed" } }),
    );
    const duplicateIncident = resolveGymTask(
      event("gym.incident.detected", { evaluation: { sessionId: "s_failed" } }),
    );
    expect(firstIncident?.id).toBe(duplicateIncident?.id);
    expect(firstIncident).toMatchObject({
      parentId: "incident-learning",
      mode: "achieve",
      workflow: "incident-intake",
      input: { kind: "incident", sessionId: "s_failed" },
    });

    const firstEvidence = resolveGymTask(
      event("gym.learning.evidence.observed", {
        polarity: "positive",
        evaluation: { agent: "may", sessionId: "s_good" },
      }),
    );
    const duplicateEvidence = resolveGymTask(
      event("gym.learning.evidence.observed", {
        polarity: "positive",
        evaluation: { agent: "may", sessionId: "s_good" },
      }),
    );
    expect(firstEvidence?.id).toBe(duplicateEvidence?.id);
    expect(firstEvidence).toMatchObject({
      parentId: "incident-learning",
      mode: "achieve",
      workflow: "learning-evidence-intake",
      input: { kind: "learning-evidence", polarity: "positive" },
    });
  });

  test("keeps distinct review evidence and explicit recoveries on distinct identities", () => {
    const original = resolveGymTask(
      event("gym.review.requested", { requestKey: "incident-s_failed" }),
    );
    const duplicate = resolveGymTask(
      event("gym.review.requested", { requestKey: "incident-s_failed" }),
    );
    const distinctEvidence = resolveGymTask(
      event("gym.review.requested", { requestKey: "incident-s_other" }),
    );
    const recovery = resolveGymTask(
      event("gym.review.requested", {
        requestKey: "incident-s_failed",
        recoveryId: "telegram-46020",
      }),
    );

    expect(duplicate?.id).toBe(original?.id);
    expect(distinctEvidence?.id).not.toBe(original?.id);
    expect(original?.input).toEqual({
      kind: "unknown",
      requestKey: "incident-s_failed",
    });
    expect(distinctEvidence?.input).toEqual({
      kind: "unknown",
      requestKey: "incident-s_other",
    });
    expect(recovery?.id).not.toBe(original?.id);
    expect(recovery?.input).toEqual({
      kind: "unknown",
      recoveryId: "telegram-46020",
      requestKey: "incident-s_failed",
    });
  });

  test("uses explicit execution request identity for each bounded regression run", () => {
    const first = resolveGymTask(
      event("gym.regression.requested", {
        requestId: "request-201",
        executionRequestId: "execution-201-a",
        benchmark: "may-alignment",
      }),
    );
    const second = resolveGymTask(
      event("gym.regression.requested", {
        requestId: "request-201",
        executionRequestId: "execution-201-b",
        benchmark: "may-alignment",
      }),
    );
    expect(first?.id).not.toBe(second?.id);
    expect(first).toMatchObject({
      parentId: "regression-assurance",
      mode: "achieve",
      workflow: "regression-run",
      input: {
        benchmark: "may-alignment",
        executionRequestId: "execution-201-a",
        requestId: "request-201",
      },
    });
    expect(
      resolveGymTask(
        event("gym.regression.requested", { benchmark: "may-alignment" }),
      ),
    ).toBeNull();
  });

  test("fails closed at binding when a comparison-shaped request omits its immutable source request id", () => {
    const requestId = "appdep_42bceb440b8fcd47cf81241f";
    const data = {
      agent: "may",
      benchmark: "may-alignment",
      reason: "frozen-comparison-request",
      scenario: "may-align-proof-before-adopt",
      trials: 1,
      baseline: {
        artifact: "/app/.state/sessions/s_1787238379742_871/result.json",
        sha256:
          "e4d47ca876d70d8f24ec5896c33d4d1824acaced93d85b7ae128e92b8e870cff",
      },
      candidate: {
        commit: "0ff56f626cbfb3646a098deef4042c8b262d1bd3",
        patchSha256:
          "c09007f96d991be0714f7c500afb53a125a5560550fda3ca3a965a0dd3c4aab7",
        repo: "/app/projects/may-agent",
      },
      sampleScope: { scenarios: ["may-align-proof-before-adopt"], trials: 1 },
      requiredProof: ["result", "correlation"],
      constraints: ["do-not-execute-comparison"],
      returnPath:
        "/app/projects/gym/.state/proofs/run-regression-request-correlation/terminal.json",
    };

    expect(Check(gymApp.inputSchema, { kind: "run-regression", data })).toBe(
      true,
    );
    const attachment = taskForGymInput(
      admitted({ kind: "run-regression", data }, requestId),
    );
    expect(attachment).toMatchObject({
      kind: "desired",
      intent: {
        outcome: "Interpret and handle admitted Gym input run-regression.",
        input: { kind: "run-regression", data },
      },
    });
    if (attachment.kind !== "desired") {
      throw new Error("run-regression did not produce a defensive task");
    }
    expect(attachment.intent.workflow).toBeUndefined();
  });

  test("preserves only the explicit finish-result comparison envelope value-for-value", () => {
    const data = validFinishResultComparisonData();
    const executionRequestId = "appdep_corrected_finish_result_once";
    expect(Check(gymApp.inputSchema, { kind: "run-regression", data })).toBe(
      true,
    );
    const attachment = taskForGymInput(
      admitted({ kind: "run-regression", data }, executionRequestId),
    );
    if (attachment.kind !== "desired") {
      throw new Error("finish-result envelope did not produce a desired task");
    }
    expect(attachment.intent).toMatchObject({
      workflow: "regression-run",
      outcome: expect.stringContaining("Compare the exact requested frozen"),
      outputs: [".state/proofs", ".state/runs"],
    });
    expect(attachment.intent.input).toEqual({
      ...data,
      executionRequestId,
    });

    for (const field of [
      "priorRequestId",
      "baseline",
      "candidate",
      "sampleScope",
      "requiredProof",
      "constraints",
      "returnPath",
    ]) {
      const malformed = validFinishResultComparisonData();
      delete malformed[field];
      const rejected = taskForGymInput(
        admitted(
          { kind: "run-regression", data: malformed },
          `malformed-finish-${field}`,
        ),
      );
      if (rejected.kind !== "desired") throw new Error("missing fallback task");
      expect(rejected.intent.workflow).toBeUndefined();
    }
  });

  test("fails closed at binding for every incomplete or malformed comparison field", () => {
    const invalid: Record<string, unknown>[] = [];
    for (const field of [
      "requestId",
      "outcome",
      "acceptanceProof",
      "constraints",
      "scope",
    ]) {
      const value = validComparisonData();
      delete value[field];
      invalid.push(value);
    }
    for (const field of [
      "baseline",
      "candidate",
      "comparisonArtifact",
      "expectedLifecycleTypes",
      "negativeControls",
    ]) {
      const value = validComparisonData();
      delete (value.scope as Record<string, unknown>)[field];
      invalid.push(value);
    }
    const malformedHash = validComparisonData();
    (
      (malformedHash.scope as Record<string, unknown>).baseline as Record<
        string,
        unknown
      >
    ).sha256 = "not-a-sha";
    invalid.push(malformedHash);
    const unsafePath = validComparisonData();
    (
      (unsafePath.scope as Record<string, unknown>).candidate as Record<
        string,
        unknown
      >
    ).path = "../candidate.sql";
    invalid.push(unsafePath);
    const emptyProof = validComparisonData();
    emptyProof.acceptanceProof = [];
    invalid.push(emptyProof);

    for (const [index, data] of invalid.entries()) {
      const attachment = taskForGymInput(
        admitted(
          { kind: "run-regression", data },
          `malformed-comparison-${index}`,
        ),
      );
      if (attachment.kind !== "desired") {
        throw new Error("malformed input did not produce defensive ownership");
      }
      expect(attachment.intent.workflow).toBeUndefined();
      expect(attachment.intent.outcome).toBe(
        "Interpret and handle admitted Gym input run-regression.",
      );
    }
  });

  test("comparison discrimination is structural across paraphrases and opposite ordinary controls", () => {
    const paraphrases = [
      "Please contrast these immutable artifacts.",
      "Assess whether the proposed taxonomy is safe.",
      "Run the bounded proof without changing production.",
    ];
    for (const [index, outcome] of paraphrases.entries()) {
      const data = { ...validComparisonData(), outcome };
      const attachment = taskForGymInput(
        admitted(
          { kind: "run-regression", data },
          `comparison-paraphrase-${index}`,
        ),
      );
      expect(attachment).toMatchObject({
        kind: "desired",
        intent: {
          workflow: "regression-run",
          outcome: expect.stringContaining(
            "Compare the exact requested frozen",
          ),
          input: {
            ...data,
            executionRequestId: `comparison-paraphrase-${index}`,
          },
        },
      });
    }

    expect(
      taskForGymInput(
        admitted(
          {
            kind: "run-regression",
            data: {
              benchmark: "may-alignment",
              scenario: "ordinary-scenario",
              reason: "standalone smoke test",
              trials: 1,
            },
          },
          "ordinary-opposite-control",
        ),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        workflow: "regression-run",
        outcome: expect.stringContaining("standalone Gym benchmark"),
        input: {
          requestId: "ordinary-opposite-control",
          benchmark: "may-alignment",
        },
      },
    });
  });

  test("preserves the complete exact comparison envelope value-for-value through admission and reconciliation", () => {
    const requestId = "appdep_888d7fd7b82c4939d83dae2b";
    const data = {
      outcome:
        "Compare the frozen baseline with the exact candidate and return immutable proof establishing whether the candidate narrowly treats only the four expected task-reconciler lifecycle observations as expected while preserving genuine failure and unrelated unhandled-signal visibility; if supported, produce a staged rollout proposal for May review before any adoption.",
      scope: {
        baseline: {
          path: "evidence/unhandled-signal-taxonomy-20260824/baseline.sql",
          sha256:
            "64dc0a6b713612b751e1aa530e81d18e34a42c98227cc34bdb2472d6bc23925b",
        },
        candidate: {
          path: "evidence/unhandled-signal-taxonomy-20260824/candidate.sql",
          sha256:
            "e1a5bfc3192d1d61c5c75b76e7b50c5b1518aced0ca88b9c4d4c7a880297e98d",
        },
        comparisonArtifact: {
          path: "evidence/unhandled-signal-taxonomy-20260824/comparison.json",
          sha256:
            "d51f47bda3786eb40619b6c718c633dad171be9378bb3d879ea3737d7b0b324f",
        },
        expectedLifecycleTypes: [
          "project.task.reconcile.started",
          "project.task.reconcile.profiled",
          "project.task.reconciled",
          "project.task.reconcile.skipped",
        ],
        negativeControls: [
          "malformed task results",
          "task reconciliation failures",
          "subscriber failures",
          "unknown-source signals",
          "conversation delivery failures",
          "actionable alerts",
        ],
      },
      constraints: [
        "Evaluation only: do not mutate benchmark truth, production metrics, deployments, reloads, restarts, or schedules.",
        "Reject any broad rollout until Hao explicitly approves.",
        "Any material regression stops the rollout proposal.",
        "Rollback for any later approved adoption is Git revert.",
      ],
      acceptanceProof: [
        "Representative task-reconciler lifecycle rows from every named positive event type and every named negative-control family are compared.",
        "Proof shows only the four exact lifecycle types are expected observations and all material failures and unrelated unhandled signals remain visible.",
        "The comparison result is immutable and content-hashed.",
        "If adoption is supported, the proposal names exact scope, evidence, risks, staged monitoring, Hao's explicit approval gate, and Git-revert rollback.",
        "Do not claim alert 4602 resolved during evaluation; after a separately approved adoption, closure requires a complete rolling hour at or below 5, non-null resolved_at, no recurrence in that window, and a subsequent project.ops_health.observed with no stale open alert.",
      ],
      reviewAndFailureBranch:
        "May will review the exact Gym result. Missing representative coverage, weak immutability, hidden material signals, or any regression causes May to reject rollout and replan the proof with Gym; only a proof-supported proposal is brought to Hao for approval.",
    };

    const executionRequestId = "appdep_corrected_replay_1";
    const attachment = taskForGymInput(
      admitted(
        { kind: "run-regression", data: { ...data, requestId } },
        executionRequestId,
      ),
    );
    if (attachment.kind !== "desired") {
      throw new Error("comparison request did not produce a desired task");
    }
    expect(attachment.intent).toMatchObject({
      workflow: "regression-run",
      outcome: expect.stringContaining("Compare the exact requested frozen"),
      outputs: [".state/proofs", ".state/runs"],
    });
    expect(attachment.intent.id).toContain(executionRequestId);
    expect(attachment.intent.input).toEqual({
      ...data,
      requestId,
      executionRequestId,
    });
    expect(
      resolveGymTask(
        event("gym.regression.requested", {
          ...data,
          requestId,
          executionRequestId,
        }),
      )?.input,
    ).toEqual({ ...data, requestId, executionRequestId });
  });

  test("rejects comparison aliases before they can reach the regression run", () => {
    const aliases = [
      "compare-regression",
      "run-comparison",
      "regression-run",
      "run-regression-comparison",
    ];

    for (const kind of aliases) {
      const input = { kind, data: { benchmark: "may-alignment" } };
      expect(Check(gymApp.inputSchema, input)).toBe(false);
      const bypassed = taskForGymInput(
        admitted(input as AppInput, "unrecognized-alias"),
      );
      if (bypassed.kind !== "desired") {
        throw new Error(`${kind} did not produce the defensive fallback task`);
      }
      expect(bypassed.intent.workflow).not.toBe("regression-run");
    }

    expect(
      Check(gymApp.inputSchema, {
        kind: "run-regression",
        data: { agent: "may", benchmark: "may-alignment", trials: 3 },
      }),
    ).toBe(true);
    expect(
      taskForGymInput(
        admitted(
          {
            kind: "run-regression",
            data: { agent: "may", benchmark: "may-alignment", trials: 3 },
          },
          "generic-regression-request",
        ),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        workflow: "regression-run",
        input: {
          agent: "may",
          benchmark: "may-alignment",
          trials: 3,
          requestId: "generic-regression-request",
        },
      },
    });
  });

  test("routes owner comments to request-correlated achieve carriers", () => {
    const subscription = gymApp.subscriptions?.find(
      ({ id }) => id === "project-comment",
    );
    if (!subscription) throw new Error("missing project-comment subscription");
    const input = subscription.toInput(
      event("project.comment.created", {
        comment:
          "Review the current training loop and decide what should happen next.",
        context: { source: "field", sequence: 7 },
      }),
    );
    expect(input).toMatchObject({ kind: "owner-review" });

    const first = taskForGymInput(admitted(input!, "owner request/17"));
    const duplicate = taskForGymInput(admitted(input!, "owner request/17"));
    const distinct = taskForGymInput(admitted(input!, "owner request/18"));

    expect(first).toEqual(duplicate);
    expect(first).toMatchObject({
      kind: "desired",
      intent: {
        mode: "achieve",
        agent: "gym",
        input: {
          requestId: "owner request/17",
          admittedInput: input,
        },
      },
    });
    if (first.kind !== "desired" || distinct.kind !== "desired") {
      throw new Error("owner review input did not produce desired tasks");
    }
    expect(first.intent.id).toMatch(
      /^owner-review\/owner-request-17-[a-f0-9]{16}$/,
    );
    expect(first.intent.id.startsWith("runtime/")).toBe(false);
    expect(distinct.intent.id).not.toBe(first.intent.id);
  });

  test("reconciles one finding dedupe key while preserving each admitted request", () => {
    const firstInput: AppInput = {
      kind: "owner-review",
      data: {
        finding: {
          dedupeKey: " owner-gap/stable-responsibility ",
          severity: "high",
          source: { sessionId: "s_first", packet: ["alpha", 1] },
        },
        outcome: "Repair the owner responsibility once.",
        acceptance: ["Preserve the first packet."],
        constraints: ["Do not discard request correlation."],
      },
    };
    const secondInput: AppInput = {
      kind: "owner-review",
      data: {
        finding: {
          dedupeKey: "owner-gap/stable-responsibility",
          severity: "medium",
          source: { sessionId: "s_second", packet: ["beta", 2] },
        },
        outcome: "Repair the owner responsibility once.",
        acceptance: ["Preserve the second packet."],
        constraints: ["Keep the complete admitted payload."],
      },
    };

    const first = taskForGymInput(admitted(firstInput, "owner-request-first"));
    const second = taskForGymInput(
      admitted(secondInput, "owner-request-second"),
    );
    if (first.kind !== "desired" || second.kind !== "desired") {
      throw new Error("finding owner reviews did not produce desired tasks");
    }

    expect(first.intent.id).toBe(second.intent.id);
    expect(first.intent.id).toMatch(
      /^owner-review\/owner-gap-stable-responsibility-[a-f0-9]{16}$/,
    );
    expect(first.intent.id.startsWith("runtime/")).toBe(false);
    expect(first.intent.input).toEqual({
      requestId: "owner-request-first",
      admittedInput: firstInput,
    });
    expect(second.intent.input).toEqual({
      requestId: "owner-request-second",
      admittedInput: secondInput,
    });

    const differentKey = taskForGymInput(
      admitted(
        {
          ...secondInput,
          data: {
            ...secondInput.data,
            finding: { dedupeKey: "owner-gap/different-responsibility" },
          },
        },
        "owner-request-third",
      ),
    );
    if (differentKey.kind !== "desired") {
      throw new Error("distinct finding did not produce a desired task");
    }
    expect(differentKey.intent.id).not.toBe(first.intent.id);
  });

  test("falls back to request identity for unusable finding dedupe keys", () => {
    const malformedFindings: unknown[] = [
      undefined,
      null,
      "owner-gap/not-structured",
      [],
      {},
      { dedupeKey: "   " },
      { dedupeKey: 42 },
      { dedupeKey: { nested: "not-a-string" } },
    ];

    for (const [index, finding] of malformedFindings.entries()) {
      const input: AppInput = {
        kind: "owner-review",
        data: { finding, marker: { index } },
      };
      const first = taskForGymInput(admitted(input, `fallback-${index}-a`));
      const duplicate = taskForGymInput(admitted(input, `fallback-${index}-a`));
      const distinct = taskForGymInput(admitted(input, `fallback-${index}-b`));
      if (
        first.kind !== "desired" ||
        duplicate.kind !== "desired" ||
        distinct.kind !== "desired"
      ) {
        throw new Error("fallback owner review did not produce desired tasks");
      }
      expect(first).toEqual(duplicate);
      expect(first.intent.id).not.toBe(distinct.intent.id);
      expect(first.intent.input).toEqual({
        requestId: `fallback-${index}-a`,
        admittedInput: input,
      });
    }
  });

  test("preserves a structured owner request as the concrete Task goal", () => {
    const input: AppInput = {
      kind: "owner-review",
      data: {
        outcome: "Cancel only Gym Tasks proven to be duplicates.",
        acceptance: [
          "List the identity evidence for each candidate.",
          "Report the cancelled and retained Task ids.",
          "Leave uncertain candidates unchanged.",
        ],
        constraints: ["Do not cancel by similar title alone."],
      },
    };

    const task = taskForGymInput(admitted(input, "owner request/structured"));
    expect(task).toMatchObject({
      kind: "desired",
      intent: {
        outcome: "Cancel only Gym Tasks proven to be duplicates.",
        acceptance: [
          "List the identity evidence for each candidate.",
          "Report the cancelled and retained Task ids.",
          "Leave uncertain candidates unchanged.",
        ],
        input: { requestId: "owner request/structured", admittedInput: input },
      },
    });
  });

  test("adds the fail-closed convergence rule to artifact-claim owner reviews", () => {
    const input: AppInput = {
      kind: "owner-review",
      data: {
        outcome:
          "Verify preservation of one acceptance-critical terminal artifact.",
        acceptance: ["Preserve HASH_GATE_REJECTED."],
      },
    };

    const task = taskForGymInput(admitted(input, "owner request/artifact"));
    if (task.kind !== "desired")
      throw new Error("artifact owner review did not produce a Task");

    expect(task.intent.acceptance).toEqual([
      "Preserve HASH_GATE_REJECTED.",
      expect.stringMatching(
        /fresh successful read.*independently computed.*ENOENT.*non-converged/,
      ),
    ]);
  });

  test("adds the same-session receipt rule to hash-fence owner reviews", () => {
    const input: AppInput = {
      kind: "owner-review",
      data: {
        outcome: "Verify the SHA-256 hash fence before activation.",
        acceptance: ["Preserve one checksum receipt per candidate."],
      },
    };

    const task = taskForGymInput(admitted(input, "owner request/hash-fence"));
    if (task.kind !== "desired")
      throw new Error("hash-fence owner review did not produce a Task");

    expect(task.intent.acceptance).toEqual([
      "Preserve one checksum receipt per candidate.",
      expect.stringMatching(
        /executing review session.*every exact current candidate path.*copied cross-session hashes.*nonzero exit.*non-converged/,
      ),
    ]);
  });

  test("keeps the safe owner-review fallback for an unstructured comment", () => {
    const input: AppInput = {
      kind: "owner-review",
      data: { comment: "Please take a look at the current backlog." },
    };
    const task = taskForGymInput(admitted(input, "owner request/comment"));
    if (task.kind !== "desired")
      throw new Error("owner review did not produce a Task");

    expect(task.intent.outcome).toBe(
      "Review one request for the Gym project and organize the smallest useful next step from its exact admitted evidence.",
    );
    expect(task.intent.acceptance).toHaveLength(3);
  });

  test("rejects malformed and unsupported inputs at the declared admission schema", () => {
    expect(
      Check(gymApp.inputSchema, {
        kind: "owner-review",
        data: { comment: "review this" },
      }),
    ).toBe(true);
    expect(Check(gymApp.inputSchema, { kind: "owner-review" })).toBe(false);
    expect(
      Check(gymApp.inputSchema, {
        kind: "owner-review",
        data: "not-an-object",
      }),
    ).toBe(false);
    expect(Check(gymApp.inputSchema, { kind: "unsupported", data: {} })).toBe(
      false,
    );
    expect(
      Check(gymApp.inputSchema, {
        kind: "owner-review",
        data: {},
        extra: true,
      }),
    ).toBe(false);
  });

  test("keeps every other supported input kind out of owner-review carriers", () => {
    const supportedNonOwnerInputs: AppInput[] = [
      { kind: "improve-may", data: {} },
      { kind: "run-regression", data: { benchmark: "may-alignment" } },
      { kind: "report-incident", data: { sessionId: "session-1" } },
      { kind: "collect-codex-learning", data: {} },
      { kind: "review-telegram-field", data: {} },
    ];

    for (const input of supportedNonOwnerInputs) {
      expect(Check(gymApp.inputSchema, input)).toBe(true);
      const attachment = taskForGymInput(admitted(input, "shared-request"));
      if (attachment.kind !== "desired") {
        throw new Error(`${input.kind} did not produce a desired task`);
      }
      expect(attachment.intent.id.startsWith("owner-review/")).toBe(false);
    }
  });

  test("reconciles typed improvement wakes into one maintain task", () => {
    for (const fact of [
      event("gym.improvement.requested", { reason: "manual", trials: 3 }),
      event("agent.revision.changed", {
        agent: "may",
        revision: "sha256:revision",
      }),
      event("project.approval.submitted", {
        taskId: "improve/may",
        approvalId: "approval-303",
      }),
    ]) {
      expect(resolveGymTask(fact)).toMatchObject({
        id: "improve/may",
        mode: "maintain",
        workflow: "improve-agent",
        input: { agent: "may", curriculumDrain: true },
      });
    }
    expect(
      resolveGymTask(
        event("project.approval.submitted", { taskId: "another/task" }),
      ),
    ).toBeNull();
  });

  test("keeps request-specific evidence out of the stable improvement spec", () => {
    const focused = resolveGymTask(
      event("gym.improvement.requested", {
        benchmark: "may-deputy-learning",
        scenarios: ["may-learn-select-skill-or-workflow"],
        trials: 3,
        reason: "approved-system-deputy-pilot",
      }),
    );
    const revision = resolveGymTask(
      event("agent.revision.changed", {
        agent: "may",
        revision: "sha256:new-may",
      }),
    );
    expect(focused).toEqual(revision);
    expect(focused?.input).toEqual({ agent: "may", curriculumDrain: true });
  });

  test("wakes May campaign only for genuine May metric identities", () => {
    expect(
      resolveGymTask(
        event(
          "metric.breach",
          { metricId: "may.telegram-follow-through-rate" },
          { owner: "agent:may" },
        ),
      ),
    ).toMatchObject({
      id: "improve/may",
      input: { agent: "may", curriculumDrain: true },
    });

    expect(
      resolveGymTask(
        event(
          "metric.breach",
          {
            metricId: "  AGENT.MAY.response-quality  ",
            agent: "app-ops",
          },
          { owner: "agent:app-ops" },
        ),
      ),
    ).toMatchObject({
      id: "improve/may",
      input: { agent: "may", curriculumDrain: true },
    });

    for (const breach of [
      event(
        "metric.breach",
        { metricId: "event.unhandled-signal-count-1h" },
        { owner: "agent:may" },
      ),
      event("metric.breach", {
        metricId: "system.unhandled-event-count-1h",
        agent: "may",
      }),
      event(
        "metric.breach",
        {
          metricId: "runtime.unhandled-signal-rate",
          agent: "may",
        },
        { owner: "may" },
      ),
      event(
        "metric.breach",
        { metricId: "aks.task-timeout-rate" },
        { owner: "agent:app-ops" },
      ),
    ]) {
      expect(resolveGymTask(breach)).toBeNull();
    }
  });
});

describe("Gym evaluation frontier", () => {
  test("routes all May evaluations to one stable task", () => {
    const failure = resolveGymTask(
      event(
        "evaluation.recorded",
        {
          evaluation: {
            agent: "may",
            lane: "needs_triage",
            verdict: "needs_improvement",
            sessionId: "s_bad_may_run",
          },
        },
        { source: "evaluator-aftermath" },
      ),
    );
    const success = resolveGymTask(
      event("evaluation.recorded", {
        evaluation: {
          agent: "may",
          lane: "success_candidate",
          verdict: "good",
          sessionId: "s_good_may_run",
        },
      }),
    );
    expect(failure).toMatchObject({
      id: "runtime/evaluation-intake",
      mode: "maintain",
      workflow: "evaluation-intake",
    });
    expect(success?.id).toBe(failure?.id);
    expect(success?.input).toEqual({ contractRevision: 1 });
  });

  test("ignores non-May evaluations", () => {
    expect(
      resolveGymTask(
        event("evaluation.recorded", {
          evaluation: {
            agent: "coder",
            lane: "needs_triage",
            verdict: "needs_improvement",
          },
        }),
      ),
    ).toBeNull();
  });

  test("ignores structured skips because they contain no behavior evidence", () => {
    expect(
      resolveGymTask(
        event("evaluation.recorded", {
          evaluation: {
            agent: "may",
            verdict: "skipped",
            sessionId: "s_missing_evidence",
          },
        }),
      ),
    ).toBeNull();
  });
});
