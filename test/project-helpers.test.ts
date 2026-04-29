import { describe, it, expect } from "vitest";
import {
  extractField,
  extractSection,
  extractMilestones,
  checkOffMilestones,
  extractComments,
  clearComments,
} from "../shared/workflows/project-helpers.ts";

const sampleProject = `# Project: Test

**Status**: active
**Owner**: optimizer
**Priority**: P1

## Goal
Do something useful.

## Plan
- [x] First milestone done
- [ ] Second milestone pending
- [ ] Third milestone pending

## Comments
User said something here.

## References
Some refs.
`;

describe("project-helpers", () => {
  describe("extractField", () => {
    it("extracts Status field", () => {
      expect(extractField(sampleProject, "Status")).toBe("active");
    });

    it("extracts Owner field", () => {
      expect(extractField(sampleProject, "Owner")).toBe("optimizer");
    });

    it("returns empty string for missing field", () => {
      expect(extractField(sampleProject, "Missing")).toBe("");
    });
  });

  describe("extractSection", () => {
    it("extracts Goal section", () => {
      expect(extractSection(sampleProject, "Goal")).toBe("Do something useful.");
    });

    it("extracts Plan section with milestones", () => {
      const plan = extractSection(sampleProject, "Plan");
      expect(plan).toContain("First milestone done");
      expect(plan).toContain("Third milestone pending");
    });

    it("returns empty for missing section", () => {
      expect(extractSection(sampleProject, "Nonexistent")).toBe("");
    });

    it("extracts last section (References)", () => {
      expect(extractSection(sampleProject, "References")).toBe("Some refs.");
    });
  });

  describe("extractMilestones", () => {
    it("counts total milestones", () => {
      const ms = extractMilestones(sampleProject);
      expect(ms.total).toBe(3);
    });

    it("counts done milestones", () => {
      expect(extractMilestones(sampleProject).done).toBe(1);
    });

    it("lists pending milestones", () => {
      const ms = extractMilestones(sampleProject);
      expect(ms.pending).toEqual(["Second milestone pending", "Third milestone pending"]);
    });

    it("lists completed milestones", () => {
      expect(extractMilestones(sampleProject).completed).toEqual(["First milestone done"]);
    });

    it("handles empty plan", () => {
      const ms = extractMilestones("# No plan here");
      expect(ms.total).toBe(0);
    });
  });

  describe("checkOffMilestones", () => {
    it("checks off milestone by text match", () => {
      const result = checkOffMilestones(sampleProject, 'Milestone completed: "Second milestone pending"');
      expect(result).toContain("[x] Second milestone pending");
    });

    it("checks off milestone by ✅ marker", () => {
      const result = checkOffMilestones(sampleProject, "✅ Second milestone pending");
      expect(result).toContain("[x] Second milestone pending");
    });

    it("checks off milestone by M-number", () => {
      const result = checkOffMilestones(sampleProject, "M2: Done");
      expect(result).toContain("[x] Second milestone pending");
    });

    it("returns unchanged content when no milestones match", () => {
      const result = checkOffMilestones(sampleProject, "Nothing relevant here");
      expect(result).toBe(sampleProject);
    });

    it("does not un-check already completed milestones", () => {
      const result = checkOffMilestones(sampleProject, "M1: Done");
      expect(result).toContain("[x] First milestone done");
    });
  });

  describe("extractComments", () => {
    it("extracts comments section content", () => {
      expect(extractComments(sampleProject)).toBe("User said something here.");
    });

    it("returns empty for no comments", () => {
      expect(extractComments("# No comments\n## Plan\n")).toBe("");
    });
  });

  describe("clearComments", () => {
    it("removes comment content but keeps heading", () => {
      const cleared = clearComments(sampleProject);
      expect(cleared).toContain("## Comments");
      expect(cleared).not.toContain("User said something here.");
    });

    it("preserves other sections", () => {
      const cleared = clearComments(sampleProject);
      expect(cleared).toContain("## References");
      expect(cleared).toContain("Some refs.");
    });
  });
});
