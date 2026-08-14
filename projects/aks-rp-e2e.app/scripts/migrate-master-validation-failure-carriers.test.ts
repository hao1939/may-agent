import { describe, expect, it } from "bun:test";
import type { ProjectAppTaskResource, TaskTree } from "@may-agent/sdk/legacy";
import {
  masterValidationFailureTaskId,
  migrateMasterValidationFailureCarriers,
} from "./migrate-master-validation-failure-carriers.ts";

function carrier(
  id: string,
  specId: string,
  fingerprint: string,
  updatedAt: string,
  conditionId: string,
): ProjectAppTaskResource {
  return {
    metadata: { id, generation: 2, resourceVersion: 4 },
    spec: {
      parentId: "group/domain-work",
      outcome: `Resolve ${specId}`,
      acceptance: ["verified"],
      mode: "achieve",
      owner: "aks-explorer",
      workflow: "master-validation-failure",
      input: { specId, failureFingerprint: fingerprint },
      outputs: [],
      dependsOn: [],
      priority: "P0",
    },
    status: {
      observedGeneration: 2,
      phase: "waiting",
      summary: `Waiting for ${fingerprint}`,
      evidence: [`artifact:${fingerprint}`],
      conditionIds: [conditionId],
      updatedAt,
    },
  };
}

