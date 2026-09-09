import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostMaintenance } from "./runtime.js";
import { EventBus } from "../../core/events/bus.js";
import { SubagentManager } from "../../../lib/manager.js";
import { closeDb } from "../../../lib/requests.js";
import { importRuntimeModule } from "../../../lib/runtime-import.js";
import { loadMaintenanceHandlers } from "./handler-loader.js";

// Real imports deliberately finish in reverse order. The gate only controls
// module preparation; HostMaintenance and the loader own publication and dispatch.
async function setup(timers: boolean) {
  const root = mkdtempSync(join(tmpdir(), "handler-reload-"));
  const agentDir = join(root, "agents", "owner");
  mkdirSync(join(agentDir, "handlers"), { recursive: true });
  const configPath = join(agentDir, "cron.json");
  const bus = new EventBus();
  const manager = new SubagentManager({ persistDir: root });
  let installed = Promise.withResolvers<void>();
  const reports: unknown[] = [];
  bus.subscribe((event) => {
    if (event.type === "fixture.handler-ran") reports.push(event.data);
  });
  const cron = new HostMaintenance({
    configPath: configPath,
    onError: (message) => {
      if (message.startsWith("[handler] Resolved handler")) installed.resolve();
    },
    projectRoot: root,
  });
  const gates = new Map<
    string,
    { started: ReturnType<typeof Promise.withResolvers<void>>; release: ReturnType<typeof Promise.withResolvers<void>> }
  >();
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[root] = gates;
  const configure = (handler: string, marker = handler, enabled = true) => {
    installed = Promise.withResolvers<void>();
    writeFileSync(
      configPath,
      JSON.stringify([
        {
          name: "review",
          handler,
          handlerConfig: { marker },
          enabled,
          on: ["fixture.changed"],
          intervalMs: 60_000,
          offsetMs: 60_000,
        },
      ]),
    );
    cron.reload();
    return installed.promise;
  };
  const module = (name: string) => {
    const gate = { started: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() };
    gates.set(name, gate);
    const path = join(agentDir, "handlers", `${name}.ts`);
    writeFileSync(
      path,
      `
const gate = globalThis[${JSON.stringify(root)}].get(${JSON.stringify(name)});
gate.started.resolve();
await gate.release.promise;
export function create(ctx, entry) {
  return async () => ctx.sdk.emit("fixture.handler-ran", { module: ${JSON.stringify(name)}, marker: entry.handlerConfig.marker });
}
`,
    );
    return {
      started: gate.started.promise,
      finish: async () => {
        gate.release.resolve();
        await importRuntimeModule(path);
        await Bun.sleep(0); // Drain the loader/HostMaintenance continuations after import completion.
      },
    };
  };
  cron.load();
  await loadMaintenanceHandlers({
    agentsRoot: join(root, "agents"),
    persistDir: root,
    projectRoot: root,
    manager,
    bus,
    agentMaintenance: new Map([["owner", cron]]),
  });
  cron.subscribeToBus(bus);
  if (timers) cron.start();
  return {
    cron,
    configure,
    module,
    configPath,
    fire: async () => {
      bus.emit({ type: "fixture.changed", source: "fixture", owner: "host:maintenance", data: {} });
      await Bun.sleep(0);
      return reports;
    },
    close: () => {
      cron.close();
      for (const gate of gates.values()) gate.release.resolve();
      delete globals[root];
      closeDb(root);
      closeDb(join(root, ".state"));
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe("handler reload publication", () => {
  it.each([false, true])("rejects a late import and refreshes captured config (timers=%s)", async (timers) => {
    const fixture = await setup(timers);
    try {
      const a = fixture.module("a");
      const b = fixture.module("b");
      void fixture.configure("a");
      await a.started;
      const installed = fixture.configure("b");
      await b.started;
      await b.finish();
      await installed;
      await a.finish();
      expect(await fixture.fire()).toEqual([{ module: "b", marker: "b" }]);
      await fixture.configure("b", "updated");
      expect(await fixture.fire()).toEqual([
        { module: "b", marker: "b" },
        { module: "b", marker: "updated" },
      ]);
    } finally {
      fixture.close();
    }
  });

  it.each(["disable", "remove", "close"])("does not publish pending imports after %s", async (action) => {
    const fixture = await setup(false);
    try {
      const pending = fixture.module("pending");
      void fixture.configure("pending");
      await pending.started;
      if (action === "disable") void fixture.configure("pending", "pending", false);
      else if (action === "remove") {
        writeFileSync(fixture.configPath, "[]");
        fixture.cron.reload();
      } else fixture.cron.close();
      await pending.finish();
      expect(fixture.cron.hasHandler("review")).toBe(false);
    } finally {
      fixture.close();
    }
  });
});
