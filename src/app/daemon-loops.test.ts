import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

for (const failure of ["missing-binding", "storage", "close-flush"] as const) {
  test(`console survives ${failure} input failure without accepting or retrying it`, async () => {
    const root = mkdtempSync(join(tmpdir(), "may-console-failure-"));
    const moduleUrl = (path: string) => JSON.stringify(new URL(path, import.meta.url).href);
    const child = Bun.spawn(
      [process.execPath, "--eval", `
        import assert from "node:assert/strict";
        import { runInteractiveLoop } from ${moduleUrl("./daemon-loops.ts")};
        import { attachCommandRouter } from ${moduleUrl("./command-router.ts")};
        import { EventBus } from ${moduleUrl("./core/events/bus.ts")};
        import { DbWriter } from ${moduleUrl("../lib/db-writer.ts")};
        import { getDb, closeDb } from ${moduleUrl("../lib/db/connection.ts")};

        const root = ${JSON.stringify(root)};
        const failure = ${JSON.stringify(failure)};
        const bus = new EventBus();
        const writer = new DbWriter(root);
        bus.setPersistenceSubscriber(writer.handler);
        bus.setDeliveryRecorder(writer.recordDelivery);
        const db = getDb(root);
        if (failure === "storage") db.exec(
          "CREATE TEMP TRIGGER reject_input BEFORE INSERT ON events " +
          "WHEN NEW.event_type = 'app.input.requested' " +
          "BEGIN SELECT RAISE(ABORT, 'fixture input storage unavailable'); END"
        );
        const manager = { status: () => [], run: () => { throw new Error("unexpected model call"); } };
        let readline;
        let prompts = 0;
        let reloads = 0;
        let inputs = 0;
        let closed = 0;
        const sendLine = (text) => process.stdin.emit("data", Buffer.from(text + "\\n"));
        const router = attachCommandRouter({
          bus, manager, projectRoot: root, interfaceAgent: "helper",
          conversationAppId: failure === "storage" ? "support" : undefined,
          reload: () => {
            reloads++;
            setImmediate(() => sendLine("quit"));
            return { ok: true, summary: "fixture reload complete" };
          },
          restart: () => { throw new Error("unexpected restart"); },
          shutdown: () => { throw new Error("unexpected shutdown"); },
        });
        await runInteractiveLoop({
          bus, manager,
          handleInput: (text, source) => { inputs++; router.handleInput(text, source); },
          gracefulShutdown: () => { throw new Error("unexpected shutdown"); },
          socketUI: { close: () => closed++ },
          telegramBot: { close: () => closed++ },
          setActiveReadline: (rl) => { readline = rl; },
          isCancelLatched: () => false, latchCancel: () => {},
          emitPrompt: () => {
            if (++prompts === 1) setImmediate(() => {
              sendLine("hello");
              if (failure === "close-flush") readline.close();
            });
            else if (failure !== "close-flush") setImmediate(() => sendLine("/reload"));
          },
        });
        assert.equal(prompts, 2);
        assert.equal(inputs, failure === "close-flush" ? 1 : 2);
        assert.equal(reloads, failure === "close-flush" ? 0 : 1);
        assert.equal(closed, 2);
        assert.equal(readline, null);
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'app.input.requested'").get().n, 0);
        router.close();
        closeDb(root);
        console.log("console survived");
      `],
      { stdin: "pipe", stdout: "pipe", stderr: "pipe", timeout: 10_000 },
    );
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect({ code, stderr }).toMatchObject({ code: 0 });
      expect(stdout).toContain("console survived");
      expect(stderr).toContain(failure === "storage"
        ? "[console] Input failed: fixture input storage unavailable"
        : "[console] Input failed: No Conversation App is configured");
    } finally {
      child.kill();
      await child.exited;
      rmSync(root, { recursive: true, force: true });
    }
  }, 15_000);
}

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
