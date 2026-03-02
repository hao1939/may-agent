import { describe, it, expect } from "vitest";
import { createExecTool, stripRedundantCd, detectsOutsidePaths } from "../src/tools.js";
import type { ExecToolOptions } from "../src/tools.js";

describe("createExecTool with options", () => {
  it("accepts a string cwd (backward compat)", async () => {
    const tool = createExecTool("/tmp");
    const result = await tool.execute("id", { command: "pwd" });
    expect(result.content[0].text).toContain("/tmp");
  });

  it("accepts an ExecToolOptions object", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "pwd" });
    expect(result.content[0].text).toContain("/tmp");
  });

  it("blocks commands matching denyPatterns", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
      denyMessage: "No global searches allowed.",
    });
    const result = await tool.execute("id", { command: "find / -name foo" });
    expect(result.content[0].text).toContain("Blocked");
    expect(result.content[0].text).toContain("No global searches allowed");
    expect(result.content[0].text).toContain("/tmp");
  });

  it("allows commands that don't match denyPatterns", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });
    const result = await tool.execute("id", { command: "find ./src -name foo" });
    // Should not be blocked — "find ./src" doesn't match "find /"
    expect(result.content[0].text).not.toContain("Blocked");
  });

  it("allows find with specific absolute paths", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });

    // "find /tmp" — specific dir, should be allowed
    const r1 = await tool.execute("id1", { command: "find /tmp -name foo" });
    expect(r1.content[0].text).not.toContain("Blocked");

    // "find /.hidden" — specific dir starting with dot, should be allowed
    const r2 = await tool.execute("id2", { command: "find /.hidden -name foo" });
    expect(r2.content[0].text).not.toContain("Blocked");

    // "find /var-log" — specific dir with hyphen, should be allowed
    const r3 = await tool.execute("id3", { command: "find /var-log -name foo" });
    expect(r3.content[0].text).not.toContain("Blocked");
  });

  it("blocks find / with flags", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });

    // "find / -maxdepth 3" — root traversal with flags, should be blocked
    const result = await tool.execute("id", { command: "find / -maxdepth 3 -name foo" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("blocks find / at end of command", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });

    // "find /" at end of string — should be blocked
    const result = await tool.execute("id", { command: "find /" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("blocks find /home pattern", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/home\b/],
    });
    const result = await tool.execute("id", { command: "find /home -name package.json" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("blocks sudo find / pattern", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bsudo\s+find\s+\/\s*(?:$|[;&|]|-)/],
    });
    const result = await tool.execute("id", { command: "sudo find / -name foo" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("echoes cwd on every exec call when echoCwd is true", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      echoCwd: true,
    });

    // First call should include CWD
    const result1 = await tool.execute("id1", { command: "echo hello" });
    expect(result1.content[0].text).toContain("CWD: /tmp");
    expect(result1.content[0].text).toContain("hello");

    // Second call should also include CWD
    const result2 = await tool.execute("id2", { command: "echo world" });
    expect(result2.content[0].text).toContain("CWD: /tmp");
    expect(result2.content[0].text).toContain("world");
  });

  it("echoes cwd on error output when echoCwd is true", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      echoCwd: true,
    });

    // Command that will fail with non-zero exit code
    const result = await tool.execute("id", { command: "ls /nonexistent_path_xyz_12345" });
    const text = result.content[0].text;
    // Should include CWD even on error
    expect(text).toContain("CWD: /tmp");
    // Should also include the error
    expect(text).toContain("Exit code");
  });

  it("does not echo cwd when echoCwd is false or unset", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "echo hello" });
    expect(result.content[0].text).not.toContain("CWD:");
  });

  it("does not echo cwd on error when echoCwd is false", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "ls /nonexistent_path_xyz_12345" });
    expect(result.content[0].text).not.toContain("CWD:");
  });

  it("shows cwd hint in deny message", async () => {
    const tool = createExecTool({
      cwd: "/my/project",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });
    const result = await tool.execute("id", { command: "find / -type f" });
    expect(result.content[0].text).toContain("/my/project");
  });

  it("works with no options (defaults)", async () => {
    const tool = createExecTool();
    const result = await tool.execute("id", { command: "echo ok" });
    expect(result.content[0].text).toContain("ok");
  });

  it("blocks multiple deny patterns", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [
        /\bfind\s+\/\s*(?:$|[;&|]|-)/,
        /\bfind\s+\/home\b/,
        /\bsudo\b/,
      ],
    });

    const r1 = await tool.execute("id1", { command: "find / -name x" });
    expect(r1.content[0].text).toContain("Blocked");

    const r2 = await tool.execute("id2", { command: "find /home -name y" });
    expect(r2.content[0].text).toContain("Blocked");

    const r3 = await tool.execute("id3", { command: "sudo rm -rf /" });
    expect(r3.content[0].text).toContain("Blocked");

    const r4 = await tool.execute("id4", { command: "ls -la" });
    expect(r4.content[0].text).not.toContain("Blocked");
  });
});

