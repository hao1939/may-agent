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
    const observed = {
      specId: "spec.example",
      status: "pass",
      pipelineRunId: "101",
    };
    expect(
      campaignPassVerificationTrigger(campaign, {
        event_type: "pipeline.spec.observed",
        status: "pending",
        data: JSON.stringify({
          ...observed,
          sourceBranch: "refs/heads/task/legacy",
          sourceCommit: "legacy-fix",
        }),
      }),
    ).toEqual({
      specId: "spec.example",
      pipelineRunId: "101",
      sourceBranch: "task/legacy",
      sourceCommit: "legacy-fix",
      pullRequestIds: ["7"],
    });
    expect(
      campaignPassVerificationTrigger(campaign, {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({
          ...observed,
          pipelineRunId: "102",
          sourceBranch: "task/stable",
          sourceCommit: "stable-fix",
        }),
      }),
    ).toEqual({
      specId: "spec.example",
      pipelineRunId: "102",
      sourceBranch: "task/stable",
      sourceCommit: "stable-fix",
      pullRequestIds: ["8"],
    });
    expect(
      campaignPassVerificationTrigger(campaign, {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({
          ...observed,
          sourceBranch: "task/stable",
          sourceCommit: "older-stable-fix",
        }),
      }),
    ).toBeNull();
  });
});
