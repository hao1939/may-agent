import { describe, it, expect } from "vitest";
import { createExecTool, isMetaRecursionCommand } from "../src/tools.js";

describe("createExecTool", () => {
  it("executes a simple command and returns output", async () => {
    const tool = createExecTool({ projectRoot: "/tmp" });
    const result = await tool.execute("id", { command: "echo hello" });
    expect(result.content[0].text).toContain("hello");
  });

  it("works with no options (defaults)", async () => {
    const tool = createExecTool();
    const result = await tool.execute("id", { command: "echo ok" });
    expect(result.content[0].text).toContain("ok");
  });

  it("returns exit code on non-zero exit", async () => {
    const tool = createExecTool({ projectRoot: "/tmp" });
    const result = await tool.execute("id", { command: "ls /nonexistent_path_xyz_12345" });
    const text = result.content[0].text;
    expect(text).toContain("Exit code");
  });

  it("includes CWD in error output", async () => {
    const tool = createExecTool({ projectRoot: "/tmp" });
    const result = await tool.execute("id", { command: "ls /nonexistent_path_xyz_12345" });
    const text = result.content[0].text;
    expect(text).toContain("CWD: /tmp");
  });

  it("returns (no output) for empty stdout", async () => {
    const tool = createExecTool({ projectRoot: "/tmp" });
    const result = await tool.execute("id", { command: "true" });
    expect(result.content[0].text).toBe("(no output)");
  });

  it("respects timeout parameter", async () => {
    const tool = createExecTool({ projectRoot: "/tmp" });
    const result = await tool.execute("id", { command: "sleep 30", timeout: 1 });
    const text = result.content[0].text;
    // Timeout results in either an error message or a non-zero/null exit code
    expect(text).toMatch(/Error|Exit code/);
  });
});

describe("isMetaRecursionCommand", () => {
  it("detects npx may-agent", () => {
    expect(isMetaRecursionCommand("npx may-agent")).toBe(true);
  });

  it("detects may-agent with arguments", () => {
    expect(isMetaRecursionCommand("may-agent --agent optimizer")).toBe(true);
  });

  it("detects node dist/cli", () => {
    expect(isMetaRecursionCommand("node dist/cli.js")).toBe(true);
  });

  it("detects tsx src/cli", () => {
    expect(isMetaRecursionCommand("tsx src/cli.ts")).toBe(true);
  });

  it("detects ts-node src/cli", () => {
    expect(isMetaRecursionCommand("ts-node src/cli.ts")).toBe(true);
  });

  it("does NOT block normal commands", () => {
    expect(isMetaRecursionCommand("echo hello")).toBe(false);
    expect(isMetaRecursionCommand("ls -la")).toBe(false);
    expect(isMetaRecursionCommand("npx vitest --run")).toBe(false);
    expect(isMetaRecursionCommand("npx tsc --noEmit")).toBe(false);
    expect(isMetaRecursionCommand("node test.js")).toBe(false);
    expect(isMetaRecursionCommand("cat run/may.ts")).toBe(false);
  });
});
