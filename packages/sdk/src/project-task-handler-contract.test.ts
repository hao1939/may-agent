import { describe, expect, it } from "bun:test";
import {
  admitProjectAppTaskHandlerResult,
  admitProjectAppTaskVerificationResult,
} from "./project-task-handler-contract.js";

const workflowOptions = { allowNeedsOwner: true, defaultParentId: "app-root" };

describe("project task handler contract", () => {
  it("applies convention defaults to a finite create action", () => {
    const admitted = admitProjectAppTaskHandlerResult(
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
    const admitted = admitProjectAppTaskHandlerResult(
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
    const admitted = admitProjectAppTaskHandlerResult(
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
    const admitted = admitProjectAppTaskHandlerResult(
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
      admitProjectAppTaskHandlerResult(
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
      admitProjectAppTaskHandlerResult({ state: "failed", summary: "attempt failed", evidence: [] }, workflowOptions),
    ).toEqual({ ok: false, error: "state must be converged, waiting, or needs-owner" });
  });

  it("allows needs-owner only at the workflow boundary", () => {
    const output = { state: "needs-owner", summary: "Novel judgment", evidence: ["scope:novel"] };
    expect(admitProjectAppTaskHandlerResult(output, workflowOptions).ok).toBe(true);
    expect(admitProjectAppTaskHandlerResult(output, { ...workflowOptions, allowNeedsOwner: false })).toEqual({
      ok: false,
      error: "a resolved owner cannot return needs-owner",
    });
  });

  it("uses the model schema as the exact runtime admission boundary", () => {
    const withUnknownResultField = admitProjectAppTaskHandlerResult(
      { state: "converged", summary: "done", evidence: [], unexpected: true },
      workflowOptions,
    );
    expect(withUnknownResultField.ok).toBe(false);

    const withUnknownActionField = admitProjectAppTaskHandlerResult(
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
      admitProjectAppTaskVerificationResult({
        accepted: true,
        summary: "verified",
        evidence: [],
        unexpected: true,
      }).ok,
    ).toBe(false);
  });

  it("admits waiting for runtime validation against Conditions or live children", () => {
    expect(
      admitProjectAppTaskHandlerResult(
        { state: "waiting", summary: "Waiting", evidence: [], conditions: [] },
        workflowOptions,
      ).ok,
    ).toBe(true);

    expect(
      admitProjectAppTaskHandlerResult(
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

    expect(
      admitProjectAppTaskHandlerResult(
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

  it("admits only explicit verifier verdicts", () => {
    expect(
      admitProjectAppTaskVerificationResult({
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
      admitProjectAppTaskVerificationResult({
        accepted: "yes",
        summary: "Ambiguous verdict",
        evidence: [],
      }),
    ).toEqual({ ok: false, error: "verifier accepted must be boolean" });
  });
});
