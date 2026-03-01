import { describe, it, expect } from "vitest";
import { createExecTool } from "../src/tools.js";
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

  it("echoes cwd on first exec call when echoCwd is true", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      echoCwd: true,
    });

    // First call should include CWD
    const result1 = await tool.execute("id1", { command: "echo hello" });
    expect(result1.content[0].text).toContain("CWD: /tmp");
    expect(result1.content[0].text).toContain("hello");

    // Second call should NOT include CWD
    const result2 = await tool.execute("id2", { command: "echo world" });
    expect(result2.content[0].text).not.toContain("CWD:");
    expect(result2.content[0].text).toContain("world");
  });

  it("does not echo cwd when echoCwd is false or unset", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "echo hello" });
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
  const ROOT = "/home/example-user/may-agent";

  it("warns when command uses /home/user path", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "find /home/user -name foo" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
    expect(result.content[0].text).toContain(ROOT);
  });

  it("does not warn when command uses project-root path", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "find /home/example-user/may-agent/src -name foo" });
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

  it("warns on /app/ paths", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "ls /app/something" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });

  it("warning is appended to actual output, not replacing it", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    // echo produces output, and the command references an outside path
    const result = await tool.execute("id", { command: "echo hello && echo /home/user/something" });
    const text = result.content[0].text;
    // The echo output should be present
    expect(text).toContain("hello");
    // The warning should also be present
    expect(text).toContain("WARNING:");
    expect(text).toContain("outside the project root");
  });

  it("warns on non-zero exit code too", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    // ls on a non-existent outside path — will fail with non-zero exit
    const result = await tool.execute("id", { command: "ls /home/user/nonexistent_path_xyz" });
    const text = result.content[0].text;
    expect(text).toContain("WARNING:");
    expect(text).toContain("outside the project root");
  });

  it("warns on /tmp without trailing slash", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "ls /tmp" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });

  it("warns on /home without trailing slash", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "cd /home" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });

  it("warns on path after equals sign", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "--root=/home/user/x" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });

  it("warns on path-boundary sibling", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "ls /home/example-user/may-agent-old" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });
});
