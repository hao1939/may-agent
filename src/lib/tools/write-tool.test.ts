import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createWriteTool } from "./write.js";
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("write tool", () => {
  const testDir = join(tmpdir(), `write-tool-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(join(testDir, "src"), { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("writes to relative path resolved against cwd", async () => {
    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "src/output.ts",
      content: "export const x = 1;\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    const content = readFileSync(join(testDir, "src/output.ts"), "utf-8");
    expect(content).toBe("export const x = 1;\n");
  });

  it("writes to absolute path", async () => {
    const tool = createWriteTool(testDir);
    const filePath = join(testDir, "src/correct-abs.ts");
    const result = await tool.execute("test-id", {
      path: filePath,
      content: "// correct absolute\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("// correct absolute\n");
  });

  it("creates parent directories for new nested paths", async () => {
    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "deep/nested/dir/file.ts",
      content: "// nested\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    expect(existsSync(join(testDir, "deep/nested/dir/file.ts"))).toBe(true);
  });

  it("overwrites existing file", async () => {
    const filePath = join(testDir, "src/overwrite.ts");
    writeFileSync(filePath, "old content");

    const tool = createWriteTool(testDir);
    await tool.execute("test-id", {
      path: "src/overwrite.ts",
      content: "new content",
    });
    expect(readFileSync(filePath, "utf-8")).toBe("new content");
  });

  it("reports byte count in success message", async () => {
    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "src/bytes.ts",
      content: "hello",
    });
    expect(result.content[0].text).toContain("5 bytes");
  });
});

describe("write tool shrink guard", () => {
  const testDir = join(tmpdir(), `write-shrink-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("blocks write when new content is less than 50% of existing file", async () => {
    const filePath = join(testDir, "large-file.md");
    // Create a 1000-byte file
    const existingContent = "x".repeat(1000);
    writeFileSync(filePath, existingContent);

    const tool = createWriteTool(testDir);
    // Try to write only 200 bytes (20% of existing)
    const result = await tool.execute("test-id", {
      path: "large-file.md",
      content: "y".repeat(200),
    });

    // Write should be BLOCKED
    expect(result.content[0].text).toContain("WRITE BLOCKED");
    expect(result.content[0].text).toContain("report the blocked path and reason to your caller");
    expect(result.content[0].text).not.toContain("message({");
    expect(result.content[0].text).not.toContain("use bash");
    expect(result.content[0].text).toContain("20%");
    // Original file should be preserved
    expect(readFileSync(filePath, "utf-8")).toBe(existingContent);
  });

  it("warns but allows write when new content is 50-80% of existing file", async () => {
    const filePath = join(testDir, "medium-shrink.md");
    const existingContent = "x".repeat(1000);
    writeFileSync(filePath, existingContent);

    const tool = createWriteTool(testDir);
    // Write 650 bytes (65% of existing)
    const newContent = "y".repeat(650);
    const result = await tool.execute("test-id", {
      path: "medium-shrink.md",
      content: newContent,
    });

    // Write should succeed but with a warning
    expect(result.content[0].text).toContain("Wrote");
    expect(result.content[0].text).toContain("WARNING");
    expect(result.content[0].text).toContain("65%");
    // File should be updated
    expect(readFileSync(filePath, "utf-8")).toBe(newContent);
  });

  it("allows write without warning when new content is >= 80% of existing", async () => {
    const filePath = join(testDir, "slight-shrink.md");
    const existingContent = "x".repeat(1000);
    writeFileSync(filePath, existingContent);

    const tool = createWriteTool(testDir);
    const newContent = "y".repeat(900);
    const result = await tool.execute("test-id", {
      path: "slight-shrink.md",
      content: newContent,
    });

    // Write should succeed without warning
    expect(result.content[0].text).toContain("Wrote");
    expect(result.content[0].text).not.toContain("WARNING");
    expect(result.content[0].text).not.toContain("BLOCKED");
    expect(readFileSync(filePath, "utf-8")).toBe(newContent);
  });

  it("exempts files under 500 bytes from shrink guard", async () => {
    const filePath = join(testDir, "small-file.md");
    const existingContent = "x".repeat(400); // 400 bytes < 500 threshold
    writeFileSync(filePath, existingContent);

    const tool = createWriteTool(testDir);
    // Write only 50 bytes (12.5% of existing) — but under threshold
    const newContent = "y".repeat(50);
    const result = await tool.execute("test-id", {
      path: "small-file.md",
      content: newContent,
    });

    // Should succeed without blocking or warning
    expect(result.content[0].text).toContain("Wrote");
    expect(result.content[0].text).not.toContain("BLOCKED");
    expect(result.content[0].text).not.toContain("WARNING");
    expect(readFileSync(filePath, "utf-8")).toBe(newContent);
  });

  it("allows writing to new files (no existing file)", async () => {
    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "brand-new-file.md",
      content: "hello",
    });

    expect(result.content[0].text).toContain("Wrote");
    expect(result.content[0].text).not.toContain("BLOCKED");
    expect(readFileSync(join(testDir, "brand-new-file.md"), "utf-8")).toBe("hello");
  });

  it("skips shrink guard when allowShrink is true", async () => {
    const filePath = join(testDir, "allow-shrink.md");
    const existingContent = "x".repeat(1000);
    writeFileSync(filePath, existingContent);

    const tool = createWriteTool(testDir, { allowShrink: true });
    const newContent = "y".repeat(100); // 10% — would normally be blocked
    const result = await tool.execute("test-id", {
      path: "allow-shrink.md",
      content: newContent,
    });

    // Should succeed without blocking
    expect(result.content[0].text).toContain("Wrote");
    expect(result.content[0].text).not.toContain("BLOCKED");
    expect(readFileSync(filePath, "utf-8")).toBe(newContent);
  });

  it("allows growing writes (new content larger than existing)", async () => {
    const filePath = join(testDir, "growing.md");
    writeFileSync(filePath, "x".repeat(500));

    const tool = createWriteTool(testDir);
    const newContent = "y".repeat(2000);
    const result = await tool.execute("test-id", {
      path: "growing.md",
      content: newContent,
    });

    expect(result.content[0].text).toContain("Wrote");
    expect(result.content[0].text).not.toContain("BLOCKED");
    expect(result.content[0].text).not.toContain("WARNING");
    expect(readFileSync(filePath, "utf-8")).toBe(newContent);
  });

  it("blocks at exactly 49% ratio", async () => {
    const filePath = join(testDir, "exact-49.md");
    writeFileSync(filePath, "x".repeat(1000));

    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "exact-49.md",
      content: "y".repeat(490), // 49%
    });

    expect(result.content[0].text).toContain("WRITE BLOCKED");
    // Original preserved
    expect(readFileSync(filePath, "utf-8")).toBe("x".repeat(1000));
  });

  it("warns at exactly 50% ratio (boundary)", async () => {
    const filePath = join(testDir, "exact-50.md");
    writeFileSync(filePath, "x".repeat(1000));

    const tool = createWriteTool(testDir);
    const newContent = "y".repeat(500); // exactly 50%
    const result = await tool.execute("test-id", {
      path: "exact-50.md",
      content: newContent,
    });

    // 50% is >= BLOCK threshold (0.5), so NOT blocked, but < WARN threshold (0.8)
    expect(result.content[0].text).toContain("Wrote");
    expect(result.content[0].text).toContain("WARNING");
    expect(readFileSync(filePath, "utf-8")).toBe(newContent);
  });
});

