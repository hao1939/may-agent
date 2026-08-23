import { describe, expect, it } from "bun:test";
import type { TaskAction } from "@may-agent/sdk";
import { validateAksTaskAction } from "./app.js";
import { decideDomainWriteRouting } from "./domain-write-routing.js";

const exactCommit = "0123456789abcdef0123456789abcdef01234567";

function createAction(input: Record<string, unknown>): TaskAction {
  return {
    kind: "create-task",
    id: "domain/prepared-source-test",
    parentId: "group/domain-work",
    outcome: "Exercise prepared-source admission.",
    acceptance: ["The action is admitted or rejected before materialization."],
    mode: "achieve",
    outputs: [],
    priority: "P2",
    workflow: "spec-live-reconciliation",
    input,
  };
}

function updateAction(input: Record<string, unknown>): TaskAction {
  return {
    kind: "update-task",
    taskId: "domain/prepared-source-test",
    expectedGeneration: 1,
    workflow: "spec-live-reconciliation",
    input,
  };
}

describe("AKS task-action prepared-source preflight", () => {
  for (const [kind, action] of [
    [
      "create",
      createAction({ sourceBranch: "origin/dev", sourceCommit: exactCommit }),
    ],
    [
      "update",
      updateAction({ sourceBranch: "origin/dev", sourceCommit: exactCommit }),
    ],
  ] as const) {
    it(`rejects evaluator origin/dev on the ${kind} path`, () => {
      expect(validateAksTaskAction(action)).toContain("dedicated task/ branch");
    });
  }

  for (const [kind, action] of [
    ["create", createAction({ specId: "spec.example" })],
    ["update", updateAction({ specId: "spec.example" })],
  ] as const) {
    it(`accepts an omitted prepared-source pair on the ${kind} path`, () => {
      expect(validateAksTaskAction(action)).toBeNull();
    });
  }

  for (const [kind, action] of [
    [
      "create",
      createAction({ sourceBranch: "task/example", sourceCommit: exactCommit }),
    ],
    [
      "update",
      updateAction({
        sourceBranch: "refs/heads/task/example",
        sourceCommit: exactCommit,
      }),
    ],
  ] as const) {
    it(`accepts a dedicated branch and exact commit on the ${kind} path`, () => {
      expect(validateAksTaskAction(action)).toBeNull();
    });
  }

  it("rejects a branch without its exact commit", () => {
    expect(
      validateAksTaskAction(createAction({ sourceBranch: "task/example" })),
    ).toContain("sourceBranch and input.sourceCommit together");
  });

  it("rejects a commit without its branch", () => {
    expect(
      validateAksTaskAction(updateAction({ sourceCommit: exactCommit })),
    ).toContain("sourceBranch and input.sourceCommit together");
  });

  it("rejects a non-exact commit", () => {
    expect(
      validateAksTaskAction(
        createAction({
          sourceBranch: "task/example",
          sourceCommit: "deadbeef",
        }),
      ),
    ).toContain("exact 40-character Git commit");
  });
});

describe("AKS domain write routing preflight", () => {
  function domainAction(
    workflow?: string,
    outcome = "Edit repository source and commit the bounded repair.",
  ): TaskAction {
    return {
      kind: "create-task",
      id: "domain/write-routing-test",
      parentId: "group/domain-work",
      outcome,
      acceptance: ["Publish the accepted source change."],
      mode: "achieve",
      outputs: [],
      priority: "P1",
      agent: "aks-explorer",
      ...(workflow ? { workflow } : {}),
      input: {},
    };
  }

  it("rejects an ordinary unbound agent task that requires source writes", () => {
    expect(validateAksTaskAction(domainAction())).toContain(
      "ordinary unbound agent execution is read-only",
    );
  });

  it("routes a learned write workflow to its declared task workspace", () => {
    expect(
      validateAksTaskAction(domainAction("domain-task-execution")),
    ).toBeNull();
  });

  it("keeps ordinary read-only agent judgment supported", () => {
    const action = domainAction(
      undefined,
      "Inspect current repository evidence without editing, committing, or publishing source.",
    );
    action.acceptance = ["Return a read-only disposition with exact evidence."];
    expect(decideDomainWriteRouting(action).decision).toBe("read-only-agent");
    expect(validateAksTaskAction(action)).toBeNull();
  });
});
