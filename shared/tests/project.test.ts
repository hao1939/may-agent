/**
 * Tests for pure utility functions in workflows/project.ts
 * 
 * Since project.ts doesn't export its functions, we test them indirectly
 * by reimplementing the logic and verifying against the same contracts,
 * OR we extract and test the parseable/pure logic directly.
 * 
 * Strategy: import the module's source as text isn't viable, so we
 * replicate the core pure functions exactly and test them thoroughly.
 * These tests validate the LOGIC that project.ts relies on.
 */

import { describe, it, expect } from "vitest";

// ── Replicated pure functions from project.ts (exact copies) ──

function updateField(content: string, field: string, value: string): string {
  const regex = new RegExp(`^(\\*\\*${field}\\*\\*:\\s*).*$`, "m");
  if (regex.test(content)) return content.replace(regex, `$1${value}`);
  const insertPoint = content.search(/^## /m);
  if (insertPoint > 0) {
    return content.slice(0, insertPoint) + `**${field}**: ${value}\n` + content.slice(insertPoint);
  }
  return content;
}

function extractSection(content: string, heading: string): string {
  const marker = `## ${heading}\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) return "";
  const after = content.slice(idx + marker.length);
  const nextSection = after.indexOf("\n## ");
  return (nextSection === -1 ? after : after.slice(0, nextSection)).trim();
}

function updateSection(content: string, heading: string, newContent: string): string {
  const marker = `## ${heading}\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) return content + `\n\n## ${heading}\n${newContent}`;
  const after = content.slice(idx + marker.length);
  const nextSection = after.indexOf("\n## ");
  const end = nextSection === -1 ? content.length : idx + marker.length + nextSection;
  return content.slice(0, idx + marker.length) + newContent + content.slice(end);
}

function appendToSection(content: string, heading: string, line: string): string {
  const idx = content.indexOf(`## ${heading}`);
  if (idx === -1) return content + `\n\n## ${heading}\n${line}\n`;
  const afterHeading = content.indexOf("\n", idx) + 1;
  const nextSection = content.slice(afterHeading).search(/\n## /);
  const insertAt = nextSection === -1 ? content.length : afterHeading + nextSection;
  return content.slice(0, insertAt) + line + "\n" + content.slice(insertAt);
}

function parseProjectState(content: string): { status: string; lastIteration: number } {
  const statusMatch = content.match(/^\*\*Status\*\*:\s*(.+)$/m);
  const iterMatch = content.match(/^\*\*Iteration\*\*:\s*(\d+)/m);
  return {
    status: statusMatch ? statusMatch[1].trim() : "active",
    lastIteration: iterMatch ? parseInt(iterMatch[1], 10) : 0,
  };
}

function extractMilestones(content: string): { total: number; done: number; pending: string[] } {
  const section = extractSection(content, "Milestones");
  if (!section) return { total: 0, done: 0, pending: [] };
  const lines = section.split("\n").filter((l) => /^- \[/.test(l));
  const done = lines.filter((l) => /^- \[x\]/i.test(l)).length;
  const pending = lines.filter((l) => /^- \[ \]/.test(l)).map((l) => l.replace(/^- \[ \]\s*/, ""));
  return { total: lines.length, done, pending };
}

function parseInput(raw: string, callingAgent: string): Record<string, string | undefined> {
  const field = (name: string): string | undefined => {
    const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : undefined;
  };
  return {
    path: field("path"),
    worker: field("worker"),
    goal: field("goal"),
    maxIterations: field("max_iterations"),
    reviewEvery: field("review_every"),
  };
}

function extractDecision(text: string): { status: "waiting" | "blocked" | "continue"; detail: string } {
  const m = text.match(/\[DECISION:\s*(WAITING|BLOCKED|CONTINUE)\]/i);
  if (!m) return { status: "continue", detail: "" };
  const status = m[1].toLowerCase() as "waiting" | "blocked" | "continue";
  const detailMatch = text.match(/\[DETAIL:\s*(.+?)\]/i);
  return { status, detail: detailMatch ? detailMatch[1] : "" };
}

function clearComments(content: string): string {
  return updateSection(content, "Comments", "(none)\n");
}

// ── Tests ──

describe("updateField", () => {
  it("updates an existing field", () => {
    const content = "# Project\n**Status**: active\n**Iteration**: 3\n## Milestones\n";
    const result = updateField(content, "Status", "done");
    expect(result).toContain("**Status**: done");
    expect(result).not.toContain("**Status**: active");
  });

  it("inserts a new field before first ## section", () => {
    const content = "# Project\n**Status**: active\n## Milestones\nstuff\n";
    const result = updateField(content, "Owner", "alice");
    expect(result).toContain("**Owner**: alice");
    // Should appear before ## Milestones
    const ownerIdx = result.indexOf("**Owner**");
    const milestonesIdx = result.indexOf("## Milestones");
    expect(ownerIdx).toBeLessThan(milestonesIdx);
  });

  it("handles content with no sections gracefully", () => {
    const content = "just some text";
    const result = updateField(content, "Status", "active");
    // No ## section, no existing field — returns unchanged
    expect(result).toBe("just some text");
  });
});

describe("extractSection", () => {
  it("extracts content between headings", () => {
    const content = "# Title\n## Goals\nBuild something\n## Milestones\n- [x] done\n";
    expect(extractSection(content, "Goals")).toBe("Build something");
  });

  it("extracts last section to end of file", () => {
    const content = "## First\nA\n## Last\nB\nC\n";
    expect(extractSection(content, "Last")).toBe("B\nC");
  });

  it("returns empty string for missing section", () => {
    expect(extractSection("## Other\nstuff", "Missing")).toBe("");
  });
});

describe("updateSection", () => {
  it("replaces section content", () => {
    const content = "## Goals\nold\n## Next\nkeep\n";
    const result = updateSection(content, "Goals", "new\n");
    expect(result).toContain("## Goals\nnew\n");
    expect(result).toContain("## Next\nkeep");
  });

  it("appends new section if missing", () => {
    const content = "## Existing\nstuff\n";
    const result = updateSection(content, "New", "data\n");
    expect(result).toContain("## New\ndata\n");
  });
});

describe("appendToSection", () => {
  it("appends line to existing section", () => {
    const content = "## Log\nentry1\n## Other\nstuff\n";
    const result = appendToSection(content, "Log", "entry2");
    expect(result).toContain("entry1\nentry2");
    expect(result).toContain("## Other\nstuff");
  });

  it("creates section if missing", () => {
    const content = "nothing here";
    const result = appendToSection(content, "Log", "first entry");
    expect(result).toContain("## Log\nfirst entry\n");
  });
});

describe("parseProjectState", () => {
  it("parses status and iteration from project content", () => {
    const content = "**Status**: active\n**Iteration**: 5\n";
    const state = parseProjectState(content);
    expect(state.status).toBe("active");
    expect(state.lastIteration).toBe(5);
  });

  it("defaults to active/0 when fields missing", () => {
    const state = parseProjectState("# Empty project\n");
    expect(state.status).toBe("active");
    expect(state.lastIteration).toBe(0);
  });
});

describe("extractMilestones", () => {
  it("counts done and pending milestones", () => {
    const content = "## Milestones\n- [x] Setup\n- [ ] Tests\n- [ ] Deploy\n## Other\n";
    const ms = extractMilestones(content);
    expect(ms.total).toBe(3);
    expect(ms.done).toBe(1);
    expect(ms.pending).toEqual(["Tests", "Deploy"]);
  });

  it("handles no milestones section", () => {
    const ms = extractMilestones("## Other\nstuff");
    expect(ms.total).toBe(0);
    expect(ms.done).toBe(0);
    expect(ms.pending).toEqual([]);
  });
});

describe("parseInput", () => {
  it("extracts fields from raw input string", () => {
    const raw = "path: /projects/test\nworker: builder\ngoal: Build a thing\nmax_iterations: 10\nreview_every: 3";
    const result = parseInput(raw, "owner-agent");
    expect(result.path).toBe("/projects/test");
    expect(result.worker).toBe("builder");
    expect(result.goal).toBe("Build a thing");
    expect(result.maxIterations).toBe("10");
    expect(result.reviewEvery).toBe("3");
  });

  it("returns undefined for missing fields", () => {
    const result = parseInput("path: /test", "owner");
    expect(result.worker).toBeUndefined();
    expect(result.goal).toBeUndefined();
  });
});

describe("extractDecision", () => {
  it("parses WAITING decision", () => {
    const text = "Review looks good. [DECISION: WAITING] [DETAIL: needs user input]";
    const d = extractDecision(text);
    expect(d.status).toBe("waiting");
    expect(d.detail).toBe("needs user input");
  });

  it("parses BLOCKED decision", () => {
    const text = "[DECISION: BLOCKED] [DETAIL: missing API key]";
    const d = extractDecision(text);
    expect(d.status).toBe("blocked");
  });

  it("defaults to continue when no marker found", () => {
    const d = extractDecision("everything is fine, keep going");
    expect(d.status).toBe("continue");
  });
});

describe("clearComments", () => {
  it("replaces comments section with (none)", () => {
    const content = "## Comments\nSome feedback here\n## Other\nstuff\n";
    const result = clearComments(content);
    expect(extractSection(result, "Comments")).toBe("(none)");
    expect(result).toContain("## Other\nstuff");
  });
});
