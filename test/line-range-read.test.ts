import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createReadTool } from "../src/lib/tools/read.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const tmpDir = join("/tmp", "line-range-test");

function setup() {
  mkdirSync(tmpDir, { recursive: true });
}

function cleanup() {
  try {
    rmSync(tmpDir, { recursive: true });
  } catch {
    /* ignore */
  }
}

describe("read tool with offset/limit", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it("returns specific line range when offset and limit are set", async () => {
    const filePath = join(tmpDir, "lines.txt");
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1} content`);
    writeFileSync(filePath, lines.join("\n"));

    const tool = createReadTool(tmpDir);
    const result = await tool.execute("test-id", {
      path: filePath,
      offset: 10,
      limit: 6,
    });

    const text = result.content[0].text;
    expect(text).toContain("line 10 content");
    expect(text).toContain("line 15 content");
    expect(text).not.toContain("line 9 content");
    expect(text).not.toContain("line 16 content");
  });

  it("returns from offset to end when only offset is set", async () => {
    const filePath = join(tmpDir, "partial.txt");
    writeFileSync(filePath, "a\nb\nc\nd\ne");

    const tool = createReadTool(tmpDir);
    const result = await tool.execute("test-id", {
      path: filePath,
      offset: 3,
    });

    const text = result.content[0].text;
    expect(text).toContain("c");
    expect(text).toContain("d");
    expect(text).toContain("e");
    expect(text).not.toMatch(/^a\n/);
    expect(text).not.toMatch(/^b\n/);
  });

  it("returns first N lines when only limit is set", async () => {
    const filePath = join(tmpDir, "partial2.txt");
    writeFileSync(filePath, "a\nb\nc\nd\ne");

    const tool = createReadTool(tmpDir);
    const result = await tool.execute("test-id", {
      path: filePath,
      limit: 3,
    });

    const text = result.content[0].text;
    expect(text).toContain("a");
    expect(text).toContain("b");
    expect(text).toContain("c");
    // Should show continuation hint
    expect(text).toContain("more lines in file");
  });

  it("returns error for offset beyond end of file", async () => {
    const filePath = join(tmpDir, "short.txt");
    writeFileSync(filePath, "a\nb\nc");

    const tool = createReadTool(tmpDir);
    await expect(tool.execute("test-id", { path: filePath, offset: 100 })).rejects.toThrow(/beyond end of file/);
  });

  it("returns error for non-existent file", async () => {
    const tool = createReadTool(tmpDir);
    await expect(tool.execute("test-id", { path: join(tmpDir, "nonexistent.txt") })).rejects.toThrow();
  });

  it("handles single-line file", async () => {
    const filePath = join(tmpDir, "single.txt");
    writeFileSync(filePath, "only line");

    const tool = createReadTool(tmpDir);
    const result = await tool.execute("test-id", { path: filePath });
    expect(result.content[0].text).toBe("only line");
  });
});
