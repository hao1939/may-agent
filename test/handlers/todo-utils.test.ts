/**
 * Tests for appendToTodoSection() utility.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { appendToTodoSection } from "../../src/lib/todo-utils.js";

describe("appendToTodoSection", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "todo-utils-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates file with TODO header if it does not exist", () => {
    const todoPath = resolve(dir, "todo.md");
    appendToTodoSection(todoPath, "- New item");

    expect(existsSync(todoPath)).toBe(true);
    const content = readFileSync(todoPath, "utf-8");
    expect(content).toContain("# TODO");
    expect(content).toContain("- New item");
  });

  it("appends to existing TODO section", () => {
    const todoPath = resolve(dir, "todo.md");
    writeFileSync(todoPath, "# TODO\n\n- Existing item\n");
    appendToTodoSection(todoPath, "- Added item");

    const content = readFileSync(todoPath, "utf-8");
    expect(content).toContain("- Existing item");
    expect(content).toContain("- Added item");
  });

  it("prepends TODO section if file has no TODO header", () => {
    const todoPath = resolve(dir, "todo.md");
    writeFileSync(todoPath, "# Tracking\n\n- Old stuff\n");
    appendToTodoSection(todoPath, "- New task");

    const content = readFileSync(todoPath, "utf-8");
    expect(content.indexOf("# TODO")).toBeLessThan(content.indexOf("# Tracking"));
    expect(content).toContain("- New task");
    expect(content).toContain("- Old stuff");
  });

  it("creates parent directories if needed", () => {
    const todoPath = resolve(dir, "deep", "nested", "todo.md");
    appendToTodoSection(todoPath, "- Deep item");

    expect(existsSync(todoPath)).toBe(true);
    expect(readFileSync(todoPath, "utf-8")).toContain("- Deep item");
  });
});
