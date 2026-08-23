import { describe, expect, it } from "bun:test";
import { createDaemonLifecycle, startSupervisorRestarter } from "./daemon-lifecycle.js";

describe("startSupervisorRestarter", () => {
  it("hands restart ownership to supervisor's one-shot restarter", () => {
    const emitted: unknown[] = [];
    const calls: unknown[] = [];

    startSupervisorRestarter({ emit: (event) => emitted.push(event) }, ((file, args, options, callback) => {
      calls.push({ file, args, options });
      callback(null, "may-agent-restarter: started", "");
    }) as any);

    expect(calls).toEqual([
      {
        file: "supervisorctl",
        args: ["start", "may-agent-restarter"],
        options: { timeout: 10000 },
      },
    ]);
    expect(emitted).toEqual([]);
  });

  it("emits an info event when supervisor rejects the restarter start", () => {
    const emitted: unknown[] = [];

    startSupervisorRestarter({ emit: (event) => emitted.push(event) }, ((_file, _args, _options, callback) => {
      callback(new Error("start failed"), "", "may-agent-restarter: ERROR (already started)");
    }) as any);

    expect(emitted).toEqual([
      {
        type: "info",
        message: "[restart] Failed to start supervisor restarter: may-agent-restarter: ERROR (already started)",
      },
    ]);
  });
});

describe("runtime generation reload", () => {
  function lifecycleOptions(overrides: Record<string, unknown>) {
    return {
      bus: { emit: () => {} },
      manager: {},
      loaderOpts: {},
      closeAllDbs: () => {},
      writeIdentity: () => {},
      processStartTime: Date.now(),
      getTelegramBot: () => undefined,
      getActiveReadline: () => null,
      clearActiveReadline: () => {},
      ...overrides,
    } as any;
  }

  const generation = {
    added: ["new-agent"],
    updated: [],
    definitions: [],
    crons: new Map(),
    cleanups: new Map(),
    warnings: [],
  } as any;

  it("rolls the agent publication back when the App generation rejects", async () => {
    let published = 0;
    let rolledBack = 0;
    let finalized = 0;
    const lifecycle = createDaemonLifecycle(
      lifecycleOptions({
        prepareAgents: async () => generation,
        publishAgents: () => {
          published++;
          return {
            rollback: () => rolledBack++,
            finalize: () => finalized++,
          };
        },
        reloadApps: async ({ publishAgents }: { publishAgents: () => void }) => {
          publishAgents();
          throw new Error("prospective App rejected");
        },
      }),
    );

    const result = await lifecycle.handleReload();
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("prospective App rejected");
    expect({ published, rolledBack, finalized }).toEqual({ published: 1, rolledBack: 1, finalized: 0 });
  });

  it("finalizes one agent publication only after the App generation commits", async () => {
    let published = 0;
    let rolledBack = 0;
    let finalized = 0;
    const lifecycle = createDaemonLifecycle(
      lifecycleOptions({
        prepareAgents: async () => generation,
        publishAgents: () => {
          published++;
          return {
            rollback: () => rolledBack++,
            finalize: () => finalized++,
          };
        },
        reloadApps: async ({ publishAgents }: { publishAgents: () => void }) => {
          publishAgents();
          return { appIds: ["may"], taskApps: 1 };
        },
      }),
    );

    const result = await lifecycle.handleReload();
    expect(result.ok).toBe(true);
    expect({ published, rolledBack, finalized }).toEqual({ published: 1, rolledBack: 0, finalized: 1 });
  });

  it("discards prepared resources when App validation fails before publication", async () => {
    let closed = 0;
    let cleaned = 0;
    const prepared = {
      ...generation,
      crons: new Map([["candidate", { close: () => closed++ }]]),
      cleanups: new Map([["candidate", [() => cleaned++]]]),
    } as any;
    const lifecycle = createDaemonLifecycle(
      lifecycleOptions({
        prepareAgents: async () => prepared,
        reloadApps: async () => {
          throw new Error("App definition rejected");
        },
      }),
    );

    const result = await lifecycle.handleReload();
    expect(result.ok).toBe(false);
    expect({ closed, cleaned }).toEqual({ closed: 1, cleaned: 1 });
  });
});
