import { describe, expect, it } from "vitest";
import { extractMarkdownSection, normalizeProjectPathForCompare, projectPathsMatch } from "./server.js";

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

    expect(extractMarkdownSection(body, "Current State")).toBe([
      "Waiting: All documentation milestones are complete and verified.",
      "The worker is now attempting to actually deploy and run e2e tests.",
      "This second line must remain visible in the Web UI.",
    ].join("\n"));
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
    expect(projectPathsMatch("agents/shared/projects/aks-rp-e2e", "shared/projects/aks-rp-e2e")).toBe(true);
    expect(projectPathsMatch("agents/shared/projects/aks-rp-e2e/project.md", "shared/projects/aks-rp-e2e/")).toBe(true);
    expect(normalizeProjectPathForCompare("./agents/shared/projects/aks-rp-e2e/project.md")).toBe("shared/projects/aks-rp-e2e");
  });

  it("normalizes canonical project-root paths", () => {
    expect(normalizeProjectPathForCompare("/app/projects/aks-rp-e2e/project.md")).toBe("projects/aks-rp-e2e");
    expect(projectPathsMatch("/app/projects/aks-rp-e2e", "projects/aks-rp-e2e/project.md")).toBe(true);
    expect(projectPathsMatch("/app/agents/shared/projects/aks-rp-e2e", "projects/aks-rp-e2e")).toBe(false);
  });
});
