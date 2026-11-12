import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openStateDb, type SqliteDb } from "../../src/app/http/read-model/state-db.js";
import { createQueryService } from "../../src/lib/query-service.js";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";
import type { SubagentManager } from "../../src/lib/manager.js";
import { closeDb } from "../../src/lib/db/connection.js";
import { upsertSession } from "../../src/lib/db/sessions.js";

describe("HTTP event reads", () => {
  let root: string;
  let db: SqliteDb;
  let child: ChildProcess;
  let stopped: Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "may-http-events-"));
    db = openStateDb(join(root, "may.db"));
    mkdirSync(join(root, "agents"));
    // Exercise the standalone adapter, not a daemon or model-backed App.
    child = spawnFixtureProcess(
      [resolve(import.meta.dir, "../../src/app/http/server.ts"), "--state-dir", root, "--port", "0"],
      {
        cwd: root,
        env: { ...process.env, AGENT: "helper", CONVERSATION_APP: "support", CONVERSATION_ID: "retained-room", PROJECT_ROOT: root, AGENTS_ROOT: join(root, "agents"), PROJECTS_ROOT: root, SHARED_ROOT: root },
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

  it("exposes independent interface identities and excludes disabled App agents", async () => {
    expect(await read("/api/interface")).toEqual({ agent: "helper", appId: "support", conversationId: "retained-room" });
    for (const [app, disabled] of [["support", false], ["retired", true]] as const) {
      const appDir = join(root, `${app}.app`);
      const dir = join(appDir, "agents", app);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(appDir, "app.ts"), "export default {};\n");
      writeFileSync(join(dir, "agent.json"), JSON.stringify({ name: app }));
      if (disabled) writeFileSync(join(appDir, ".disabled"), "");
    }
    const catalog = await read("/api/agents");
    expect(catalog.map((agent: { name: string }) => agent.name)).toEqual(["support"]);
  });

  function metadata(path: string, file: string, content: string) {
    const dir = join(root, path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), content);
    return dir;
  }

  it("shares projected JSON posture across project list, detail and agent counts without changing source identity", async () => {
    metadata("agents/worker", "agent.json", JSON.stringify({ name: "worker" }));
    const source = JSON.stringify({ id: "stable.app", owner: "agent:worker", status: "active", goal: "Source goal" });
    const dir = metadata("sample.app", "project.json", source);
    const state = metadata("sample.app/.state", "project-state.json", JSON.stringify({
      id: "wrong", owner: "other", status: "blocked", currentState: { summary: "Waiting for review" },
    }));
    upsertSession(root, { sessionId: "s_json", agent: "worker", task: "Inspect the result",
      projectId: "agent:worker/stable.app", status: "done", startedAt: 1 });

    expect(await read("/api/projects")).toMatchObject([
      { name: "stable.app", path: "projects/sample.app", owner: "agent:worker", status: "blocked", formatErrors: [] },
    ]);
    expect(await read("/api/projects/detail?path=projects/sample.app")).toMatchObject({
      name: "stable.app", owner: "agent:worker", projectId: "agent:worker/stable.app", status: "blocked",
      currentState: "Waiting for review", goal: "Source goal", app: { appId: "stable" }, sessionCount: 1,
    });
    expect(await read("/api/projects/sessions?path=projects/sample.app")).toMatchObject([
      { sessionId: "s_json", link: "tagged" },
    ]);
    expect(await read("/api/agents")).toMatchObject([{ name: "worker", projectsTotal: 1, projectsActive: 0 }]);
    writeFileSync(join(state, "project-state.json"), JSON.stringify({ status: "active" }));
    expect((await read("/api/projects"))[0].status).toBe("active");
    expect((await read("/api/projects/detail?path=projects/sample.app")).status).toBe("active");
    expect(await read("/api/agents")).toMatchObject([{ name: "worker", projectsTotal: 1, projectsActive: 1 }]);
    expect(readFileSync(join(dir, "project.json"), "utf8")).toBe(source);
    expect(db.prepare("SELECT projectId FROM sessions WHERE sessionId = 's_json'").get()).toEqual({ projectId: "agent:worker/stable.app" });
  });

  it.each([
    ["owner: worker\nid: saved-label\nstatus: active", "shared"],
    ["id: saved-label\nowner: worker\nstatus: active", "worker"],
    ["id: saved-label\nstatus: active\nowner: worker", "shared"],
  ])("retains Markdown session links with frontmatter %s", async (frontmatter, oldOwner) => {
    const saved = `---\n${frontmatter}\n---\n\n## Goal\nRetained project goal\n`;
    const dir = metadata("legacy-project", "project.md", saved);
    metadata("agents/worker", "agent.json", JSON.stringify({ name: "worker" }));
    for (const [sessionId, projectId, startedAt] of [
      ["s_current", "worker/legacy-project", 2], ["s_historical", `${oldOwner}/legacy-project`, 1],
    ] as const) upsertSession(root, { sessionId, projectId, startedAt, agent: "worker", task: "Inspect the result", status: "done" });
    const before = db.prepare("SELECT sessionId, projectId FROM sessions ORDER BY sessionId").all();
    expect(await read("/api/projects")).toMatchObject([
      { name: "saved-label", path: "projects/legacy-project", owner: "worker", status: "active", formatErrors: [] },
    ]);
    expect(await read("/api/projects/detail?path=projects/legacy-project")).toMatchObject({
      name: "legacy-project", owner: "worker", projectId: "worker/legacy-project", sessionCount: 2, goal: "Retained project goal",
      recentSessions: [{ sessionId: "s_current", link: "tagged" }, { sessionId: "s_historical", link: "tagged" }],
    });
    expect(await read("/api/projects/sessions?path=projects/legacy-project")).toMatchObject([
      { sessionId: "s_current", link: "tagged" }, { sessionId: "s_historical", link: "tagged" },
    ]);
    expect(await read("/api/agents")).toMatchObject([{ name: "worker", projectsTotal: 1, projectsActive: 1 }]);
    expect(db.prepare("SELECT sessionId, projectId FROM sessions ORDER BY sessionId").all()).toEqual(before);
    expect(readFileSync(join(dir, "project.md"), "utf8")).toBe(saved);
  });

  it("keeps per-agent Markdown readable beside a shared project with the same basename", async () => {
    const saved = "# Old project\n\n**Owner**: worker\n**Status**: active\n\n## Goal\nRetained agent project\n";
    metadata("agents/worker/workspace/projects/old-project", "project.md", saved);
    metadata("old-project", "project.md", "---\nid: old-project\nowner: another\nstatus: waiting\n---\n\n## Goal\nShared project\n");
    metadata("agents/worker", "agent.json", JSON.stringify({ name: "worker" }));
    upsertSession(root, { sessionId: "s_old", projectId: "shared/old-project", startedAt: 1,
      agent: "worker", task: "Inspect the result", status: "done" });
    const path = "agents/worker/workspace/projects/old-project";
    const params = new URLSearchParams({ path });
    expect(await read("/api/projects")).toMatchObject([
      { path: "projects/old-project", owner: "another" }, { path, owner: "worker", status: "active", formatErrors: [] },
    ]);
    expect(await read(`/api/projects/detail?${params}`)).toMatchObject({
      owner: "worker", projectId: "worker/old-project", goal: "Retained agent project", sessionCount: 1,
    });
    expect(await read(`/api/projects/content?${params}`)).toEqual({ content: saved });
    expect(await read(`/api/projects/sessions?${params}`)).toMatchObject([{ sessionId: "s_old", link: "tagged" }]);
    expect(await read("/api/agents")).toMatchObject([{ name: "worker", projectsTotal: 1, projectsActive: 1 }]);
  });

  it("keeps missing and damaged metadata distinct while retaining exact saved session tags", async () => {
    metadata("damaged.app", "project.json", "{ damaged");
    expect(await read("/api/projects")).toEqual([]);
    expect((await fetch(baseUrl + "/api/projects/detail?path=projects/damaged.app")).status).toBe(500);
    expect((await fetch(baseUrl + "/api/projects/detail?path=projects/missing-project")).status).toBe(404);
    upsertSession(root, { sessionId: "s_missing", projectId: "shared/missing-project", startedAt: 1,
      agent: "worker", task: "Inspect the result", status: "done" });
    expect(await read("/api/projects/sessions?path=projects/missing-project")).toMatchObject([
      { sessionId: "s_missing", link: "tagged" },
    ]);
  });

  it("retires Learning and project Lineage aggregation while preserving session evidence", async () => {
    const sessionId = "s_review";
    const dir = join(root, "sessions", sessionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "session.jsonl"), '{"role":"user","content":"Review the result"}\n');
    const projectDir = join(root, "sample.app");
    mkdirSync(projectDir);
    writeFileSync(join(projectDir, "project.json"), JSON.stringify({ id: "sample", owner: "worker" }));
    upsertSession(root, { sessionId, agent: "worker", task: "Review the result", projectId: "worker/sample",
      status: "done", startedAt: Date.now(), endedAt: Date.now() });
    upsertSession(root, { sessionId: "s_review_child", agent: "helper", task: "Inspect descendant evidence",
      parentSessionId: sessionId, status: "done", startedAt: Date.now(), endedAt: Date.now() });
    const path = join(dir, "session.eval.jsonl");
    const summary = { type: "summary", verdict: "needs_fix",
      repairDecision: { ownerFindings: [{ id: "legacy", evidence: ["Saved observation"] }] } };
    const saved = JSON.stringify(summary) + "\n";
    writeFileSync(path, saved);
    db.prepare(`INSERT INTO evaluations (sessionId, agent, quality, efficiency, verdict, createdAt)
      VALUES (?, 'worker', 0.7, 0.8, 'needs_improvement', 1000)`).run(sessionId);
    const evaluation = db.prepare("SELECT * FROM evaluations WHERE sessionId = ?").get(sessionId);

    for (const route of ["/api/learning", "/api/learning?projectId=sample&days=30", "/learning", "/learning/",
      "/api/projects/lineage", "/api/projects/lineage?path=projects/sample.app"]) {
      expect((await fetch(baseUrl + route)).status).toBe(404);
    }
    expect(await read(`/api/sessions/${sessionId}`)).toMatchObject({
      session: { sessionId, status: "done", projectId: "worker/sample" }, evaluation,
      children: [{ sessionId: "s_review_child", parentSessionId: sessionId }],
    });
    expect(await read("/api/projects/sessions?path=projects/sample.app")).toMatchObject([
      { sessionId, status: "done", link: "tagged" },
    ]);
    expect(await read(`/api/sessions/${sessionId}/eval`)).toMatchObject({ exists: true, rows: [summary] });
    expect(await read("/api/agents/worker/detail")).toMatchObject({
      evalTrend: [{ quality: 0.7, efficiency: 0.8, verdict: "needs_improvement", createdAt: 1000 }],
    });
    expect(db.prepare("SELECT * FROM evaluations WHERE sessionId = ?").get(sessionId)).toEqual(evaluation);
    expect(readFileSync(path, "utf8")).toBe(saved);
  });

  it("reads saved session notes without Evaluation and rejects retired writes", async () => {
    const dir = join(root, "sessions", "s_notes");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "session.jsonl"), '{"role":"user","content":"Review the result"}\n');
    const path = join(dir, "session.eval.jsonl");
    const endpoint = "/api/sessions/s_notes/eval";
    expect(await read(endpoint)).toMatchObject({ exists: false, rows: [] });
    for (const suffix of ["", "/comment"]) {
      const response = await fetch(`${baseUrl}${endpoint}${suffix}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line: 1, comment: "Must not be saved by HTTP" }),
        signal: AbortSignal.timeout(5_000),
      });
      expect(response.status).toBe(404);
    }
    expect(existsSync(path)).toBe(false);
    const note = { type: "line", line: 1, source: "human-feedback", comment: "Retained review" };
    const saved = JSON.stringify(note) + "\n";
    writeFileSync(path, saved);
    expect(await read(endpoint)).toMatchObject({ exists: true, rows: [note] });
    expect(readFileSync(path, "utf8")).toBe(saved);
    expect(await read("/api/events?type=evaluation.session.requested")).toEqual([]);
  });

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
