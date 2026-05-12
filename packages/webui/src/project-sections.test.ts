import { describe, expect, it } from "vitest";
import { extractMarkdownSection } from "./server.js";

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
