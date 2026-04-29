import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractField,
  extractSection,
  extractMilestones,
  checkOffMilestones,
  extractComments,
  clearComments,
  updateProjectStatus,
} from "../workflows/project-helpers.js";

// Mock fs for updateProjectStatus
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, readFileSync: vi.fn(), writeFileSync: vi.fn() };
});
import { readFileSync, writeFileSync } from "node:fs";

describe("extractField", () => {
  it("extracts a field value", () => {
    expect(extractField("**Status**: active\n**Owner**: bob", "Status")).toBe("active");
    expect(extractField("**Status**: active\n**Owner**: bob", "Owner")).toBe("bob");
  });
  it("returns empty for missing field", () => {
    expect(extractField("no fields here", "Status")).toBe("");
  });
});

describe("extractSection", () => {
  it("extracts section content between headings", () => {
    const md = "## Plan\n- item 1\n- item 2\n## Comments\nsome comment";
    expect(extractSection(md, "Plan")).toBe("- item 1\n- item 2");
  });
  it("extracts last section", () => {
    const md = "## Plan\nstuff\n## End\nfinal";
    expect(extractSection(md, "End")).toBe("final");
  });
  it("returns empty for missing section", () => {
    expect(extractSection("## Other\ncontent", "Plan")).toBe("");
  });
});

describe("extractMilestones", () => {
  it("parses milestone checkboxes", () => {
    const md = "## Plan\n- [x] First done\n- [ ] Second pending\n- [x] Third done";
    const result = extractMilestones(md);
    expect(result.total).toBe(3);
    expect(result.done).toBe(2);
    expect(result.completed).toEqual(["First done", "Third done"]);
    expect(result.pending).toEqual(["Second pending"]);
  });
  it("falls back to Milestones heading", () => {
    const md = "## Milestones\n- [ ] Only one";
    const result = extractMilestones(md);
    expect(result.total).toBe(1);
    expect(result.pending).toEqual(["Only one"]);
  });
  it("handles no milestones", () => {
    const result = extractMilestones("## Plan\nNo checkboxes here");
    expect(result.total).toBe(0);
  });
});

describe("checkOffMilestones", () => {
  const content = "## Plan\n- [ ] Build the API\n- [ ] Write tests\n- [x] Setup repo";

  it("checks off milestone by M-index pattern", () => {
    const result = checkOffMilestones(content, "M1: Done");
    expect(result).toContain("[x] Build the API");
  });
  it("checks off milestone by completion pattern", () => {
    const result = checkOffMilestones(content, "✅ Write tests");
    expect(result).toContain("[x] Write tests");
  });
  it("checks off via milestone completed pattern", () => {
    const result = checkOffMilestones(content, "milestone completed: Build the API");
    expect(result).toContain("[x] Build the API");
  });
  it("returns unchanged if no matches", () => {
    const result = checkOffMilestones(content, "nothing relevant");
    expect(result).toBe(content);
  });
  it("checks off via [x] pattern in reviewer text", () => {
    const result = checkOffMilestones(content, "[x] Write tests");
    expect(result).toContain("[x] Write tests");
  });
});

describe("extractComments", () => {
  it("extracts comments section", () => {
    const md = "## Plan\nstuff\n## Comments\nmy comment\n## Other";
    expect(extractComments(md)).toBe("my comment");
  });
});

describe("clearComments", () => {
  it("clears comments section content", () => {
    const md = "## Plan\nstuff\n## Comments\nold comment\n## Other\nmore";
    const result = clearComments(md);
    expect(result).not.toContain("old comment");
    expect(result).toContain("## Other");
    expect(result).toContain("more");
  });
  it("handles missing comments section", () => {
    const md = "## Plan\nstuff";
    expect(clearComments(md)).toBe(md);
  });
});

describe("updateProjectStatus", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates status field", () => {
    (readFileSync as any).mockReturnValue("**Status**: active\n**Iteration**: 1");
    updateProjectStatus("/tmp/project.md", "complete");
    expect(writeFileSync).toHaveBeenCalledWith(
      "/tmp/project.md",
      expect.stringContaining("**Status**: complete"),
      "utf-8"
    );
  });

  it("adds stop reason if not present", () => {
    (readFileSync as any).mockReturnValue("**Status**: active\n**Iteration**: 1");
    updateProjectStatus("/tmp/project.md", "stopped", "budget exceeded");
    const written = (writeFileSync as any).mock.calls[0][1];
    expect(written).toContain("**Stop Reason**: budget exceeded");
  });

  it("replaces existing stop reason", () => {
    (readFileSync as any).mockReturnValue("**Status**: active\n**Stop Reason**: old reason\n**Iteration**: 1");
    updateProjectStatus("/tmp/project.md", "stopped", "new reason");
    const written = (writeFileSync as any).mock.calls[0][1];
    expect(written).toContain("**Stop Reason**: new reason");
    expect(written).not.toContain("old reason");
  });

  it("updates iteration number", () => {
    (readFileSync as any).mockReturnValue("**Status**: active\n**Iteration**: 1");
    updateProjectStatus("/tmp/project.md", "active", undefined, 5);
    const written = (writeFileSync as any).mock.calls[0][1];
    expect(written).toContain("**Iteration**: 5");
  });
});
