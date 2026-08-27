import { describe, expect, test } from "bun:test";

import { verificationRunMatchesTrigger } from "./master-validation-cycle.js";

describe("master-validation PR publication", () => {
  const trigger = {
    specId: "spec.example",
    pipelineRunId: "101",
    sourceBranch: "task/example",
    sourceCommit: "fix",
    pullRequestIds: ["7"],
  };
  const terminalRun = {
    status: "completed",
    result: "failed",
    sourceBranch: "refs/heads/task/example",
    sourceVersion: "fix",
  };

  test("accepts a terminal exact-head run even when another spec found a product failure", () => {
    expect(verificationRunMatchesTrigger(trigger, terminalRun)).toBe(true);
  });

  test("rejects active, canceled, and wrong-head runs", () => {
    expect(
      verificationRunMatchesTrigger(trigger, {
        ...terminalRun,
        status: "inProgress",
        result: undefined,
      }),
    ).toBe(false);
    expect(
      verificationRunMatchesTrigger(trigger, {
        ...terminalRun,
        result: "canceled",
      }),
    ).toBe(false);
    expect(
      verificationRunMatchesTrigger(trigger, {
        ...terminalRun,
        sourceVersion: "older",
      }),
    ).toBe(false);
    expect(
      verificationRunMatchesTrigger(trigger, {
        ...terminalRun,
        sourceBranch: "refs/heads/task/other",
      }),
    ).toBe(false);
  });
});