describe("master-validation failure carrier migration", () => {
  it("keeps the newest wait and absorbs fingerprint identities into receipts", () => {
    const specId = "spec.example.lifecycle";
    const oldId = `domain/master-validation-failure/${specId}/old`;
    const newestId = `domain/master-validation-failure/${specId}/new`;
    const canonicalId = masterValidationFailureTaskId(specId);
    const tree: TaskTree = {
      project_lifecycle: "paused",
      active_task_ids: [],
      tasks: {},
      resources: {
        [oldId]: carrier(
          oldId,
          specId,
          "old-fingerprint",
          "2026-08-03T00:00:00.000Z",
          "condition-old",
        ),
        [newestId]: carrier(
          newestId,
          specId,
          "new-fingerprint",
          "2026-08-04T00:00:00.000Z",
          "condition-new",
        ),
        dependent: {
          metadata: { id: "dependent", generation: 1, resourceVersion: 1 },
          spec: {
            parentId: "group/domain-work",
            outcome: "Wait for the current spec issue",
            acceptance: ["done"],
            mode: "achieve",
            owner: "app-ops",
            outputs: [],
            dependsOn: [oldId, newestId],
            priority: "P1",
          },
          status: {
            observedGeneration: 0,
            phase: "pending",
            updatedAt: "2026-08-04T00:00:00.000Z",
          },
        },
      },
      attempts: {
        oldAttempt: {
          metadata: { id: "oldAttempt", resourceVersion: 1 },
          taskId: oldId,
          taskGeneration: 2,
          specHash: "old",
          owner: "aks-explorer",
          handler: "workflow:master-validation-failure",
          runtimeId: "old-runtime",
          state: "completed",
          reason: "old",
          startedAt: "2026-08-03T00:00:00.000Z",
          finishedAt: "2026-08-03T00:05:00.000Z",
        },
        newestAttempt: {
          metadata: { id: "newestAttempt", resourceVersion: 1 },
          taskId: newestId,
          taskGeneration: 2,
          specHash: "new",
          owner: "aks-explorer",
          handler: "workflow:master-validation-failure",
          runtimeId: "new-runtime",
          state: "completed",
          reason: "new",
          startedAt: "2026-08-04T00:00:00.000Z",
          finishedAt: "2026-08-04T00:05:00.000Z",
        },
      },
      conditions: {
        "condition-old": {
          metadata: { id: "condition-old", generation: 1, resourceVersion: 1 },
          spec: {
            type: "pipeline.completed",
            subject: "pipeline:old",
            expected: { state: "completed" },
          },
          status: {
            state: "unknown",
            observedGeneration: 0,
            updatedAt: "2026-08-03T00:00:00.000Z",
          },
        },
        "condition-new": {
          metadata: { id: "condition-new", generation: 1, resourceVersion: 1 },
          spec: {
            type: "pipeline.completed",
            subject: "pipeline:new",
            expected: { state: "completed" },
          },
          status: {
            state: "unknown",
            observedGeneration: 0,
            updatedAt: "2026-08-04T00:00:00.000Z",
          },
        },
        "unrelated-orphan": {
          metadata: {
            id: "unrelated-orphan",
            generation: 1,
            resourceVersion: 1,
          },
          spec: {
            type: "pipeline.completed",
            subject: "pipeline:unrelated",
            expected: { state: "completed" },
          },
          status: {
            state: "unknown",
            observedGeneration: 0,
            updatedAt: "2026-08-04T00:00:00.000Z",
          },
        },
      },
    };

    const stats = migrateMasterValidationFailureCarriers(
      tree,
      "2026-08-04T01:00:00.000Z",
    );

    expect(stats).toMatchObject({
      specsConsolidated: 1,
      resourcesRenamed: 1,
      resourcesAbsorbed: 1,
      receiptsCreated: 2,
      attemptsRemoved: 1,
      dependenciesRetargeted: 1,
      conditionsRemoved: 1,
    });
    expect(tree.resources?.[canonicalId]).toMatchObject({
      metadata: { id: canonicalId },
      status: {
        phase: "waiting",
        conditionIds: ["condition-new"],
      },
      spec: { input: { failureFingerprint: "new-fingerprint" } },
    });
    expect(tree.resources?.[oldId]).toBeUndefined();
    expect(tree.resources?.[newestId]).toBeUndefined();
    expect(tree.receipts?.[oldId]?.failureFingerprints).toEqual([
      "old-fingerprint",
    ]);
    expect(tree.receipts?.[newestId]?.failureFingerprints).toEqual([
      "new-fingerprint",
    ]);
    expect(tree.resources?.dependent?.spec.dependsOn).toEqual([canonicalId]);
    expect(tree.conditions?.["condition-old"]).toBeUndefined();
    expect(tree.conditions?.["condition-new"]).toBeDefined();
    expect(tree.conditions?.["unrelated-orphan"]).toBeDefined();
    expect(tree.attempts?.oldAttempt).toBeUndefined();
    expect(tree.attempts?.newestAttempt?.taskId).toBe(canonicalId);
  });

  it("rejects a carrier that still owns an active attempt", () => {
    const id = "domain/master-validation-failure/spec.example/fingerprint";
    const tree: TaskTree = {
      tasks: {},
      resources: {
        [id]: {
          ...carrier(
            id,
            "spec.example",
            "fingerprint",
            "2026-08-04T00:00:00.000Z",
            "condition",
          ),
          status: {
            ...carrier(
              id,
              "spec.example",
              "fingerprint",
              "2026-08-04T00:00:00.000Z",
              "condition",
            ).status,
            currentAttemptId: "running",
          },
        },
      },
    };
    expect(() => migrateMasterValidationFailureCarriers(tree)).toThrow(
      `Carrier ${id} still has a current attempt`,
    );
  });

  it("does not revise an already canonical dependency", () => {
    const specId = "spec.example";
    const canonicalId = masterValidationFailureTaskId(specId);
    const tree: TaskTree = {
      tasks: {},
      resources: {
        [canonicalId]: carrier(
          canonicalId,
          specId,
          "current-fingerprint",
          "2026-08-04T00:00:00.000Z",
          "condition",
        ),
        dependent: {
          metadata: { id: "dependent", generation: 1, resourceVersion: 7 },
          spec: {
            parentId: "group/domain-work",
            outcome: "Wait for the current spec issue",
            acceptance: ["done"],
            mode: "achieve",
            owner: "app-ops",
            outputs: [],
            dependsOn: [canonicalId],
            priority: "P1",
          },
          status: {
            observedGeneration: 0,
            phase: "pending",
            updatedAt: "2026-08-04T00:00:00.000Z",
          },
        },
      },
    };

    const stats = migrateMasterValidationFailureCarriers(tree);

    expect(stats.dependenciesRetargeted).toBe(0);
    expect(tree.resources?.dependent?.metadata.resourceVersion).toBe(7);
    expect(tree.resources?.dependent?.spec.dependsOn).toEqual([canonicalId]);
  });
});
