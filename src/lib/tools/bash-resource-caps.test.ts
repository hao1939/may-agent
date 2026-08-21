import { describe, it, expect } from "bun:test";
import { readdirSync, statSync, unlinkSync } from "node:fs";
import { BASH_CAPTURE_TAIL_BYTES, createBashTool, DEFAULT_BASH_TIMEOUT, type BashToolDetails } from "./bash.js";

describe("P113 Bash Resource Caps", () => {
  it("DEFAULT_BASH_TIMEOUT is 120 seconds", () => {
    expect(DEFAULT_BASH_TIMEOUT).toBe(120);
  });

  it("applies default timeout when agent does not specify one", async () => {
    // Create a bash tool with a very short default timeout (1s) for testing
    const tool = createBashTool("/tmp", { defaultTimeout: 1 });
    // sleep 30 should be killed by the 1s default timeout
    await expect(tool.execute("id", { command: "sleep 30" })).rejects.toThrow(/timed out/);
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

  it("does not let a background descendant hold the tool call open", async () => {
    const tool = createBashTool("/tmp", { defaultTimeout: 10 });
    const startedAt = Date.now();
    const result = await tool.execute("id", {
      command: "sleep 30 & echo parent-exited",
    });

    expect(result.content[0].text).toContain("parent-exited");
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });

  it("settles concurrent shell calls from the same long-running process", async () => {
    const tool = createBashTool("/tmp", { defaultTimeout: 10 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        tool.execute(`call-${index}`, {
          command: `printf 'call-%s\\n' ${index}`,
        }),
      ),
    );

    for (const [index, result] of results.entries()) {
      expect(result.content[0].text).toContain(`call-${index}`);
    }
  });

  it("releases process resources after repeated shell calls", async () => {
    const tool = createBashTool("/tmp", { defaultTimeout: 10 });
    const before = readdirSync("/proc/self/fd").length;

    for (let index = 0; index < 25; index += 1) {
      await tool.execute(`resource-${index}`, { command: "/bin/true" });
    }

    const after = readdirSync("/proc/self/fd").length;
    expect(after - before).toBeLessThanOrEqual(3);
  });

  it("keeps complete large output on disk without replaying it through the daemon", async () => {
    const outputBytes = 8 * 1024 * 1024;
    const tool = createBashTool("/tmp", { defaultTimeout: 10 });
    let transientBytes = 0;

    const result = await tool.execute(
      "large-output",
      { command: `bun -e 'process.stdout.write("x".repeat(${outputBytes}))'` },
      undefined,
      (update) => {
        transientBytes += Buffer.byteLength(update.content[0]?.text ?? "");
      },
    );
    const details = result.details as BashToolDetails | undefined;
    const fullOutputPath = details?.fullOutputPath;

    expect(fullOutputPath).toBeString();
    expect(statSync(fullOutputPath!).size).toBe(outputBytes);
    expect(Buffer.byteLength(result.content[0]?.text ?? "")).toBeLessThan(BASH_CAPTURE_TAIL_BYTES);
    expect(transientBytes).toBeLessThan(outputBytes / 2);
    expect(result.content[0]?.text).toContain("Full output:");

    unlinkSync(fullOutputPath!);
  });

  it("preserves the complete capture when a large-output command times out", async () => {
    const outputBytes = 2 * 1024 * 1024;
    const tool = createBashTool("/tmp", { defaultTimeout: 0.3 });
    let error: Error | undefined;

    try {
      await tool.execute("large-timeout", {
        command: `bun -e 'process.stdout.write("x".repeat(${outputBytes})); setTimeout(() => {}, 10_000)'`,
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error?.message).toContain("Command timed out after 0.3 seconds");
    const fullOutputPath = error?.message.match(/Full output: ([^\]]+)/)?.[1];
    expect(fullOutputPath).toBeString();
    expect(statSync(fullOutputPath!).size).toBe(outputBytes);
    expect(Buffer.byteLength(error?.message ?? "")).toBeLessThan(BASH_CAPTURE_TAIL_BYTES * 2);

    unlinkSync(fullOutputPath!);
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
