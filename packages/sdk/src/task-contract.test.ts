import { describe, expect, it } from "bun:test";
import { Check } from "typebox/value";
import {
  admitTaskReconcileResult,
  admitTaskVerificationResult,
  taskOwnerResultSchema,
} from "./task-contract.js";

const workflowOptions = { allowNeedsOwner: true, defaultParentId: "app-root" };

describe("project task handler contract", () => {
  it("preserves a caller response separately from task summary", () => {
    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Conversation request answered",
          response: "Here is the answer the caller asked for.",
          evidence: ["request:conversation-1"],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: true,
      result: {
        state: "converged",
        summary: "Conversation request answered",
        response: "Here is the answer the caller asked for.",
        evidence: ["request:conversation-1"],
        actions: [],
      },
    });
    expect(
      admitTaskReconcileResult(
        { state: "converged", summary: "Answered", response: "   ", evidence: [] },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "response must be a non-empty string" });
  });

  it("admits typed child App dependencies only while waiting", () => {
    const dependency = {
      id: "review",
      appId: "evaluation",
      input: { kind: "deep-scan", data: { reason: "caller-review" } },
    };
    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "Waiting for independent review",
          evidence: ["dependency:evaluation/review"],
          dependencies: [dependency],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: true,
      result: {
        state: "waiting",
        summary: "Waiting for independent review",
        evidence: ["dependency:evaluation/review"],
        actions: [],
        dependencies: [dependency],
      },
    });
    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Invalid early completion",
          evidence: [],
          dependencies: [dependency],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "dependencies are valid only for waiting" });
  });

  it("applies convention defaults to a finite create action", () => {
    const admitted = admitTaskReconcileResult(
      {
        state: "converged",
        summary: "Created one bounded follow-up",
        evidence: ["review:current-frontier"],
        actions: [
          {
            kind: "create-task",
            id: "work/follow-up",
            outcome: "Finish the bounded follow-up.",
            acceptance: ["The follow-up has exact evidence."],
          },
        ],
      },
      workflowOptions,
    );

    expect(admitted).toEqual({
      ok: true,
      result: {
        state: "converged",
        summary: "Created one bounded follow-up",
        evidence: ["review:current-frontier"],
        actions: [
          {
            kind: "create-task",
            id: "work/follow-up",
            parentId: "app-root",
            outcome: "Finish the bounded follow-up.",
            acceptance: ["The follow-up has exact evidence."],
            mode: "achieve",
            outputs: [],
            priority: "P2",
          },
        ],
      },
    });
  });

  it("normalizes app/project root aliases on create actions", () => {
    const admitted = admitTaskReconcileResult(
      {
        state: "converged",
        summary: "Created one bounded follow-up",
        evidence: ["review:current-frontier"],
        actions: [
          {
            kind: "create-task",
            id: "work/follow-up",
            parentId: "aks-rp-e2e",
            outcome: "Finish the bounded follow-up.",
            acceptance: ["The follow-up has exact evidence."],
          },
        ],
      },
      {
        ...workflowOptions,
        rootParentAliases: ["aks-rp-e2e"],
      },
    );

    expect(admitted.ok && admitted.result.actions?.[0]).toMatchObject({
      kind: "create-task",
      id: "work/follow-up",
      parentId: "app-root",
    });
  });

  it("preserves domain input, dependencies, and explicit standing mode", () => {
    const admitted = admitTaskReconcileResult(
      {
        state: "converged",
        summary: "Declared standing work",
        evidence: [],
        actions: [
          {
            kind: "create-task",
            id: "runtime/monitor",
            outcome: "Keep the signal observed.",
            acceptance: ["The latest signal is represented."],
            mode: "maintain",
            input: { signal: "pipeline" },
            dependsOn: ["bootstrap"],
          },
        ],
      },
      workflowOptions,
    );

    expect(admitted.ok && admitted.result.actions?.[0]).toMatchObject({
      mode: "maintain",
      input: { signal: "pipeline" },
      dependsOn: ["bootstrap"],
    });
  });

  it("supports explicit workflow binding repair", () => {
    const admitted = admitTaskReconcileResult(
      {
        state: "converged",
        summary: "Removed a stale workflow binding",
        evidence: ["workflow:no-longer-registered"],
        actions: [
          {
            kind: "update-task",
            taskId: "work/stale",
            expectedGeneration: 3,
            workflow: null,
            owner: "scout",
          },
        ],
      },
      workflowOptions,
    );

    expect(admitted.ok && admitted.result.actions?.[0]).toEqual({
      kind: "update-task",
      taskId: "work/stale",
      expectedGeneration: 3,
      workflow: null,
      owner: "scout",
    });
  });

  it("rejects the removed expectedRevision action field", () => {
    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Attempted a legacy update",
          evidence: ["task:work/stale"],
          actions: [
            {
              kind: "update-task",
              taskId: "work/stale",
              expectedRevision: 3,
              outcome: "This legacy action must not be admitted.",
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
      admitTaskReconcileResult({ state: "failed", summary: "attempt failed", evidence: [] }, workflowOptions),
    ).toEqual({ ok: false, error: "state must be converged, waiting, or needs-owner" });
  });

  it("allows needs-owner only at the workflow boundary", () => {
    const output = { state: "needs-owner", summary: "Novel judgment", evidence: ["scope:novel"] };
    expect(admitTaskReconcileResult(output, workflowOptions).ok).toBe(true);
    expect(admitTaskReconcileResult(output, { ...workflowOptions, allowNeedsOwner: false })).toEqual({
      ok: false,
      error: "a resolved owner cannot return needs-owner",
    });
  });

  it("uses the model schema as the exact runtime admission boundary", () => {
    const withUnknownResultField = admitTaskReconcileResult(
      { state: "converged", summary: "done", evidence: [], unexpected: true },
      workflowOptions,
    );
    expect(withUnknownResultField.ok).toBe(false);

    const withUnknownActionField = admitTaskReconcileResult(
      {
        state: "converged",
        summary: "created",
        evidence: ["proof"],
        actions: [
          {
            kind: "create-task",
            id: "work/exact",
            outcome: "Do exact work",
            acceptance: ["Exact work is done"],
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
        evidence: [],
        unexpected: true,
      }).ok,
    ).toBe(false);
  });

  it("admits waiting for runtime validation against Conditions or live children", () => {
    expect(
      admitTaskReconcileResult({ state: "waiting", summary: "Waiting", evidence: [], conditions: [] }, workflowOptions)
        .ok,
    ).toBe(true);

    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "Waiting for credential observation",
          evidence: ["credential is absent"],
          conditions: [
            {
              id: "credential-ready:xhs",
              type: "credential.ready",
              subject: "credential:xhs",
              expected: { field: "state", equals: "ready" },
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
      evidence: [],
      conditions: [
        {
          id: "approval",
          type: "approval.granted",
          subject: "approval",
          expected: true,
        },
      ],
    };
    expect(Check(taskOwnerResultSchema, untypedConditionResult)).toBe(false);
    expect(admitTaskReconcileResult(untypedConditionResult, workflowOptions)).toEqual({
      ok: false,
      error: "conditions[0].subject must be a typed subject",
    });

    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "Waiting with an invalid busy review loop",
          evidence: [],
          conditions: [
            {
              id: "credential-ready:xhs",
              type: "credential.ready",
              subject: "credential:xhs",
              expected: "ready",
              reviewAfterMs: 1000,
            },
          ],
        },
        workflowOptions,
      ).ok,
    ).toBe(false);
  });

  it("rejects Conditions that turn task state into a second scheduler", () => {
    for (const type of ["project.state", "project.task.tick", "task-field", "task-phase", "task.phase"]) {
      expect(
        admitTaskReconcileResult(
          {
            state: "waiting",
            summary: "Waiting on internal task state",
            evidence: [],
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
        evidence: ["artifact:present"],
      }),
    ).toEqual({
      ok: true,
      result: {
        accepted: true,
        summary: "Postcondition holds.",
        evidence: ["artifact:present"],
      },
    });
    expect(
      admitTaskVerificationResult({
        accepted: "yes",
        summary: "Ambiguous verdict",
        evidence: [],
      }),
    ).toEqual({ ok: false, error: "verifier accepted must be boolean" });
  });
});
