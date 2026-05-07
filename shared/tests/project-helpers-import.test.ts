/**
 * Tests for workflows/project-helpers.ts — imported directly for coverage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractField,
  extractSection,
  extractMilestones,
  checkOffMilestones,
  extractComments,
  clearComments,
  updateProjectStatus,
} from "../workflows/project-helpers.ts";

// Mock fs for updateProjectStatus
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

import { readFileSync, writeFileSync } from "node:fs";

describe("extractField", () => {
  it("extracts a simple field", () => {
    const content = "**Status**: active\n**Owner**: bob";
    expect(extractField(content, "Status")).toBe("active");
    expect(extractField(content, "Owner")).toBe("bob");
  });

  it("returns empty string for missing field", () => {
    expect(extractField("no fields here", "Status")).toBe("");
  });

  it("trims whitespace", () => {
    expect(extractField("**Status**:   done  ", "Status")).toBe("done");
  });
});

describe("extractSection", () => {
  const content = `# Title
## Plan
- [ ] item 1
- [x] item 2

## Comments
Some comment here

## Next
Other stuff`;

  it("extracts content between headings", () => {
    const plan = extractSection(content, "Plan");
    expect(plan).toContain("item 1");
    expect(plan).toContain("item 2");
    expect(plan).not.toContain("Some comment");
  });

  it("extracts last section", () => {
    const next = extractSection(content, "Next");
    expect(next).toBe("Other stuff");
  });

  it("returns empty for missing section", () => {
    expect(extractSection(content, "Missing")).toBe("");
  });

  it("extracts comments section", () => {
    const comments = extractSection(content, "Comments");
    expect(comments).toBe("Some comment here");
  });
});

describe("extractMilestones", () => {
  it("parses plan items", () => {
    const content = `## Plan
- [ ] Write tests
- [x] Setup project
- [ ] Deploy`;
    const ms = extractMilestones(content);
    expect(ms.total).toBe(3);
    expect(ms.done).toBe(1);
    expect(ms.pending).toEqual(["Write tests", "Deploy"]);
    expect(ms.completed).toEqual(["Setup project"]);
  });

  it("returns zeros for empty plan", () => {
    const ms = extractMilestones("## Plan\nNo items");
    expect(ms.total).toBe(0);
    expect(ms.done).toBe(0);
  });

  it("falls back to Milestones heading", () => {
    const content = `## Milestones
- [x] Done thing
- [ ] Pending thing`;
    const ms = extractMilestones(content);
    expect(ms.total).toBe(2);
    expect(ms.done).toBe(1);
  });
});

describe("checkOffMilestones", () => {
  const projectContent = `## Plan
- [ ] Write unit tests
- [ ] Add integration tests
- [x] Setup CI`;

  it("checks off milestones by text match", () => {
    const review = "milestone completed: Write unit tests";
    const result = checkOffMilestones(projectContent, review);
    expect(result).toContain("[x] Write unit tests");
  });

  it("checks off milestones by ✅ marker", () => {
    const review = "✅ Add integration tests";
    const result = checkOffMilestones(projectContent, review);
    expect(result).toContain("[x] Add integration tests");
  });

  it("checks off by M-number pattern", () => {
    const review = "M1: Done, M2: Complete";
    const result = checkOffMilestones(projectContent, review);
    expect(result).toContain("[x] Write unit tests");
    expect(result).toContain("[x] Add integration tests");
  });

  it("returns unchanged if no completions found", () => {
    const result = checkOffMilestones(projectContent, "nothing relevant");
    expect(result).toBe(projectContent);
  });
});

describe("extractComments", () => {
  it("extracts comments section", () => {
    const content = `## Comments
Hello world
## Next`;
    expect(extractComments(content)).toBe("Hello world");
  });

  it("returns empty if no comments", () => {
    expect(extractComments("## Plan\nstuff")).toBe("");
  });
});

describe("clearComments", () => {
  it("clears content between Comments and next heading", () => {
    const content = `## Plan
stuff
## Comments
old comment
## Next
more`;
    const result = clearComments(content);
    expect(result).not.toContain("old comment");
    expect(result).toContain("## Comments");
    expect(result).toContain("more");
  });

  it("returns unchanged if no comments section", () => {
    const content = "## Plan\nstuff";
    expect(clearComments(content)).toBe(content);
  });
});

describe("updateProjectStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates status field in file", () => {
    const content = "**Status**: active\n**Iteration**: 1";
    (readFileSync as any).mockReturnValue(content);

    updateProjectStatus("/tmp/project.md", "done");
    expect(writeFileSync).toHaveBeenCalledWith(
      "/tmp/project.md",
      expect.stringContaining("**Status**: done"),
      "utf-8",
    );
  });

  it("adds stop reason", () => {
    const content = "**Status**: active";
    (readFileSync as any).mockReturnValue(content);

    updateProjectStatus("/tmp/project.md", "blocked", "waiting for approval");
    const written = (writeFileSync as any).mock.calls[0][1];
    expect(written).toContain("**Status**: blocked");
    expect(written).toContain("**Stop Reason**: waiting for approval");
  });

  it("updates existing stop reason", () => {
    const content = "**Status**: active\n**Stop Reason**: old reason";
    (readFileSync as any).mockReturnValue(content);

    updateProjectStatus("/tmp/project.md", "blocked", "new reason");
    const written = (writeFileSync as any).mock.calls[0][1];
    expect(written).toContain("**Stop Reason**: new reason");
    expect(written).not.toContain("old reason");
  });

  it("updates iteration number", () => {
    const content = "**Status**: active\n**Iteration**: 1";
    (readFileSync as any).mockReturnValue(content);

    updateProjectStatus("/tmp/project.md", "active", undefined, 5);
    const written = (writeFileSync as any).mock.calls[0][1];
    expect(written).toContain("**Iteration**: 5");
  });

  it("reads fields from YAML frontmatter", () => {
    const content = `---
status: active
owner: may
iteration: 3
---

# Project
`;
    expect(extractField(content, "Status")).toBe("active");
    expect(extractField(content, "Owner")).toBe("may");
    expect(extractField(content, "Iteration")).toBe("3");
  });

  it("updates YAML frontmatter status and iteration", () => {
    const content = `---
id: test
owner: may
status: active
iteration: 1
---

# Project
`;
    (readFileSync as any).mockReturnValue(content);

    updateProjectStatus("/tmp/project.md", "blocked", "needs access", 2);
    const written = (writeFileSync as any).mock.calls[0][1];
    expect(written).toContain("status: blocked");
    expect(written).toContain("stop_reason: needs access");
    expect(written).toContain("iteration: 2");
  });
});
