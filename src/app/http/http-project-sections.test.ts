import { describe, expect, it } from "bun:test";
import {
  buildProjectTasksReadModel,
  extractMarkdownSection,
  normalizeProjectPathForCompare,
  projectPathsMatch,
} from "./server.js";

describe("extractMarkdownSection", () => {
  it("returns the full Current State section without truncating", () => {
    const body = [
      "## Goal",
      "Make the project readable.",
      "",
      "## Current State",
      "Waiting: All documentation milestones are complete and verified.",
      "The worker is now attempting to actually deploy and run e2e tests.",
      "This second line must remain visible in the Web UI.",
      "## Plan",
      "- [ ] Continue",
    ].join("\n");

    expect(extractMarkdownSection(body, "Current State")).toBe(
      [
        "Waiting: All documentation milestones are complete and verified.",
        "The worker is now attempting to actually deploy and run e2e tests.",
        "This second line must remain visible in the Web UI.",
      ].join("\n"),
    );
  });

  it("matches Current State headings with parenthetical suffixes", () => {
    const body = [
      "## Current State (Updated Iteration 21)",
      "Reviewer: the worker found a real issue.",
      "## Context",
      "Other text.",
    ].join("\n");

    expect(extractMarkdownSection(body, "Current State")).toBe("Reviewer: the worker found a real issue.");
  });
});

describe("project path matching", () => {
  it("matches Web UI paths against daemon project paths", () => {
    expect(projectPathsMatch("agents/shared/projects/aks-rp-e2e", "projects/aks-rp-e2e")).toBe(true);
    expect(projectPathsMatch("agents/shared/projects/aks-rp-e2e/project.md", "projects/aks-rp-e2e/")).toBe(true);
    expect(normalizeProjectPathForCompare("./agents/shared/projects/aks-rp-e2e/project.md")).toBe(
      "projects/aks-rp-e2e",
    );
  });

  it("normalizes canonical project-root paths", () => {
    expect(normalizeProjectPathForCompare("/app/projects/aks-rp-e2e/project.md")).toBe("projects/aks-rp-e2e");
    expect(projectPathsMatch("/app/projects/aks-rp-e2e", "projects/aks-rp-e2e/project.md")).toBe(true);
    expect(projectPathsMatch("/app/agents/shared/projects/aks-rp-e2e", "projects/aks-rp-e2e")).toBe(true);
  });
});

describe("project task projection read model", () => {
  it("uses compact satisfied dependency identities without full receipts", () => {
    const result = buildProjectTasksReadModel(
      {
        schema_version: 2,
        root_task_id: "project",
        max_concurrent: 2,
        active_task_ids: [],
        conditions: {},
        integrity: [],
        satisfied_dependency_ids: ["completed-dependency"],
        tasks: {
          project: { item_type: "group", id: "project", parent_id: null, children: ["consumer"] },
          consumer: {
            item_type: "task",
            id: "consumer",
            parent_id: "project",
            phase: "pending",
            mode: "achieve",
            outcome: "Consume the result",
            children: [],
            depends_on: ["completed-dependency"],
            readiness: { state: "ready", reason: "Dependencies allow claim", related_ids: [] },
            attempt_count: 4,
          },
        },
      },
      { path: "projects/sample", treePath: ".state/tasks/tree.json" },
    );

    expect(result).toMatchObject({
      available: true,
      stats: { ready: 1 },
      items: { consumer: { attempt_count: 4 } },
      completedDependencies: ["completed-dependency"],
    });
  });

  it("preserves task-projected dependency readiness", () => {
    const result = buildProjectTasksReadModel(
      {
        schema_version: 2,
        root_task_id: "project",
        max_concurrent: 2,
        active_task_ids: [],
        conditions: {},
        integrity: [],
        satisfied_dependency_ids: [],
        tasks: {
          project: { item_type: "group", id: "project", parent_id: null, children: ["consumer"] },
          consumer: {
            item_type: "task",
            id: "consumer",
            parent_id: "project",
            phase: "pending",
            mode: "achieve",
            outcome: "Consume the result",
            children: [],
            depends_on: ["live-dependency"],
            readiness: {
              state: "dependency-blocked",
              reason: "Waiting for live-dependency",
              related_ids: ["live-dependency"],
            },
          },
        },
      },
      { path: "projects/sample", treePath: ".state/tasks/tree.json" },
    );

    expect(result).toMatchObject({
      available: true,
      stats: { ready: 0, pending: 1 },
      items: { consumer: { readiness: { state: "dependency-blocked" } } },
    });
  });
});
