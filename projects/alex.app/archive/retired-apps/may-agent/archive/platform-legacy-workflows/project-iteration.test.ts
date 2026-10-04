import { describe, expect, it } from "bun:test";
import { applyReviewerProjectDirectives, stripReviewerDirectives, setStatusFooter } from "./platform-iteration.ts";

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

describe("setStatusFooter (Bug F regression)", () => {
  const projectWithNarrative = [
    "---",
    "id: p",
    "owner: may",
    "status: active",
    "---",
    "",
    "# Project",
    "",
    "## Current State",
    "Rich multi-paragraph narrative that the agent maintained.",
    "",
    "Second paragraph with more context.",
    "",
    "- Bullet 1",
    "- Bullet 2",
    "",
    "## Plan",
    "- [ ] step 1",
    "",
  ].join("\n");

  it("prepends a **Status:** footer without losing existing narrative", () => {
    const updated = setStatusFooter(projectWithNarrative, "Current State", "Blocked: worker failed 2x.");

    // New status line is present.
    expect(updated).toContain("**Status:** Blocked: worker failed 2x.");
    // Original narrative preserved verbatim.
    expect(updated).toContain("Rich multi-paragraph narrative that the agent maintained.");
    expect(updated).toContain("Second paragraph with more context.");
    expect(updated).toContain("- Bullet 1");
    expect(updated).toContain("- Bullet 2");
    // Sibling sections untouched.
    expect(updated).toContain("## Plan\n- [ ] step 1");
  });

  it("replaces a prior **Status:** line rather than stacking them", () => {
    const first = setStatusFooter(projectWithNarrative, "Current State", "Waiting: previous status.");
    const second = setStatusFooter(first, "Current State", "Blocked: new status.");

    expect(second).toContain("**Status:** Blocked: new status.");
    expect(second).not.toContain("**Status:** Waiting: previous status.");
    // Narrative still preserved through two updates.
    expect(second).toContain("Rich multi-paragraph narrative that the agent maintained.");
  });

  it("creates Current State section if missing", () => {
    const noCurrentState = [
      "---",
      "id: p",
      "owner: may",
      "status: active",
      "---",
      "",
      "# Project",
      "",
      "## Plan",
      "- [ ] step 1",
      "",
    ].join("\n");

    const updated = setStatusFooter(noCurrentState, "Current State", "Active: starting up.");
    expect(updated).toContain("## Current State\n**Status:** Active: starting up.");
  });
});