describe("write tool diff preview", () => {
  const testDir = join(tmpdir(), `write-diff-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("shows unified diff when overwriting an existing file", async () => {
    const filePath = join(testDir, "overwrite-diff.ts");
    writeFileSync(filePath, "const x = 1;\nconst y = 2;\n");

    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "overwrite-diff.ts",
      content: "const x = 1;\nconst y = 99;\n",
    });

    const text = result.content[0].text;
    expect(text).toContain("overwrite");
    expect(text).toContain("```diff");
    // Should show removed and added lines
    expect(text).toMatch(/-.*const y = 2/);
    expect(text).toMatch(/\+.*const y = 99/);
    expect(text).toContain("Inspect the diff above");
  });

  it("shows content preview for new files (not diff)", async () => {
    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "brand-new.ts",
      content: "const hello = 'world';\n",
    });

    const text = result.content[0].text;
    // Should NOT say "overwrite"
    expect(text).not.toContain("overwrite");
    // Should show content preview, not diff
    expect(text).not.toContain("```diff");
    expect(text).toContain("```");
    expect(text).toContain("const hello = 'world'");
    expect(text).toContain("Inspect the content above");
  });

  it("truncates large diffs at 60 lines", async () => {
    const filePath = join(testDir, "large-diff.ts");
    // Create a file with many lines
    const oldLines = Array.from({ length: 100 }, (_, i) => `const line${i} = ${i};`);
    writeFileSync(filePath, oldLines.join("\n") + "\n");

    const tool = createWriteTool(testDir);
    // Change every line to trigger a large diff
    const newLines = Array.from({ length: 100 }, (_, i) => `const line${i} = ${i * 10};`);
    const result = await tool.execute("test-id", {
      path: "large-diff.ts",
      content: newLines.join("\n") + "\n",
    });

    const text = result.content[0].text;
    expect(text).toContain("overwrite");
    expect(text).toContain("```diff");
    expect(text).toContain("diff truncated");
    expect(text).toContain("Diff truncated. Inspect the changes above");
  });

  it("shows diff with correct + and - markers for overwrites", async () => {
    const filePath = join(testDir, "markers.ts");
    writeFileSync(filePath, "line1\nline2\nline3\n");

    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "markers.ts",
      content: "line1\nmodified\nline3\n",
    });

    const text = result.content[0].text;
    // Should have - for removed line and + for added line
    expect(text).toMatch(/-.*line2/);
    expect(text).toMatch(/\+.*modified/);
    // Unchanged lines should be present as context
    expect(text).toContain("line1");
    expect(text).toContain("line3");
  });

  it("overwrite of identical content shows empty diff", async () => {
    const filePath = join(testDir, "identical.ts");
    const content = "const same = true;\n";
    writeFileSync(filePath, content);

    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "identical.ts",
      content: content,
    });

    const text = result.content[0].text;
    // Still an overwrite (file existed)
    expect(text).toContain("overwrite");
    expect(text).toContain("```diff");
    // But diff should be essentially empty (no + or - lines)
    expect(text).not.toMatch(/^[-+]\s*\d+/m);
  });
});
