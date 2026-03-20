import { describe, it, expect } from "vitest";
import { createBashTool, DEFAULT_BASH_TIMEOUT } from "../src/lib/tools/bash.js";

describe("P113 Bash Resource Caps", () => {
  it("DEFAULT_BASH_TIMEOUT is 120 seconds", () => {
    expect(DEFAULT_BASH_TIMEOUT).toBe(120);
  });

  it("applies default timeout when agent does not specify one", async () => {
    // Create a bash tool with a very short default timeout (1s) for testing
    const tool = createBashTool("/tmp", { defaultTimeout: 1 });
    // sleep 30 should be killed by the 1s default timeout
    await expect(
      tool.execute("id", { command: "sleep 30" })
    ).rejects.toThrow(/timed out/);
  });

  it("agent-specified timeout overrides the default", async () => {
    // Default is 1s, but agent says 2s — the command finishes in <1s so it succeeds
    const tool = createBashTool("/tmp", { defaultTimeout: 1 });
    const result = await tool.execute("id", { command: "echo fast", timeout: 2 });
    expect(result.content[0].text).toContain("fast");
  });

  it("defaultTimeout=0 disables the default timeout", async () => {
    // With 0, no default timeout — a quick command should work fine
    const tool = createBashTool("/tmp", { defaultTimeout: 0 });
    const result = await tool.execute("id", { command: "echo no-timeout" });
    expect(result.content[0].text).toContain("no-timeout");
  });

  it("normal commands complete within default timeout", async () => {
    // Use real default timeout — normal commands finish instantly
    const tool = createBashTool("/tmp");
    const result = await tool.execute("id", { command: "echo 'P113 resource caps working'" });
    expect(result.content[0].text).toContain("P113 resource caps working");
  });

  it("tool description mentions the default timeout", () => {
    const tool = createBashTool("/tmp");
    expect(tool.description).toContain("120s");
  });

  it("custom defaultTimeout appears in description", () => {
    const tool = createBashTool("/tmp", { defaultTimeout: 60 });
    expect(tool.description).toContain("60s");
  });
});
