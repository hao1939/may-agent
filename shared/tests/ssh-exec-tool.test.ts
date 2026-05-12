import { EventEmitter } from "node:events";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

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

describe("ssh_exec tool", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it("spawns ssh in its own process group so timeout can stop remote work", async () => {
    const tool = createSshExecTool();
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = tool.execute("t1", { host: "devbox", command: "hostname" });
    child.emit("close", 0, null);
    await promise;

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0][0]).toBe("ssh");
    expect(spawnMock.mock.calls[0][2]).toMatchObject({ detached: true });
  });

  it("settles timed-out ssh commands by terminating the process group", async () => {
    vi.useFakeTimers();
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true as any);
    const tool = createSshExecTool();
    const child = fakeChild(2468);
    spawnMock.mockReturnValue(child);

    const promise = tool.execute("t1", { host: "devbox", command: "sleep 100", timeout: 1 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(killSpy).toHaveBeenCalledWith(-2468, "SIGTERM");

    await vi.advanceTimersByTimeAsync(5000);
    expect(killSpy).toHaveBeenCalledWith(-2468, "SIGKILL");

    child.emit("close", null, "SIGTERM");
    const result = await promise;

    expect(textOf(result)).toContain("[timeout after 1s]");
    expect(result.details).toMatchObject({ host: "devbox", command: "sleep 100", timedOut: true });
  });
});
