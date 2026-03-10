import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createWriteTool } from "../src/tools.js";
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Integration: write tool with projectRoot ───────────────────────────

describe("write tool with projectRoot", () => {
  const testDir = join(tmpdir(), `write-tool-test-${Date.now()}`);
  const ROOT = testDir;

  beforeAll(() => {
    mkdirSync(join(testDir, "src"), { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("writes to relative path resolved against projectRoot", async () => {
    const tool = createWriteTool({ projectRoot: ROOT });
    const result = await tool.execute("test-id", {
      path: "src/output.ts",
      content: "export const x = 1;\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("wrote");
    // Verify the file was actually created
    const content = readFileSync(join(ROOT, "src/output.ts"), "utf-8");
    expect(content).toBe("export const x = 1;\n");
  });

  it("rewrites hallucinated path and writes to correct location", async () => {
    const tool = createWriteTool({ projectRoot: ROOT });
    const result = await tool.execute("test-id", {
      path: "/home/user/repo/src/hallucinated.ts",
      content: "// hallucinated path test\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("wrote");
    const content = readFileSync(join(ROOT, "src/hallucinated.ts"), "utf-8");
    expect(content).toBe("// hallucinated path test\n");
  });

  it("writes to correct absolute path without rewriting", async () => {
    const tool = createWriteTool({ projectRoot: ROOT });
    const filePath = join(ROOT, "src/correct-abs.ts");
    const result = await tool.execute("test-id", {
      path: filePath,
      content: "// correct absolute\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("wrote");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("// correct absolute\n");
  });

  it("creates parent directories for new nested paths", async () => {
    const tool = createWriteTool({ projectRoot: ROOT });
    const result = await tool.execute("test-id", {
      path: "deep/nested/dir/file.ts",
      content: "// nested\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("wrote");
    expect(existsSync(join(ROOT, "deep/nested/dir/file.ts"))).toBe(true);
  });
});

// ── Backward compatibility: write tool without options ──────────────────

describe("write tool without options (backward compat)", () => {
  const testDir = join(tmpdir(), `write-tool-compat-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("works with no options (original behavior)", async () => {
    const tool = createWriteTool();
    const filePath = join(testDir, "compat.txt");
    const result = await tool.execute("test-id", {
      path: filePath,
      content: "backward compat\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("wrote");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("backward compat\n");
  });
});

// ── Write tool error handling ───────────────────────────────────────────

describe("write tool error handling", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "write-err-"));
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    writeFileSync(join(projectRoot, "src", "tools.ts"), "// tools");
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("returns error message when write fails", async () => {
    const tool = createWriteTool({ projectRoot });
    // Writing through an existing file (tools.ts is a file, not a dir)
    const result = await tool.execute("test-id", {
      path: join(projectRoot, "src", "tools.ts", "subdir", "file.ts"),
      content: "// will fail\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Error writing file:");
  });
});
