/**
 * Tests for parseTodoItems() from drain-todo handler.
 */

import { describe, it, expect } from "vitest";
import { parseTodoItems } from "../../agents/may/handlers/drain-todo.js";

describe("parseTodoItems", () => {
  it("parses simple TODO items", () => {
    const content = `# TODO

- Buy milk
- Fix bug #42
`;
    const items = parseTodoItems(content);
    expect(items).toEqual(["- Buy milk", "- Fix bug #42"]);
  });

  it("returns empty array when no TODO section", () => {
    const content = `# Notes

Some random notes here.
`;
    expect(parseTodoItems(content)).toEqual([]);
  });

  it("returns empty array for empty TODO section", () => {
    const content = `# TODO

# Tracking
`;
    expect(parseTodoItems(content)).toEqual([]);
  });

  it("skips checked items", () => {
    const content = `# TODO

- [x] Already done
- [ ] Still pending
- [X] Also done (uppercase)
`;
    const items = parseTodoItems(content);
    expect(items).toHaveLength(1);
    expect(items[0]).toContain("Still pending");
  });

  it("skips strikethrough items", () => {
    const content = `# TODO

- ~~Cancelled item~~
- Active item
`;
    const items = parseTodoItems(content);
    expect(items).toHaveLength(1);
    expect(items[0]).toContain("Active item");
  });

  it("stops at the next top-level heading", () => {
    const content = `# TODO

- First task
- Second task

# Tracking

- [x] Old completed item
`;
    const items = parseTodoItems(content);
    expect(items).toEqual(["- First task", "- Second task"]);
  });

  it("handles multi-line items (continuation lines)", () => {
    const content = `# TODO

- Deploy new version
  Including the database migration
  and config updates
- Simple task
`;
    const items = parseTodoItems(content);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("database migration");
    expect(items[0]).toContain("config updates");
    expect(items[1]).toBe("- Simple task");
  });

  it("handles empty file", () => {
    expect(parseTodoItems("")).toEqual([]);
  });

  it("handles file with only TODO header", () => {
    expect(parseTodoItems("# TODO\n")).toEqual([]);
  });

  it("ignores sub-headings (## sections within TODO)", () => {
    const content = `# TODO

## High Priority
- Urgent fix
## Low Priority
- Nice to have
`;
    const items = parseTodoItems(content);
    expect(items).toEqual(["- Urgent fix", "- Nice to have"]);
  });
});
