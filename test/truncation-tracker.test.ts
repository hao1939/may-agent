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
    expect(writeText).toContain("shrink the file");
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

    // Third write: tracker was cleared after the successful write.
    // The disk-based shrink guard still applies (file is now 3000 bytes,
    // "also short" is <50%), so we use allowShrink to bypass the shrink guard.
    // The point is that the truncation tracker warning is gone.
    const cleanWrite = await tools.write.execute("w2", {
      path: join(testDir, "src/clear.ts"),
      content: "also short",
      allowShrink: true,
    });
    expect(cleanWrite.content[0].text).not.toContain("WARNING");
    expect(cleanWrite.content[0].text).not.toContain("BLOCKED");
    expect(cleanWrite.content[0].text).toContain("Wrote");
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
    expect(writeText).toContain("shrink the file");
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

// ── Shrink guard (disk-based) tests ────────────────────────────────────

describe("shrink guard (disk-based file size check)", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "shrink-guard-test-"));
    mkdirSync(join(testDir, "src"), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("blocks write when new content is <50% of existing file size", async () => {
    // Create a 2000-byte file
    writeFileSync(join(testDir, "src/large.ts"), "x".repeat(2000));

    const tool = createWriteTool({ projectRoot: testDir });

    // Try to write 500 bytes (25% of original) — should be BLOCKED
    const result = await tool.execute("w1", {
      path: join(testDir, "src/large.ts"),
      content: "y".repeat(500),
    });
    const text = result.content[0].text;
    expect(text).toContain("BLOCKED");
    expect(text).toContain("shrink the file");
    expect(text).toContain("2,000");
    expect(text).toContain("500");
    expect(text).toContain("allowShrink=true");

    // Verify the file was NOT modified
    const content = readFileSync(join(testDir, "src/large.ts"), "utf-8");
    expect(content).toBe("x".repeat(2000));
  });

  it("warns (but allows) when new content is 50-80% of existing file size", async () => {
    writeFileSync(join(testDir, "src/medium.ts"), "x".repeat(2000));

    const tool = createWriteTool({ projectRoot: testDir });

    // Write 1200 bytes (60% of original) — should WARN but succeed
    const result = await tool.execute("w1", {
      path: join(testDir, "src/medium.ts"),
      content: "y".repeat(1200),
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    expect(text).toContain("SHRINK WARNING");
    expect(text).toContain("60%");

    // Verify the file WAS modified
    const content = readFileSync(join(testDir, "src/medium.ts"), "utf-8");
    expect(content).toBe("y".repeat(1200));
  });

  it("allows write when new content is >=80% of existing file size", async () => {
    writeFileSync(join(testDir, "src/normal.ts"), "x".repeat(2000));

    const tool = createWriteTool({ projectRoot: testDir });

    // Write 1800 bytes (90% of original) — no warning
    const result = await tool.execute("w1", {
      path: join(testDir, "src/normal.ts"),
      content: "y".repeat(1800),
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    expect(text).not.toContain("WARNING");
    expect(text).not.toContain("BLOCKED");
  });

  it("allows write to new files without restriction", async () => {
    const tool = createWriteTool({ projectRoot: testDir });

    const result = await tool.execute("w1", {
      path: join(testDir, "src/brand-new.ts"),
      content: "// small file\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    expect(text).not.toContain("BLOCKED");
    expect(text).not.toContain("WARNING");
  });

  it("skips shrink guard for small files (under shrinkGuardMinSize)", async () => {
    // Default shrinkGuardMinSize is 500
    writeFileSync(join(testDir, "src/tiny.ts"), "x".repeat(400));

    const tool = createWriteTool({ projectRoot: testDir });

    // Write 10 bytes to replace 400-byte file — should be allowed (under threshold)
    const result = await tool.execute("w1", {
      path: join(testDir, "src/tiny.ts"),
      content: "// tiny\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    expect(text).not.toContain("BLOCKED");
    expect(text).not.toContain("WARNING");
  });

  it("respects custom shrinkGuardMinSize", async () => {
    writeFileSync(join(testDir, "src/custom.ts"), "x".repeat(800));

    // Set custom min size to 1000 — so an 800-byte file won't be protected
    const tool = createWriteTool({ projectRoot: testDir, shrinkGuardMinSize: 1000 });

    const result = await tool.execute("w1", {
      path: join(testDir, "src/custom.ts"),
      content: "// short\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    expect(text).not.toContain("BLOCKED");
  });

  it("allowShrink=true bypasses the shrink guard", async () => {
    writeFileSync(join(testDir, "src/explicit.ts"), "x".repeat(5000));

    const tool = createWriteTool({ projectRoot: testDir });

    // Write 100 bytes with allowShrink — should succeed
    const result = await tool.execute("w1", {
      path: join(testDir, "src/explicit.ts"),
      content: "// intentionally short\n",
      allowShrink: true,
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    expect(text).not.toContain("BLOCKED");

    // Verify the file was modified
    const content = readFileSync(join(testDir, "src/explicit.ts"), "utf-8");
    expect(content).toBe("// intentionally short\n");
  });

  it("works without projectRoot (uses raw path)", async () => {
    writeFileSync(join(testDir, "src/no-root.ts"), "x".repeat(3000));

    // No projectRoot — shrink guard still works with absolute paths
    const tool = createWriteTool();

    const result = await tool.execute("w1", {
      path: join(testDir, "src/no-root.ts"),
      content: "// very short\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("BLOCKED");
    expect(text).toContain("shrink the file");
  });

  it("correctly reports the shrink ratio in the blocked message", async () => {
    writeFileSync(join(testDir, "src/ratio.ts"), "x".repeat(10000));

    const tool = createWriteTool({ projectRoot: testDir });

    const result = await tool.execute("w1", {
      path: join(testDir, "src/ratio.ts"),
      content: "y".repeat(2200),
    });
    const text = result.content[0].text;
    expect(text).toContain("BLOCKED");
    expect(text).toContain("22%"); // 2200/10000 = 22%
  });
});