describe("warnOutsideRoot", () => {
  const ROOT = "/home/hao/may-agent";

  it("rewrites /home/user to project root (hallucinated path auto-correction)", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    // /home/user is a hallucinated path — it gets rewritten to ROOT
    // The command becomes: find /home/hao/may-agent -name foo
    // After rewriting, no WARNING is needed since the path is now correct
    const result = await tool.execute("id", { command: "find /home/user -name foo" });
    // Should NOT contain warning — path was auto-corrected
    expect(result.content[0].text).not.toContain("WARNING:");
  });

  it("does not warn when command uses project-root path", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "find /home/hao/may-agent/src -name foo" });
    expect(result.content[0].text).not.toContain("WARNING:");
    expect(result.content[0].text).not.toContain("outside the project root");
  });

  it("does not warn when command uses relative paths", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "find . -name foo" });
    expect(result.content[0].text).not.toContain("WARNING:");
    expect(result.content[0].text).not.toContain("outside the project root");
  });

  it("does not warn when warnOutsideRoot is not set", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "find /home/user -name foo" });
    expect(result.content[0].text).not.toContain("WARNING:");
    expect(result.content[0].text).not.toContain("outside the project root");
  });

  it("rewrites /app/ paths to project root (hallucinated path auto-correction)", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    // /app/something is a hallucinated path — rewritten to ROOT/something
    // The ls will fail because ROOT/something doesn't exist, but the path is now correct
    const result = await tool.execute("id", { command: "ls /app/something" });
    const text = result.content[0].text;
    // Should reference the corrected project root path, not /app/
    expect(text).toContain(ROOT);
    // No outside-root warning because the path was auto-corrected
    expect(text).not.toContain("WARNING:");
  });

  it("rewritten hallucinated path appears in echo output", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    // echo /home/user/something → rewritten to echo /home/hao/may-agent/something
    const result = await tool.execute("id", { command: "echo /home/user/something" });
    const text = result.content[0].text;
    // The echo output should show the rewritten path
    expect(text).toContain(ROOT + "/something");
    // No WARNING because the hallucinated path was rewritten
    expect(text).not.toContain("WARNING:");
  });

  it("rewrites hallucinated paths even on non-zero exit code", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    // ls on a non-existent path under hallucinated root — will fail but with corrected path
    const result = await tool.execute("id", { command: "ls /home/user/nonexistent_path_xyz" });
    const text = result.content[0].text;
    // The error should reference the corrected project root, not /home/user
    expect(text).toContain(ROOT);
    // No WARNING because the path was rewritten
    expect(text).not.toContain("WARNING:");
  });

  it("warns on /tmp without trailing slash (not a hallucinated path)", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "ls /tmp" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });

  it("warns on /home without trailing slash (not a hallucinated path)", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "cd /home" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });

  it("rewrites --root=/home/user/x (hallucinated path in flag)", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    // --root=/home/user/x → rewritten to --root=/home/hao/may-agent/x
    const result = await tool.execute("id", { command: "echo --root=/home/user/x" });
    const text = result.content[0].text;
    expect(text).toContain(ROOT);
    expect(text).not.toContain("WARNING:");
  });

  it("warns on path-boundary sibling (not hallucinated)", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "ls /home/hao/may-agent-old" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });
});

