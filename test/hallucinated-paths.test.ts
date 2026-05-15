import { describe, it, expect } from "bun:test";
import { extractHallucinatedRelPath } from "../src/lib/tools/may-utils.js";
import { createReadTool } from "../src/lib/tools/read.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── extractHallucinatedRelPath ─────────────────────────────────────────

describe("extractHallucinatedRelPath", () => {
  it("extracts relative path from /home/user/src/tools.ts", () => {
    expect(extractHallucinatedRelPath("/home/user/src/tools.ts")).toBe("/src/tools.ts");
  });

  it("extracts relative path from /home/user/repo/src/tools.ts", () => {
    expect(extractHallucinatedRelPath("/home/user/repo/src/tools.ts")).toBe("/src/tools.ts");
  });

  it("extracts relative path from /home/user/repos/my-project/src/tools.ts", () => {
    expect(extractHallucinatedRelPath("/home/user/repos/my-project/src/tools.ts")).toBe("/src/tools.ts");
  });

  it("extracts relative path from /Users/jdoe/amp-agent/src/tools.ts", () => {
    expect(extractHallucinatedRelPath("/Users/jdoe/amp-agent/src/tools.ts")).toBe("/src/tools.ts");
  });

  it("extracts relative path from /app/src/tools.ts", () => {
    expect(extractHallucinatedRelPath("/app/src/tools.ts")).toBe("/src/tools.ts");
  });

  it("returns / for bare /home/user (matches but no relative suffix)", () => {
    expect(extractHallucinatedRelPath("/home/user")).toBe("/");
  });

  it("returns null for relative paths", () => {
    expect(extractHallucinatedRelPath("src/tools.ts")).toBe(null);
  });

  it("returns null for /etc/config", () => {
    expect(extractHallucinatedRelPath("/etc/config")).toBe(null);
  });

  it("returns null for /tmp/test", () => {
    expect(extractHallucinatedRelPath("/tmp/test")).toBe(null);
  });
});

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
