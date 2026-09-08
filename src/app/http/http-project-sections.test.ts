import { describe, expect, it } from "bun:test";
import {
  extractMarkdownSection,
  normalizeProjectPathForCompare,
  projectEventTargetForPath,
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
    expect(projectPathsMatch("agents/shared/projects/alpha-project", "projects/alpha-project")).toBe(true);
    expect(projectPathsMatch("agents/shared/projects/alpha-project/project.md", "projects/alpha-project/")).toBe(true);
    expect(normalizeProjectPathForCompare("./agents/shared/projects/alpha-project/project.md")).toBe(
      "projects/alpha-project",
    );
  });

  it("normalizes canonical project-root paths", () => {
    expect(normalizeProjectPathForCompare("/app/projects/alpha-project/project.md")).toBe("projects/alpha-project");
    expect(projectPathsMatch("/app/projects/alpha-project", "projects/alpha-project/project.md")).toBe(true);
    expect(projectPathsMatch("/app/agents/shared/projects/alpha-project", "projects/alpha-project")).toBe(true);
  });

  it("targets a loaded app id instead of its human-facing project identity", () => {
    expect(projectEventTargetForPath("projects/alpha-project.app", "app-ops/alpha-project.app")).toBe("alpha-project");
    expect(projectEventTargetForPath("projects/evaluation.app", "evaluator/evaluation")).toBe("evaluation");
    expect(projectEventTargetForPath("projects/plain-project", "shared/plain-project")).toBe("shared/plain-project");
  });
});
