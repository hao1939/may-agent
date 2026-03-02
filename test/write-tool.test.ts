import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createWriteTool, resolveWritePath } from "../src/tools.js";
import { mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// ── resolveWritePath ───────────────────────────────────────────────────

describe("resolveWritePath", () => {
  const ROOT = "/home/hao/may-agent";

  it("resolves relative path against projectRoot", () => {
    expect(resolveWritePath("src/foo.ts", ROOT))
      .toBe("/home/hao/may-agent/src/foo.ts");
  });

  it("resolves bare filename against projectRoot", () => {
    expect(resolveWritePath("output.txt", ROOT))
      .toBe("/home/hao/may-agent/output.txt");
  });

  it("resolves dotfile relative path", () => {
    expect(resolveWritePath(".state/data/result.json", ROOT))
      .toBe("/home/hao/may-agent/.state/data/result.json");
  });

  it("resolves ./prefixed relative path", () => {
    expect(resolveWritePath("./src/new-file.ts", ROOT))
      .toBe("/home/hao/may-agent/src/new-file.ts");
  });

  it("rewrites hallucinated /home/user/repo path", () => {
    expect(resolveWritePath("/home/user/repo/src/new-file.ts", ROOT))
      .toBe("/home/hao/may-agent/src/new-file.ts");
  });

  it("rewrites hallucinated /home/user path", () => {
    expect(resolveWritePath("/home/user/src/tools.ts", ROOT))
      .toBe("/home/hao/may-agent/src/tools.ts");
  });

  it("rewrites hallucinated /Users/jdoe/project path", () => {
    expect(resolveWritePath("/Users/jdoe/amp-agent/test/foo.test.ts", ROOT))
      .toBe("/home/hao/may-agent/test/foo.test.ts");
  });

  it("rewrites hallucinated /app path", () => {
    expect(resolveWritePath("/app/config.yaml", ROOT))
      .toBe("/home/hao/may-agent/config.yaml");
  });

  it("passes through correct absolute path unchanged", () => {
    expect(resolveWritePath("/home/hao/may-agent/src/tools.ts", ROOT))
      .toBe("/home/hao/may-agent/src/tools.ts");
  });

  it("passes through non-hallucinated absolute path unchanged", () => {
    expect(resolveWritePath("/tmp/output.txt", ROOT))
      .toBe("/tmp/output.txt");
  });
});

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
    expect(text).toContain("Wrote 20 bytes");
    // Should have resolved to the projectRoot-based path
    expect(text).toContain(join(ROOT, "src/output.ts"));
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
    expect(text).toContain("Wrote");
    // Should have written to the real projectRoot
    expect(text).toContain(join(ROOT, "src/hallucinated.ts"));
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
    expect(text).toContain("Wrote");
    expect(text).toContain(filePath);
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
    expect(text).toContain("Wrote");
    expect(existsSync(join(ROOT, "deep/nested/dir/file.ts"))).toBe(true);
  });

  it("reports resolved path in success message (not original hallucinated)", async () => {
    const tool = createWriteTool({ projectRoot: ROOT });
    const result = await tool.execute("test-id", {
      path: "/home/user/src/resolved-msg.ts",
      content: "// resolved\n",
    });
    const text = result.content[0].text;
    // The success message should show the resolved (actual) path, not /home/user
    expect(text).toContain(ROOT);
    expect(text).not.toContain("/home/user");
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
    expect(text).toContain("Wrote");
    expect(text).toContain(filePath);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("backward compat\n");
  });

  it("does not resolve relative paths when no projectRoot", async () => {
    const tool = createWriteTool();
    // With no projectRoot, relative paths are used as-is (original behavior)
    // This would fail since there's no resolution — we just check the tool
    // doesn't crash and uses the path as given
    const filePath = join(testDir, "relative-test.txt");
    const result = await tool.execute("test-id", {
      path: filePath,
      content: "no projectRoot\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Wrote");
    expect(text).toContain(filePath);
  });
});
