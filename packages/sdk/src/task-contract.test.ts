import { describe, expect, it } from "bun:test";
import { Check } from "typebox/value";
import { admitTaskReconcileResult, admitTaskVerificationResult, taskAgentResultSchema } from "./task-contract.js";

const workflowOptions = { allowNeedsAgent: true, defaultParentId: "app-root" };

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

  it("carries a bounded App-defined structured result across task states", () => {
    const output = {
      state: "converged" as const,
      summary: "Classified the terminal run",
      result: { productVerdict: "none", cause: "pipeline-artifact" },
      evidence: ["pipeline-run:42"],
    };
    expect(admitTaskReconcileResult(output, workflowOptions)).toEqual({
      ok: true,
      result: { ...output, actions: [] },
    });
    expect(Check(taskAgentResultSchema, output)).toBeTrue();
    expect(
      admitTaskReconcileResult(
        { ...output, state: "waiting" },
        workflowOptions,
      ),
    ).toEqual({
      ok: true,
      result: { ...output, state: "waiting", actions: [] },
    });
    expect(
      admitTaskReconcileResult(
        { ...output, result: { value: "x".repeat(17 * 1024) } },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "result exceeds the 16384-byte limit" });
  });

  it("admits typed child App dependencies only while waiting", () => {
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
    expect(
      admitTaskReconcileResult(
        {
          state: "waiting",
          summary: "The dependency is still running",
          response: "I will tell you when it finishes.",
          evidence: [],
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
          evidence: [],
          dependencies: [{ ...dependency, taskId: " " }],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "dependencies[0].taskId must be a non-empty string when present" });
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

  it("accepts canonical agent selection and normalizes it for retained Host state", () => {
    const canonicalOutput = {
      state: "converged" as const,
      summary: "Selected a specialist",
      evidence: [] as string[],
      actions: [
        {
          kind: "create-task" as const,
          id: "work/specialist",
          outcome: "Run specialist work",
          acceptance: ["Specialist work completes"],
          agent: "specialist",
        },
      ],
    };
    expect(Check(taskAgentResultSchema, canonicalOutput)).toBe(true);
    expect(
      Check(taskAgentResultSchema, {
        ...canonicalOutput,
        actions: [{ ...canonicalOutput.actions[0], owner: "may-agent" }],
      }),
    ).toBe(false);

    const admitted = admitTaskReconcileResult(
      canonicalOutput,
      workflowOptions,
    );

    expect(admitted.ok && admitted.result.actions?.[0]).toMatchObject({ owner: "specialist" });
    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Ambiguous selection",
          evidence: [],
          actions: [
            {
              kind: "create-task",
              id: "work/ambiguous",
              outcome: "Do work",
              acceptance: ["Work completes"],
              agent: "one",
              owner: "two",
            },
          ],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "actions[0].agent conflicts with legacy owner" });
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
            agent: "scout",
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

  it("normalizes a canonical agent removal and rejects conflicting update aliases", () => {
    const removed = admitTaskReconcileResult(
      {
        state: "converged",
        summary: "Use the inherited App agent",
        evidence: [],
        actions: [
          {
            kind: "update-task",
            taskId: "work/stale-agent",
            expectedGeneration: 4,
            agent: null,
          },
        ],
      },
      workflowOptions,
    );
    expect(removed.ok && removed.result.actions?.[0]).toEqual({
      kind: "update-task",
      taskId: "work/stale-agent",
      expectedGeneration: 4,
      owner: null,
    });

    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Ambiguous update",
          evidence: [],
          actions: [
            {
              kind: "update-task",
              taskId: "work/ambiguous",
              expectedGeneration: 2,
              agent: null,
              owner: "specialist",
            },
          ],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "actions[0].agent conflicts with legacy owner" });
  });

  it("admits one executor selection and rejects ambiguous workflow binding", () => {
    const selected = admitTaskReconcileResult(
      {
        state: "converged",
        summary: "Delegated one bounded implementation",
        evidence: [],
        actions: [
          {
            kind: "create-task",
            id: "work/review",
            outcome: "Implement the bounded change.",
            acceptance: ["The change is verified."],
            executor: "reviewer",
          },
        ],
      },
      workflowOptions,
    );
    expect(selected.ok && selected.result.actions?.[0]).toMatchObject({ executor: "reviewer" });

    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Ambiguous delegation",
          evidence: [],
          actions: [
            {
              kind: "create-task",
              id: "work/ambiguous",
              outcome: "Do work.",
              acceptance: ["Done."],
              workflow: "implementation",
              executor: "claude",
            },
          ],
        },
        workflowOptions,
      ),
    ).toEqual({ ok: false, error: "actions[0] cannot configure both workflow and executor" });

    expect(
      admitTaskReconcileResult(
        {
          state: "converged",
          summary: "Invalid executor",
          evidence: [],
          actions: [
            {
              kind: "create-task",
              id: "work/invalid-executor",
              outcome: "Do work.",
              acceptance: ["Done."],
              executor: "Bad Name",
            },
          ],
        },
        workflowOptions,
      ),
    ).toEqual({
      ok: false,
      error: "actions[0].executor must be a lowercase name of at most 64 characters when present",
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
    ).toEqual({ ok: false, error: "state must be converged, waiting, or needs-agent" });
  });

  it("allows needs-agent only at the workflow boundary", () => {
    const output = { state: "needs-agent", summary: "Novel judgment", evidence: ["scope:novel"] };
    expect(admitTaskReconcileResult(output, workflowOptions).ok).toBe(true);
    expect(admitTaskReconcileResult(output, { ...workflowOptions, allowNeedsAgent: false })).toEqual({
      ok: false,
      error: "a resolved agent cannot return needs-agent",
    });
  });

  it("normalizes the legacy needs-owner result at admission", () => {
    expect(
      admitTaskReconcileResult(
        { state: "needs-owner", summary: "Legacy handoff", evidence: ["legacy:workflow"] },
        workflowOptions,
      ),
    ).toEqual({
      ok: true,
      result: { state: "needs-agent", summary: "Legacy handoff", evidence: ["legacy:workflow"] },
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
          evidence: [],
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
      evidence: [],
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