describe("stripRedundantCd", () => {
  const ROOT = "/home/hao/may-agent";

  it("strips cd <root> && prefix", () => {
    expect(stripRedundantCd("cd /home/hao/may-agent && git log", ROOT))
      .toBe("git log");
  });

  it("strips cd <root>; prefix", () => {
    expect(stripRedundantCd("cd /home/hao/may-agent; git log", ROOT))
      .toBe("git log");
  });

  it("strips cd with quotes around path (double)", () => {
    expect(stripRedundantCd('cd "/home/hao/may-agent" && git log', ROOT))
      .toBe("git log");
  });

  it("strips cd with quotes around path (single)", () => {
    expect(stripRedundantCd("cd '/home/hao/may-agent' && git log", ROOT))
      .toBe("git log");
  });

  it("strips cd with leading whitespace", () => {
    expect(stripRedundantCd("  cd /home/hao/may-agent && ls", ROOT))
      .toBe("ls");
  });

  it("does NOT strip cd to a different directory", () => {
    const cmd = "cd /home/user && git log";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT strip cd to a subdirectory", () => {
    const cmd = "cd /home/hao/may-agent/src && ls";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT strip cd to parent directory", () => {
    const cmd = "cd /home/hao && ls";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT strip cd to sibling directory", () => {
    const cmd = "cd /home/hao/may-agent-old && ls";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT strip cd in the middle of a command", () => {
    const cmd = "echo hello && cd /home/hao/may-agent && ls";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("passes through commands without cd prefix", () => {
    expect(stripRedundantCd("git log", ROOT)).toBe("git log");
    expect(stripRedundantCd("ls -la", ROOT)).toBe("ls -la");
    expect(stripRedundantCd("echo hello", ROOT)).toBe("echo hello");
  });

  it("handles root path with special regex characters", () => {
    const specialRoot = "/home/user/my.project+1";
    expect(stripRedundantCd("cd /home/user/my.project+1 && ls", specialRoot))
      .toBe("ls");
  });
});

describe("stripRedundantCd integration with exec tool", () => {
  it("executes command after stripping cd prefix", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    // This would fail if the cd was actually executed (cd to /tmp then run echo)
    // but since cwd is /tmp and cd /tmp is stripped, it just runs "echo ok"
    const result = await tool.execute("id", { command: "cd /tmp && echo ok" });
    expect(result.content[0].text).toContain("ok");
  });

  it("deny patterns checked after stripping cd prefix", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });
    // cd /tmp && find / -name foo → stripped to: find / -name foo → blocked
    const result = await tool.execute("id", { command: "cd /tmp && find / -name foo" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("warnOutsideRoot checked after stripping cd prefix", async () => {
    const ROOT = "/home/hao/may-agent";
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    // cd <root> && echo hello → stripped to: echo hello → no warning
    const result = await tool.execute("id", { command: `cd ${ROOT} && echo hello` });
    const text = result.content[0].text;
    expect(text).toContain("hello");
    expect(text).not.toContain("WARNING:");
  });
});

describe("detectsOutsidePaths", () => {
  const ROOT = "/home/hao/may-agent";

  it("detects /home/user as outside root", () => {
    expect(detectsOutsidePaths("find /home/user -name foo", ROOT)).toBe(true);
  });

  it("does not detect project root as outside", () => {
    expect(detectsOutsidePaths("find /home/hao/may-agent/src -name foo", ROOT)).toBe(false);
  });

  it("detects /home/hao (parent of root) as outside", () => {
    expect(detectsOutsidePaths("cd /home/hao && ls", ROOT)).toBe(true);
  });

  it("does not flag relative paths", () => {
    expect(detectsOutsidePaths("find . -name foo", ROOT)).toBe(false);
  });

  it("detects /app as outside", () => {
    expect(detectsOutsidePaths("ls /app/something", ROOT)).toBe(true);
  });

  it("detects exact root as not-outside", () => {
    expect(detectsOutsidePaths("cd /home/hao/may-agent", ROOT)).toBe(false);
  });

  it("detects sibling directories as outside", () => {
    expect(detectsOutsidePaths("ls /home/hao/may-agent-old", ROOT)).toBe(true);
  });
});
