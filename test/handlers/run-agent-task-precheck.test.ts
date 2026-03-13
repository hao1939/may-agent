/**
 * Tests for hasActiveItems() pre-check logic in run-agent-task handler.
 */

import { describe, it, expect } from "vitest";
import { hasActiveItems, hasMinContent } from "../../agents/may/handlers/run-agent-task.js";

describe("hasActiveItems", () => {
  const defaultConfig = {
    activeSection: "## Active Focus",
    endSection: "## Archive",
    completedPattern: "COMPLETED",
  };

  it("returns false when all active tasks are completed", () => {
    const content = `# Focus Tasks

## Active Focus

### Monitor P53 Compliance (2026-03-12)
- **Status**: **COMPLETED** (2026-03-12)
- **Outcome**: All good.

## Archive (Completed)

### Old Task
- Done.
`;
    expect(hasActiveItems(content, defaultConfig)).toBe(false);
  });

  it("returns true when an active task is not completed", () => {
    const content = `# Focus Tasks

## Active Focus

### Implement Feature X (2026-03-15)
- **Status**: In Progress
- **Owner**: Bob

## Archive (Completed)

### Old Task
- Done.
`;
    expect(hasActiveItems(content, defaultConfig)).toBe(true);
  });

  it("returns true when some tasks are completed and some are not", () => {
    const content = `# Focus Tasks

## Active Focus

### Task A (2026-03-12)
- **Status**: **COMPLETED** (2026-03-12)

### Task B (2026-03-15)
- **Status**: In Progress

## Archive (Completed)
`;
    expect(hasActiveItems(content, defaultConfig)).toBe(true);
  });

  it("returns false when active section has no tasks", () => {
    const content = `# Focus Tasks

## Active Focus

(Nothing here yet.)

## Archive (Completed)

### Old Task
- Done.
`;
    expect(hasActiveItems(content, defaultConfig)).toBe(false);
  });

  it("returns false when active section is empty", () => {
    const content = `# Focus Tasks

## Active Focus

## Archive (Completed)
`;
    expect(hasActiveItems(content, defaultConfig)).toBe(false);
  });

  it("handles missing end section (scans to end of file)", () => {
    const content = `# Focus Tasks

## Active Focus

### Ongoing Task (2026-03-15)
- **Status**: In Progress
- Not completed yet.
`;
    expect(hasActiveItems(content, defaultConfig)).toBe(true);
  });

  it("handles missing end section with all tasks completed", () => {
    const content = `# Focus Tasks

## Active Focus

### Done Task (2026-03-15)
- **Status**: **COMPLETED** (2026-03-15)
`;
    expect(hasActiveItems(content, defaultConfig)).toBe(false);
  });

  it("uses default config values when not specified", () => {
    const content = `# Tasks

## Active

### Task A
- COMPLETED

## Archive
`;
    // Default: activeSection="## Active", endSection="## Archive", completedPattern="COMPLETED"
    expect(hasActiveItems(content, {})).toBe(false);
  });

  it("returns true for file with no sections at all", () => {
    const content = `# Focus Tasks

Nothing here.
`;
    // No active section found, no tasks — returns false (no work)
    expect(hasActiveItems(content, defaultConfig)).toBe(false);
  });

  it("does not count completed tasks in archive section", () => {
    const content = `# Focus Tasks

## Active Focus

### New Task (2026-03-15)
- **Status**: Working on it

## Archive (Completed)

### Old Task that was COMPLETED
- All done.
`;
    // Only 1 active task, not completed → should return true
    expect(hasActiveItems(content, defaultConfig)).toBe(true);
  });

  it("handles real focus-tasks.md format", () => {
    // Copy of the actual focus-tasks.md structure
    const content = `# Focus Tasks

**Status: Active**
**Owner: Bob**

## Active Focus

### Monitor: Reasoning Evolution Compliance (P53) (2026-03-12)
- **Context**: We have bifurcated self-evolution...
- **Goal**: Ensure no agent modifies its own reasoning core.
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-12)
- **Outcome**:
  - Audited all 12 SOUL.md files...

## Archive (Completed)

### L3 Drift Detection (Safety) (2026-03-13)
- **Status**: **COMPLETED** (2026-03-13)
`;
    expect(hasActiveItems(content, defaultConfig)).toBe(false);
  });

  it("custom completed pattern", () => {
    const content = `# Tasks

## Active Focus

### Task A
- Status: DONE

## Archive
`;
    expect(hasActiveItems(content, { ...defaultConfig, completedPattern: "DONE" })).toBe(false);
    expect(hasActiveItems(content, { ...defaultConfig, completedPattern: "COMPLETED" })).toBe(true);
  });
});

describe("hasMinContent", () => {
  it("returns false for empty content", () => {
    expect(hasMinContent("", 1)).toBe(false);
  });

  it("returns false for header-only content", () => {
    expect(hasMinContent("# Journal\n", 1)).toBe(false);
  });

  it("returns false for header + empty lines", () => {
    expect(hasMinContent("# Journal\n\n\n", 1)).toBe(false);
  });

  it("returns true when content has enough lines", () => {
    const content = `# Journal

- Did something today
- Fixed a bug
`;
    expect(hasMinContent(content, 1)).toBe(true);
    expect(hasMinContent(content, 2)).toBe(true);
    expect(hasMinContent(content, 3)).toBe(false);
  });

  it("ignores headers at all levels", () => {
    const content = `# Title
## Subtitle
### Section
`;
    expect(hasMinContent(content, 1)).toBe(false);
  });

  it("counts real content lines", () => {
    const content = `# Journal

## 2026-03-12

- Entry 1
- Entry 2
- Entry 3

## 2026-03-11

- Old entry
`;
    expect(hasMinContent(content, 3)).toBe(true);
    expect(hasMinContent(content, 4)).toBe(true);
    expect(hasMinContent(content, 5)).toBe(false);
  });

  it("handles real journal content", () => {
    // Bob's journal is 9 lines with mostly headers
    const bobJournal = `# Journal

## 2026-03-12

- Audited SOUL.md files.
`;
    expect(hasMinContent(bobJournal, 1)).toBe(true);
    expect(hasMinContent(bobJournal, 2)).toBe(false);
  });
});
