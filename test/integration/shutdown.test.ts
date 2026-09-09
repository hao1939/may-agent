import { describe, expect, it, spyOn } from "bun:test";
import { createDaemonLifecycle } from "../../src/app/daemon-lifecycle.js";

describe("daemon shutdown", () => {
  it.each(["SIGINT", "SIGTERM"] as const)("handles %s through production handlers", (signal) => {
    const handlers = new Map<string, (...args: any[]) => void>();
    const timers: Array<{ delay: number; run: () => void }> = [];
    const calls: string[] = [];
    // Only process effects are intercepted; real lifecycle code makes every decision.
    const on = spyOn(process, "on").mockImplementation(((event: string, handler: (...args: any[]) => void) => {
      expect(handlers.has(event)).toBe(false);
      handlers.set(event, handler);
      return process;
    }) as typeof process.on);
    const exit = spyOn(process, "exit").mockImplementation((code) => {
      calls.push("exit:" + code);
      return undefined as never;
    });
    const kill = spyOn(process, "kill").mockImplementation((pid, sig) => {
      expect(pid).toBe(process.pid);
      calls.push("kill:" + sig);
      return true;
    });
    const timer = spyOn(globalThis, "setTimeout").mockImplementation(((run: () => void, delay: number) => {
      timers.push({ delay, run });
      return { unref() {} };
    }) as unknown as typeof setTimeout);
    try {
      const lifecycle = createDaemonLifecycle({
        bus: { emit() {} },
        manager: {
          status: () => [
            { sessionId: "running", status: "running" },
            { sessionId: "idle", status: "idle" },
          ],
          cancel: (id: string) => calls.push("cancel:" + id),
        },
        loaderOpts: {},
        closeAllDbs: () => calls.push("db:close"),
        writeIdentity: (identity: { status: string }) => calls.push("identity:" + identity.status),
        processStartTime: Date.now(),
        getTelegramBot: () => ({ close: () => calls.push("telegram:close") }),
        getActiveReadline: () => ({ close: () => calls.push("console:close") }),
        clearActiveReadline: () => calls.push("console:clear"),
        beforeShutdown: () => calls.push("tasks:close"),
      } as Parameters<typeof createDaemonLifecycle>[0]);
      lifecycle.installProcessHandlers();
      handlers.get(signal)!();
      expect(calls).toEqual([
        "tasks:close",
        "telegram:close",
        "console:close",
        "console:clear",
        ...(signal === "SIGINT" ? ["cancel:running"] : []),
      ]);
      expect(timers.map((t) => t.delay)).toEqual([2000, 5000]);
      timers[0].run();
      expect(calls.slice(-2)).toEqual(["db:close", "exit:0"]);
      handlers.get("exit")!(0);
      expect(calls.slice(-2)).toEqual(["db:close", "identity:done"]);
      const beforeSecondSignal = calls.length;
      handlers.get(signal)!();
      expect(calls.slice(beforeSecondSignal)).toEqual(["kill:SIGKILL"]);
      expect(timers).toHaveLength(2);
      timers[1].run();
      expect(kill).toHaveBeenCalledTimes(2);
    } finally {
      timer.mockRestore();
      kill.mockRestore();
      exit.mockRestore();
      on.mockRestore();
    }
  });
});
