import { describe, it, expect } from "vitest";
import { rewriteHallucinatedPath, rewriteHallucinatedCommand, extractHallucinatedRelPath, createReadTool, createExecTool } from "../src/tools.js";
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

  it("returns empty string for bare /home/user", () => {
    expect(extractHallucinatedRelPath("/home/user")).toBe("");
  });

  it("returns null for real paths like /home/hao/may-agent", () => {
    expect(extractHallucinatedRelPath("/home/hao/may-agent")).toBe(null);
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
  const ROOT = "/home/hao/may-agent";

  it("rewrites /home/user/src/tools.ts to project root", () => {
    expect(rewriteHallucinatedPath("/home/user/src/tools.ts", ROOT))
      .toBe("/home/hao/may-agent/src/tools.ts");
  });

  it("rewrites /home/user/repo/test/max-turns.test.ts", () => {
    expect(rewriteHallucinatedPath("/home/user/repo/test/max-turns.test.ts", ROOT))
      .toBe("/home/hao/may-agent/test/max-turns.test.ts");
  });

  it("rewrites /home/user/repos/cora/src/manager.ts", () => {
    expect(rewriteHallucinatedPath("/home/user/repos/cora/src/manager.ts", ROOT))
      .toBe("/home/hao/may-agent/src/manager.ts");
  });

  it("rewrites /Users/jdoe/amp-agent/.state/evaluations/", () => {
    expect(rewriteHallucinatedPath("/Users/jdoe/amp-agent/.state/evaluations/", ROOT))
      .toBe("/home/hao/may-agent/.state/evaluations/");
  });

  it("rewrites /app/config.yaml", () => {
    expect(rewriteHallucinatedPath("/app/config.yaml", ROOT))
      .toBe("/home/hao/may-agent/config.yaml");
  });

  it("rewrites bare /home/user to project root", () => {
    expect(rewriteHallucinatedPath("/home/user", ROOT))
      .toBe("/home/hao/may-agent");
  });

  it("does NOT rewrite the actual project root", () => {
    expect(rewriteHallucinatedPath("/home/hao/may-agent/src/tools.ts", ROOT))
      .toBe("/home/hao/may-agent/src/tools.ts");
  });

  it("does NOT rewrite the exact project root", () => {
    expect(rewriteHallucinatedPath("/home/hao/may-agent", ROOT))
      .toBe("/home/hao/may-agent");
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
  const ROOT = "/home/hao/may-agent";

  it("rewrites find /home/user -name foo", () => {
    expect(rewriteHallucinatedCommand("find /home/user -name foo", ROOT))
      .toBe("find /home/hao/may-agent -name foo");
  });

  it("rewrites cd /home/user && git log", () => {
    expect(rewriteHallucinatedCommand("cd /home/user && git log", ROOT))
      .toBe("cd /home/hao/may-agent && git log");
  });

  it("rewrites grep -r pattern /home/user/src --include=*.ts", () => {
    expect(rewriteHallucinatedCommand('grep -r "maxTurns" /home/user --include="*.ts" -l', ROOT))
      .toBe('grep -r "maxTurns" /home/hao/may-agent --include="*.ts" -l');
  });

  it("rewrites ls /home/user/.state/staged/proposals/", () => {
    expect(rewriteHallucinatedCommand("ls -la /home/user/.state/staged/proposals/", ROOT))
      .toBe("ls -la /home/hao/may-agent/.state/staged/proposals/");
  });

  it("rewrites /Users/jdoe/amp-agent/.state/evaluations/", () => {
    expect(rewriteHallucinatedCommand('find /Users/jdoe/amp-agent/.state/evaluations/ -type f -name "*.json"', ROOT))
      .toBe('find /home/hao/may-agent/.state/evaluations/ -type f -name "*.json"');
  });

  it("rewrites /home/user/repos/cora/src paths", () => {
    expect(rewriteHallucinatedCommand('grep -r "maxTurns" /home/user/repos/cora/src --include="*.ts" -l', ROOT))
      .toBe('grep -r "maxTurns" /home/hao/may-agent/src --include="*.ts" -l');
  });

  it("rewrites /app/ paths", () => {
    expect(rewriteHallucinatedCommand("cat /app/config.yaml", ROOT))
      .toBe("cat /home/hao/may-agent/config.yaml");
  });

  it("does NOT rewrite the actual project root path", () => {
    const cmd = "find /home/hao/may-agent/src -name foo";
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
      .toBe("diff /home/hao/may-agent/src/a.ts /home/hao/may-agent/src/b.ts");
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
    const ROOT = "/home/hao/may-agent";
    const tool = createExecTool({
      cwd: ROOT,
      warnOutsideRoot: ROOT,
    });
    // cd /home/user && echo test → stripRedundantCd doesn't match (different root),
    // but rewriteHallucinatedCommand rewrites /home/user to /home/hao/may-agent,
    // then stripRedundantCd strips the now-matching cd prefix
    // Actually: stripRedundantCd runs first, then rewrite. So cd /home/user stays,
    // then rewrite makes it cd /home/hao/may-agent. Let's verify it works:
    const result = await tool.execute("id", { command: "cd /home/user && echo success" });
    // The command should work because /home/user is rewritten to the actual CWD
    expect(result.content[0].text).toContain("success");
  });
});
