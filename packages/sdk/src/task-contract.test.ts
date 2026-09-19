import { describe, expect, it } from "bun:test";
import { Check } from "typebox/value";
import { admitTaskReconcileResult, admitTaskVerificationResult, taskAgentResultSchema } from "./task-contract.js";

const workflowOptions = { allowNeedsAgent: true };

it("admits explicit useful continuation without confusing it with an answer or failure", () => {
  const result = {
    state: "waiting",
    continue: true,
    summary: "Review requested; prepare independent notes next",
    facts: ["review:requested"],
    dependencies: [{ id: "review", appId: "reviewer", input: { kind: "review", data: {} } }],
  };
  expect(Check(taskAgentResultSchema, result)).toBe(true);
  const admitted = admitTaskReconcileResult(result, workflowOptions);
  expect(admitted.ok).toBe(true);
  if (!admitted.ok) throw new Error(admitted.error);
  expect(admitTaskReconcileResult(admitted.result, workflowOptions)).toEqual(admitted);
  for (const invalid of [
    { continue: false },
    { state: "converged" },
    { dependencies: [] },
    { facts: [] },
    { report: true },
  ]) {
    expect(admitTaskReconcileResult({ ...result, ...invalid }, workflowOptions).ok).toBe(false);
  }
});

describe("App stop contract", () => {
  const incomplete = {
    state: "incomplete",
    summary: "Optional export is not feasible",
    facts: ["analysis:export"],
    result: { partial: "Feasibility findings" },
  };
  it("admits a non-success decision and keeps normalization replayable", () => {
    expect(Check(taskAgentResultSchema, incomplete)).toBe(true);
    const admitted = admitTaskReconcileResult(incomplete, workflowOptions);
    expect(admitted).toEqual({ ok: true, result: incomplete });
    if (!admitted.ok) throw new Error("expected admitted stop");
    expect(admitTaskReconcileResult(admitted.result, workflowOptions)).toEqual(admitted);
  });
  it.each([{ facts: [] }, { actions: [] }, { conditions: [] }, { dependencies: [] }])(
    "rejects incomplete or mixed stop decisions: %j",
    (extra) => {
      expect(Check(taskAgentResultSchema, { ...incomplete, ...extra })).toBe(false);
      expect(admitTaskReconcileResult({ ...incomplete, ...extra }, workflowOptions).ok).toBe(false);
    },
  );
});

