import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager } from "./manager.js";
import { executionTimeout } from "./execution-scope.js";
import { closeDb } from "./requests.js";
import { fakeModel } from "../../test/fixtures/model.js";
import { runOneshotMode } from "../app/modes/oneshot.js";
import { fileURLToPath } from "node:url";
import { EventBus } from "../app/core/events/bus.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(behavior: (text: string, stopped: Promise<void>) => Promise<string>, bus?: EventBus) {
  const root = mkdtempSync(join(tmpdir(), "may-execution-scope-"));
  roots.push(root);
  const manager = new SubagentManager({
    persistDir: root,
    bus,
    agentRunFactory: () => {
      let stop = Promise.withResolvers<void>();
      const state = { messages: [] as any[] } as any;
      return {
        state,
        prompt: async (text: any) => {
          stop = Promise.withResolvers<void>();
          const prompt =
            typeof text === "string" ? text : text.content.map((part: { text?: string }) => part.text ?? "").join("");
          const answer = await behavior(prompt, stop.promise);
          state.messages.push({ role: "assistant", content: [{ type: "text", text: answer }] });
        },
        cancel: () => stop.resolve(),
        waitForIdle: async () => undefined,
        followUp: () => undefined,
        continue: async () => undefined,
        steer: () => undefined,
        subscribe: () => () => undefined,
      };
    },
  });
  manager.register({ name: "worker", description: "fixture", domain: "fixture", tools: [], model: fakeModel() });
  return manager;
}

