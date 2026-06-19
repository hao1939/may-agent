import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestRuntime } from "@may-agent/sdk/testing";
import { execute } from "./ops-health-review.ts";
import type { WorkflowContext } from "@may-agent/sdk";

type EmittedEvent = { type: string; [key: string]: unknown };

describe("ops-health-review", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function setup() {
    const root = join(
      tmpdir(),
      `may-agent-ops-health-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const appDir = join(root, "projects", "may-agent.app");
    const emitted: EmittedEvent[] = [];
    tempDirs.push(root);
    mkdirSync(appDir, { recursive: true });

    const runtime = createTestRuntime({
      root,
      persist: root,
      agents: join(root, "agents"),
      shared: join(root, "shared"),
      projects: join(root, "projects"),
      emit: (type, data) => emitted.push({ type, ...(data ?? {}) }),
    });

    const ctx: WorkflowContext = {
      task: `app: ${appDir}\nReview may-agent operational health.`,
      agent: "may",
      emit: (event) => emitted.push(event),
      dispatchEvent: (eventType, data = {}) =>
        emitted.push({ type: eventType, ...data }),
      getDb: () => runtime.db,
      query: runtime.sdk.query,
      log: () => {},
      notify: () => {},
      metrics: runtime.sdk.metrics,
      persistDir: root,
      projectRoot: root,
      agentsRoot: runtime.agents,
      sharedRoot: runtime.shared,
      projectsRoot: runtime.projects,
      runAgent: runtime.sdk.runAgent,
      runWorkflow: runtime.sdk.runWorkflow,
      runFunction: async (label, fn) => ({
        ok: true,
        status: "done",
        agent: "may",
        sessionId: label,
        result: await fn(),
      }),
      summarize: (result) => String(result.result ?? result.status),
      done: (summary) => ({ type: "done", summary }),
      escalate: (reason, context) => ({ type: "escalate", reason, context }),
      createSession: async () => ({
        prompt: async () => {},
        lastText: () => "",
        close: () => {},
      }),
    };

    return { appDir, db: runtime.db, emitted, ctx, close: runtime.close };
  }

  function packetLines(appDir: string) {
    return readFileSync(
      join(appDir, ".state", "ops-health-packets.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }

  it("records a quiet observation without waking the owner", async () => {
    const { appDir, emitted, ctx, close } = setup();

    const result = await execute(ctx);
    close();

    expect(result).toEqual({
      type: "done",
      summary: "Ops health observer recorded packet with no owner wake.",
    });
    expect(emitted.map((event) => event.type)).toEqual([
      "project.ops_health.observed",
    ]);
    expect(emitted[0]).toMatchObject({
      project: "may-agent",
      signalCount: 0,
      signals: [],
    });
    expect(packetLines(appDir)[0]).toMatchObject({
      role: "observer",
      signals: [],
    });
  });

  it("wakes the owner for stale unresolved escalations", async () => {
    const { appDir, db, emitted, ctx, close } = setup();
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000;
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "escalation.created",
        "agent:may",
        "telegram",
        JSON.stringify({ escalationId: "esc_stale", reason: "needs reply" }),
        twoHoursAgo,
      ],
    );

    const result = await execute(ctx);
    close();

    expect(result.type).toBe("done");
    expect(emitted.map((event) => event.type)).toEqual([
      "project.ops_health.observed",
      "project.owner.requested",
    ]);
    expect(emitted[1]).toMatchObject({
      project: "may-agent",
      reason: "ops-health-signal",
      params: {
        signalCount: 1,
        signals: [
          expect.objectContaining({
            kind: "stale-escalation",
            severity: "P1",
          }),
        ],
      },
    });
    expect(packetLines(appDir)[0].signals[0]).toMatchObject({
      kind: "stale-escalation",
    });
  });

  it("wakes the owner for repeated runtime symptoms", async () => {
    const { db, emitted, ctx, close } = setup();
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      db.run(
        "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
        [
          "handler.failed",
          "runtime",
          "agent:may",
          JSON.stringify({ handler: "telegram-reply", error: "timeout" }),
          now - i * 60_000,
        ],
      );
    }

    await execute(ctx);
    close();

    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      params: {
        signals: expect.arrayContaining([
          expect.objectContaining({
            kind: "repeated-runtime-symptom",
            severity: "P1",
          }),
        ]),
      },
    });
  });

  it("filters out project-agent escalations from stale-escalation signal", async () => {
    const { appDir, db, emitted, ctx, close } = setup();
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000;

    // aks-explorer escalation — should be filtered out (project-level, not platform)
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "escalation.created",
        "agent:may",
        "runtime:session-finish",
        JSON.stringify({
          escalationId: "esc_aks",
          sourceAgent: "aks-explorer",
          reason: "needs ARM auth",
        }),
        twoHoursAgo,
      ],
    );

    // Another project-agent escalation
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "escalation.created",
        "agent:may",
        "runtime:session-finish",
        JSON.stringify({
          escalationId: "esc_scout",
          sourceAgent: "scout",
          reason: "needs file",
        }),
        twoHoursAgo,
      ],
    );

    const result = await execute(ctx);
    close();

    // No signals should fire — both escalations are from project agents, not platform
    expect(result).toEqual({
      type: "done",
      summary: "Ops health observer recorded packet with no owner wake.",
    });
    expect(emitted.map((event) => event.type)).toEqual([
      "project.ops_health.observed",
    ]);
  });

  it("still wakes for platform-sourced (no sourceAgent) stale escalations", async () => {
    const { db, emitted, ctx, close } = setup();
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000;

    // Platform escalation with no sourceAgent — should trigger the signal
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "escalation.created",
        "agent:may",
        "telegram",
        JSON.stringify({
          escalationId: "esc_platform",
          reason: "human needs reply",
        }),
        twoHoursAgo,
      ],
    );

    // Project-agent escalation that should be filtered out
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "escalation.created",
        "agent:may",
        "runtime:session-finish",
        JSON.stringify({
          escalationId: "esc_aks2",
          sourceAgent: "aks-explorer",
          reason: "needs ARM auth",
        }),
        twoHoursAgo,
      ],
    );

    await execute(ctx);
    close();

    // Should fire exactly 1 signal for the platform escalation
    expect(emitted.map((event) => event.type)).toEqual([
      "project.ops_health.observed",
      "project.owner.requested",
    ]);
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      params: {
        signals: [
          expect.objectContaining({
            kind: "stale-escalation",
            severity: "P1",
          }),
        ],
      },
    });
  });

  it("wakes the owner for open P0 May-owned metric alerts", async () => {
    const { db, emitted, ctx, close } = setup();
    const now = Date.now();
    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, alert_op, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "runtime.daemon-heartbeat-stale",
        "Runtime daemon heartbeat stale",
        "may",
        1,
        0,
        0,
        "P0",
        ">",
        now,
      ],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      [
        "runtime.daemon-heartbeat-stale",
        "threshold",
        "daemon heartbeat is stale",
        now - 60_000,
      ],
    );

    await execute(ctx);
    close();

    expect(emitted.map((event) => event.type)).toEqual([
      "project.ops_health.observed",
      "project.owner.requested",
    ]);
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      params: {
        signals: [
          expect.objectContaining({
            kind: "metric-p0",
            severity: "P0",
          }),
        ],
      },
    });
  });

  it("wakes the owner for event delivery health failures", async () => {
    const { db, emitted, ctx, close } = setup();
    const now = Date.now();
    db.run(
      `INSERT INTO events
       (event_type, owner, source, data, timestamp, delivery_status, delivery_note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "custom.requested",
        "agent:may",
        "test",
        JSON.stringify({ requestId: "req_unaccepted" }),
        now - 5 * 60_000,
        "unhandled",
        "no responsible consumer accepted event before timeout",
      ],
    );

    await execute(ctx);
    close();

    expect(emitted.map((event) => event.type)).toEqual([
      "project.ops_health.observed",
      "project.owner.requested",
    ]);
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      params: {
        signals: [
          expect.objectContaining({
            kind: "event-delivery-unaccepted",
            severity: "P1",
          }),
        ],
      },
    });
  });
});
