import { describe, expect, it } from "bun:test";
import { applyReviewerProjectDirectives, stripReviewerDirectives } from "./project.js";

describe("project reviewer directives", () => {
  it("applies reviewer-owned project state updates", () => {
    const project = [
      "---",
      "id: aks-rp-e2e",
      "owner: may",
      "status: active",
      "---",
      "",
      "# Project",
      "",
      "## Goal",
      "Old learning goal.",
      "",
      "## Signals",
      "- old.signal: 1",
      "",
      "## Current State",
      "Waiting on stale review.",
      "",
      "## Plan",
      "- [x] old plan",
      "",
      "## Context",
      "- keep me",
      "",
    ].join("\n");

    const reviewer = [
      "CONTINUE",
      "",
      "GOAL_UPDATE:",
      "Actually run e2e cases so we can understand code quality from real execution results.",
      "",
      "CURRENT_STATE_UPDATE:",
      "Active: goal changed by human; next work is to get one green e2e case or collect concrete blocker evidence.",
      "",
      "SIGNALS_UPDATE:",
      "- e2e.scenario-pass: 0",
      "- e2e.green-run-evidence: missing",
      "",
      "**(a) Concrete output:** outputs/successful-e2e-run.md",
    ].join("\n");

    const updated = applyReviewerProjectDirectives(project, reviewer);

    expect(updated).toContain("## Goal\nActually run e2e cases so we can understand code quality from real execution results.\n");
    expect(updated).toContain("## Current State\nActive: goal changed by human; next work is to get one green e2e case or collect concrete blocker evidence.\n");
    expect(updated).toContain("## Signals\n- e2e.scenario-pass: 0\n- e2e.green-run-evidence: missing\n");
    expect(updated).toContain("## Context\n- keep me");
  });

  it("keeps directive blocks out of status summaries", () => {
    const clean = stripReviewerDirectives([
      "The standalone RP has 0 underlays registered.",
      "",
      "Resume when: underlay is registered.",
      "",
      "CONTEXT_UPDATE:",
      "- Root cause identified.",
      "- Tried 5 regions.",
    ].join("\n"));

    expect(clean).toBe("The standalone RP has 0 underlays registered.\n\nResume when: underlay is registered.");
  });
});
