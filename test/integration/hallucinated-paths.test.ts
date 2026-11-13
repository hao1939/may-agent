import { describe, it, expect } from "bun:test";
import { createReadTool } from "../../src/lib/tools/read.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Integration: read tool with relative path resolution ───────────────

describe("read tool relative path resolution", () => {
  const testDir = join(tmpdir(), `relative-read-test-${Date.now()}`);
  const ROOT = testDir;

  it("reads file via relative path", async () => {
    mkdirSync(join(ROOT, "src"), { recursive: true });
    writeFileSync(join(ROOT, "src/hello.txt"), "relative works", "utf-8");

    const tool = createReadTool(ROOT);
    const result = await tool.execute("id", { path: "src/hello.txt" });
    expect(result.content[0].text).toBe("relative works");

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("reads file via ./prefixed relative path", async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, "readme.md"), "dot-slash works", "utf-8");

    const tool = createReadTool(ROOT);
    const result = await tool.execute("id", { path: "./readme.md" });
    expect(result.content[0].text).toBe("dot-slash works");

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("reads bare filename against cwd", async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, "package.json"), '{"name":"test"}', "utf-8");

    const tool = createReadTool(ROOT);
    const result = await tool.execute("id", { path: "package.json" });
    expect(result.content[0].text).toBe('{"name":"test"}');

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("returns error for non-existent file", async () => {
    mkdirSync(ROOT, { recursive: true });
    const tool = createReadTool(ROOT);
    await expect(tool.execute("id", { path: "nonexistent.ts" })).rejects.toThrow();
    rmSync(ROOT, { recursive: true, force: true });
  });
});
