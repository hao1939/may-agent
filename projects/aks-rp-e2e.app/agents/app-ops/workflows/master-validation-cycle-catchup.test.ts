import { describe, expect, test } from "bun:test";

import { campaignPassVerificationTrigger } from "./master-validation-cycle.js";

describe("master-validation campaign verification catch-up", () => {
  const campaign = {
    schemaVersion: "1" as const,
    baselineRunId: "100",
    baseCommit: "base",
    branch: "validation/master-validation-100",
    currentCommit: "candidate",
    integratedFixes: [
      {
        pullRequestId: "7",
        taskId: "domain/master-validation-failure/spec.example/fingerprint",
        sourceBranch: "task/legacy",
        sourceCommit: "legacy-fix",
        title: "legacy fix",
      },
      {
        pullRequestId: "8",
        taskId: "domain/master-validation-failure/spec.example",
        sourceBranch: "task/stable",
        sourceCommit: "stable-fix",
        title: "stable fix",
      },
    ],
    updatedAt: "2026-08-05T00:00:00Z",
  };

  test("recovers exact campaign pass proof for legacy and stable task PRs", () => {
    const data = {
      specId: "spec.example",
      status: "pass",
      pipelineRunId: "101",
      sourceBranch: "refs/heads/validation/master-validation-100",
      sourceCommit: "candidate",
    };
    expect(
      campaignPassVerificationTrigger(campaign, {
        event_type: "pipeline.spec.observed",
        status: "pending",
        data: JSON.stringify(data),
      }),
    ).toEqual({
      specId: "spec.example",
      pipelineRunId: "101",
      sourceBranch: "validation/master-validation-100",
      sourceCommit: "candidate",
      pullRequestIds: ["7", "8"],
    });
    expect(
      campaignPassVerificationTrigger(campaign, {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({ ...data, sourceCommit: "older-candidate" }),
      }),
    ).toBeNull();
  });
});
