import { describe, it, expect } from "bun:test";
import { createBashTool } from "@may-agent/sdk/runtime";

describe("createBashTool", () => {
  it("executes a simple command and returns output", async () => {
    const tool = createBashTool("/tmp");
    const result = await tool.execute("id", { command: "echo hello" });
    expect(result.content[0].text).toContain("hello");
  });

  it("returns non-zero exit code as error", async () => {
    const tool = createBashTool("/tmp");
    await expect(tool.execute("id", { command: "ls /nonexistent_path_xyz_12345" })).rejects.toThrow(/exited with code/);
  });

  it("returns (no output) for empty stdout", async () => {
    const tool = createBashTool("/tmp");
    const result = await tool.execute("id", { command: "true" });
    expect(result.content[0].text).toBe("(no output)");
  });

  it("captures stderr in output", async () => {
    const tool = createBashTool("/tmp");
    await expect(tool.execute("id", { command: "echo error >&2; exit 1" })).rejects.toThrow(/error/);
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
