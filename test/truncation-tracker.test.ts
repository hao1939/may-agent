import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createReadTool, createWriteTool, createLinkedTools, TruncationTracker } from "../src/tools.js";
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

  it("returns null for untracked path", () => {
    const tracker = new TruncationTracker();
    expect(tracker.checkWrite("/path/to/file.ts", 100)).toBeNull();
  });

  it("returns null when new content is >= 80% of original", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/path/to/file.ts", 10000);
    // 80% of 10000 = 8000 — should be fine
    expect(tracker.checkWrite("/path/to/file.ts", 8000)).toBeNull();
    // Exactly 80% — should be fine
    expect(tracker.checkWrite("/path/to/file.ts", 8001)).toBeNull();
  });

  it("returns warning when new content is < 80% of original", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/path/to/file.ts", 10000);
    const warning = tracker.checkWrite("/path/to/file.ts", 5000);
    expect(warning).not.toBeNull();
    expect(warning).toContain("WARNING");
    expect(warning).toContain("truncation");
    expect(warning).toContain("10,000");
    expect(warning).toContain("5,000");
    expect(warning).toContain("50%");
  });

  it("returns warning with correct percentage for very short write", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/path/to/file.ts", 100000);
    const warning = tracker.checkWrite("/path/to/file.ts", 1000);
    expect(warning).not.toBeNull();
    expect(warning).toContain("1%");
    expect(warning).toContain("99,000 chars lost");
  });

  it("tracks multiple files independently", () => {
    const tracker = new TruncationTracker();
    tracker.recordTruncatedRead("/a.ts", 50000);
    tracker.recordTruncatedRead("/b.ts", 30000);
    expect(tracker.size).toBe(2);

    // Writing /a.ts shouldn't affect /b.ts tracking
    expect(tracker.checkWrite("/a.ts", 5000)).not.toBeNull();
    expect(tracker.checkWrite("/b.ts", 25000)).toBeNull(); // 83% > 80%
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
    expect(tools.tracker).toBeInstanceOf(TruncationTracker);
  });

  it("warns when writing back a file that was read truncated", async () => {
    // Create a large file
    const largeContent = "x".repeat(50000);
    writeFileSync(join(testDir, "src/big.ts"), largeContent);

    // Create linked tools with small maxFileLength to force truncation
    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read the file (will be truncated)
    const readResult = await tools.read.execute("r1", { path: join(testDir, "src/big.ts") });
    const readText = readResult.content[0].text;
    expect(readText).toContain("truncated");
    expect(readText.length).toBeLessThan(50000);

    // Verify tracker recorded the truncation
    expect(tools.tracker.has(join(testDir, "src/big.ts"))).toBe(true);

    // Write back much shorter content (simulating data loss) — should be BLOCKED
    const writeResult = await tools.write.execute("w1", {
      path: join(testDir, "src/big.ts"),
      content: "// shortened version\n" + "y".repeat(500),
    });
    const writeText = writeResult.content[0].text;
    expect(writeText).toContain("BLOCKED");
    expect(writeText).toContain("data loss");
    expect(writeText).toContain("sed");
  });

  it("does NOT warn when writing a new file", async () => {
    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    const writeResult = await tools.write.execute("w1", {
      path: join(testDir, "src/new.ts"),
      content: "// brand new file\n",
    });
    const writeText = writeResult.content[0].text;
    expect(writeText).toContain("Wrote");
    expect(writeText).not.toContain("WARNING");
  });

  it("does NOT warn when file was read without truncation", async () => {
    // Create a small file
    const smallContent = "export const x = 1;\n";
    writeFileSync(join(testDir, "src/small.ts"), smallContent);

    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read the small file (no truncation needed)
    await tools.read.execute("r1", { path: join(testDir, "src/small.ts") });
    expect(tools.tracker.has(join(testDir, "src/small.ts"))).toBe(false);

    // Write it back shorter — no warning because it wasn't truncated
    const writeResult = await tools.write.execute("w1", {
      path: join(testDir, "src/small.ts"),
      content: "// shorter\n",
    });
    const writeText = writeResult.content[0].text;
    expect(writeText).toContain("Wrote");
    expect(writeText).not.toContain("WARNING");
  });

  it("does NOT warn when write content is >= 80% of original", async () => {
    // Create a file just over the truncation limit
    const content = "x".repeat(2000);
    writeFileSync(join(testDir, "src/medium.ts"), content);

    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read (will be truncated)
    await tools.read.execute("r1", { path: join(testDir, "src/medium.ts") });

    // Write back 85% of original — should be fine
    const writeResult = await tools.write.execute("w1", {
      path: join(testDir, "src/medium.ts"),
      content: "x".repeat(1700),
    });
    const writeText = writeResult.content[0].text;
    expect(writeText).toContain("Wrote");
    expect(writeText).not.toContain("WARNING");
  });

  it("clears tracker after successful write", async () => {
    const content = "x".repeat(5000);
    writeFileSync(join(testDir, "src/clear.ts"), content);

    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read (truncated) → write (blocked) → write with enough content (warning) → write again (no warning)
    await tools.read.execute("r1", { path: join(testDir, "src/clear.ts") });

    // First write: way too short, should be BLOCKED (doesn't clear tracker)
    const blockedWrite = await tools.write.execute("w0", {
      path: join(testDir, "src/clear.ts"),
      content: "short",
    });
    expect(blockedWrite.content[0].text).toContain("BLOCKED");

    // Second write: 60% of original (between 50% block and 80% warn thresholds)
    const warningWrite = await tools.write.execute("w1", {
      path: join(testDir, "src/clear.ts"),
      content: "x".repeat(3000),
    });
    expect(warningWrite.content[0].text).toContain("WARNING");

    // Third write: tracker was cleared after the successful write, no warning
    const cleanWrite = await tools.write.execute("w2", {
      path: join(testDir, "src/clear.ts"),
      content: "also short",
    });
    expect(cleanWrite.content[0].text).not.toContain("WARNING");
    expect(cleanWrite.content[0].text).not.toContain("BLOCKED");
  });

  it("clears tracker when file is re-read without truncation", async () => {
    const largeContent = "x".repeat(5000);
    writeFileSync(join(testDir, "src/reread.ts"), largeContent);

    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read large file (truncated)
    await tools.read.execute("r1", { path: join(testDir, "src/reread.ts") });
    expect(tools.tracker.has(join(testDir, "src/reread.ts"))).toBe(true);

    // Now make the file smaller and re-read (no truncation)
    writeFileSync(join(testDir, "src/reread.ts"), "small now");
    await tools.read.execute("r2", { path: join(testDir, "src/reread.ts") });
    expect(tools.tracker.has(join(testDir, "src/reread.ts"))).toBe(false);
  });

  it("works with hallucinated paths (tracker uses resolved path)", async () => {
    const largeContent = "x".repeat(5000);
    writeFileSync(join(testDir, "src/hallucinated.ts"), largeContent);

    const tools = createLinkedTools({ projectRoot: testDir, maxFileLength: 1000 });

    // Read with the real path
    await tools.read.execute("r1", { path: join(testDir, "src/hallucinated.ts") });
    expect(tools.tracker.has(join(testDir, "src/hallucinated.ts"))).toBe(true);

    // Write with relative path (should resolve to same absolute path)
    // 'very short' is <50% of 5000 chars, so should be BLOCKED
    const writeResult = await tools.write.execute("w1", {
      path: "src/hallucinated.ts",
      content: "very short",
    });
    const writeText = writeResult.content[0].text;
    expect(writeText).toContain("BLOCKED");
    expect(writeText).toContain("data loss");
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
    expect(result.content[0].text).toContain("Wrote");
    expect(result.content[0].text).not.toContain("WARNING");
  });

  it("write tool works with no options at all", async () => {
    const tool = createWriteTool();
    const filePath = join(testDir, "no-opts.txt");
    const result = await tool.execute("w1", {
      path: filePath,
      content: "no options",
    });
    expect(result.content[0].text).toContain("Wrote");
    expect(readFileSync(filePath, "utf-8")).toBe("no options");
  });
});
