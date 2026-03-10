import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createReadTool, createLinkedTools } from "../src/tools.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const tmpDir = join("/tmp", "line-range-test");

function setup() {
  mkdirSync(tmpDir, { recursive: true });
}

function cleanup() {
  try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
}

describe("createReadTool with line ranges", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it("returns specific line range when startLine and endLine are set", async () => {
    const filePath = join(tmpDir, "lines.txt");
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1} content`);
    writeFileSync(filePath, lines.join("\n"));

    const tool = createReadTool({ maxFileLength: 500 });
    const result = await tool.execute("test-id", {
      path: filePath,
      startLine: 10,
      endLine: 15,
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("line 10 content");
    expect(text).toContain("line 15 content");
    expect(text).not.toContain("line 9 content");
    expect(text).not.toContain("line 16 content");
  });

  it("does not truncate line-range reads even when maxFileLength is set", async () => {
    const filePath = join(tmpDir, "big.txt");
    const lines = Array.from({ length: 1000 }, (_, i) => `big line ${i + 1} with padding ${"x".repeat(50)}`);
    writeFileSync(filePath, lines.join("\n"));

    const tool = createReadTool({ maxFileLength: 500 });
    const result = await tool.execute("test-id", {
      path: filePath,
      startLine: 100,
      endLine: 200,
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    // Should NOT contain truncation warnings
    expect(text).not.toContain("FILE TRUNCATED");
    expect(text).not.toContain("truncated");
    // Should contain requested lines
    expect(text).toContain("big line 100");
    expect(text).toContain("big line 200");
  });

  it("returns from startLine to end of file when only startLine is set", async () => {
    const filePath = join(tmpDir, "partial.txt");
    writeFileSync(filePath, "a\nb\nc\nd\ne");

    const tool = createReadTool({});
    const result = await tool.execute("test-id", {
      path: filePath,
      startLine: 3,
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("c");
    expect(text).toContain("d");
    expect(text).toContain("e");
    expect(text).not.toContain("a\n");
    expect(text).not.toContain("b\n");
  });

  it("returns lines from start when only endLine is set", async () => {
    const filePath = join(tmpDir, "partial2.txt");
    writeFileSync(filePath, "a\nb\nc\nd\ne");

    const tool = createReadTool({});
    const result = await tool.execute("test-id", {
      path: filePath,
      endLine: 3,
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("a");
    expect(text).toContain("b");
    expect(text).toContain("c");
    // d is line 4, should not be present
    const lines = text.split("\n");
    expect(lines.length).toBe(3);
  });

  it("does not trigger truncation tracker for line-range reads", async () => {
    const filePath = join(tmpDir, "tracked.txt");
    const bigContent = "x\n".repeat(5000);
    writeFileSync(filePath, bigContent);

    const { read, truncationTracker } = createLinkedTools({
      projectRoot: tmpDir,
      maxFileLength: 500,
    });

    // Line-range read should NOT record in tracker
    await read.execute("test-id", {
      path: filePath,
      startLine: 1,
      endLine: 10,
    });

    expect(truncationTracker.has(filePath)).toBe(false);
  });

  it("handles line-range read on ENOENT gracefully", async () => {
    const tool = createReadTool({ projectRoot: tmpDir });
    const result = await tool.execute("test-id", {
      path: join(tmpDir, "nonexistent.txt"),
      startLine: 1,
      endLine: 10,
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("Error");
  });
});
