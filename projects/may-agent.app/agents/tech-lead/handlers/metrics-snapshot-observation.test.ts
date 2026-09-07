import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHostTestRuntime } from "./testing.ts";
import { create } from "./metrics-snapshot.ts";

describe("metrics snapshot preserves session evidence", () => {
  const fixtures: ReturnType<typeof createHostTestRuntime>[] = [];

  afterEach(() => {
    for (const runtime of fixtures.splice(0)) {
      runtime.close();
      rmSync(runtime.root, { recursive: true, force: true });
    }
  });

  function fixture() {
    const root = mkdtempSync(join(tmpdir(), "metrics-observation-"));
    mkdirSync(join(root, "agents"));
    const runtime = createHostTestRuntime({ root });
    fixtures.push(runtime);
    const snapshot = create(
      {
        sdk: runtime.sdk,
        agentName: "tech-lead",
        classifyError: () => "unknown",
        getLastDigest: () => null,
        upsertDigest: async () => undefined,
      },
      {},
    );
    const mismatch = () =>
      runtime.db
        .prepare(
          "SELECT current FROM metrics WHERE id = 'capability.status-reality-mismatch-count'",
        )
        .get() as { current: number };
    return { ...runtime, snapshot, mismatch };
  }

  for (const status of ["done", "error", "interrupted"]) {
    it(`keeps a missing ${status} session end visible until real evidence arrives`, async () => {
      const { db, snapshot, mismatch } = fixture();
      const now = Date.now();
      db.prepare(
        "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        "missing-end",
        "worker",
        "example task",
        status,
        now - 120_000,
        now - 60_000,
      );
      const sessions = db.prepare("SELECT * FROM sessions").all();

      for (let sample = 0; sample < 2; sample++) {
        await snapshot();
        expect(
          db
            .prepare("SELECT * FROM events WHERE event_type = 'session.end'")
            .all(),
        ).toEqual([]);
        expect(db.prepare("SELECT * FROM sessions").all()).toEqual(sessions);
        expect(mismatch()).toEqual({ current: 1 });
      }
      expect(
        db
          .prepare(
            "SELECT value FROM metric_snapshots WHERE metric_id = 'capability.status-reality-mismatch-count' ORDER BY id",
          )
          .all(),
      ).toEqual([{ value: 1 }, { value: 1 }]);

      // Simulate evidence arriving from the session owner, not the collector.
      const evidence = JSON.stringify({
        sessionId: "missing-end",
        agent: "worker",
        status,
      });
      db.prepare(
        "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ).run("session.end", evidence, now);
      const events = db.prepare("SELECT * FROM events").all();
      await snapshot();
      expect(mismatch()).toEqual({ current: 0 });
      expect(db.prepare("SELECT * FROM events").all()).toEqual(events);
      expect(db.prepare("SELECT * FROM sessions").all()).toEqual(sessions);
    });
  }

  it("does not infer completion for a running session", async () => {
    const { db, snapshot, mismatch } = fixture();
    db.prepare(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
    ).run("still-running", "worker", "example task", "running", Date.now());
    await snapshot();
    expect(mismatch()).toEqual({ current: 0 });
    expect(
      db.prepare("SELECT * FROM events WHERE event_type = 'session.end'").all(),
    ).toEqual([]);
    expect(db.prepare("SELECT status, endedAt FROM sessions").all()).toEqual([
      { status: "running", endedAt: null },
    ]);
  });
});
