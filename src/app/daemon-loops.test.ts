import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("heartbeat retries failed file writes and never grows the event journal", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-heartbeat-"));
  const moduleUrl = (path: string) => JSON.stringify(new URL(path, import.meta.url).href);
  // Isolate the daemon's never-ending loop and accelerate its real recurring
  // timer. The EventBus/DbWriter journal and file persistence remain production code.
  const child = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `
      import assert from "node:assert/strict";
      import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
      import { runDaemonKeepalive } from ${moduleUrl("./daemon-loops.ts")};
      import { EventBus } from ${moduleUrl("./core/events/bus.ts")};
      import { DbWriter } from ${moduleUrl("../lib/db-writer.ts")};
      import { getDb, closeDb } from ${moduleUrl("../lib/db/connection.ts")};

      const root = ${JSON.stringify(root)};
      const instanceDir = root + "/instances/fixture-instance";
      const heartbeatPath = instanceDir + "/fixture.heartbeat.json";
      mkdirSync(root + "/instances", { recursive: true });
      writeFileSync(instanceDir, "blocks heartbeat directory");
      const writer = new DbWriter(root);
      const db = getDb(root);
      const bus = new EventBus();
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      const journalCount = () => db.prepare(
        "SELECT COUNT(*) AS n FROM events WHERE event_type = 'runtime.daemon.heartbeat'"
      ).get().n;

      const schedule = globalThis.setInterval;
      let ticks = 0;
      globalThis.setInterval = (callback, intervalMs) => {
        assert.equal(intervalMs, 60_000);
        assert.equal(journalCount(), 0); // Failed startup did not invent freshness.
        return schedule(() => {
          callback();
          if (++ticks === 1) {
            assert.equal(journalCount(), 0);
            rmSync(instanceDir, { force: true });
            mkdirSync(instanceDir);
          } else {
            const first = JSON.parse(readFileSync(heartbeatPath, "utf8"));
            assert.equal(journalCount(), 0);
            callback();
            const second = JSON.parse(readFileSync(heartbeatPath, "utf8"));
            assert.equal(journalCount(), 0);
            assert.equal(second.pid, process.pid);
            assert.equal(second.processIdentity, first.processIdentity);
            assert.ok(second.recordedAt >= first.recordedAt);
            console.log(JSON.stringify({ ticks, first, second }));
            closeDb(root);
            process.exit(0);
          }
        }, 10);
      };
      await runDaemonKeepalive({
        bus,
        persistDir: root,
        instanceLabel: "fixture-instance",
        interfaceAgent: "fixture",
        socketEnabled: false,
      });
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
    expect(failures).toHaveLength(2);
    expect(failures).toEqual([
      { type: "runtime.daemon.heartbeat.failed", error: expect.stringContaining("EEXIST") },
      { type: "runtime.daemon.heartbeat.failed", error: expect.stringContaining("EEXIST") },
    ]);
    const result = JSON.parse(stdout.trim());
    expect(result).toMatchObject({
      ticks: 2,
      second: {
        version: 1,
        interfaceAgent: "fixture",
        socketEnabled: false,
        sql: { calls: expect.any(Number), errors: expect.any(Number), totalMs: expect.any(Number) },
      },
    });
  } finally {
    child.kill();
    await child.exited;
    rmSync(root, { recursive: true, force: true });
  }
}, 20_000);
