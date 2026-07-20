import { describe, expect, test } from "bun:test";
import type { ProjectAppTaskResource, TaskTree } from "@may-agent/sdk";
import { applyTaskGraphMigration } from "./migrate-task-graph-v1.ts";

function resource(
  id: string,
  parentId: string,
  phase: "waiting" | "converged",
): ProjectAppTaskResource {
  return {
    metadata: { id, generation: 1, resourceVersion: 1 },
    spec: {
      parentId,
      outcome: id,
      acceptance: ["migrated"],
      mode: "maintain",
      owner: "owner",
    },
    status: {
      observedGeneration: 1,
      phase,
      conditionIds: phase === "waiting" ? [`condition:${id}`] : [],
      updatedAt: "2026-07-20T00:00:00.000Z",
    },
  };
}

describe("task graph migration v1", () => {
  test("renames, places, prunes, and converges controllers idempotently", () => {
    const tree: TaskTree = {
      project_lifecycle: "paused",
      groups: { project: { id: "project", parent_id: null } },
      tasks: {},
      resources: {
        old: resource("old", "project", "waiting"),
        leaf: resource("leaf", "old", "waiting"),
        obsolete: resource("obsolete", "old", "waiting"),
      },
      conditions: {
        "condition:old": {} as never,
        "condition:leaf": {} as never,
        "condition:obsolete": {} as never,
      },
    };
    const manifest = {
      version: 1 as const,
      reviewedAt: "2026-07-20T00:00:00.000Z",
      baselineSha256: "hash",
      groups: {
        project: { parentId: null, owner: "app-ops" },
        group: { parentId: "project", owner: "owner" },
      },
      rename: { from: "old", to: "controller" },
      placements: { group: ["controller", "leaf"] },
      clearControllerWaits: ["controller"],
      removeResources: ["obsolete"],
      removalDisposition: "obsolete",
    };

    applyTaskGraphMigration(tree, manifest);
    applyTaskGraphMigration(tree, manifest);

    expect(Object.keys(tree.resources ?? {}).sort()).toEqual([
      "controller",
      "leaf",
    ]);
    expect(tree.resources?.controller).toMatchObject({
      metadata: { id: "controller" },
      spec: { parentId: "group" },
      status: { phase: "converged", conditionIds: [] },
    });
    expect(tree.resources?.leaf.spec.parentId).toBe("group");
    expect(Object.keys(tree.conditions ?? {})).toEqual(["condition:leaf"]);
  });
});
