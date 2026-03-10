import { describe, it, expect } from "vitest";
import { createBashTool } from "../src/lib/tools/bash.js";
import { isMetaRecursionCommand } from "../src/lib/tools/may-utils.js";

describe("createBashTool", () => {
  it("executes a simple command and returns output", async () => {
    const tool = createBashTool("/tmp");
    const result = await tool.execute("id", { command: "echo hello" });
    expect(result.content[0].text).toContain("hello");
  });

  it("returns non-zero exit code as error", async () => {
    const tool = createBashTool("/tmp");
    await expect(
      tool.execute("id", { command: "ls /nonexistent_path_xyz_12345" })
    ).rejects.toThrow(/exited with code/);
  });

  it("returns (no output) for empty stdout", async () => {
    const tool = createBashTool("/tmp");
    const result = await tool.execute("id", { command: "true" });
    expect(result.content[0].text).toBe("(no output)");
  });

  it("respects timeout parameter", async () => {
    const tool = createBashTool("/tmp");
    await expect(
      tool.execute("id", { command: "sleep 30", timeout: 1 })
    ).rejects.toThrow(/timed out/);
  });

  it("captures stderr in output", async () => {
    const tool = createBashTool("/tmp");
    await expect(
      tool.execute("id", { command: "echo error >&2; exit 1" })
    ).rejects.toThrow(/error/);
  });

  it("handles multi-line script", async () => {
    const tool = createBashTool("/tmp");
    const result = await tool.execute("id", {
      command: `
        for i in 1 2 3; do
          echo "line \$i"
        done
      `,
    });
    expect(result.content[0].text).toContain("line 1");
    expect(result.content[0].text).toContain("line 3");
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
