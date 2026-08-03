import { describe, expect, test } from "bun:test";
import type { TaskTree } from "@may-agent/sdk";
import { migrateSessionAftermathFrontier } from "./migrate-session-aftermath-frontier.ts";

function fixture(): TaskTree {
  return {
    project_lifecycle: "paused",
    groups: {
      root: { id: "root", parent_id: null, owner: "evaluator" },
      "evaluator-reliability": {
        id: "evaluator-reliability",
        parent_id: "root",
        owner: "evaluator",
      },
      "pipeline-health": {
        id: "pipeline-health",
        parent_id: "evaluator-reliability",
        owner: "evaluator",
      },
    },
    tasks: {},
    resources: {
      "runtime/session-aftermath/s_old": {
        metadata: {
          id: "runtime/session-aftermath/s_old",
          generation: 1,
          resourceVersion: 1,
        },
        spec: {
          parentId: "root",
          outcome: "evaluate old session",
          acceptance: [],
          mode: "achieve",
          workflow: "evaluator-aftermath",
        },
        status: {
          observedGeneration: 0,
          phase: "pending",
          updatedAt: "2026-08-03T00:00:00.000Z",
          conditionIds: ["legacy-condition"],
        },
      },
      "runtime/aftermath-backfill": {
        metadata: {
          id: "runtime/aftermath-backfill",
          generation: 1,
          resourceVersion: 1,
        },
        spec: {
          parentId: "root",
          outcome: "keep frontier current",
          acceptance: [],
          mode: "maintain",
          workflow: "evaluator-aftermath",
        },
        status: {
          observedGeneration: 1,
          phase: "converged",
          updatedAt: "2026-08-03T00:00:00.000Z",
          conditionIds: [],
        },
      },
      "evaluator-reliability": {
        metadata: {
          id: "evaluator-reliability",
          generation: 2,
          resourceVersion: 8,
        },
        spec: {
          parentId: "root",
          outcome: "keep evaluator reliable",
          acceptance: [],
          mode: "maintain",
          workflow: "evaluator-heartbeat",
        },
        status: {
          observedGeneration: 2,
          phase: "converged",
          updatedAt: "2026-08-03T00:00:00.000Z",
          conditionIds: [],
        },
      },
      "pipeline-health": {
        metadata: {
          id: "pipeline-health",
          generation: 2,
          resourceVersion: 9,
        },
        spec: {
          parentId: "evaluator-reliability",
          outcome: "keep pipeline healthy",
          acceptance: [],
          mode: "maintain",
          workflow: "evaluator-heartbeat",
        },
        status: {
          observedGeneration: 2,
          phase: "converged",
          updatedAt: "2026-08-03T00:00:00.000Z",
          conditionIds: [],
        },
      },
    },
    taskTriggers: {
      "runtime/session-aftermath/s_old": {
        event: { type: "session.end", data: { task: "large payload" } },
        observedAt: "2026-08-03T00:00:00.000Z",
      },
    },
    attempts: {
      legacy: {
        metadata: { id: "legacy", resourceVersion: 1 },
        taskId: "runtime/session-aftermath/s_old",
        taskGeneration: 1,
        specHash: "hash",
        owner: "evaluator",
        handler: "workflow:evaluator-aftermath",
        runtimeId: "runtime",
        state: "completed",
        reason: "test",
        startedAt: "2026-08-03T00:00:00.000Z",
      },
    },
    receipts: {
      "runtime/session-aftermath/s_done": {
        metadata: {
          id: "runtime/session-aftermath/s_done",
          generation: 1,
          resourceVersion: 1,
        },
        specHash: "hash",
        parentId: "root",
        outcome: "evaluated",
        acceptance: [],
        owner: "evaluator",
        handler: "workflow:evaluator-aftermath",
        summary: "done",
        evidence: [],
        acceptanceBasis: { method: "workflow-contract", evidence: [] },
        failureFingerprints: [],
        completedAt: "2026-08-03T00:00:00.000Z",
      },
    },
    conditions: {
      "legacy-condition": {
        metadata: { id: "legacy-condition", generation: 1, resourceVersion: 1 },
        spec: { type: "test", subject: "legacy", expected: {} },
        status: { state: "unknown", observedAt: "2026-08-03T00:00:00.000Z" },
      },
      "unrelated-orphan": {
        metadata: { id: "unrelated-orphan", generation: 1, resourceVersion: 1 },
        spec: { type: "test", subject: "unrelated", expected: {} },
        status: { state: "unknown", observedAt: "2026-08-03T00:00:00.000Z" },
      },
    },
  };
}

describe("session aftermath frontier migration", () => {
  test("removes only legacy per-session task state", () => {
    const tree = fixture();
    expect(migrateSessionAftermathFrontier(tree)).toEqual({
      resourcesRemoved: 1,
      triggersRemoved: 1,
      attemptsRemoved: 1,
      receiptsRemoved: 1,
      conditionsRemoved: 1,
      structuralParentsRepaired: 2,
    });
    expect(Object.keys(tree.resources ?? {})).toEqual([
      "runtime/aftermath-backfill",
    ]);
    expect(tree.groups?.["evaluator-reliability"]).toBeDefined();
    expect(tree.groups?.["pipeline-health"]).toBeDefined();
    expect(tree.taskTriggers).toEqual({});
    expect(tree.attempts).toEqual({});
    expect(tree.receipts).toEqual({});
    expect(tree.conditions).toEqual({
      "unrelated-orphan": {
        metadata: { id: "unrelated-orphan", generation: 1, resourceVersion: 1 },
        spec: { type: "test", subject: "unrelated", expected: {} },
        status: { state: "unknown", observedAt: "2026-08-03T00:00:00.000Z" },
      },
    });
  });

  test("refuses to remove a task still used as a dependency", () => {
    const tree = fixture();
    tree.resources!["runtime/aftermath-backfill"]!.spec.dependsOn = [
      "runtime/session-aftermath/s_old",
    ];
    expect(() => migrateSessionAftermathFrontier(tree)).toThrow(
      "still used as dependencies",
    );
  });

  test("refuses to remove a completed legacy task still used as a dependency", () => {
    const tree = fixture();
    delete tree.resources!["runtime/session-aftermath/s_old"];
    tree.resources!["runtime/aftermath-backfill"]!.spec.dependsOn = [
      "runtime/session-aftermath/s_done",
    ];
    expect(() => migrateSessionAftermathFrontier(tree)).toThrow(
      "still used as dependencies",
    );
  });

  test("repairs structural parents without removing later explicit session history", () => {
    const tree = fixture();
    const stats = migrateSessionAftermathFrontier(tree, {
      retireLegacySessionTasks: false,
    });
    expect(stats).toMatchObject({
      resourcesRemoved: 0,
      triggersRemoved: 0,
      attemptsRemoved: 0,
      receiptsRemoved: 0,
      structuralParentsRepaired: 2,
    });
    expect(tree.resources?.["runtime/session-aftermath/s_old"]).toBeDefined();
    expect(tree.attempts?.legacy).toBeDefined();
    expect(tree.receipts?.["runtime/session-aftermath/s_done"]).toBeDefined();
    expect(tree.resources?.["evaluator-reliability"]).toBeUndefined();
    expect(tree.resources?.["pipeline-health"]).toBeUndefined();
    expect(tree.groups?.["evaluator-reliability"]).toBeDefined();
    expect(tree.groups?.["pipeline-health"]).toBeDefined();
  });
});
