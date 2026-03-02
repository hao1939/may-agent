import { describe, it, expect } from "vitest";
import { truncateOutput, createExecTool } from "../src/tools.js";

describe("truncateOutput", () => {
  it("returns short strings unchanged", () => {
    expect(truncateOutput("hello", 100)).toBe("hello");
  });

  it("returns strings exactly at the limit unchanged", () => {
    const s = "a".repeat(100);
    expect(truncateOutput(s, 100)).toBe(s);
  });

  it("truncates strings exceeding the limit", () => {
    const s = "a".repeat(200);
    const result = truncateOutput(s, 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toContain("[");
    expect(result).toContain("truncated]");
  });

  it("preserves head and tail content", () => {
    // Create a string with recognizable head and tail
    const head = "HEAD_CONTENT_START_";
    const middle = "m".repeat(500);
    const tail = "_END_TAIL_CONTENT";
    const full = head + middle + tail;

    const result = truncateOutput(full, 200);
    expect(result).toContain("HEAD_CONTENT_START");
    expect(result).toContain("TAIL_CONTENT");
    expect(result).toContain("truncated");
  });

  it("includes character count in truncation marker", () => {
    const s = "x".repeat(1000);
    const result = truncateOutput(s, 200);
    // The marker should mention how many characters were omitted
    const match = result.match(/\[(\d[\d,]*) characters truncated\]/);
    expect(match).not.toBeNull();
    const omitted = parseInt(match![1].replace(/,/g, ""), 10);
    expect(omitted).toBeGreaterThan(0);
    expect(omitted).toBeLessThan(1000);
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
    // Available = 1000 - ~80 marker = ~920
    // Head ≈ 552, tail ≈ 368
    expect(markerIdx).toBeGreaterThan(400); // head is substantial
    const tailLen = result.length - markerEnd - 3;
    expect(tailLen).toBeGreaterThan(250); // tail is also substantial
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
    const tool = createExecTool({ cwd: "/tmp", maxOutputLength: 100 });
    const result = await tool.execute("test-id", {
      command: `python3 -c "print('y' * 500)"`,
      timeout: 10,
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text.length).toBeLessThanOrEqual(100);
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
    const tool = createExecTool({ cwd: "/tmp", maxOutputLength: 200 });
    const result = await tool.execute("test-id", {
      command: `python3 -c "import sys; sys.stderr.write('E' * 500); sys.exit(1)"`,
      timeout: 10,
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("Exit code 1");
    expect(text).toContain("truncated");
    expect(text.length).toBeLessThan(400); // 200 for output + prefix/exit code
  });
});
