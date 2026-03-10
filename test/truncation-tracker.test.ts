import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createReadTool, createWriteTool, createLinkedTools, TruncationTracker } from "../src/lib/tools.js";
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── TruncationTracker unit tests ───────────────────────────────────────

describe("TruncationTracker", () => {
  it("starts empty", () => {
    const tracker = new TruncationTracker();
    expect(tracker.size).toBe(0);
  });

  it("records a truncated read", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/path/to/file.ts", 50000);
    expect(tracker.has("/path/to/file.ts")).toBe(true);
    expect(tracker.getOriginalLength("/path/to/file.ts")).toBe(50000);
  });

  it("clears a path", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/path/to/file.ts", 50000);
    tracker.clearPath("/path/to/file.ts");
    expect(tracker.has("/path/to/file.ts")).toBe(false);
    expect(tracker.size).toBe(0);
  });

  it("validateWrite throws for poisoned path", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/path/to/file.ts", 50000);
    expect(() => tracker.validateWrite("/path/to/file.ts")).toThrow("BLOCKED");
  });

  it("validateWrite does not throw for untracked path", () => {
    const tracker = new TruncationTracker();
    expect(() => tracker.validateWrite("/path/to/file.ts")).not.toThrow();
  });

  it("checkWrite returns null for untracked path", () => {
    const tracker = new TruncationTracker();
    expect(tracker.checkWrite("/path/to/file.ts", 100)).toBeNull();
  });

  it("checkWrite throws for poisoned path", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/path/to/file.ts", 10000);
    expect(() => tracker.checkWrite("/path/to/file.ts", 5000)).toThrow("BLOCKED");
  });

  it("tracks multiple files independently", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/a.ts", 50000);
    tracker.recordTruncatedRead("/b.ts", 30000);
    expect(tracker.size).toBe(2);

    expect(() => tracker.validateWrite("/a.ts")).toThrow("BLOCKED");
    expect(() => tracker.validateWrite("/b.ts")).toThrow("BLOCKED");
    // Untracked file should be fine
    expect(() => tracker.validateWrite("/c.ts")).not.toThrow();
  });
});

// ── Integration: read + write with shared tracker ──────────────────────

describe("linked read/write tools with truncation tracking", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "truncation-test-"));
    mkdirSync(join(testDir, "src"), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("createLinkedTools returns read, write, and tracker", () => {
    const tools = createLinkedTools({ projectRoot: testDir });
    expect(tools.read).toBeDefined();
    expect(tools.write).toBeDefined();
    expect(tools.truncationTracker).toBeInstanceOf(TruncationTracker);
  });

  it("blocks writing to a file that was read truncated", async () => {
    const largeContent = "x".repeat(50000);
    writeFileSync(join(testDir, "src/big.ts"), largeContent);

    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read the file (will be truncated)
    const readResult = await tools.read.execute("r1", { path: join(testDir, "src/big.ts") });
    const readText = readResult.content[0].text;
    expect(readText).toContain("truncated");

    // Verify tracker recorded the truncation
    expect(tools.truncationTracker.has(join(testDir, "src/big.ts"))).toBe(true);

    // Write should be blocked (poisoned path)
    const writeResult = await tools.write.execute("w1", {
      path: join(testDir, "src/big.ts"),
      content: "// shortened version\n",
    });
    const writeText = writeResult.content[0].text;
    expect(writeText).toContain("BLOCKED");
  });

  it("does NOT block writing a new file", async () => {
    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    const writeResult = await tools.write.execute("w1", {
      path: join(testDir, "src/new.ts"),
      content: "// brand new file\n",
    });
    const writeText = writeResult.content[0].text;
    expect(writeText).toContain("wrote");
    expect(writeText).not.toContain("BLOCKED");
  });

  it("does NOT block when file was read without truncation", async () => {
    const smallContent = "export const x = 1;\n";
    writeFileSync(join(testDir, "src/small.ts"), smallContent);

    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read the small file (no truncation needed)
    await tools.read.execute("r1", { path: join(testDir, "src/small.ts") });
    expect(tools.truncationTracker.has(join(testDir, "src/small.ts"))).toBe(false);

    // Write should succeed
    const writeResult = await tools.write.execute("w1", {
      path: join(testDir, "src/small.ts"),
      content: "// shorter\n",
    });
    const writeText = writeResult.content[0].text;
    expect(writeText).toContain("wrote");
    expect(writeText).not.toContain("BLOCKED");
  });

  it("clears tracker when file is re-read without truncation", async () => {
    const largeContent = "x".repeat(5000);
    writeFileSync(join(testDir, "src/reread.ts"), largeContent);

    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read large file (truncated)
    await tools.read.execute("r1", { path: join(testDir, "src/reread.ts") });
    expect(tools.truncationTracker.has(join(testDir, "src/reread.ts"))).toBe(true);

    // Now make the file smaller and re-read (no truncation)
    writeFileSync(join(testDir, "src/reread.ts"), "small now");
    await tools.read.execute("r2", { path: join(testDir, "src/reread.ts") });
    expect(tools.truncationTracker.has(join(testDir, "src/reread.ts"))).toBe(false);
  });
});

// ── Backward compatibility ─────────────────────────────────────────────

describe("read/write tools without tracker (backward compat)", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "notracker-test-"));
    mkdirSync(join(testDir, "src"), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("read tool works without tracker", async () => {
    writeFileSync(join(testDir, "src/file.ts"), "content");
    const tool = createReadTool({ projectRoot: testDir });
    const result = await tool.execute("r1", { path: join(testDir, "src/file.ts") });
    expect(result.content[0].text).toBe("content");
  });

  it("write tool works without tracker", async () => {
    const tool = createWriteTool({ projectRoot: testDir });
    const result = await tool.execute("w1", {
      path: join(testDir, "src/new.ts"),
      content: "new content",
    });
    expect(result.content[0].text).toContain("wrote");
  });

  it("write tool works with no options at all", async () => {
    const tool = createWriteTool();
    const filePath = join(testDir, "no-opts.txt");
    const result = await tool.execute("w1", {
      path: filePath,
      content: "no options",
    });
    expect(result.content[0].text).toContain("wrote");
    expect(readFileSync(filePath, "utf-8")).toBe("no options");
  });
});
