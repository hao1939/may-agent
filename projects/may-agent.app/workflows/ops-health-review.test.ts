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
      agent: "tech-lead",
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
        agent: "tech-lead",
        sessionId: label,
        result: await fn(),
      }),
      summarize: (result) => String(result.result ?? result.status),
      done: (summary) => ({ type: "done", summary }),
      blocked: (reason, context) => ({ type: "blocked", reason, context }),
      blocked: (reason, context) => ({ type: "blocked", reason, context }),
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

  function pairLatestEscalation(
    db: ReturnType<typeof setup>["db"],
    escalationId: string,
  ) {
    const created = db
      .prepare(
        `SELECT id, owner, timestamp
           FROM events
          WHERE event_type = 'escalation.created'
            AND json_extract(data, '$.escalationId') = ?
          ORDER BY id DESC
          LIMIT 1`,
      )
      .get(escalationId) as {
      id: number;
      owner: string | null;
      timestamp: number;
    };
    db.run(
      `INSERT INTO event_pair_runs
       (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
       VALUES ('escalation', ?, ?, ?, 'open', ?, ?)`,
      [
        escalationId,
        created.id,
        created.owner,
        created.timestamp,
        created.timestamp + 24 * 60 * 60_000,
      ],
    );
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
        "agent:tech-lead",
        "telegram",
        JSON.stringify({ escalationId: "esc_stale", reason: "needs reply" }),
        twoHoursAgo,
      ],
    );
    pairLatestEscalation(db, "esc_stale");

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

  it("annotates stale escalations when a human reply arrived but closure is missing", async () => {
    const { appDir, db, emitted, ctx, close } = setup();
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000;
    const oneHourAgo = Date.now() - 60 * 60_000;
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "escalation.created",
        "agent:tech-lead",
        "telegram",
        JSON.stringify({
          escalationId: "esc_replied",
          reason: "needs human decision",
        }),
        twoHoursAgo,
      ],
    );
    pairLatestEscalation(db, "esc_replied");
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "telegram.reply",
        "agent:may",
        "telegram",
        JSON.stringify({
          conversationId: "escalation:esc_replied",
          originalIssue: {
            eventType: "escalation.created",
            escalationId: "esc_replied",
          },
          expectedClosure: ["escalation.resolved", "escalation.dismissed"],
        }),
        oneHourAgo,
      ],
    );

    const result = await execute(ctx);
    close();

    expect(result.type).toBe("done");
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      params: {
        signals: [
          expect.objectContaining({
            kind: "stale-escalation",
            evidence: [
              expect.objectContaining({
                reply_context: expect.objectContaining({
                  state: "reply-received-no-closure",
                  count: 1,
                  latest: expect.objectContaining({
                    event_type: "telegram.reply",
                    conversationId: "escalation:esc_replied",
                  }),
                }),
              }),
            ],
          }),
        ],
      },
    });
    expect(packetLines(appDir)[0].observations.stale_escalations[0]).toMatchObject({
      reply_context: {
        state: "reply-received-no-closure",
      },
    });
  });

  it("wakes the owner for stale local blocked workflow groups", async () => {
    const { appDir, db, emitted, ctx, close } = setup();
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000;
    db.run(
      `INSERT INTO workflow_runs
       (runId, workflow, task, parentSessionId, projectId, depth, status, startedAt, endedAt, result_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "wr_blocked",
        "ops-health-review",
        "Review platform health",
        "s_parent",
        "may-agent",
        0,
        "blocked",
        twoHoursAgo - 1_000,
        twoHoursAgo,
        "evaluator-aftermath requires a sessionId",
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
        signals: [
          expect.objectContaining({
            kind: "workflow-local-blocked",
            severity: "P1",
          }),
        ],
      },
    });
    expect(packetLines(appDir)[0].observations).toMatchObject({
      stale_blocked_workflow_runs: [
        expect.objectContaining({
          workflow: "ops-health-review",
          status: "blocked",
          count: 1,
        }),
      ],
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
          "agent:tech-lead",
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
        "agent:tech-lead",
        "runtime:session-finish",
        JSON.stringify({
          escalationId: "esc_aks",
          sourceAgent: "aks-explorer",
          reason: "needs ARM auth",
        }),
        twoHoursAgo,
      ],
    );
    pairLatestEscalation(db, "esc_aks");

    // Another project-agent escalation
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "escalation.created",
        "agent:tech-lead",
        "runtime:session-finish",
        JSON.stringify({
          escalationId: "esc_scout",
          sourceAgent: "scout",
          reason: "needs file",
        }),
        twoHoursAgo,
      ],
    );
    pairLatestEscalation(db, "esc_scout");

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
        "agent:tech-lead",
        "telegram",
        JSON.stringify({
          escalationId: "esc_platform",
          reason: "human needs reply",
        }),
        twoHoursAgo,
      ],
    );
    pairLatestEscalation(db, "esc_platform");

    // Project-agent escalation that should be filtered out
    db.run(
      "INSERT INTO events (event_type, owner, source, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "escalation.created",
        "agent:tech-lead",
        "runtime:session-finish",
        JSON.stringify({
          escalationId: "esc_aks2",
          sourceAgent: "aks-explorer",
          reason: "needs ARM auth",
        }),
        twoHoursAgo,
      ],
    );
    pairLatestEscalation(db, "esc_aks2");

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

  it("wakes the owner for open P0 platform-owned metric alerts", async () => {
    const { db, emitted, ctx, close } = setup();
    const now = Date.now();
    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, alert_op, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "runtime.daemon-heartbeat-stale",
        "Runtime daemon heartbeat stale",
        "tech-lead",
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

  it("wakes the owner when canonical session.end is unhandled", async () => {
    const { db, emitted, ctx, close } = setup();
    const now = Date.now();
    db.run(
      `INSERT INTO events
       (event_type, owner, source, data, timestamp, delivery_status, delivery_note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "session.end",
        "agent:tech-lead",
        "test",
        JSON.stringify({ sessionId: "s_unaccepted", agent: "tech-lead", status: "done" }),
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
