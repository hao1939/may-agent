import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { CodexGoalAppServerClient, type AppServerProcess } from "./codex-goal-client.js";

class FakeAppServerProcess extends EventEmitter implements AppServerProcess {
  pid = undefined;
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  writes: Array<Record<string, any>> = [];
  signals: Array<NodeJS.Signals | undefined> = [];
  private readonly closeOnSignal: "any" | NodeJS.Signals | null;

  constructor(options: { closeOnStdinEnd?: boolean; closeOnSignal?: "any" | NodeJS.Signals | null } = {}) {
    super();
    this.closeOnSignal = options.closeOnSignal ?? "any";
    let buffered = "";
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", (chunk: string) => {
      buffered += chunk;
      while (buffered.includes("\n")) {
        const newline = buffered.indexOf("\n");
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        if (line.trim()) this.writes.push(JSON.parse(line));
      }
    });
    if (options.closeOnStdinEnd) this.stdin.once("finish", () => this.emit("close", 0, null));
  }

  kill(signal?: NodeJS.Signals): boolean {
    this.signals.push(signal);
    if (this.closeOnSignal === "any" || this.closeOnSignal === signal) this.emit("close", 0, signal ?? null);
    return true;
  }

  reply(id: number, result: unknown): void {
    this.stdout.write(`${JSON.stringify({ id, result })}\n`);
  }

  notify(method: string, params: unknown): void {
    this.stdout.write(`${JSON.stringify({ method, params })}\n`);
  }
}

async function waitForWrite(process: FakeAppServerProcess, method: string): Promise<Record<string, any>> {
  for (let index = 0; index < 100; index++) {
    const found = process.writes.find((entry) => entry.method === method);
    if (found) return found;
    await Bun.sleep(1);
  }
  throw new Error(`Did not observe ${method}`);
}

