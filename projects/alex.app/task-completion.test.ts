import { expect, test } from "bun:test";
import type { AppTaskResultContext } from "@may-agent/sdk/app";
import { closeAcceptedAssignment } from "./task-completion.js";
import { taskForInput, taskInputForEvent } from "./app.js";

function context(
  kind = "message",
  context: Record<string, unknown> = {},
): AppTaskResultContext {
  return {
    task: {
      id: "input/exact-ask",
      parentId: "root",
      outcome: "Assess one report",
      acceptance: ["Return a supported disposition"],
      input: { kind, data: { context } },
    },
    creator: { appId: "alex" },
    acceptedResult: {
      state: "converged",
      summary: "Supported no change",
      facts: ["Exact report and subject verified"],
      result: {
        taskDisposition: {
          kind: "close",
          reason:
            "The finite report assessment is complete; its subject retains independent work",
        },
      },
    },
  };
}

test("an explicit evidenced ending applies to finite messages and goals", () => {
  for (const kind of ["message", "goal"]) {
    const c = context(kind);
    expect(closeAcceptedAssignment(c)).toEqual({
      reason:
        "The finite report assessment is complete; its subject retains independent work",
    });
  }
});

test("a completed standing cycle or selector result does not end its assignment", () => {
  for (const c of [
    context("automatic-review"),
    context("review-task-outcome"),
    context("review-metric"),
    context("goal", { audit: { mode: "standing" } }),
    context("goal", { research: { mode: "standing" } }),
  ]) {
    expect(closeAcceptedAssignment(c)).toBeNull();
  }
});

test("a summary or recommendation alone does not silently acquire closure semantics", () => {
  for (const result of [
    undefined,
    {},
    {
      taskDisposition: {
        kind: "retain",
        reason: "Wait for an independent owner",
      },
    },
    { taskDisposition: { kind: "close", reason: " " } },
  ]) {
    const c = context();
    c.acceptedResult = { ...c.acceptedResult, result };
    expect(closeAcceptedAssignment(c)).toBeNull();
  }
  const c = context();
  c.acceptedResult = { ...c.acceptedResult, facts: [] };
  expect(closeAcceptedAssignment(c)).toBeNull();
});

test("mapped recovery routes survive an evidenced repair ending, including an envelope-shaped input", () => {
  for (const taskId of ["runtime/task-outcome-selector", "input/original"]) {
    const input = taskInputForEvent({ type: "handler.failed", source: "app-task-controller",
      data: { appId: "alex", taskId, stage: "task-reconciliation", willRetry: true },
    } as never)!;
    const c = context();
    c.task = taskForInput({ id: "notice", input } as never).intent;
    expect(closeAcceptedAssignment(c)).toBeNull();
    c.task = { ...c.task, input };
    expect(closeAcceptedAssignment(c)).toBeNull();
  }
});
