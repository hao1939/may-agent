import { describe, expect, test } from "bun:test";
import type { AppTaskInput, TaskIntent } from "@may-agent/sdk/app";
import { Check } from "typebox/value";
import {
  isPlatformUpgradeBenchmarkIntent,
  piuBenchmarkTaskId,
  platformUpgradeBenchmarkAttachment,
  platformUpgradeBenchmarkFeedbackSchema,
  platformUpgradeBenchmarkInputSchema,
} from "./piu-benchmark-task.js";

function admitted(input: unknown, source = { kind: "human", id: "piu-owner" }) {
  return { id: "piu-test", appId: "aks-rp-e2e", source, input } as AppTaskInput;
}

const start = { kind: "platform-initiated-upgrade-benchmark", data: {} };
function intent() {
  const attachment = platformUpgradeBenchmarkAttachment(admitted(start));
  if (attachment?.kind !== "desired") throw Error("Missing benchmark intent");
  return attachment.intent;
}
function feedback() {
  return {
    kind: "owner-review",
    data: {
      message: "Continue with the measured baseline.",
      context: {
        intent: "task-feedback",
        taskId: piuBenchmarkTaskId,
        expectedGeneration: 1,
      },
    },
  };
}

describe("finite PIU benchmark admission", () => {
  test("creates one exact Task with its complete offline assignment", () => {
    expect(Check(platformUpgradeBenchmarkInputSchema, start)).toBe(true);
    const task = intent();
    expect(task.id).toBe(piuBenchmarkTaskId);
    expect(task.executor).toBe("codex-goal");
    expect(task.agent).toBe("aks-explorer");
    expect(task.acceptance?.length).toBeGreaterThan(5);
    expect(isPlatformUpgradeBenchmarkIntent(task)).toBe(true);
    const assignment = task.input!.assignment as Record<string, unknown>;
    expect(assignment.effects).toEqual({
      sourceRepair: "isolated-spec-worktree-only",
      localValidation: true,
      prepareBenchmarkPullRequest: true,
      cloudMutation: false,
      merge: false,
      publishReviewComments: false,
      modifyOtherTasks: false,
      subagents: false,
    });
  });

  test("input cannot override the source, Task ID, acceptance or effects", () => {
    for (const data of [
      { taskId: "workstream/compiler" },
      { effects: { cloudMutation: true } },
      { acceptance: [] },
      { workspace: "/" },
    ]) {
      const input = { ...start, data };
      expect(Check(platformUpgradeBenchmarkInputSchema, input)).toBe(false);
      expect(platformUpgradeBenchmarkAttachment(admitted(input))).toBeNull();
    }
  });

  test("requires a human source for creation and feedback", () => {
    for (const input of [start, feedback()]) {
      for (const source of [
        { kind: "app", id: "aks-rp-e2e" },
        { kind: "human", id: " " },
      ])
        expect(() => platformUpgradeBenchmarkAttachment(admitted(input, source))).toThrow();
    }
  });

  test("feedback attaches to the same Task without revising requirements", () => {
    const input = feedback();
    expect(Check(platformUpgradeBenchmarkFeedbackSchema, input)).toBe(true);
    expect(platformUpgradeBenchmarkAttachment(admitted(input))).toEqual({
      kind: "existing",
      taskId: piuBenchmarkTaskId,
    });
  });

  test("rejects foreign, unfenced, empty or scope-changing feedback", () => {
    const foreign = feedback();
    foreign.data.context.taskId = "workstream/compiler";
    expect(Check(platformUpgradeBenchmarkFeedbackSchema, foreign)).toBe(false);
    const stale = feedback();
    stale.data.context.expectedGeneration = 0;
    expect(Check(platformUpgradeBenchmarkFeedbackSchema, stale)).toBe(false);
    const unfenced = feedback() as any;
    delete unfenced.data.context.expectedGeneration;
    expect(Check(platformUpgradeBenchmarkFeedbackSchema, unfenced)).toBe(false);
    const expanded = { ...feedback(), data: { ...feedback().data, effects: { cloudMutation: true } } };
    expect(Check(platformUpgradeBenchmarkFeedbackSchema, expanded)).toBe(false);
    const empty = feedback();
    empty.data.message = " ";
    expect(() => platformUpgradeBenchmarkAttachment(admitted(empty))).toThrow();
  });

  test("domain exemption rejects changed source, authority and acceptance", () => {
    for (const mutate of [
      (task: TaskIntent) => { task.id = "domain/another-task"; },
      (task: TaskIntent) => { task.acceptance = []; },
      (task: TaskIntent) => { task.executor = "prompt-agent"; },
      (task: TaskIntent) => { (task.input!.assignment as any).effects.cloudMutation = true; },
      (task: TaskIntent) => { (task.input!.assignment as any).workspace = "/"; },
    ]) {
      const task = intent();
      mutate(task);
      expect(isPlatformUpgradeBenchmarkIntent(task)).toBe(false);
    }
    expect(isPlatformUpgradeBenchmarkIntent(intent())).toBe(true);
  });

  test("unrelated inputs remain owned by their current mapper", () => {
    expect(platformUpgradeBenchmarkAttachment(admitted({ kind: "start-workstream", data: { stream: "compiler" } }))).toBeNull();
  });
});