describe("project task handler contract", () => {
  it.each([
    ["external-review", false],
    ["review.completed", true],
    ["custom.fact", true],
  ] as const)("requires publishable namespaced Condition types: %s", (type, valid) => {
    const output = {
      state: "waiting",
      summary: "Await exact review",
      facts: [],
      conditions: [
        {
          id: "review",
          type,
          subject: "review:candidate",
          expected: true,
          owner: "human",
          reviewAfterMs: 60_000,
        },
      ],
    };
    expect(Check(taskAgentResultSchema, output)).toBe(valid);
    expect(admitTaskReconcileResult(output, workflowOptions).ok).toBe(valid);
  });
  it("agrees with the finish schema on quiet waits and explicit facts-backed reports", () => {
    for (const state of ["waiting", "incomplete", "converged", "needs-agent"] as const) {
      for (const facts of [[], ["source:access-denied"]]) {
        for (const report of [undefined, true, false]) {
          const output = { state, summary: "Access is missing", facts,
            ...(report === undefined ? {} : { report }) };
          const valid = state !== "needs-agent" && report !== false &&
            (report !== true || (state !== "converged" && facts.length > 0)) &&
            (state !== "incomplete" || facts.length > 0);
          expect({ output, valid: Check(taskAgentResultSchema, output) }).toEqual({ output, valid });
          const admitted = admitTaskReconcileResult(output, { allowNeedsAgent: false });
          expect({ output, valid: admitted.ok }).toEqual({ output, valid });
          if (admitted.ok) {
            expect(admitted.result).toMatchObject(output);
            expect(Check(taskAgentResultSchema, admitted.result)).toBe(true);
            expect(admitTaskReconcileResult(admitted.result, { allowNeedsAgent: false })).toEqual(admitted);
          }
        }
      }
    }
  });

  it("exposes the admitted Condition owner syntax to the agent before finish", () => {
    const owners = [
      ["human", true],
      ["human:requester", true],
      ["app:measurement", true],
      ["source-owner:sample/Read.v2", true],
      ["  human  ", true],
      ["\tapp:measurement\n", true],
      ["", false],
      ["   ", false],
      ["human requester", false],
      ["Human:requester", false],
      ["app:", false],
      ["app:two words", false],
      ["app:sample:owner", false],
    ] as const;
    for (const [owner, valid] of owners) {
      const output = {
        state: "waiting",
        summary: "Waiting for source access",
        facts: ["source:sample"],
        conditions: [
          {
            id: "source-access",
            type: "source.access",
            subject: "source:sample",
            expected: true,
            owner,
            reviewAfterMs: 60_000,
          },
        ],
      };
      expect({ owner, valid: Check(taskAgentResultSchema, output) }).toEqual({ owner, valid });
      const admitted = admitTaskReconcileResult(output, workflowOptions);
      expect({ owner, valid: admitted.ok }).toEqual({ owner, valid });
      if (admitted.ok) {
        expect(admitted.result.conditions?.[0]?.owner).toBe(owner.trim());
        expect(Check(taskAgentResultSchema, admitted.result)).toBe(true);
      }
    }
  });

  it("rejects legacy close actions instead of manufacturing a successful outcome", () => {
    const result = {
      state: "converged",
      summary: "Withdraw the child scope",
      facts: ["owner:withdrawal"],
      actions: [{ kind: "close-task", taskId: "child", expectedGeneration: 1, summary: "No longer needed" }],
    };
    expect(Check(taskAgentResultSchema, result)).toBe(false);
    expect(admitTaskReconcileResult(result, workflowOptions)).toMatchObject({
      ok: false,
      error:
        "actions[0].kind must be unblock-task or retire-condition; revise requirements through tasks update and delegate new work through dependencies",
    });
  });

  it("normalizes exact Condition retirement and an absolute waiting review", () => {
    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "Reconsider this exact request later",
          reviewAt: 1_800_000_000_000,
          facts: ["budget:deferred"],
          actions: [
            {
              kind: "retire-condition",
              conditionId: "obsolete-review",
              expectedConditionGeneration: 2,
              reason: "This exact link is obsolete",
            },
          ],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: true,
      result: {
        state: "waiting",
        summary: "Reconsider this exact request later",
        reviewAt: 1_800_000_000_000,
        facts: ["budget:deferred"],
        actions: [
          {
            kind: "retire-condition",
            conditionId: "obsolete-review",
            expectedConditionGeneration: 2,
            reason: "This exact link is obsolete",
          },
        ],
      },
    });
    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "done",
          reviewAt: 1_800_000_000_000,
          facts: [],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "reviewAt is valid only for waiting" });
  });

  it("preserves a caller response separately from task summary", () => {
    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Conversation request answered",
          response: "Here is the answer the caller asked for.",
          facts: ["request:conversation-1"],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: true,
      result: {
        state: "converged",
        summary: "Conversation request answered",
        response: "Here is the answer the caller asked for.",
        facts: ["request:conversation-1"],
        actions: [],
      },
    });
    expect(
      admitTaskReconcileResult(
        { state: "converged", summary: "Answered", response: "   ", facts: [] },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "response must be a non-empty string" });
  });

  it("carries a bounded App-defined structured result across task states", () => {
    const output = {
      state: "converged" as const,
      summary: "Classified the terminal run",
      result: { productVerdict: "none", cause: "pipeline-artifact" },
      facts: ["pipeline-run:42"],
    };
    expect(admitTaskReconcileResult(output, workflowOptions)).toEqual({
      ok: true,
      result: { ...output, actions: [] },
    });
    expect(Check(taskAgentResultSchema, output)).toBeTrue();
    expect(admitTaskReconcileResult({ ...output, state: "waiting" }, workflowOptions)).toEqual({
      ok: true,
      result: { ...output, state: "waiting", actions: [] },
    });
    expect(admitTaskReconcileResult({ ...output, result: { value: "x".repeat(17 * 1024) } }, workflowOptions)).toEqual({
      ok: false,
      error: "result exceeds the 16384-byte limit",
    });
  });

  it("admits typed App dependencies only while waiting", () => {
    const dependency = {
      id: "review",
      appId: "evaluation",
      taskId: "review/current",
      input: { kind: "deep-scan", data: { reason: "caller-review" } },
    };
    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "Waiting for independent review",
          facts: ["dependency:evaluation/review"],
          dependencies: [dependency],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: true,
      result: {
        state: "waiting",
        summary: "Waiting for independent review",
        facts: ["dependency:evaluation/review"],
        actions: [],
        dependencies: [dependency],
      },
    });
    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Invalid early completion",
          facts: [],
          dependencies: [dependency],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "dependencies are valid only for waiting" });
    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "The dependency is still running",
          response: "I will tell you when it finishes.",
          facts: [],
          dependencies: [dependency],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: false,
      error: "waiting cannot include response; put operational progress in summary",
    });
    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "Invalid target",
          facts: [],
          dependencies: [{ ...dependency, taskId: " " }],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "dependencies[0].taskId must be a non-empty string when present" });
  });

  it("rejects raw child specifications in both schema and admission", () => {
    const output = {
      state: "waiting",
      summary: "Delegate work",
      facts: ["needed"],
      actions: [{ kind: "create-task", id: "child", outcome: "Measure", acceptance: ["Measured"] }],
    };
    expect(Check(taskAgentResultSchema, output)).toBeFalse();
    expect(admitTaskReconcileResult(output, workflowOptions)).toEqual({
      ok: false,
      error:
        "actions[0].kind must be unblock-task or retire-condition; revise requirements through tasks update and delegate new work through dependencies",
    });
  });

  it("accepts the established human identity for an accountable timed wait", () => {
    const result = {
      state: "waiting",
      summary: "Waiting for the operator",
      facts: [],
      conditions: [
        {
          id: "auth-restored",
          type: "external.fact",
          subject: "credential:provider",
          expected: { status: "valid" },
          owner: "human",
          reviewAfterMs: 300_000,
        },
      ],
    };
    expect(Check(taskAgentResultSchema, result)).toBeTrue();
    expect(admitTaskReconcileResult(result, workflowOptions).ok).toBeTrue();
  });

  it.each([
    { outcome: "Corrected work", input: { source: "beta" } },
    { agent: "other" },
    { owner: "other", workflow: null },
    { executor: "worker" },
    { priority: "P1" },
  ])("rejects raw assignment updates at both result boundaries: %j", (change) => {
    const output = {
      state: "converged", summary: "Proposed correction", facts: ["scope:corrected"],
      actions: [{ kind: "update-task", taskId: "child", expectedGeneration: 1, ...change }],
    };
    expect(Check(taskAgentResultSchema, output)).toBe(false);
    expect(admitTaskReconcileResult(output, workflowOptions)).toEqual({
      ok: false,
      error: "actions[0].update-task is retired; use tasks update or TaskAttempt.reviseTask before returning a result",
    });
  });

  it("rejects the removed expectedRevision action field", () => {
    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Attempted a legacy update",
          facts: ["task:work/stale"],
          actions: [
            {
              kind: "unblock-task",
              taskId: "work/stale",
              expectedRevision: 3,
              reason: "This legacy action must not be admitted.",
            },
          ],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: false,
      error: "actions[0].expectedGeneration must be a positive integer",
    });
  });

  it("keeps failure outside the public handler states", () => {
    expect(
      admitTaskReconcileResult({ state: "failed", summary: "attempt failed", facts: [] }, workflowOptions),
    ).toEqual({ ok: false, error: "state must be converged, waiting, incomplete, or needs-agent" });
  });

  it("allows needs-agent only at the workflow boundary", () => {
    const output = { state: "needs-agent", summary: "Novel judgment", facts: ["scope:novel"] };
    expect(admitTaskReconcileResult(output, workflowOptions).ok).toBe(true);
    expect(admitTaskReconcileResult(output, { ...workflowOptions, allowNeedsAgent: false })).toEqual({
      ok: false,
      error: "a resolved agent cannot return needs-agent",
    });
  });

  it("normalizes the legacy needs-owner result at admission", () => {
    expect(
      admitTaskReconcileResult(
        { state: "needs-owner", summary: "Legacy handoff", facts: ["legacy:workflow"] },
        workflowOptions,
      ),
    ).toEqual({
      ok: true,
      result: { state: "needs-agent", summary: "Legacy handoff", facts: ["legacy:workflow"] },
    });
  });

  it("uses the model schema as the exact runtime admission boundary", () => {
    const withUnknownResultField = admitTaskReconcileResult(
      { state: "converged", summary: "done", facts: [], unexpected: true },
      workflowOptions,
    );
    expect(withUnknownResultField.ok).toBe(false);

    const withUnknownActionField = admitTaskReconcileResult(
      {
        state: "converged",
        summary: "created",
        facts: ["proof"],
        actions: [
          {
            kind: "unblock-task",
            taskId: "work/exact",
            expectedGeneration: 1,
            reason: "Reconsider the wait",
            unexpected: true,
          },
        ],
      },
      workflowOptions,
    );
    expect(withUnknownActionField.ok).toBe(false);

    expect(
      admitTaskVerificationResult({
        accepted: true,
        summary: "verified",
        facts: [],
        unexpected: true,
      }).ok,
    ).toBe(false);
  });

  it("admits waiting for runtime validation against newly declared or saved waits", () => {
    expect(
      admitTaskReconcileResult({ state: "waiting", summary: "Waiting", facts: [], conditions: [] }, workflowOptions)
        .ok,
    ).toBe(true);

    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "Waiting for credential observation",
          facts: ["credential is absent"],
          conditions: [
            {
              id: "credential-ready:xhs",
              type: "credential.ready",
              subject: "credential:xhs",
              expected: { field: "state", equals: "ready" },
              owner: "app:credential-provider",
              requestedAction: "Restore the xhs credential or confirm that it should remain disabled.",
              reviewAfterMs: 300000,
            },
          ],
        },
        workflowOptions,
      ).ok,
    ).toBe(true);

    const untypedConditionResult = {
      state: "waiting",
      summary: "Waiting for approval",
      facts: [],
      conditions: [
        {
          id: "approval",
          type: "approval.granted",
          subject: "approval",
          expected: true,
        },
      ],
    };
    expect(Check(taskAgentResultSchema, untypedConditionResult)).toBe(false);
    expect(admitTaskReconcileResult(untypedConditionResult, workflowOptions)).toEqual({
      ok: false,
      error: "conditions[0].subject must be a typed subject",
    });

    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "Waiting with an invalid busy review loop",
          facts: [],
          conditions: [
            {
              id: "credential-ready:xhs",
              type: "credential.ready",
              subject: "credential:xhs",
              expected: "ready",
              owner: "app:credential-provider",
              reviewAfterMs: 1000,
            },
          ],
        },
        workflowOptions,
      ).ok,
    ).toBe(false);

    const incompleteCondition = {
      state: "waiting",
      summary: "Waiting without accountable recovery",
      facts: [],
      conditions: [
        {
          id: "credential-ready:xhs",
          type: "credential.ready",
          subject: "credential:xhs",
          expected: "ready",
        },
      ],
    };
    expect(admitTaskReconcileResult(incompleteCondition, workflowOptions)).toEqual({
      ok: false,
      error: "conditions[0].owner must be a canonical non-empty identity",
    });
    expect(
      admitTaskReconcileResult(
        {
          ...incompleteCondition,
          conditions: [{ ...incompleteCondition.conditions[0], owner: "Hao", reviewAfterMs: 60_000 }],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "conditions[0].owner must be a canonical kind:identity" });
    expect(
      admitTaskReconcileResult(
        {
          ...incompleteCondition,
          conditions: [{ ...incompleteCondition.conditions[0], owner: "app:credential-provider" }],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: false,
      error: "conditions[0].reviewAfterMs must be an integer of at least 60000",
    });
  });

  it("rejects Conditions that turn task state into a second scheduler", () => {
    for (const type of ["project.state", "project.task.tick", "task-field", "task-phase", "task.phase"]) {
      expect(
        admitTaskReconcileResult(
          {
            state: "waiting",
            summary: "Waiting on internal task state",
            facts: [],
            conditions: [
              {
                id: `internal-${type}`,
                type,
                subject: "task:child",
                expected: { field: "phase", equals: "converged" },
              },
            ],
          },
          workflowOptions,
        ),
      ).toEqual({
        ok: false,
        error: `conditions[0].type ${type} is internal task scheduling; use a direct child, dependsOn, or an external observable Condition`,
      });
    }
  });

  it("admits only explicit verifier verdicts", () => {
    expect(
      admitTaskVerificationResult({
        accepted: true,
        summary: "Postcondition holds.",
        facts: ["artifact:present"],
      }),
    ).toEqual({
      ok: true,
      result: {
        accepted: true,
        summary: "Postcondition holds.",
        facts: ["artifact:present"],
      },
    });
    expect(
      admitTaskVerificationResult({
        accepted: "yes",
        summary: "Ambiguous verdict",
        facts: [],
      }),
    ).toEqual({ ok: false, error: "verifier accepted must be boolean" });
  });
});
