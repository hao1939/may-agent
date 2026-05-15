import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import { createSshExecTool } from "../tools/ssh-exec";

function textOf(result: any): string {
  return result.content?.[0]?.text ?? "";
}

function fakeChild(pid = 12345): any {
  const child = new EventEmitter() as any;
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("ssh_exec tool", () => {
  let spawnMock: any;
  let killMock: any;

  beforeEach(() => {
    spawnMock = vi.fn();
    killMock = vi.fn(() => true);
  });

  function makeTool() {
    return createSshExecTool({
      spawn: spawnMock,
      kill: killMock,
      timeoutToMs: (seconds) => seconds,
      forceKillDelayMs: 5,
    });
  }

  it("exposes an exact remote command interface", () => {
    const tool = createSshExecTool();

    expect(tool.name).toBe("ssh_exec");
    expect(tool.description).toContain("not an LLM worker");
    expect(tool.parameters.properties.command.description).toContain("execute exactly");
  });

  it("rejects non-approved hosts before spawning ssh", async () => {
    const result = await makeTool().execute("t1", { host: "prod", command: "hostname" });

    expect(textOf(result)).toContain('SSH host "prod" is not allowed');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("requires a command", async () => {
    const result = await makeTool().execute("t1", { host: "devbox", command: "" });

    expect(textOf(result)).toContain("command is required");
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("spawns ssh in its own process group so timeout can stop remote work", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = makeTool().execute("t1", { host: "devbox", command: "hostname" });
    child.emit("close", 0, null);
    await promise;

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0][0]).toBe("ssh");
    expect(spawnMock.mock.calls[0][2]).toMatchObject({ detached: true });
  });

  it("settles timed-out ssh commands by terminating the process group", async () => {
    const child = fakeChild(2468);
    spawnMock.mockReturnValue(child);

    const promise = makeTool().execute("t1", { host: "devbox", command: "sleep 100", timeout: 1 });

    await delay(3);
    expect(killMock).toHaveBeenCalledWith(-2468, "SIGTERM");

    await delay(8);
    expect(killMock).toHaveBeenCalledWith(-2468, "SIGKILL");

    child.emit("close", null, "SIGTERM");
    const result = await promise;

    expect(textOf(result)).toContain("[timeout after 1s]");
    expect(result.details).toMatchObject({ host: "devbox", command: "sleep 100", timedOut: true });
  });

  it("does not spawn when the tool call is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await makeTool().execute("t1", { host: "devbox", command: "hostname" }, controller.signal);

    expect(spawnMock).not.toHaveBeenCalled();
    expect(textOf(result)).toContain("[aborted]");
    expect(result.details).toMatchObject({ aborted: true, timedOut: false });
  });

  it("terminates the ssh process group when the tool call is aborted", async () => {
    const child = fakeChild(1357);
    const controller = new AbortController();
    spawnMock.mockReturnValue(child);

    const promise = makeTool().execute("t1", { host: "devbox", command: "sleep 100", timeout: 60 }, controller.signal);

    controller.abort();
    expect(killMock).toHaveBeenCalledWith(-1357, "SIGTERM");

    await delay(8);
    expect(killMock).toHaveBeenCalledWith(-1357, "SIGKILL");

    child.emit("close", null, "SIGTERM");
    const result = await promise;

    expect(textOf(result)).toContain("[aborted signal SIGTERM]");
    expect(result.details).toMatchObject({ host: "devbox", command: "sleep 100", aborted: true });
  });
});
