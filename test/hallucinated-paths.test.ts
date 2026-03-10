import { describe, it, expect } from "vitest";
import { resolveHallucinatedPath, extractHallucinatedRelPath, createReadTool } from "../src/tools.js";
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

// ── resolveHallucinatedPath ────────────────────────────────────────────

describe("resolveHallucinatedPath", () => {
  const ROOT = "/home/hao/may-agent";

  it("rewrites /home/user/src/tools.ts to project root", () => {
    expect(resolveHallucinatedPath("/home/user/src/tools.ts", ROOT))
      .toBe("/home/hao/may-agent/src/tools.ts");
  });

  it("rewrites /home/user/repo/test/max-turns.test.ts", () => {
    expect(resolveHallucinatedPath("/home/user/repo/test/max-turns.test.ts", ROOT))
      .toBe("/home/hao/may-agent/test/max-turns.test.ts");
  });

  it("rewrites /home/user/repos/cora/src/manager.ts", () => {
    expect(resolveHallucinatedPath("/home/user/repos/cora/src/manager.ts", ROOT))
      .toBe("/home/hao/may-agent/src/manager.ts");
  });

  it("rewrites /Users/jdoe/amp-agent/.state/evaluations/", () => {
    expect(resolveHallucinatedPath("/Users/jdoe/amp-agent/.state/evaluations/", ROOT))
      .toBe("/home/hao/may-agent/.state/evaluations/");
  });

  it("rewrites /app/config.yaml", () => {
    expect(resolveHallucinatedPath("/app/config.yaml", ROOT))
      .toBe("/home/hao/may-agent/config.yaml");
  });

  it("rewrites bare /home/user to project root", () => {
    expect(resolveHallucinatedPath("/home/user", ROOT))
      .toBe("/home/hao/may-agent");
  });

  it("preserves the actual project root path (rewrite is identity)", () => {
    expect(resolveHallucinatedPath("/home/hao/may-agent/src/tools.ts", ROOT))
      .toBe("/home/hao/may-agent/src/tools.ts");
  });

  it("does NOT rewrite non-hallucinated paths like /etc/config", () => {
    expect(resolveHallucinatedPath("/etc/config", ROOT))
      .toBe("/etc/config");
  });

  it("does NOT rewrite relative paths", () => {
    expect(resolveHallucinatedPath("src/tools.ts", ROOT))
      .toBe("src/tools.ts");
  });
});

// ── Integration: read tool with hallucinated path rewriting ────────────

describe("read tool hallucinated path rewriting", () => {
  const testDir = join(tmpdir(), `hallucinated-read-test-${Date.now()}`);
  const ROOT = testDir;

  it("rewrites /home/user/repo/<file> to project root and reads successfully", async () => {
    mkdirSync(join(ROOT, "src"), { recursive: true });
    writeFileSync(join(ROOT, "src/test.txt"), "hello world", "utf-8");

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: "/home/user/repo/src/test.txt" });
    expect(result.content[0].text).toBe("hello world");

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("still returns error if rewritten path also doesn't exist", async () => {
    mkdirSync(ROOT, { recursive: true });

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: "/home/user/repo/nonexistent.ts" });
    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain("not found");

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("reads actual project root path without rewriting", async () => {
    mkdirSync(join(ROOT, "src"), { recursive: true });
    writeFileSync(join(ROOT, "src/real.txt"), "real content", "utf-8");

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: join(ROOT, "src/real.txt") });
    expect(result.content[0].text).toBe("real content");

    rmSync(ROOT, { recursive: true, force: true });
  });
});

// ── Integration: read tool with relative path resolution ───────────────

describe("read tool relative path resolution", () => {
  const testDir = join(tmpdir(), `relative-read-test-${Date.now()}`);
  const ROOT = testDir;

  it("reads file via relative path when projectRoot is set", async () => {
    mkdirSync(join(ROOT, "src"), { recursive: true });
    writeFileSync(join(ROOT, "src/hello.txt"), "relative works", "utf-8");

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: "src/hello.txt" });
    expect(result.content[0].text).toBe("relative works");

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("reads file via ./prefixed relative path", async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, "readme.md"), "dot-slash works", "utf-8");

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: "./readme.md" });
    expect(result.content[0].text).toBe("dot-slash works");

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("reads bare filename against projectRoot", async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, "package.json"), '{"name":"test"}', "utf-8");

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: "package.json" });
    expect(result.content[0].text).toBe('{"name":"test"}');

    rmSync(ROOT, { recursive: true, force: true });
  });
});
