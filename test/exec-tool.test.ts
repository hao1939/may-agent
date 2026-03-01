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
      denyPatterns: [/\bfind\s+\/(?!\w)/],
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
      denyPatterns: [/\bfind\s+\/(?!\w)/],
    });
    const result = await tool.execute("id", { command: "find ./src -name foo" });
    // Should not be blocked — "find ./src" doesn't match "find /"
    expect(result.content[0].text).not.toContain("Blocked");
  });

  it("blocks find /home pattern", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/home\b/],
    });
    const result = await tool.execute("id", { command: "find /home -name package.json" });
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
      denyPatterns: [/\bfind\s+\/(?!\w)/],
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
        /\bfind\s+\/(?!\w)/,
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
