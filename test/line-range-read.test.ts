import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createReadTool, extractLineRange, createLinkedTools } from "../src/tools.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const tmpDir = join("/tmp", "line-range-test");

function setup() {
  mkdirSync(tmpDir, { recursive: true });
}

function cleanup() {
  try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
}

describe("extractLineRange", () => {
  const content = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10";

  it("extracts a middle range", () => {
    const { text, totalLines, linesReturned } = extractLineRange(content, 3, 5);
    expect(totalLines).toBe(10);
    expect(linesReturned).toBe(3);
    expect(text).toContain("line3");
    expect(text).toContain("line4");
    expect(text).toContain("line5");
    expect(text).not.toContain("line2");
    expect(text).not.toContain("line6");
  });

  it("includes line numbers", () => {
    const { text } = extractLineRange(content, 3, 5);
    expect(text).toMatch(/3\| line3/);
    expect(text).toMatch(/4\| line4/);
    expect(text).toMatch(/5\| line5/);
  });

  it("pads line numbers to consistent width", () => {
    // Lines 8-10 → should pad to width 2
    const { text } = extractLineRange(content, 8, 10);
    expect(text).toMatch(/ 8\| line8/);
    expect(text).toMatch(/ 9\| line9/);
    expect(text).toMatch(/10\| line10/);
  });

  it("clamps startLine below 1 to 1", () => {
    const { text, linesReturned } = extractLineRange(content, -5, 3);
    expect(linesReturned).toBe(3);
    expect(text).toContain("line1");
    expect(text).toContain("line3");
  });

  it("clamps endLine beyond file length", () => {
    const { text, linesReturned } = extractLineRange(content, 8, 100);
    expect(linesReturned).toBe(3);
    expect(text).toContain("line8");
    expect(text).toContain("line10");
  });

  it("handles startLine > endLine by clamping", () => {
    const { linesReturned } = extractLineRange(content, 5, 3);
    // end gets clamped to >= start, so start=5, end=5 (1 line) 
    // Actually, start=5, end=max(5,3)=5
    expect(linesReturned).toBe(1);
  });

  it("returns single line when startLine === endLine", () => {
    const { text, linesReturned } = extractLineRange(content, 5, 5);
    expect(linesReturned).toBe(1);
    expect(text).toContain("line5");
    expect(text).not.toContain("line4");
    expect(text).not.toContain("line6");
  });

  it("handles single-line files", () => {
    const { text, totalLines, linesReturned } = extractLineRange("only line", 1, 1);
    expect(totalLines).toBe(1);
    expect(linesReturned).toBe(1);
    expect(text).toContain("only line");
  });

  it("handles empty content", () => {
    const { totalLines, linesReturned } = extractLineRange("", 1, 1);
    expect(totalLines).toBe(1);  // empty string splits to [""]
    expect(linesReturned).toBe(1);
  });
});

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
    expect(text).toContain("[Lines 10-15 of 100 total");
    expect(text).toContain("6 lines shown");
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
    expect(text).not.toContain("characters truncated");
    // Should contain all requested lines
    expect(text).toContain("101 lines shown");
    expect(text).toContain("big line 100");
    expect(text).toContain("big line 200");
  });

  it("returns full file when only startLine is set (to end of file)", async () => {
    const filePath = join(tmpDir, "partial.txt");
    writeFileSync(filePath, "a\nb\nc\nd\ne");

    const tool = createReadTool({});
    const result = await tool.execute("test-id", {
      path: filePath,
      startLine: 3,
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("[Lines 3-5 of 5 total");
    expect(text).toContain("3 lines shown");
    expect(text).toContain("c");
    expect(text).toContain("d");
    expect(text).toContain("e");
    expect(text).not.toContain("| a");
    expect(text).not.toContain("| b");
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
    expect(text).toContain("[Lines 1-3 of 5 total");
    expect(text).toContain("3 lines shown");
    expect(text).toContain("| a");
    expect(text).toContain("| b");
    expect(text).toContain("| c");
    expect(text).not.toContain("| d");
    expect(text).not.toContain("| e");
  });

  it("does not trigger truncation tracker for line-range reads", async () => {
    const filePath = join(tmpDir, "tracked.txt");
    const bigContent = "x\n".repeat(5000);
    writeFileSync(filePath, bigContent);

    const { read, tracker } = createLinkedTools({
      projectRoot: tmpDir,
      maxFileLength: 500,
    });

    // Line-range read should NOT record in tracker
    await read.execute("test-id", {
      path: filePath,
      startLine: 1,
      endLine: 10,
    });

    expect(tracker.has(filePath)).toBe(false);
  });

  it("handles line-range read on ENOENT gracefully", async () => {
    const tool = createReadTool({ projectRoot: tmpDir });
    const result = await tool.execute("test-id", {
      path: join(tmpDir, "nonexistent.txt"),
      startLine: 1,
      endLine: 10,
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("Error reading file");
    expect(text).toContain("ENOENT");
  });

  it("includes line numbers that help with subsequent sed edits", async () => {
    const filePath = join(tmpDir, "numbered.txt");
    writeFileSync(filePath, "alpha\nbeta\ngamma\ndelta\nepsilon");

    const tool = createReadTool({});
    const result = await tool.execute("test-id", {
      path: filePath,
      startLine: 2,
      endLine: 4,
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    // Line numbers should be present for easy reference
    expect(text).toMatch(/2\| beta/);
    expect(text).toMatch(/3\| gamma/);
    expect(text).toMatch(/4\| delta/);
  });
});

describe("truncation markers reference line-range reading", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it("truncation marker mentions read with startLine/endLine", async () => {
    const filePath = join(tmpDir, "truncmarker.txt");
    const bigContent = "x".repeat(5000);
    writeFileSync(filePath, bigContent);

    const tool = createReadTool({ maxFileLength: 1000 });
    const result = await tool.execute("test-id", { path: filePath });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("FILE TRUNCATED");
    expect(text).toContain("read(path, startLine=N, endLine=M)");
  });

  it("write block message mentions read with startLine/endLine", async () => {
    const filePath = join(tmpDir, "blocked.txt");
    const bigContent = "x".repeat(10000);
    writeFileSync(filePath, bigContent);

    const { read, write } = createLinkedTools({
      projectRoot: tmpDir,
      maxFileLength: 1000,
    });

    // First, read the big file (triggers truncation tracking)
    await read.execute("test-id", { path: filePath });

    // Try to write back something much smaller — now succeeds with warning
    const result = await write.execute("test-id", {
      path: filePath,
      content: "tiny",
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("Wrote");
    expect(text).toContain("WARNING");
    expect(text).toContain("truncation");
  });
});
