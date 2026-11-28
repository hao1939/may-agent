import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../../lib/db.js";
import { applyDbSchema } from "../../lib/db/schema.js";
import { createMetricAndKnowledgeRouteHandlers } from "./metric-knowledge-routes.js";

type Candidate = { appId: string; attemptId: string; startedAt: number };
type Timeline = {
  summary: { activityRows: number; activityRowsTruncated: boolean; truncatedSources: string[] };
  timeline: { truncated: boolean; truncatedSources: string[]; appLanes: Array<{ items: Array<{ id: string }> }> };
};

describe("liveness attempt candidates", () => {
  const now = 2_000_000_000_000;
  const since = now - 4 * 60 * 60 * 1000;
  let db: SqliteDb;
  let root: string;
  let clock: ReturnType<typeof spyOn<typeof Date, "now">>;
  let query: string;
  let bindings: unknown[];
  let candidates: Candidate[];
  let handleLiveness: ReturnType<typeof createMetricAndKnowledgeRouteHandlers>["handleLiveness"];

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
    root = mkdtempSync(join(tmpdir(), "may-liveness-query-"));
    clock = spyOn(Date, "now").mockReturnValue(now);
    query = "";
    bindings = [];
    candidates = [];
    // Capture the shipped statement and its real results, rather than maintaining
    // a test-local copy of the SQL or substituting a mocked query response.
    const observedDb: SqliteDb = {
      ...db,
      prepare(sql, options) {
        const statement = db.prepare(sql, options);
        if (!sql.includes("candidate_keys AS MATERIALIZED")) return statement;
        query = sql;
        return {
          ...statement,
          all(...params) {
            bindings = params;
            const rows = statement.all(...params);
            candidates = rows as Candidate[];
            return rows;
          },
        };
      },
    };
    ({ handleLiveness } = createMetricAndKnowledgeRouteHandlers({
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      projectsRoot: join(root, "projects"),
      getDb: () => observedDb,
      listLoadedApps: () => [],
      json: (body, status) => Response.json(body, { status }),
      sendDaemonFrame: async () => ({ ok: true }),
      buildPublishFrame: (type, data) => ({ type, data }),
    }));
  });

  afterEach(() => {
    clock?.mockRestore();
    db?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function insert(appId: string, attemptId: string, startedAt: number, state = "completed", finishedAt?: number) {
    db.prepare(
      `INSERT INTO app_task_attempts
       (app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
    ).run(
      appId,
      attemptId,
      `task-${attemptId}`,
      state,
      startedAt,
      JSON.stringify({
        handler: "executor:agent",
        ...(finishedAt === undefined ? {} : { finishedAt: new Date(finishedAt).toISOString() }),
      }),
    );
  }

  async function read() {
    const response = handleLiveness();
    expect(response.status).toBe(200);
    return (await response.json()) as Timeline;
  }

  function visibleIds(body: Timeline) {
    return body.timeline.appLanes.flatMap((lane) => lane.items.map((item) => item.id)).sort();
  }

  test("materializes indexed cohort keys and seeks attempts by composite primary key", async () => {
    insert("alpha", "recent", since + 1);
    insert("alpha", "running", since - 1, "running");
    insert("alpha", "finished", since - 1, "completed", since + 1);
    await read();

    const plan = db
      .prepare(`EXPLAIN QUERY PLAN ${query}`)
      .all(...bindings)
      .map((row) => String(row.detail));
    expect(query).not.toMatch(/INDEXED BY/i);
    expect(plan).toContain("MATERIALIZE raw_keys");
    expect(plan).toContain("MATERIALIZE candidate_keys");
    expect(plan).toContain("SCAN app_task_attempts USING COVERING INDEX idx_app_task_attempts_running_started");
    expect(plan).toContain(
      "SEARCH app_task_attempts USING COVERING INDEX idx_app_task_attempts_started (started_at>?)",
    );
    expect(plan).toContain("SEARCH app_task_attempts USING INDEX idx_app_task_attempts_finished_ms (<expr>>?)");
    expect(plan).toContain("SCAN ck");
    expect(plan).toContain("SEARCH a USING INDEX sqlite_autoindex_app_task_attempts_1 (app_id=? AND attempt_id=?)");
    // The only full attempt scan allowed is the small running partial index.
    expect(plan.filter((step) => /^SCAN (?:app_task_attempts|a)\b/.test(step))).toEqual([
      "SCAN app_task_attempts USING COVERING INDEX idx_app_task_attempts_running_started",
    ]);
    expect(plan.some((step) => /SCAN .*sqlite_autoindex_app_task_attempts_1/.test(step))).toBe(false);
    expect(bindings).toEqual([since, since]);
  });

  test.each([800, 801, 802])(
    "selects deterministic tied keys with %i matches and an 801st-row sentinel",
    async (count) => {
      // 799 newer rows leave the tie at ranks 800/801/802. Insert ties out of
      // key order, crossing both app_id and attempt_id at the cap boundary.
      for (let i = 798; i >= 0; i--) insert("newer", `row-${String(i).padStart(3, "0")}`, since + 2);
      const ties = [
        { appId: "alpha", attemptId: "z" },
        { appId: "beta", attemptId: "a" },
        { appId: "alpha", attemptId: "a" },
      ];
      const selectedTies = count === 800 ? [ties[2]] : count === 801 ? [ties[0], ties[2]] : ties;
      for (const tie of selectedTies) insert(tie.appId, tie.attemptId, since + 1);
      const body = await read();

      // Incidental B-tree order can also select the expected IDs without an
      // explicit tie-breaker, so assert the ordering contract on the real SQL.
      expect(query).toMatch(/ORDER BY a\.started_at DESC, a\.app_id ASC, a\.attempt_id ASC\s+LIMIT 801/);
      expect(candidates).toHaveLength(Math.min(count, 801));
      expect(candidates.slice(0, 799).map((row) => row.attemptId)).toEqual(
        Array.from({ length: 799 }, (_, i) => `row-${String(i).padStart(3, "0")}`),
      );
      expect(candidates.slice(799).map(({ appId, attemptId }) => ({ appId, attemptId }))).toEqual([
        { appId: "alpha", attemptId: "a" },
        ...(count > 800 ? [{ appId: "alpha", attemptId: "z" }] : []),
      ]);
      const expectedVisible = [
        "att:alpha:a",
        ...Array.from({ length: 799 }, (_, i) => `att:newer:row-${String(i).padStart(3, "0")}`),
      ].sort();
      expect(visibleIds(body)).toEqual(expectedVisible);
      expect(body.summary.activityRows).toBe(800);
      expect(body.summary.activityRowsTruncated).toBe(count > 800);
      expect(body.timeline.truncated).toBe(count > 800);
      expect(body.summary.truncatedSources).toEqual(count > 800 ? ["attempts"] : []);
      expect(body.timeline.truncatedSources).toEqual(count > 800 ? ["attempts"] : []);
    },
  );

  test("preserves old running and recently finished cohorts, strict cutoffs, and UNION deduplication", async () => {
    insert("alpha", "old-running", since - 1000, "running");
    for (const state of ["completed", "failed", "interrupted"]) {
      insert("alpha", `old-${state}`, since - 1000, state, since + 1);
      insert("alpha", `finished-at-cutoff-${state}`, since - 1000, state, since);
    }
    insert("alpha", "recent", since + 1);
    insert("alpha", "overlap-running", since + 1, "running");
    insert("alpha", "overlap-finished", since + 1, "completed", since + 2);
    insert("alpha", "started-at-cutoff", since);
    insert("alpha", "old-no-finish", since - 1000);
    insert("alpha", "nonterminal-finish", since - 1000, "pending", since + 1);
    const body = await read();

    const expected = [
      "old-running",
      "old-completed",
      "old-failed",
      "old-interrupted",
      "recent",
      "overlap-running",
      "overlap-finished",
    ];
    expect(candidates.map((row) => row.attemptId).sort()).toEqual(expected.toSorted());
    expect(visibleIds(body)).toEqual(expected.map((id) => `att:alpha:${id}`).sort());
    expect(body.timeline.truncatedSources).toEqual([]);
    expect(body.timeline.truncated).toBe(false);
  });

  test("does not overwrite a terminal attempt status with running when a joined workflow row is stale", async () => {
    insert("alpha", "interrupted-attempt", since + 10, "interrupted", since + 50);
    insert("alpha", "active-attempt", since + 20, "running");
    db.prepare(
      `INSERT INTO workflow_runs
       (runId, workflow, task, status, app_id, task_id, task_generation, attempt_id, startedAt, endedAt)
       VALUES
       ('wf-stale', 'scout-explore', 'Explore', 'running', 'alpha', 'task-interrupted-attempt', 1, 'interrupted-attempt', ?, NULL),
       ('wf-prior-err', 'scout-explore', 'Explore', 'error', 'alpha', 'task-active-attempt', 1, 'active-attempt', ?, ?),
       ('wf-live', 'scout-explore', 'Explore', 'running', 'alpha', 'task-active-attempt', 1, 'active-attempt', ?, NULL)`,
    ).run(since + 10, since + 21, since + 22, since + 25);

    const body = (await read()) as Timeline & {
      timeline: { appLanes: Array<{ items: Array<{ id: string; status: string; detail: string; endedAt: number | null }> }> };
    };
    const items = body.timeline.appLanes.flatMap((lane) => lane.items);
    const interruptedItem = items.find((item) => item.id === "att:alpha:interrupted-attempt");
    const activeItem = items.find((item) => item.id === "att:alpha:active-attempt");

    expect(interruptedItem).toMatchObject({
      status: "interrupted",
      endedAt: since + 50,
      detail: expect.stringContaining("stale-running (wf-stale)"),
    });
    expect(activeItem).toMatchObject({
      status: "running",
      endedAt: null,
      detail: expect.stringContaining("running (wf-live)"),
    });
  });
});
