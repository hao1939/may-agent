import { describe, expect, it } from "vitest";
import { createSshExecTool } from "../tools/ssh-exec";

function textOf(result: any): string {
  return result.content?.[0]?.text ?? "";
}

describe("ssh_exec tool", () => {
  it("exposes an exact remote command interface", () => {
    const tool = createSshExecTool();

    expect(tool.name).toBe("ssh_exec");
    expect(tool.description).toContain("not an LLM worker");
    expect(tool.parameters.properties.command.description).toContain("execute exactly");
  });

  it("rejects non-approved hosts before spawning ssh", async () => {
    const tool = createSshExecTool();

    const result = await tool.execute("t1", { host: "prod", command: "hostname" });

    expect(textOf(result)).toContain('SSH host "prod" is not allowed');
  });

  it("requires a command", async () => {
    const tool = createSshExecTool();

    const result = await tool.execute("t1", { host: "devbox", command: "" });

    expect(textOf(result)).toContain("command is required");
  });
});

