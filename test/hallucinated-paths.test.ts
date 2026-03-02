import { describe, it, expect } from "vitest";
import { rewriteHallucinatedPath, rewriteHallucinatedCommand, extractHallucinatedRelPath, createReadTool, createExecTool, resolveReadPath } from "../src/tools.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
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

  it("returns empty string for bare /home/user", () => {
    expect(extractHallucinatedRelPath("/home/user")).toBe("");
  });

  it("returns null for real paths like /home/example-user/may-agent", () => {
    expect(extractHallucinatedRelPath("/home/example-user/may-agent")).toBe(null);
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

// ── rewriteHallucinatedPath ────────────────────────────────────────────

describe("rewriteHallucinatedPath", () => {
  const ROOT = "/home/example-user/may-agent";

  it("rewrites /home/user/src/tools.ts to project root", () => {
    expect(rewriteHallucinatedPath("/home/user/src/tools.ts", ROOT))
      .toBe("/home/example-user/may-agent/src/tools.ts");
  });

  it("rewrites /home/user/repo/test/max-turns.test.ts", () => {
    expect(rewriteHallucinatedPath("/home/user/repo/test/max-turns.test.ts", ROOT))
      .toBe("/home/example-user/may-agent/test/max-turns.test.ts");
  });

  it("rewrites /home/user/repos/cora/src/manager.ts", () => {
    expect(rewriteHallucinatedPath("/home/user/repos/cora/src/manager.ts", ROOT))
      .toBe("/home/example-user/may-agent/src/manager.ts");
  });

  it("rewrites /Users/jdoe/amp-agent/.state/evaluations/", () => {
    expect(rewriteHallucinatedPath("/Users/jdoe/amp-agent/.state/evaluations/", ROOT))
      .toBe("/home/example-user/may-agent/.state/evaluations/");
  });

  it("rewrites /app/config.yaml", () => {
    expect(rewriteHallucinatedPath("/app/config.yaml", ROOT))
      .toBe("/home/example-user/may-agent/config.yaml");
  });

  it("rewrites bare /home/user to project root", () => {
    expect(rewriteHallucinatedPath("/home/user", ROOT))
      .toBe("/home/example-user/may-agent");
  });

  it("does NOT rewrite the actual project root", () => {
    expect(rewriteHallucinatedPath("/home/example-user/may-agent/src/tools.ts", ROOT))
      .toBe("/home/example-user/may-agent/src/tools.ts");
  });

  it("does NOT rewrite the exact project root", () => {
    expect(rewriteHallucinatedPath("/home/example-user/may-agent", ROOT))
      .toBe("/home/example-user/may-agent");
  });

  it("does NOT rewrite non-hallucinated paths like /etc/config", () => {
    expect(rewriteHallucinatedPath("/etc/config", ROOT))
      .toBe("/etc/config");
  });

  it("does NOT rewrite relative paths", () => {
    expect(rewriteHallucinatedPath("src/tools.ts", ROOT))
      .toBe("src/tools.ts");
  });
});

// ── rewriteHallucinatedCommand ─────────────────────────────────────────

describe("rewriteHallucinatedCommand", () => {
  const ROOT = "/home/example-user/may-agent";

  it("rewrites find /home/user -name foo", () => {
    expect(rewriteHallucinatedCommand("find /home/user -name foo", ROOT))
      .toBe("find /home/example-user/may-agent -name foo");
  });

  it("rewrites cd /home/user && git log", () => {
    expect(rewriteHallucinatedCommand("cd /home/user && git log", ROOT))
      .toBe("cd /home/example-user/may-agent && git log");
  });

  it("rewrites grep -r pattern /home/user/src --include=*.ts", () => {
    expect(rewriteHallucinatedCommand('grep -r "maxTurns" /home/user --include="*.ts" -l', ROOT))
      .toBe('grep -r "maxTurns" /home/example-user/may-agent --include="*.ts" -l');
  });

  it("rewrites ls /home/user/.state/staged/proposals/", () => {
    expect(rewriteHallucinatedCommand("ls -la /home/user/.state/staged/proposals/", ROOT))
      .toBe("ls -la /home/example-user/may-agent/.state/staged/proposals/");
  });

  it("rewrites /Users/jdoe/amp-agent/.state/evaluations/", () => {
    expect(rewriteHallucinatedCommand('find /Users/jdoe/amp-agent/.state/evaluations/ -type f -name "*.json"', ROOT))
      .toBe('find /home/example-user/may-agent/.state/evaluations/ -type f -name "*.json"');
  });

  it("rewrites /home/user/repos/cora/src paths", () => {
    expect(rewriteHallucinatedCommand('grep -r "maxTurns" /home/user/repos/cora/src --include="*.ts" -l', ROOT))
      .toBe('grep -r "maxTurns" /home/example-user/may-agent/src --include="*.ts" -l');
  });

  it("rewrites /app/ paths", () => {
    expect(rewriteHallucinatedCommand("cat /app/config.yaml", ROOT))
      .toBe("cat /home/example-user/may-agent/config.yaml");
  });

  it("does NOT rewrite the actual project root path", () => {
    const cmd = "find /home/example-user/may-agent/src -name foo";
    expect(rewriteHallucinatedCommand(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT rewrite relative paths", () => {
    const cmd = "find . -name foo";
    expect(rewriteHallucinatedCommand(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT rewrite unrelated absolute paths like /var/log", () => {
    const cmd = "tail -f /var/log/syslog";
    expect(rewriteHallucinatedCommand(cmd, ROOT)).toBe(cmd);
  });

  it("handles multiple hallucinated paths in one command", () => {
    expect(rewriteHallucinatedCommand("diff /home/user/src/a.ts /home/user/src/b.ts", ROOT))
      .toBe("diff /home/example-user/may-agent/src/a.ts /home/example-user/may-agent/src/b.ts");
  });
});

// ── resolveReadPath ────────────────────────────────────────────────────

describe("resolveReadPath", () => {
  const ROOT = "/home/example-user/may-agent";

  it("resolves relative path against projectRoot", () => {
    expect(resolveReadPath("src/tools.ts", ROOT))
      .toBe("/home/example-user/may-agent/src/tools.ts");
  });

  it("resolves bare filename against projectRoot", () => {
    expect(resolveReadPath("package.json", ROOT))
      .toBe("/home/example-user/may-agent/package.json");
  });

  it("resolves dotfile relative path", () => {
    expect(resolveReadPath(".state/evaluations/foo.json", ROOT))
      .toBe("/home/example-user/may-agent/.state/evaluations/foo.json");
  });

  it("resolves ./prefixed relative path", () => {
    expect(resolveReadPath("./src/tools.ts", ROOT))
      .toBe("/home/example-user/may-agent/src/tools.ts");
  });

  it("resolves nested relative path with ../", () => {
    // resolve("root", "../other") goes up one level
    expect(resolveReadPath("../other/file.ts", ROOT))
      .toBe(resolve(ROOT, "../other/file.ts"));
  });

  it("rewrites hallucinated absolute path", () => {
    expect(resolveReadPath("/home/user/repo/src/tools.ts", ROOT))
      .toBe("/home/example-user/may-agent/src/tools.ts");
  });

  it("passes through correct absolute path unchanged", () => {
    expect(resolveReadPath("/home/example-user/may-agent/src/tools.ts", ROOT))
      .toBe("/home/example-user/may-agent/src/tools.ts");
  });

  it("passes through non-hallucinated absolute path unchanged", () => {
    expect(resolveReadPath("/etc/hosts", ROOT))
      .toBe("/etc/hosts");
  });
});

// ── Integration: read tool with hallucinated path rewriting ────────────

describe("read tool hallucinated path rewriting", () => {
  const testDir = join(tmpdir(), `hallucinated-read-test-${Date.now()}`);
  const ROOT = testDir;

  it("rewrites /home/user/repo/<file> to project root and reads successfully", async () => {
    // Create a test file at the project root
    mkdirSync(join(ROOT, "src"), { recursive: true });
    writeFileSync(join(ROOT, "src/test.txt"), "hello world", "utf-8");

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: "/home/user/repo/src/test.txt" });
    expect(result.content[0].text).toBe("hello world");

    // Cleanup
    rmSync(ROOT, { recursive: true, force: true });
  });

  it("still returns ENOENT with hint if rewritten path also doesn't exist", async () => {
    mkdirSync(ROOT, { recursive: true });

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: "/home/user/repo/nonexistent.ts" });
    expect(result.content[0].text).toContain("Error reading file:");
    expect(result.content[0].text).toContain("ENOENT");
    expect(result.content[0].text).toContain("Hint:");

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

  it("returns ENOENT with hint for non-existent relative path", async () => {
    mkdirSync(ROOT, { recursive: true });

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: "nonexistent/file.ts" });
    expect(result.content[0].text).toContain("Error reading file:");
    expect(result.content[0].text).toContain("ENOENT");
    expect(result.content[0].text).toContain("Hint:");

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("reads nested .state path via relative path", async () => {
    mkdirSync(join(ROOT, ".state", "evaluations"), { recursive: true });
    writeFileSync(join(ROOT, ".state/evaluations/test.json"), '{"score":1}', "utf-8");

    const tool = createReadTool({ projectRoot: ROOT });
    const result = await tool.execute("id", { path: ".state/evaluations/test.json" });
    expect(result.content[0].text).toBe('{"score":1}');

    rmSync(ROOT, { recursive: true, force: true });
  });

  it("relative path without projectRoot falls back to cwd resolution", async () => {
    // Without projectRoot, relative paths resolve from process.cwd()
    const tool = createReadTool();
    const result = await tool.execute("id", { path: "src/tools.ts" });
    // Should either work (if cwd has src/tools.ts) or fail with ENOENT (no hint)
    const text = result.content[0].text;
    // Since we're running from the project root, this should read the file
    // (can't check "not contains Error" because the file source itself has that string)
    expect(text).toContain("import");
    expect(text.startsWith("Error reading file:")).toBe(false);
  });
});

// ── Integration: exec tool with hallucinated path rewriting ────────────

describe("exec tool hallucinated path rewriting", () => {
  it("rewrites hallucinated paths in exec commands when warnOutsideRoot is set", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      warnOutsideRoot: "/tmp",
    });

    // /home/user → should be rewritten to /tmp
    const result = await tool.execute("id", { command: "echo /home/user" });
    // The echo output should contain the rewritten path
    expect(result.content[0].text).toContain("/tmp");
  });

  it("does not rewrite when warnOutsideRoot is not set", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    // Without warnOutsideRoot, no rewriting happens
    const result = await tool.execute("id", { command: "echo /home/user" });
    expect(result.content[0].text).toContain("/home/user");
  });

  it("rewriting + stripRedundantCd work together", async () => {
    const ROOT = "/home/example-user/may-agent";
    const tool = createExecTool({
      cwd: ROOT,
      warnOutsideRoot: ROOT,
    });
    // cd /home/user && echo test → stripRedundantCd doesn't match (different root),
    // but rewriteHallucinatedCommand rewrites /home/user to /home/example-user/may-agent,
    // then stripRedundantCd strips the now-matching cd prefix
    // Actually: stripRedundantCd runs first, then rewrite. So cd /home/user stays,
    // then rewrite makes it cd /home/example-user/may-agent. Let's verify it works:
    const result = await tool.execute("id", { command: "cd /home/user && echo success" });
    // The command should work because /home/user is rewritten to the actual CWD
    expect(result.content[0].text).toContain("success");
  });
});
