import { describe, expect, test } from "bun:test";
import {
  decideRepoRefAdvanceGate,
  parseReconciliationTaskPayload,
} from "./wait-for-repo-ref-advance.js";

describe("wait-for-repo-ref-advance workflow", () => {
  test("parses the reconciliation payload block", () => {
    const payload =
      parseReconciliationTaskPayload(`prefix\n## Reconciliation Task\n\
\
\
{\n  "taskId": "domain/example",\n  "input": { "baseRef": "origin/dev", "resumeBaselineCommit": "abc" },\n  "paths": { "projectDir": "/tmp/project" }\n}\n`);

    expect(payload).toMatchObject({
      taskId: "domain/example",
      input: {
        baseRef: "origin/dev",
        resumeBaselineCommit: "abc",
      },
      paths: { projectDir: "/tmp/project" },
    });
  });

  test("returns an exact waiting condition while the watched ref is unchanged", () => {
    const result = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
      specId: "spec.localdns.vm-prerelease.enable-disable",
      sourceCommit: "def",
      publicationBranch: "aks-explorer/example",
    });

    expect(result).toMatchObject({
      state: "waiting",
      conditions: [
        {
          type: "aks.repo-ref.changed",
          subject: "repoRef:origin/dev",
          expected: { field: "commit", notEquals: "abc" },
        },
      ],
    });
  });

  test("uses a distinct Condition for each baseline commit", () => {
    const first = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
    });
    const second = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "def",
      currentCommit: "def",
    });

    expect(first.conditions?.[0]?.id).toBeTruthy();
    expect(second.conditions?.[0]?.id).toBeTruthy();
    expect(first.conditions?.[0]?.id).not.toBe(second.conditions?.[0]?.id);
  });

  test("hands the task back to the owner after the watched ref advances", () => {
    const result = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "def",
      specId: "spec.localdns.vm-prerelease.enable-disable",
    });

    expect(result).toMatchObject({
      state: "needs-owner",
    });
    expect(result).not.toHaveProperty("actions");
    expect(result).not.toHaveProperty("conditions");
    expect(result.summary).toContain("advanced from baseline abc to def");
  });
});
