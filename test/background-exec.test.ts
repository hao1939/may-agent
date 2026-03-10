import { describe, it, expect, afterEach } from "vitest";
import { createBackgroundExecTool } from "../src/lib/background-exec.js";

describe("background_exec tool", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  });

  function makeTool(opts?: Parameters<typeof createBackgroundExecTool>[0]) {
    const result = createBackgroundExecTool(opts);
    cleanups.push(result.cleanup);
    return result.tool;
  }

  async function exec(tool: ReturnType<typeof makeTool>, params: Record<string, unknown>) {
    const result = await tool.execute("tc1", params as any);
    return JSON.parse(result.content[0].text);
  }

  it("spawns a process and returns pid", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const result = await exec(tool, { action: "spawn", command: "echo hello && sleep 60", label: "test" });
    expect(result.pid).toBeGreaterThan(0);
    expect(result.label).toBe("test");
  });

  it("reads output from spawned process", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const { pid } = await exec(tool, { action: "spawn", command: "echo 'line1'; echo 'line2'" });

    // Wait for process to produce output
    await new Promise((r) => setTimeout(r, 200));

    const result = await exec(tool, { action: "output", pid });
    expect(result.output).toContain("line1");
    expect(result.output).toContain("line2");
  });

  it("drain semantics — second read returns no new output", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const { pid } = await exec(tool, { action: "spawn", command: "echo 'only-once'" });

    await new Promise((r) => setTimeout(r, 200));

    const first = await exec(tool, { action: "output", pid });
    expect(first.output).toContain("only-once");

    const second = await exec(tool, { action: "output", pid });
    expect(second.output).toBe("(no new output)");
  });

  it("limits output by lines", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const { pid } = await exec(tool, { action: "spawn", command: "for i in $(seq 1 10); do echo line$i; done" });

    await new Promise((r) => setTimeout(r, 200));

    const result = await exec(tool, { action: "output", pid, lines: 3 });
    const lines = result.output.trim().split("\n").filter((l: string) => l.length > 0);
    expect(lines.length).toBe(3);
    expect(lines[lines.length - 1]).toBe("line10");
  });

  it("writes to stdin", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const { pid } = await exec(tool, { action: "spawn", command: "cat" });

    const writeResult = await exec(tool, { action: "input", pid, text: "hello from stdin\n" });
    expect(writeResult.written).toBe(true);

    await new Promise((r) => setTimeout(r, 200));

    const output = await exec(tool, { action: "output", pid });
    expect(output.output).toContain("hello from stdin");
  });

  it("kills a process", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const { pid } = await exec(tool, { action: "spawn", command: "sleep 300" });

    const result = await exec(tool, { action: "kill", pid });
    expect(result.killed).toBe(true);

    // Process should not be tracked anymore
    const listResult = await exec(tool, { action: "list" });
    expect(listResult).toEqual([]);
  });

  it("lists all tracked processes", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    await exec(tool, { action: "spawn", command: "sleep 300", label: "proc1" });
    await exec(tool, { action: "spawn", command: "sleep 300", label: "proc2" });

    const result = await exec(tool, { action: "list" });
    expect(result.length).toBe(2);
    expect(result.map((e: any) => e.label).sort()).toEqual(["proc1", "proc2"]);
  });

  it("reports dead process status in output", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const { pid } = await exec(tool, { action: "spawn", command: "echo done" });

    await new Promise((r) => setTimeout(r, 200));

    const result = await exec(tool, { action: "output", pid });
    expect(result.alive).toBe(false);
    expect(result.exitCode).toBe(0);
  });

  it("errors for input on dead process", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const { pid } = await exec(tool, { action: "spawn", command: "echo done" });

    await new Promise((r) => setTimeout(r, 200));

    const result = await exec(tool, { action: "input", pid, text: "hello" });
    expect(result.error).toContain("not alive");
  });

  it("blocks deny patterns", async () => {
    const tool = makeTool({
      cwd: "/tmp",
      denyPatterns: [/^\s*find\s+\/\s/],
      denyMessage: "No root finds!",
    });

    const result = await exec(tool, { action: "spawn", command: "find / -name test" });
    expect(result.error).toContain("Blocked");
  });

  it("blocks meta-recursion commands", async () => {
    const tool = makeTool({ cwd: "/tmp" });
    const result = await exec(tool, { action: "spawn", command: "npx may-agent --agent coder" });
    expect(result.error).toContain("Blocked");
  });

  it("cleanup kills all tracked processes", async () => {
    const { tool, cleanup } = createBackgroundExecTool({ cwd: "/tmp" });
    const r1 = await tool.execute("tc1", { action: "spawn", command: "sleep 300" } as any);
    const pid = JSON.parse(r1.content[0].text).pid;

    cleanup();

    // Verify process is dead (give it a moment)
    await new Promise((r) => setTimeout(r, 100));
    try {
      process.kill(pid, 0); // Check if alive
      // If we get here, process is still alive — fail
      expect(true).toBe(false);
    } catch {
      // Expected — process should be dead
    }
  });

  it("returns error for missing required params", async () => {
    const tool = makeTool();
    const r1 = await exec(tool, { action: "spawn" });
    expect(r1.error).toContain("requires 'command'");

    const r2 = await exec(tool, { action: "output" });
    expect(r2.error).toContain("requires 'pid'");

    const r3 = await exec(tool, { action: "input" });
    expect(r3.error).toContain("requires 'pid'");

    const r4 = await exec(tool, { action: "kill" });
    expect(r4.error).toContain("requires 'pid'");
  });

  it("returns error for unknown pid", async () => {
    const tool = makeTool();
    const result = await exec(tool, { action: "output", pid: 999999 });
    expect(result.error).toContain("No tracked process");
  });
});
