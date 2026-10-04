import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("heartbeat survives locked storage at startup and on a timer, then records the next sample", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-heartbeat-"));
  const moduleUrl = (path: string) => JSON.stringify(new URL(path, import.meta.url).href);
  // Isolate the daemon's never-ending loop and timer acceleration in a child.
  // Persistence, SQLite contention, and the recurring timer remain real.
  const child = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `
      import assert from "node:assert/strict";
      import { runDaemonKeepalive } from ${moduleUrl("./daemon-loops.ts")};
      import { EventBus } from ${moduleUrl("./core/events/bus.ts")};
      import { DbWriter } from ${moduleUrl("../lib/db-writer.ts")};
      import { getDb, closeDb } from ${moduleUrl("../lib/db/connection.ts")};
      import { openDatabase } from ${moduleUrl("../lib/db.ts")};

      const root = ${JSON.stringify(root)};
      const writer = new DbWriter(root);
      const db = getDb(root);
      const locker = openDatabase(root + "/may.db");
      const bus = new EventBus();
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      const samples = () => db.prepare(
        "SELECT delivery_status, delivery_route, data FROM events WHERE event_type = 'runtime.daemon.heartbeat'"
      ).all();
      locker.exec("BEGIN IMMEDIATE");

      const schedule = globalThis.setInterval;
      let ticks = 0;
      globalThis.setInterval = (callback, intervalMs) => {
        assert.equal(intervalMs, 60_000);
        assert.deepEqual(samples(), []); // Failed startup did not invent a sample.
        return schedule(() => {
          callback();
          if (++ticks === 1) {
            assert.deepEqual(samples(), []); // The timer failure also leaves a gap.
            locker.exec("COMMIT");
          } else {
            const rows = samples();
            assert.equal(rows.length, 1);
            console.log(JSON.stringify({ ticks, sample: rows[0] }));
            locker.close();
            closeDb(root);
            process.exit(0);
          }
        }, 10);
      };
      await runDaemonKeepalive({ bus, interfaceAgent: "fixture", socketEnabled: false });
    `,
    ],
    { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 15_000 },
  );
  try {
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ code, stderr }).toMatchObject({ code: 0 });
    const failures = stderr
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));
    expect(failures).toEqual([
      { type: "runtime.daemon.heartbeat.failed", error: expect.stringContaining("locked") },
      { type: "runtime.daemon.heartbeat.failed", error: expect.stringContaining("locked") },
    ]);
    const result = JSON.parse(stdout.trim());
    expect(result).toMatchObject({ ticks: 2, sample: { delivery_status: "accepted", delivery_route: "noop" } });
    expect(JSON.parse(result.sample.data)).toMatchObject({
      interfaceAgent: "fixture",
      socketEnabled: false,
      sql: { calls: expect.any(Number), errors: expect.any(Number) },
    });
  } finally {
    child.kill();
    await child.exited;
    rmSync(root, { recursive: true, force: true });
  }
}, 20_000);
