import { describe, it, expect, afterEach, spyOn } from "bun:test";
import * as childProcess from "node:child_process";
import { once } from "node:events";
import { createBackgroundExecTool } from "./background-exec.js";

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

  it.each([0, 0.3])("limits output by lines after a %s second startup delay", async (delay) => {
    const tool = makeTool({ cwd: "/tmp" });
    // Observe the real child without changing its execution. `close` follows
    // both process exit and stdout/stderr drain; a fixed sleep proves neither.
    const spawned = spyOn(childProcess, "spawn");
    let child: childProcess.ChildProcess;
    let pid: number;
    try {
      ({ pid } = await exec(tool, { action: "spawn", command: `sleep ${delay}; for i in $(seq 1 10); do echo line$i; done` }));
      child = spawned.mock.results.at(-1)!.value;
    } finally {
      spawned.mockRestore();
    }
    await once(child, "close");
    const result = await exec(tool, { action: "output", pid, lines: 3 });
    const lines = result.output
      .trim()
      .split("\n")
      .filter((l: string) => l.length > 0);
    expect(lines).toEqual(["line8", "line9", "line10"]);
    expect(result.alive).toBe(false);
    expect(result.exitCode).toBe(0);
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

  it("cleanupAsync escalates to SIGKILL and confirms exit for SIGTERM-ignoring process groups", async () => {
    const { tool, cleanupAsync } = createBackgroundExecTool({ cwd: "/tmp" });
    const spawned = await tool.execute(
      "tc_term_resist",
      { action: "spawn", command: "trap '' TERM; sleep 60 & wait" } as any,
    );
    const pid = JSON.parse(spawned.content[0].text).pid as number;
    await new Promise((r) => setTimeout(r, 100));

    const confirmed = await cleanupAsync();
    expect(confirmed).toBe(true);
    expect(() => process.kill(-pid, 0)).toThrow();
  });

  it("cleanupAsync retains unconfirmed groups across retries until drain succeeds", async () => {
    let attempts = 0;
    let allowDrain = false;
    const { tool, cleanup, cleanupAsync } = createBackgroundExecTool({
      cwd: "/tmp",
      drainProcessGroup: async (pgid) => {
        attempts++;
        if (!allowDrain) return false;
        try {
          process.kill(-pgid, "SIGKILL");
        } catch {
          /* ignore */
        }
        return true;
      },
    });
    const spawned = await tool.execute("tc_unconfirmed", { action: "spawn", command: "sleep 60" } as any);
    const pid = JSON.parse(spawned.content[0].text).pid as number;
    try {
      expect(await cleanupAsync()).toBe(false);
      // Repeated cleanupAsync must NOT forget the group and falsely report true.
      expect(await cleanupAsync()).toBe(false);
      expect(attempts).toBe(2);

      allowDrain = true;
      expect(await cleanupAsync()).toBe(true);
      expect(attempts).toBe(3);
      // Once drained, subsequent cleanupAsync has no retained groups to retry.
      expect(await cleanupAsync()).toBe(true);
      expect(attempts).toBe(3);
      cleanup();
    } finally {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
  });

  it("cleanupAsync drains background descendants even after the shell leader exits", async () => {
    const { tool, cleanupAsync } = createBackgroundExecTool({ cwd: "/tmp" });
    const spawned = await tool.execute(
      "tc_leader_exited",
      { action: "spawn", command: "sleep 60 </dev/null >/dev/null 2>&1 & exit 0" } as any,
    );
    const pgid = JSON.parse(spawned.content[0].text).pid as number;

    // Wait until the shell leader exits (`alive: false`), while `sleep 60` stays in `-pgid`.
    const deadline = Date.now() + 2_000;
    let status = await exec(tool, { action: "output", pid: pgid });
    while (status.alive && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
      status = await exec(tool, { action: "output", pid: pgid });
    }
    expect(status.alive).toBe(false);
    // Confirm the orphaned process group still exists before cleanupAsync.
    expect(() => process.kill(-pgid, 0)).not.toThrow();

    const confirmed = await cleanupAsync();
    expect(confirmed).toBe(true);
    expect(() => process.kill(-pgid, 0)).toThrow();
  });
});