describe("shared execution scope", () => {
  it.each(["success", "failure"])("one-shot subprocess reports %s after execution cleanup", async (mode) => {
    const root = mkdtempSync(join(tmpdir(), "may-oneshot-result-"));
    roots.push(root);
    const child = Bun.spawn(
      [process.execPath, fileURLToPath(new URL("../../test/fixtures/oneshot-result.ts", import.meta.url)), root, mode],
      {
        stdout: "pipe",
        stderr: "pipe",
        timeout: 10_000,
      },
    );
    const [stdout, stderr, exit] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(exit).toBe(mode === "success" ? 0 : 1);
    const result = JSON.parse(stdout.trim().split("\n").at(-1)!);
    expect(result.status).toBe(mode === "success" ? "success" : "error");
    if (mode === "success") expect(result.result).toBe("fixture answer");
    else {
      expect(result.error).toBe("fixture execution failed");
      expect(stderr).toContain("fixture execution failed");
    }
  });

  it("validates limits and clamps to the remaining caller allowance", () => {
    expect(executionTimeout()).toBe(1_800_000);
    for (const value of [0, -1, NaN, Infinity, 2_147_483_648]) expect(() => executionTimeout(value)).toThrow();
    expect(executionTimeout(60_000, Date.now() + 1_000)).toBeLessThanOrEqual(1_000);
    expect(() => executionTimeout(60_000, Date.now() - 1)).toThrow("expired");
  });

  it("one-shot returns an exact failed result after the session leaves the live map", async () => {
    const manager = fixture(async () => {
      throw new Error("fixture failure");
    });
    const logs: string[] = [];
    const original = console.log;
    console.log = (text) => logs.push(String(text));
    try {
      expect(
        await runOneshotMode({
          manager,
          agentName: "worker",
          task: "fail",
          timeoutMinutes: 1,
          formatDurationMs: String,
        }),
      ).toBe(1);
    } finally {
      console.log = original;
    }
    expect(manager.status()).toEqual([]);
    expect(JSON.parse(logs.at(-1)!)).toMatchObject({ status: "error", error: "fixture failure" });
  });

  it("cancels and joins a nested helper before returning the parent result", async () => {
    const childStarted = Promise.withResolvers<void>();
    const childStopped = Promise.withResolvers<void>();
    const releaseCleanup = Promise.withResolvers<void>();
    const finishParent = Promise.withResolvers<void>();
    let parentId = "";
    let childId = "";
    const manager = fixture(async (text, stopped) => {
      if (text.startsWith("child")) {
        childStarted.resolve();
        await stopped;
        childStopped.resolve();
        await releaseCleanup.promise;
        return "partial evidence";
      }
      await finishParent.promise;
      return "parent answer";
    });
    parentId = manager.run("worker", "parent", {
      timeoutMs: 5_000,
      toolPolicy: "readonly",
      executionRoot: roots.at(-1),
      taskBinding: { appId: "sample", taskId: "work", generation: 2, attemptId: "attempt-2" },
    });
    const fork = manager.createAgentsTool({ getCallerSessionId: () => parentId });
    const reply = await fork.execute("fork-child", { action: "fork", agent: "worker", task: "child" });
    childId = JSON.parse((reply.content[0] as { text: string }).text).sessionId;
    await childStarted.promise;
    const parent = manager.activeSessions.get(parentId)!;
    const child = manager.activeSessions.get(childId)!;
    expect(child.taskBinding).toEqual(parent.taskBinding);
    expect(child.toolPolicy).toBe("readonly");
    expect(child.executionRoot).toBe(parent.executionRoot);
    expect(child.executionScope!.deadlineAt).toBeLessThanOrEqual(parent.executionScope!.deadlineAt);
    expect(() => manager.run("worker", "broaden", { parentSessionId: parentId, toolPolicy: "full" })).toThrow(
      "restriction",
    );
    let returned = false;
    const parentResult = manager.waitFor(parentId).then((result) => {
      returned = true;
      return result;
    });
    finishParent.resolve();
    await childStopped.promise;
    manager.cancel(childId);
    manager.cancel(childId);
    expect(returned).toBe(false);
    expect(manager.hasActiveSession(parentId)).toBe(true);
    expect(manager.hasActiveSession(childId)).toBe(true);
    expect(manager.status().find((session) => session.sessionId === childId)?.status).toBe("running");
    releaseCleanup.resolve();
    expect((await parentResult).status).toBe("done");
    expect((await manager.waitFor(childId)).status).toBe("interrupted");
    expect(manager.status()).toEqual([]);
  });

  it("generic call forwards tool cancellation and rejects a missing caller", async () => {
    const manager = fixture(async (_text, stopped) => {
      await stopped;
      return "partial";
    });
    const parentId = manager.run("worker", "parent", { timeoutMs: 5_000 });
    const tool = manager.createAgentsTool({ getCallerSessionId: () => parentId });
    const controller = new AbortController();
    const result = tool.execute("helper", { action: "call", agent: "worker", task: "child" }, controller.signal);
    controller.abort();
    expect(JSON.stringify(await result)).toContain("abort");
    manager.cancel(parentId);
    await manager.waitFor(parentId);
    expect(JSON.stringify(await tool.execute("late", { action: "call", agent: "worker", task: "child" }))).toContain(
      "live caller",
    );
    expect(() => manager.runAgent("worker", "orphan")).toThrow("live caller");
  });

  it("idle chat can start a new bounded turn after its earlier allowance passes", async () => {
    const manager = fixture(async () => "answer");
    const sessionId = manager.run("worker", "first", { kind: "chat", autoClose: "never", timeoutMs: 100 });
    await manager.waitForIdle(sessionId);
    const first = manager.activeSessions.get(sessionId)!.executionScope!.deadlineAt;
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(manager.activeSessions.get(sessionId)!.status).toBe("idle");
    manager.send(sessionId, "second");
    await manager.waitForIdle(sessionId);
    expect(manager.activeSessions.get(sessionId)!.executionScope!.deadlineAt).toBeGreaterThan(first);
    manager.cancel(sessionId);
  });

  it("does not let the previous chat turn close a turn started by its idle event", async () => {
    const bus = new EventBus();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const manager = fixture(async (text) => {
      if (text === "second") {
        entered.resolve();
        await release.promise;
      }
      return "answer";
    }, bus);
    let sent = false;
    const unsubscribe = bus.subscribe((event) => {
      if (event.type === "session.idle" && !sent) {
        sent = true;
        manager.send(event.data.sessionId, "second", { trace: { traceId: "second-turn", parentEventId: 2 } });
      }
    });
    const id = manager.run("worker", "first", { kind: "chat", autoClose: "never", timeoutMs: 5_000 });
    try {
      await entered.promise;
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(manager.activeSessions.get(id)!.executionScope!.signal.aborted).toBe(false);
      expect(manager.activeSessions.get(id)!.status).toBe("running");
      expect(manager.activeSessions.get(id)!.openTurnTraces).toMatchObject([{ traceId: "second-turn" }]);
    } finally {
      unsubscribe();
      release.resolve();
      await manager.waitForIdle(id);
      manager.cancel(id);
    }
  });

  it("reports a chat helper cleanup failure instead of leaving the chat running", async () => {
    const bus = new EventBus();
    const release = Promise.withResolvers<void>();
    let child: string;
    bus.setPersistenceSubscriber((event) => {
      if (event.type === "session.end" && event.data.sessionId === child) throw new Error("Child receipt write failed");
    });
    const manager = fixture(async (text, stopped) => {
      if (text.split("\n")[0] === "child") await stopped;
      else await release.promise;
      return "answer";
    }, bus);
    const parent = manager.run("worker", "parent", { kind: "chat", autoClose: "never", timeoutMs: 5_000 });
    child = manager.runAgent("worker", "child", { parentSessionId: parent });
    const failedChild = manager.waitFor(child).catch((error) => error);
    release.resolve();
    await expect(manager.waitForIdle(parent)).rejects.toThrow("Child receipt write failed");
    expect((await failedChild).message).toContain("Child receipt write failed");
    expect(manager.status()).toEqual([]);
    expect((await manager.waitFor(parent)).status).toBe("error");
  });

  it("keeps terminal persistence failure observable without a global rejection", async () => {
    const manager = fixture(async () => "answer");
    const failure = new Error("database or disk is full");
    (manager as any).executeSession = async () => {
      throw failure;
    };
    const leaked: unknown[] = [];
    const onUnhandled = (error: unknown) => leaked.push(error);
    process.on("unhandledRejection", onUnhandled);
    try {
      const id = manager.run("worker", "test");
      const result = manager.waitFor(id);
      await expect(result).rejects.toBe(failure);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(leaked).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