describe("CodexGoalAppServerClient", () => {
  it("initializes, starts a thread, sets a goal, steers, and accepts authoritative completion", async () => {
    const process = new FakeAppServerProcess();
    const client = new CodexGoalAppServerClient(process, { requestTimeoutMs: 1_000 });

    const initialized = client.initialize();
    const initialize = await waitForWrite(process, "initialize");
    process.reply(initialize.id, { userAgent: "fake" });
    await initialized;
    expect((await waitForWrite(process, "initialized")).id).toBeUndefined();

    const started = client.startThread({ cwd: "/tmp/work", sandbox: "read-only" });
    const start = await waitForWrite(process, "thread/start");
    expect(start.params).toMatchObject({ cwd: "/tmp/work", approvalPolicy: "never", ephemeral: false });
    process.reply(start.id, { thread: { id: "thread-1" }, cwd: "/tmp/work" });
    expect(await started).toEqual({ threadId: "thread-1", cwd: "/tmp/work" });

    const goalSet = client.setGoal({ threadId: "thread-1", objective: "Fulfill the May Task" });
    const goal = await waitForWrite(process, "thread/goal/set");
    process.reply(goal.id, { goal: { threadId: "thread-1", objective: "Fulfill the May Task", status: "active" } });
    await goalSet;

    const turnStarted = client.startTurn({ threadId: "thread-1", prompt: "Advance the Task" });
    const turnStart = await waitForWrite(process, "turn/start");
    process.reply(turnStart.id, { turn: { id: "turn-1", status: "inProgress" } });
    expect(await turnStarted).toBe("turn-1");

    const steered = client.steer({ threadId: "thread-1", turnId: "turn-1", message: "New durable fact" });
    const steer = await waitForWrite(process, "turn/steer");
    expect(steer.params.expectedTurnId).toBe("turn-1");
    process.reply(steer.id, { turnId: "turn-1" });
    expect(await steered).toBe("turn-1");

    const completion = client.waitForTurn("turn-1", 1_000);
    process.notify("turn/completed", {
      threadId: "thread-1",
      turn: { id: "turn-1", status: "completed", items: [] },
    });
    expect(await completion).toMatchObject({ threadId: "thread-1", turn: { id: "turn-1", status: "completed" } });
    expect(client.diagnostics()).toMatchObject({
      processId: null,
      notifications: 1,
      serverRequests: 0,
      responses: 5,
    });
    expect(client.diagnostics().protocolBytes).toBeGreaterThan(0);
    expect(client.diagnostics().maxProtocolLineChars).toBeGreaterThan(0);
  });

  it("resumes a persisted thread and interrupts the exact active turn", async () => {
    const process = new FakeAppServerProcess();
    const client = new CodexGoalAppServerClient(process, { requestTimeoutMs: 1_000 });

    const resumed = client.resumeThread({ threadId: "thread-1", cwd: "/tmp/work" });
    const resume = await waitForWrite(process, "thread/resume");
    process.reply(resume.id, { thread: { id: "thread-1" }, cwd: "/tmp/work" });
    expect(await resumed).toEqual({ threadId: "thread-1", cwd: "/tmp/work" });

    const interrupted = client.interrupt({ threadId: "thread-1", turnId: "turn-2" });
    const interrupt = await waitForWrite(process, "turn/interrupt");
    expect(interrupt.params).toEqual({ threadId: "thread-1", turnId: "turn-2" });
    process.reply(interrupt.id, {});
    await interrupted;
  });

  it("observes the authoritative turn and terminal status created by an active goal", async () => {
    const process = new FakeAppServerProcess();
    const client = new CodexGoalAppServerClient(process, { requestTimeoutMs: 1_000 });
    const activeTurn = client.waitForActiveTurn("thread-1", 1_000);
    process.notify("turn/started", {
      threadId: "thread-1",
      turn: { id: "goal-turn-1", status: "inProgress", items: [] },
    });
    expect(await activeTurn).toBe("goal-turn-1");

    const terminalGoal = client.waitForGoal("thread-1", (observation) => observation.goal.status === "complete", 1_000);
    process.notify("thread/goal/updated", {
      threadId: "thread-1",
      turnId: "goal-turn-1",
      goal: { threadId: "thread-1", objective: "Fulfill the Task", status: "complete" },
    });
    expect(await terminalGoal).toMatchObject({
      threadId: "thread-1",
      turnId: "goal-turn-1",
      goal: { status: "complete" },
    });
  });

  it("fails pending work when app-server exits", async () => {
    const process = new FakeAppServerProcess();
    const client = new CodexGoalAppServerClient(process, { requestTimeoutMs: 1_000 });
    const pending = client.getGoal("thread-1");
    await waitForWrite(process, "thread/goal/get");
    process.stderr.write("protocol stopped");
    process.emit("close", 1, null);
    await expect(pending).rejects.toThrow("protocol stopped");
  });

  it("fails closed on server requests", async () => {
    const process = new FakeAppServerProcess();
    new CodexGoalAppServerClient(process, { requestTimeoutMs: 1_000 });
    process.stdout.write(
      `${JSON.stringify({ id: 77, method: "item/commandExecution/requestApproval", params: {} })}\n`,
    );
    for (let index = 0; index < 100 && !process.writes.some((entry) => entry.id === 77); index++) await Bun.sleep(1);
    expect(process.writes.find((entry) => entry.id === 77)).toMatchObject({
      error: { code: -32000 },
    });
  });

  it("fails the connection on malformed protocol JSON", async () => {
    const process = new FakeAppServerProcess();
    const client = new CodexGoalAppServerClient(process, { requestTimeoutMs: 1_000 });
    process.stdout.write("{not-json}\n");
    await expect(client.getGoal("thread-1")).rejects.toThrow("invalid JSON");
  });

  it("bounds an unterminated protocol line", async () => {
    const process = new FakeAppServerProcess();
    const client = new CodexGoalAppServerClient(process, { requestTimeoutMs: 1_000 });
    process.stdout.write("x".repeat(4 * 1024 * 1024 + 1));
    await expect(client.getGoal("thread-1")).rejects.toThrow("protocol line exceeded");
  });

  it("stops through normal stdin shutdown without signaling", async () => {
    const process = new FakeAppServerProcess({ closeOnStdinEnd: true, closeOnSignal: null });
    const client = new CodexGoalAppServerClient(process, { terminateAfterMs: 5, killAfterMs: 15 });
    await client.stop();
    expect(process.signals).toEqual([]);
    await client.stop();
  });

  it("falls back to SIGTERM and then SIGKILL when required", async () => {
    const termProcess = new FakeAppServerProcess({ closeOnSignal: "SIGTERM" });
    const termClient = new CodexGoalAppServerClient(termProcess, { terminateAfterMs: 5, killAfterMs: 20 });
    await termClient.stop();
    expect(termProcess.signals).toEqual(["SIGTERM"]);

    const killProcess = new FakeAppServerProcess({ closeOnSignal: "SIGKILL" });
    const killClient = new CodexGoalAppServerClient(killProcess, { terminateAfterMs: 5, killAfterMs: 15 });
    await killClient.stop();
    expect(killProcess.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("returns immediately when the process already closed", async () => {
    const process = new FakeAppServerProcess({ closeOnSignal: null });
    const client = new CodexGoalAppServerClient(process, { terminateAfterMs: 5, killAfterMs: 15 });
    process.emit("close", 0, null);
    await client.stop();
    expect(process.signals).toEqual([]);
  });

  it("removes timed-out requests and ignores their late responses", async () => {
    const process = new FakeAppServerProcess({ closeOnStdinEnd: true });
    const client = new CodexGoalAppServerClient(process, {
      requestTimeoutMs: 5,
      terminateAfterMs: 5,
      killAfterMs: 15,
    });
    const timedOut = client.getGoal("thread-1");
    const first = await waitForWrite(process, "thread/goal/get");
    await expect(timedOut).rejects.toThrow("request thread/goal/get timed out");
    process.reply(first.id, { goal: { status: "active" } });

    const next = client.readThread("thread-1", false);
    const second = await waitForWrite(process, "thread/read");
    process.reply(second.id, { thread: { id: "thread-1" } });
    await expect(next).resolves.toEqual({ thread: { id: "thread-1" } });
    await client.stop();
  });
});
