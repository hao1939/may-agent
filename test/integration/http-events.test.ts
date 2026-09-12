import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openStateDb, type SqliteDb } from "../../src/app/http/read-model/state-db.js";
import { createQueryService } from "../../src/lib/query-service.js";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";
import type { SubagentManager } from "../../src/lib/manager.js";
import { closeDb } from "../../src/lib/db/connection.js";

describe("HTTP event reads", () => {
  let root: string;
  let db: SqliteDb;
  let child: ChildProcess;
  let stopped: Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "may-http-events-"));
    db = openStateDb(join(root, "may.db"));
    // Exercise the standalone adapter, not a daemon or model-backed App.
    child = spawn(
      "bun",
      [resolve(import.meta.dir, "../../src/app/http/server.ts"), "--state-dir", root, "--port", "0"],
      {
        cwd: root,
        env: { ...process.env, PROJECT_ROOT: root, AGENTS_ROOT: root, PROJECTS_ROOT: root, SHARED_ROOT: root },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    stopped = new Promise((done) => child.once("close", () => done()));
    let logs = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      baseUrl = await new Promise<string>((ready, reject) => {
        timer = setTimeout(() => reject(new Error(`HTTP startup timed out: ${logs}`)), 10_000);
        child.once("error", reject);
        child.once("exit", (code) => reject(new Error(`HTTP exited (${code}): ${logs}`)));
        child.stderr!.on("data", (chunk) => {
          logs += chunk.toString();
        });
        child.stdout!.on("data", (chunk) => {
          logs += chunk.toString();
          const port = logs.match(/url:\s+http:\/\/localhost:(\d+)/)?.[1];
          if (port) ready(`http://127.0.0.1:${port}`);
        });
      });
      // Open the adapter's cached DB before tests alter their temporary schema.
      await read("/api/events");
    } finally {
      clearTimeout(timer);
    }
  });

  afterEach(async () => {
    child?.kill("SIGKILL");
    await stopped;
    db?.close();
    if (root) closeDb(root);
    if (root) rmSync(root, { recursive: true, force: true });
  });

  async function read(path: string) {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(5_000) });
    expect(response.status).toBe(200);
    return response.json();
  }

  it("opens failed workflow facts through HTTP without a daemon or metric collector", async () => {
    const workflows = join(root, "workflows");
    mkdirSync(workflows);
    writeFileSync(join(workflows, "report.ts"), `
      export const name = "report";
      export const description = "Fixture report";
      export async function execute(ctx) {
        ctx.log.info("prepared partial report");
        throw new Error("upload unavailable");
      }`);
    const runner = createWorkflowRunner({ manager: {} as SubagentManager, workflowDir: workflows, persistDir: root });
    const result = await runner.run("report", "fixture");
    if (result.type !== "error" || !result.workflowRunId) throw new Error("Expected failed workflow identity");
    const trace = await read(`/api/loop-trace?workflowRunId=${result.workflowRunId}`);
    expect(trace.workflowFacts.run).toMatchObject({ status: "error", result_reason: "upload unavailable" });
    expect(trace.workflowFacts.diagnostics).toMatchObject({ state: "available", truncated: false,
      entries: [{ level: "info", message: "prepared partial report" }] });
    expect(trace.workflowFacts.stepsTruncated).toBe(false);
    expect((await read("/api/loop-trace?workflowRunId=wr_missing")).workflowFacts).toBeNull();
  });

  function event(
    type: string,
    timestamp: number,
    status = "unhandled",
    ttl: number | null = null,
    owner = "agent:may",
  ) {
    return Number(
      db
        .prepare(
          `INSERT INTO events
      (event_type, source, owner, data, timestamp, delivery_status, ttl_ms)
      VALUES (?, 'test', ?, '{"facts":"kept"}', ?, ?, ?)`,
        )
        .run(type, owner, timestamp, status, ttl).lastInsertRowid,
    );
  }

  it("keeps the row-array response, exact filters, stored data, and stable newest-first order", async () => {
    const first = event("sample", 1);
    const second = event("sample", 1);
    const newest = event("sample", 2);
    event("other", 3);
    event("sample", 4, "unhandled", null, "may");
    const rows = await read("/api/events?owner=agent%3Amay&type=sample");
    expect(rows.map((row: { id: number }) => row.id)).toEqual([newest, second, first]);
    expect(rows).toEqual(createQueryService({ getDb: () => db }).events({ owner: "agent:may", type: "sample" }).rows);
    expect(rows[0]).toMatchObject({ event_type: "sample", owner: "agent:may", data: '{"facts":"kept"}' });
    expect(await read("/api/events?owner=missing")).toEqual([]);
    expect(await read("/api/events?owner=&type=")).toHaveLength(5);
  });

  it("bounds event lists even for negative, excessive, and invalid limits", async () => {
    db.exec("BEGIN");
    for (let i = 0; i < 501; i++) event("sample", i);
    db.exec("COMMIT");
    for (const [limit, count] of [
      ["", 100],
      ["200", 200],
      ["9999", 500],
      ["-1", 1],
      ["0", 1],
      ["invalid", 100],
      ["2.9", 2],
    ] as const) {
      expect(await read(`/api/events?limit=${limit}`)).toHaveLength(count);
    }
  });

  it("retains the four health groups, lookback, TTL rules, pair facts, and ordering", async () => {
    const now = Date.now();
    const minute = 60_000;
    const unhandled = event("unhandled", now - minute);
    const unhandledLaterId = event("unhandled-tie", now - minute);
    const expired = event("default-ttl-expired", now - 3 * minute, "pending");
    event("default-ttl-fresh", now - minute, "pending");
    const customExpired = event("custom-ttl-expired", now - minute, "pending", 100);
    event("custom-ttl-fresh", now - 3 * minute, "pending", 10 * minute);
    event("accepted", now - minute, "accepted");
    event("old", now - 7 * 60 * minute);
    const pair = (
      key: string,
      status: string,
      openedAt: number,
      expectedAt: number,
      closedAt: number | null = null,
    ) => {
      db.prepare(
        `INSERT INTO event_pair_runs
        (pair_name, correlation_key, open_event_id, status, opened_at, expected_close_at, closed_at)
        VALUES ('sample', ?, ?, ?, ?, ?, ?)`,
      ).run(key, unhandled, status, openedAt, expectedAt, closedAt);
    };
    pair("orphan", "orphan", now - minute, now - minute);
    pair("closed-orphan", "orphan", now - minute, now - minute, now);
    pair("overdue", "open", now - minute, now - minute);
    pair("overdue-tie", "open", now - minute, now - minute);
    pair("earlier-deadline", "open", now - 2 * minute, now - 2 * minute);
    pair("not-due", "open", now - minute, now + minute);
    pair("old", "open", now - 7 * 60 * minute, now - minute);

    const health = await read("/api/events/delivery-health");
    expect(health).toEqual({
      ...createQueryService({ getDb: () => db }).eventDeliveryHealth({ now: health.now }),
      lookbackMs: 6 * 60 * minute,
      schemaReady: true,
    });
    expect(health.unhandledEvents.map((row: { id: number }) => row.id)).toEqual([unhandledLaterId, unhandled]);
    expect(health.overduePendingEvents.map((row: { id: number }) => row.id)).toEqual([customExpired, expired]);
    expect(health.orphanPairs.map((row: { correlationKey: string }) => row.correlationKey)).toEqual(["orphan"]);
    expect(health.overdueOpenPairs.map((row: { correlationKey: string }) => row.correlationKey)).toEqual([
      "earlier-deadline",
      "overdue",
      "overdue-tie",
    ]);
    expect(health.orphanPairs[0]).toMatchObject({
      openEventId: unhandled,
      openEventType: "unhandled",
      openEventData: '{"facts":"kept"}',
    });
  });

  it("retains HTTP's narrower health limits and bounds invalid numeric input", async () => {
    const now = Date.now();
    for (let i = 0; i < 101; i++) event("sample", now);
    for (const [limit, count] of [
      ["", 25],
      ["8", 8],
      ["9999", 100],
      ["-1", 1],
      ["0", 1],
      ["invalid", 25],
      ["2.9", 2],
    ] as const) {
      const health = await read(`/api/events/delivery-health?limit=${limit}`);
      expect(health.schemaReady).toBe(true);
      expect(health.unhandledEvents).toHaveLength(count);
    }
    for (const [input, lookbackMs] of [
      ["-1", 1],
      ["0", 1],
      ["999999999", 86_400_000],
      ["invalid", 21_600_000],
      ["3600000", 3_600_000],
    ] as const) {
      const health = await read(`/api/events/delivery-health?lookbackMs=${input}`);
      expect(health.schemaReady).toBe(true);
      expect(health.lookbackMs).toBe(lookbackMs);
      expect(health.since).toBe(health.now - lookbackMs);
    }
  });

  it("still distinguishes unavailable delivery schema from empty healthy results", async () => {
    expect(await read("/api/events/delivery-health")).toMatchObject({ schemaReady: true, unhandledEvents: [] });
    db.exec("DROP TABLE event_pair_runs");
    expect(await read("/api/events/delivery-health")).toMatchObject({
      schemaReady: false,
      note: "event delivery schema is not migrated in this state database yet",
      unhandledEvents: [],
      overduePendingEvents: [],
      orphanPairs: [],
      overdueOpenPairs: [],
    });
  });

  it("preserves health query errors and the legacy empty event-list fallback", async () => {
    db.exec("ALTER TABLE event_pair_runs DROP COLUMN note");
    expect(await read("/api/events/delivery-health")).toMatchObject({
      schemaReady: false,
      error: expect.stringContaining("note"),
      unhandledEvents: [],
      overduePendingEvents: [],
      orphanPairs: [],
      overdueOpenPairs: [],
    });
    db.exec("DROP TABLE events");
    expect(await read("/api/events")).toEqual([]);
  });
});
