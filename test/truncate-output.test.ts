import { describe, it, expect } from "vitest";
import { truncateOutput, createExecTool, createReadTool } from "../src/tools.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("truncateOutput", () => {
  it("returns short strings unchanged", () => {
    expect(truncateOutput("hello", 100)).toBe("hello");
  });

  it("returns strings exactly at the limit unchanged", () => {
    const s = "a".repeat(100);
    expect(truncateOutput(s, 100)).toBe(s);
  });

  it("truncates strings exceeding the limit", () => {
    const s = "a".repeat(1000);
    const result = truncateOutput(s, 500);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result).toContain("[");
    expect(result).toContain("truncated");
  });

  it("preserves head and tail content", () => {
    // Create a string with recognizable head and tail
    const head = "HEAD_CONTENT_START_";
    const middle = "m".repeat(500);
    const tail = "_END_TAIL_CONTENT";
    const full = head + middle + tail;

    const result = truncateOutput(full, 400);
    expect(result).toContain("HEAD_CONTENT_START");
    expect(result).toContain("TAIL_CONTENT");
    expect(result).toContain("truncated");
  });

  it("includes character count in truncation marker", () => {
    const s = "x".repeat(5000);
    const result = truncateOutput(s, 1000);
    // The marker should mention how many characters were omitted
    const match = result.match(/\[(\d[\d,]*) characters truncated/);
    expect(match).not.toBeNull();
    const omitted = parseInt(match![1].replace(/,/g, ""), 10);
    expect(omitted).toBeGreaterThan(0);
    expect(omitted).toBeLessThan(5000);
  });

  it("includes fabrication warning in truncation marker", () => {
    const s = "x".repeat(5000);
    const result = truncateOutput(s, 1000);
    expect(result).toContain("DO NOT fabricate");
    expect(result).toContain("truncated section");
  });

  it("does not truncate when maxLen is 0 (disabled)", () => {
    const s = "a".repeat(1000);
    expect(truncateOutput(s, 0)).toBe(s);
  });

  it("does not truncate when maxLen is Infinity", () => {
    const s = "a".repeat(1000);
    expect(truncateOutput(s, Infinity)).toBe(s);
  });

  it("head portion is larger than tail (60/40 split)", () => {
    const s = "a".repeat(10000);
    const result = truncateOutput(s, 1000);
    const markerIdx = result.indexOf("...");
    const markerEnd = result.lastIndexOf("...");
    // Head should be roughly 60% of available space
    // Available = 1000 - ~160 marker = ~840
    // Head ≈ 504, tail ≈ 336
    expect(markerIdx).toBeGreaterThan(300); // head is substantial
    const tailLen = result.length - markerEnd - 3;
    expect(tailLen).toBeGreaterThan(200); // tail is also substantial
    expect(markerIdx).toBeGreaterThan(tailLen); // head > tail
  });

  it("handles very small maxLen gracefully", () => {
    const s = "a".repeat(200);
    const result = truncateOutput(s, 10);
    // Should not crash, just truncate aggressively
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("handles empty string", () => {
    expect(truncateOutput("", 100)).toBe("");
  });

  it("handles single-character string", () => {
    expect(truncateOutput("x", 100)).toBe("x");
  });
});

describe("createExecTool maxOutputLength", () => {
  it("truncates long output by default", async () => {
    // Generate output longer than default 20000 chars
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("test-id", {
      command: `python3 -c "print('x' * 30000)"`,
      timeout: 10,
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    // Output should be truncated to around 20000 chars
    expect(text.length).toBeLessThan(25000);
    expect(text).toContain("truncated");
  });

  it("does not truncate short output", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("test-id", {
      command: "echo hello",
      timeout: 10,
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("hello");
    expect(text).not.toContain("truncated");
  });

  it("respects custom maxOutputLength", async () => {
    const tool = createExecTool({ cwd: "/tmp", maxOutputLength: 500 });
    const result = await tool.execute("test-id", {
      command: `python3 -c "print('y' * 2000)"`,
      timeout: 10,
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text.length).toBeLessThanOrEqual(800); // 500 for truncated output + suffix warning
    expect(text).toContain("truncated");
  });

  it("disables truncation with maxOutputLength: 0", async () => {
    const tool = createExecTool({ cwd: "/tmp", maxOutputLength: 0 });
    const result = await tool.execute("test-id", {
      command: `python3 -c "print('z' * 500)"`,
      timeout: 10,
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("z".repeat(500));
    expect(text).not.toContain("truncated");
  });

  it("truncates error output too", async () => {
    const tool = createExecTool({ cwd: "/tmp", maxOutputLength: 500 });
    const result = await tool.execute("test-id", {
      command: `python3 -c "import sys; sys.stderr.write('E' * 2000); sys.exit(1)"`,
      timeout: 10,
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("Exit code 1");
    expect(text).toContain("truncated");
    expect(text.length).toBeLessThan(700); // 500 for output + prefix/exit code
  });

  it("includes actionable truncation guidance in truncated exec output", async () => {
    const tool = createExecTool({ cwd: "/tmp", maxOutputLength: 500 });
    const result = await tool.execute("test-id", {
      command: `python3 -c "print('w' * 2000)"`,
      timeout: 10,
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("OUTPUT TRUNCATED");
    expect(text).toContain("Do NOT fabricate");
  });
});

describe("createReadTool maxFileLength", () => {
  const tmpDir = join("/tmp", "read-truncation-test");

  // Setup test files
  const setupDir = () => {
    mkdirSync(tmpDir, { recursive: true });
  };

  const cleanup = () => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  };

  it("truncates large files when maxFileLength is set", () => {
    setupDir();
    const filePath = join(tmpDir, "large.txt");
    const largeContent = "x".repeat(5000);
    writeFileSync(filePath, largeContent);

    const tool = createReadTool({ maxFileLength: 1000 });
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text.length).toBeLessThanOrEqual(1100);
      expect(text).toContain("truncated");
      expect(text).toContain("FILE TRUNCATED");
      expect(text).toContain("DO NOT use the write tool");
      cleanup();
    });
  });

  it("does not truncate small files", () => {
    setupDir();
    const filePath = join(tmpDir, "small.txt");
    const content = "hello world";
    writeFileSync(filePath, content);

    const tool = createReadTool({ maxFileLength: 1000 });
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toBe("hello world");
      expect(text).not.toContain("truncated");
      cleanup();
    });
  });

  it("does not truncate when maxFileLength is 0 (disabled)", () => {
    setupDir();
    const filePath = join(tmpDir, "nolimit.txt");
    const largeContent = "y".repeat(5000);
    writeFileSync(filePath, largeContent);

    const tool = createReadTool({ maxFileLength: 0 });
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toBe(largeContent);
      expect(text).not.toContain("truncated");
      cleanup();
    });
  });

  it("does not truncate when maxFileLength is not set", () => {
    setupDir();
    const filePath = join(tmpDir, "default.txt");
    const largeContent = "z".repeat(5000);
    writeFileSync(filePath, largeContent);

    const tool = createReadTool({});
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toBe(largeContent);
      expect(text).not.toContain("truncated");
      cleanup();
    });
  });

  it("preserves head and tail of truncated files", () => {
    setupDir();
    const filePath = join(tmpDir, "headtail.txt");
    const head = "HEADER_CONTENT_";
    const middle = "m".repeat(5000);
    const tail = "_FOOTER_CONTENT";
    writeFileSync(filePath, head + middle + tail);

    const tool = createReadTool({ maxFileLength: 1000 });
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toContain("HEADER_CONTENT");
      expect(text).toContain("FOOTER_CONTENT");
      expect(text).toContain("truncated");
      cleanup();
    });
  });
});
