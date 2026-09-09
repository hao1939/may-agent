import { afterEach, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostMaintenance } from "./runtime.js";
import { EventBus, EVENT_DELIVERY_RESULT, type SystemEvent } from "../../core/events/bus.js";
import { closeDb } from "../../../lib/requests.js";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function fixture(emitEvent?: (event: SystemEvent) => void) {
  const root = mkdtempSync(join(tmpdir(), "maintenance-boundary-"));
  const configPath = join(root, "cron.json");
  const entry = { name: "review", handler: "review", intervalMs: 60000, offsetMs: 1, on: ["fixture.changed"] };
  writeFileSync(configPath, JSON.stringify([entry]));
  const errors: string[] = [];
  const runtime = new HostMaintenance({
    configPath,
    projectRoot: root,
    emitEvent,
    onError: (message) => {
      errors.push(message);
    },
  });
  runtime.load();
  cleanups.push(() => {
    runtime.close();
    closeDb(join(root, ".state"));
    rmSync(root, { recursive: true, force: true });
  });
  return { runtime, configPath, entry, errors };
}

it("does not acknowledge App work from a dispatched or queued maintenance observation", async () => {
  const bus = new EventBus();
  const f = fixture((event) => bus.emit(event));
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  f.runtime.registerHandler("review", async () => {
    started.resolve();
    await release.promise;
  });
  f.runtime.subscribeToBus(bus);
  try {
    const emit = () => bus.emit({ type: "fixture.changed", source: "fixture", owner: "host:maintenance", data: {} });
    expect(emit()[EVENT_DELIVERY_RESULT]).toBeUndefined();
    await started.promise;
    for (let index = 0; index < 5; index++) expect(emit()[EVENT_DELIVERY_RESULT]).toBeUndefined();
    expect(f.errors.some((error) => error.includes("dropping oldest"))).toBeTrue();
    f.runtime.close();
    expect(f.runtime.triggerNow("review", { force: true })).toBeFalse();
  } finally {
    release.resolve();
  }
});

it("uses prepared declarations until explicit reload and retains them when reload is rejected", async () => {
  const f = fixture();
  const ran = Promise.withResolvers<void>();
  f.runtime.registerHandler("review", async () => {
    ran.resolve();
  });
  writeFileSync(f.configPath, JSON.stringify([{ ...f.entry, enabled: false }]));
  f.runtime.start();
  await ran.promise;
  expect(f.runtime.getEntries()[0]?.enabled).not.toBe(false);
  writeFileSync(f.configPath, JSON.stringify([{ ...f.entry, handler: { workflow: "obsolete" } }]));
  expect(() => f.runtime.reload()).toThrow("requires a named handler");
  expect(f.runtime.getEntries()[0]).toEqual(f.entry);
  writeFileSync(f.configPath, JSON.stringify([{ ...f.entry, enabled: false }]));
  f.runtime.reload();
  expect(f.runtime.triggerNow("review", { force: true })).toBeFalse();
});

it("does not count failed start publication as a run or leave maintenance permanently busy", async () => {
  let available = false;
  const completed = Promise.withResolvers<void>();
  const f = fixture((event) => {
    if (!available) throw new Error("database unavailable");
    if (event.type === "handler.completed") completed.resolve();
  });
  let calls = 0;
  f.runtime.registerHandler("review", async () => {
    calls++;
  });
  expect(f.runtime.triggerNow("review", { force: true })).toBeFalse();
  expect(calls).toBe(0);
  available = true;
  expect(f.runtime.triggerNow("review", { force: true })).toBeTrue();
  await completed.promise;
  expect(calls).toBe(1);
  expect(f.errors.some((error) => error.includes("Observation publication failed"))).toBeTrue();
});

it("contains failure-notification errors and leaves later maintenance runnable", async () => {
  const failed = Promise.withResolvers<void>();
  const f = fixture((event) => {
    if (event.type === "handler.failed") {
      failed.resolve();
      throw new Error("database unavailable");
    }
  });
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    f.runtime.registerHandler("review", async () => {
      throw new Error("fixture failure");
    });
    f.runtime.triggerNow("review", { force: true });
    await failed.promise;
    const ran = Promise.withResolvers<void>();
    f.runtime.registerHandler("review", async () => {
      ran.resolve();
    });
    expect(f.runtime.triggerNow("review", { force: true })).toBeTrue();
    await ran.promise;
    expect(f.errors.some((error) => error.includes("Observation publication failed"))).toBeTrue();
  } finally {
    log.mockRestore();
  }
});
