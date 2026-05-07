import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create } from "../agents/may/handlers/metrics-snapshot.ts";
import { closeDb, getDb } from "../src/lib/requests.js";

describe("metrics-snapshot session health metrics", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      closeDb(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("measures failure triage as an outcome metric and aftermath coverage as liveness", async () => {
    const root = join(tmpdir(), `metrics-session-health-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");

    const db = getDb(root);
    const now = Date.now();
    const ended = now - 10 * 60_000;

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_failed_triaged", "arc", "task", "interrupted", ended - 60_000, ended, "boom"],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_failed_untriaged", "dev", "task", "error", ended - 50_000, ended, "boom"],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s_done_good", "scout", "task", "done", ended - 40_000, ended],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_old_failed", "arc", "task", "error", now - 4 * 3600_000, now - 4 * 3600_000 + 60_000, "old"],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_self", "evaluator", "task", "interrupted", ended - 30_000, ended, "self"],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["s_stale_running", "arc", "task", "running", now - 31 * 60_000],
    );

    db.run(
      `INSERT INTO evaluations (
        sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
        verdict, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_failed_triaged", "arc", 0.2, 0.8, 0, 1, "needs_improvement", now],
    );
    db.run(
      `INSERT INTO evaluations (
        sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
        verdict, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_done_good", "scout", 0.85, 0.8, 5, 0, "good", now],
    );

    const emitted: any[] = [];
    const handler = create({
      sdk: {
        getDb: () => db,
        paths: { root, agents: join(root, "agents") },
        log: () => {},
        emit: (event: any) => emitted.push(event),
      },
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = (id: string) => db.prepare("SELECT current, target, threshold, priority FROM metrics WHERE id = ?").get(id) as any;

    expect(metric("session.failed-triage-rate-3h")).toMatchObject({
      current: 0.5,
      target: 1,
      threshold: 0.8,
      priority: "P1",
    });
    expect(metric("evaluator.aftermath-coverage-rate-3h")).toMatchObject({
      current: 0.6667,
      target: 0.8,
      threshold: 0.2,
      priority: "P3",
    });
    expect(metric("evaluator.low-quality-rate-24h")).toMatchObject({
      current: 0.5,
      target: 0.1,
      threshold: 0.3,
      priority: "P2",
    });
    expect(metric("evaluator.stale-running-session-count")).toMatchObject({
      current: 1,
      target: 0,
      threshold: 0,
      priority: "P1",
    });
  });
});
