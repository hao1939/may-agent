import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import {
  matchesEventSelector,
  type AppEvent,
  type AppInput,
  type AppTaskInput,
} from "@may-agent/sdk";
import app, {
  AFTERMATH_COVERAGE_METRIC_ID,
  AFTERMATH_COVERAGE_SOURCE_QUERY,
  FAILED_TRIAGE_RATE_3H_METRIC_ID,
  FAILED_TRIAGE_RATE_3H_SOURCE_QUERY,
  FALSE_GOOD_RATE_SAMPLE_METRIC_ID,
  FALSE_GOOD_RATE_SAMPLE_SOURCE_QUERY,
  LLM_COVERAGE_LAG_METRIC_ID,
  LLM_COVERAGE_LAG_SOURCE_QUERY,
  LLM_EVALUATIONS_24H_METRIC_ID,
  LLM_EVALUATIONS_24H_SOURCE_QUERY,
  LOW_QUALITY_RATE_24H_METRIC_ID,
  LOW_QUALITY_RATE_24H_SOURCE_QUERY,
  MEANINGFUL_REVIEW_RATE_24H_METRIC_ID,
  MEANINGFUL_REVIEW_RATE_24H_SOURCE_QUERY,
  PROJECT_FEEDBACK_PENDING_AGE_METRIC_ID,
  PROJECT_FEEDBACK_PENDING_AGE_SOURCE_QUERY,
  PROJECT_FINDING_DELIVERY_RATE_24H_METRIC_ID,
  PROJECT_FINDING_DELIVERY_RATE_24H_SOURCE_QUERY,
  SUBSTANTIVE_LOW_QUALITY_RATE_24H_METRIC_ID,
  SUBSTANTIVE_LOW_QUALITY_RATE_24H_SOURCE_QUERY,
  TRIAGE_CLOSURE_RATE_24H_METRIC_ID,
  TRIAGE_CLOSURE_RATE_24H_SOURCE_QUERY,
  taskForEvaluationInput,
  taskInputForEvent,
  taskIntentForEvent,
  taskIntentForInput,
  validateEvaluationTaskAction,
} from "./app.ts";
import {
  PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE,
  projectHealthEvaluatorAgentPrompt,
} from "./agents/evaluator/workflows/project-health-evaluator.ts";
import { AppInboxHost } from "../may-agent/src/app/core/inbox/app-inbox-host.ts";
import { createAppInboxItem } from "../may-agent/src/app/core/state/app-inbox-store.ts";
import { admitTaskInput } from "../may-agent/src/app/core/state/inbox.ts";
import { appTaskTestContext } from "../may-agent/src/app/core/tasks/app-task-test-support.ts";
import {
  claimObservedAppTask,
  deferAppTask,
  observeAppTaskIntent,
} from "../may-agent/src/app/core/tasks/app-task-reconciler.ts";
import { applyDbSchema } from "../may-agent/src/lib/db/schema.ts";

function subscription(id: string) {
  const route = app.subscriptions?.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`missing subscription ${id}`);
  return route;
}

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return { type, data, ...extra };
}

function admitted(input: AppInput): AppTaskInput {
  return {
    id: "request-1",
    source: { kind: "system" as const, id: "test" },
    input,
  };
}

describe("canonical evaluation App", () => {
  test("declares one canonical manifest and no legacy route authority", () => {
    expect(app).toMatchObject({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      description: expect.stringContaining(
        "read-reports with operation list/read",
      ),
      tasks: { maxConcurrent: 1 },
    });
    expect(app).not.toHaveProperty("inbox");
    expect(app.task).toBe(taskForEvaluationInput);
    expect(app.route).toBeUndefined();
    expect(app.tasks?.resolve).toBe(taskIntentForEvent);
    expect(app.tasks?.subscriptions).not.toBeEmpty();
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "project-comment",
      "project-owner-request",
      "telegram-owner-reply",
      "task-incomplete-review",
    ]);
    // The installed rollout may intentionally enable the bounded selector.
    // Control the inherited manifest environment instead of treating that
    // configured schedule as candidate drift.
    const automaticEnabled =
      process.env.EVALUATION_AUTO_REVIEW_ENABLED?.trim().toLowerCase() ===
      "true";
    expect(app.schedules?.map(({ id }) => id)).toEqual(
      automaticEnabled ? ["task-outcome-selector"] : [],
    );
    for (const schedule of app.schedules ?? []) {
      expect(schedule).toMatchObject({
        input: { kind: "automatic-review", data: { reason: "scheduled" } },
        catchUp: "latest",
      });
      expect(schedule).not.toHaveProperty("event");
    }
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(app).not.toHaveProperty("budget");
    expect(existsSync(new URL("./inbox.ts", import.meta.url))).toBe(false);
  });

  test("keeps canonical App-input actions without a legacy project-review alias", () => {
    expect(
      app.actions?.["evaluate-session"]?.toInput?.({ sessionId: "s-1" }),
    ).toEqual({
      kind: "evaluate-session",
      data: { sessionId: "s-1" },
    });
    expect(
      app.actions?.["review-agent-app"]?.toInput?.({ targetProject: "gym" }),
    ).toMatchObject({
      kind: "project-review",
      data: {
        targetProject: "gym.app",
      },
    });
    expect(app.actions?.["review-project-app"]).toBeUndefined();
  });

  test("retires the legacy Codex trial behind the guarded no-model workflow", () => {
    const input = app.actions?.["trial-codex-goal-review"]?.toInput?.({
      targetProject: "may-agent.app",
      focus: "Check whether the Task mental model matches current code.",
    });
    expect(input).toEqual({
      kind: "codex-goal-trial",
      data: {
        targetProject: "may-agent.app",
        focus: "Check whether the Task mental model matches current code.",
      },
    });
    expect(taskIntentForInput(input!)).toMatchObject({
      id: expect.stringMatching(
        /^runtime\/compat\/codex-goal-trial\/may-agent\.app\/[a-f0-9]{12}$/,
      ),
      workflow: "executor-trial",
      input: { targetProject: "may-agent.app", trial: true, readOnly: true },
    });
    expect(taskIntentForInput(input!)).not.toHaveProperty("executor");
    expect(
      app.schedules?.some((schedule) => schedule.id.includes("codex-goal")),
    ).toBeFalse();
  });

  test("holds goal semantics constant across isolated executor trial siblings", () => {
    const data = {
      targetProject: "may-agent.app",
      focus: "Check whether the Task mental model matches current code.",
    };
    const codexInput =
      app.actions?.["trial-codex-goal-review"]?.toInput?.(data);
    const workflowInput =
      app.actions?.["trial-workflow-review"]?.toInput?.(data);
    const codex = taskIntentForInput(codexInput!);
    const workflow = taskIntentForInput(workflowInput!);

    expect(workflowInput).toEqual({ kind: "workflow-trial", data });
    expect(workflow).toMatchObject({
      id: expect.stringMatching(
        /^runtime\/compat\/workflow-trial\/may-agent\.app\/[a-f0-9]{12}$/,
      ),
      workflow: "executor-trial",
      input: { targetProject: "may-agent.app", trial: true, readOnly: true },
    });
    expect(workflow?.outcome).toBe(codex?.outcome);
    expect(workflow?.acceptance).toEqual(codex?.acceptance);
    expect(workflow?.input).toEqual(codex?.input);
    expect(workflow?.id).not.toBe(codex?.id);
    expect(workflow).not.toHaveProperty("executor");
    expect(codex).not.toHaveProperty("executor");
    expect(codex?.workflow).toBe("executor-trial");
  });

  test("routes legacy Evaluation self-review trials to the zero-model guard", () => {
    const input = app.actions?.["trial-codex-goal-review"]?.toInput?.({
      targetProject: "evaluation.app",
      focus: "Assess Evaluation itself.",
    });
    expect(taskForEvaluationInput(admitted(input!))).toMatchObject({
      kind: "desired",
      intent: {
        workflow: "executor-trial",
        input: {
          targetProject: "evaluation.app",
          readOnly: true,
        },
      },
    });
    expect(taskForEvaluationInput(admitted(input!))).not.toHaveProperty(
      "intent.executor",
    );
  });

  test("resolves every admitted input to one task", () => {
    expect(
      taskForEvaluationInput(
        admitted({
          kind: "message",
          data: { message: "Please inspect the result" },
        }),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        id: "runtime/compat/input/request-1",
        agent: "evaluator",
        executor: "codex-goal",
      },
    });
  });

  test("declaratively retires legacy metrics without a metric breach wake lane", () => {
    expect(app.tasks?.maxConcurrent).toBe(1);
    expect(app.metrics).toHaveLength(11);
    expect(
      app.metrics?.every((metric) => metric.status === "retired"),
    ).toBeTrue();
    expect(app.metrics?.map((metric) => metric.id)).toContain(
      LLM_COVERAGE_LAG_METRIC_ID,
    );
    expect(app.metrics?.map((metric) => metric.id)).toContain(
      LLM_EVALUATIONS_24H_METRIC_ID,
    );
    expect(app.tasks?.subscriptions).not.toContain("metric.breach");
    expect(app.tasks?.subscriptions).not.toContain("metric.recovered");
  });
});

describe("evaluation metrics", () => {
  function failedTriageDb(): Database {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE sessions (
        sessionId TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        status TEXT NOT NULL,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER,
        outcome TEXT,
        error TEXT
      )`,
    );
    db.run(
      `CREATE TABLE evaluations (
        sessionId TEXT NOT NULL,
        verdict TEXT
      )`,
    );
    return db;
  }

  function addFailedSession(
    db: Database,
    sessionId: string,
    options: {
      agent?: string;
      status?: string;
      endedAt?: number;
      outcome?: string | null;
      error?: string | null;
    } = {},
  ): void {
    const endedAt = options.endedAt ?? Date.now() - 20 * 60_000;
    db.run(
      `INSERT INTO sessions (
        sessionId, agent, status, startedAt, endedAt, outcome, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        options.agent ?? "worker",
        options.status ?? "error",
        endedAt - 60_000,
        endedAt,
        options.outcome ?? null,
        options.error === undefined ? "boom" : options.error,
      ],
    );
  }

  test("measures only actionable failed sessions after the grace period", () => {
    const db = failedTriageDb();
    const old = Date.now() - 4 * 60 * 60_000;
    const recent = Date.now() - 2 * 60_000;

    addFailedSession(db, "eligible-error");
    addFailedSession(db, "eligible-done-with-error", { status: "done" });
    addFailedSession(db, "clean-start", { error: "Clean start (fresh)" });
    addFailedSession(db, "legacy-task-handoff", {
      error:
        "Task-bound project session recovery is owned by the app task reconciler",
    });
    addFailedSession(db, "current-task-handoff", {
      error:
        "Task-bound execution is recovered through its Task, not by resuming the old session",
    });
    addFailedSession(db, "owner-session-recovery", {
      error:
        "Recovered task runtime/example interrupted an orphaned owner session from a previous runtime",
    });
    addFailedSession(db, "agent-session-recovery", {
      error:
        "Recovered task runtime/example interrupted an orphaned agent session from a previous runtime",
    });
    addFailedSession(db, "cancelled-cleanup", {
      status: "done",
      outcome: "done",
      error: "Cancelled",
    });
    addFailedSession(db, "interrupted-without-error", {
      status: "interrupted",
      error: null,
    });
    addFailedSession(db, "evaluator-self", { agent: "evaluator" });
    addFailedSession(db, "judge-self", { agent: "judge" });
    addFailedSession(db, "outside-window", { endedAt: old });
    addFailedSession(db, "inside-grace", { endedAt: recent });
    addFailedSession(db, "successful", {
      status: "done",
      outcome: "done",
      error: null,
    });

    const sample = db.query(FAILED_TRIAGE_RATE_3H_SOURCE_QUERY).get() as {
      value: number;
      sampleSize: number;
      measuredAt: number;
      note: string;
    };
    expect(sample.value).toBe(0);
    expect(sample.sampleSize).toBe(2);
    expect(sample.measuredAt).toBeGreaterThanOrEqual(Date.now() - 2_000);
    expect(sample.measuredAt).toBeLessThanOrEqual(Date.now());
    expect(JSON.parse(sample.note)).toEqual({
      failed: 2,
      triaged: 0,
      failedIds: ["eligible-done-with-error", "eligible-error"],
    });
  });

  test("counts any evaluation verdict and exposes ratio evidence", () => {
    const db = failedTriageDb();
    for (let index = 1; index <= 5; index += 1) {
      addFailedSession(db, `failed-${index}`);
    }
    db.run(
      "INSERT INTO evaluations (sessionId, verdict) VALUES (?, ?), (?, ?)",
      ["failed-1", "good", "failed-2", "acceptable"],
    );

    const sample = db.query(FAILED_TRIAGE_RATE_3H_SOURCE_QUERY).get() as {
      value: number;
      sampleSize: number;
      note: string;
    };
    expect(sample.value).toBe(0.4);
    expect(sample.sampleSize).toBe(5);
    expect(JSON.parse(sample.note)).toEqual({
      failed: 5,
      triaged: 2,
      failedIds: ["failed-1", "failed-2", "failed-3", "failed-4", "failed-5"],
    });
  });

  test("measures lag from the newest non-heuristic evaluation", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE evaluations (
        createdAt INTEGER NOT NULL,
        evaluatedByHeuristic INTEGER NOT NULL,
        agent TEXT NOT NULL
      )`,
    );
    db.run(
      "INSERT INTO evaluations (createdAt, evaluatedByHeuristic, agent) VALUES (?, 0, 'may'), (?, 1, 'scout'), (?, 0, 'evaluator-deepseek')",
      [Date.now() - 2 * 60 * 60_000, Date.now() - 60_000, Date.now() - 30_000],
    );

    const sample = db.query(LLM_COVERAGE_LAG_SOURCE_QUERY).get() as {
      value: number;
    };
    expect(sample.value).toBeGreaterThanOrEqual(2);
    expect(sample.value).toBeLessThan(2.01);

    db.run("DELETE FROM evaluations");
    expect(
      (db.query(LLM_COVERAGE_LAG_SOURCE_QUERY).get() as { value: number })
        .value,
    ).toBe(9999);
  });

  test("counts only recent non-heuristic evaluations of other agents", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE evaluations (
        createdAt INTEGER NOT NULL,
        evaluatedByHeuristic INTEGER NOT NULL,
        agent TEXT NOT NULL
      )`,
    );
    const now = Date.now();
    db.run(
      `INSERT INTO evaluations (createdAt, evaluatedByHeuristic, agent)
       VALUES (?, 0, 'may'),
              (?, 0, 'gym'),
              (?, 1, 'may'),
              (?, 0, 'evaluator'),
              (?, 0, 'judge'),
              (?, 0, 'may')`,
      [
        now - 60_000,
        now - 23 * 60 * 60_000,
        now - 60_000,
        now - 60_000,
        now - 60_000,
        now - 25 * 60 * 60_000,
      ],
    );

    expect(
      (db.query(LLM_EVALUATIONS_24H_SOURCE_QUERY).get() as { value: number })
        .value,
    ).toBe(2);
  });

  test("preserves the broad quality-rate denominator as sample evidence", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE evaluations (
        createdAt INTEGER NOT NULL,
        agent TEXT NOT NULL,
        verdict TEXT NOT NULL,
        quality REAL NOT NULL,
        efficiency REAL NOT NULL
      )`,
    );
    const now = Date.now();
    db.run(
      `INSERT INTO evaluations (createdAt, agent, verdict, quality, efficiency)
       VALUES (?, 'may', 'good', 0.8, 0.8),
              (?, 'gym', 'needs_improvement', 0.8, 0.8),
              (?, 'scout', 'acceptable', 0.3, 0.8),
              (?, 'evaluator', 'low_quality', 0.1, 0.1),
              (?, 'may', 'skipped', 0.1, 0.1),
              (?, 'may', 'low_quality', 0.1, 0.1)`,
      [
        now - 60_000,
        now - 60_000,
        now - 60_000,
        now - 60_000,
        now - 60_000,
        now - 25 * 60 * 60_000,
      ],
    );

    expect(db.query(LOW_QUALITY_RATE_24H_SOURCE_QUERY).get()).toMatchObject({
      value: 0.6667,
      sampleSize: 3,
    });
  });

  test("matches only the established substantive issue families", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE evaluations (
        createdAt INTEGER NOT NULL,
        agent TEXT NOT NULL,
        verdict TEXT NOT NULL,
        issues TEXT
      )`,
    );
    const now = Date.now();
    db.run(
      `INSERT INTO evaluations (createdAt, agent, verdict, issues)
       VALUES (?, 'may', 'needs_improvement', 'Verification Failure after tool use'),
              (?, 'gym', 'good', 'Minor wording issue'),
              (?, 'scout', 'acceptable', 'Hallucinated path in report'),
              (?, 'evaluator', 'needs_improvement', 'Fabricated result'),
              (?, 'may', 'skipped', 'Tool hallucination'),
              (?, 'may', 'needs_improvement', 'Blind overwrite')`,
      [
        now - 60_000,
        now - 60_000,
        now - 60_000,
        now - 60_000,
        now - 60_000,
        now - 25 * 60 * 60_000,
      ],
    );

    expect(
      db.query(SUBSTANTIVE_LOW_QUALITY_RATE_24H_SOURCE_QUERY).get(),
    ).toMatchObject({ value: 0.6667, sampleSize: 3 });
  });

  test("measures reviews against only meaningful routed lanes", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE events (
        event_type TEXT NOT NULL,
        data TEXT,
        timestamp INTEGER NOT NULL
      )`,
    );
    const now = Date.now();
    for (const [eventType, lane, timestamp] of [
      ["evaluation.routed", "needs_triage", now - 60_000],
      ["evaluation.routed", "success_candidate", now - 60_000],
      ["evaluation.routed", "routine_ok", now - 60_000],
      ["evaluation.reviewed", "needs_triage", now - 60_000],
      ["evaluation.reviewed", "needs_triage", now - 25 * 60 * 60_000],
    ] as const) {
      db.run(
        "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
        [eventType, JSON.stringify({ lane }), timestamp],
      );
    }

    expect(
      db.query(MEANINGFUL_REVIEW_RATE_24H_SOURCE_QUERY).get(),
    ).toMatchObject({ value: 0.5, sampleSize: 2 });

    db.run("DELETE FROM events");
    expect(
      db.query(MEANINGFUL_REVIEW_RATE_24H_SOURCE_QUERY).get(),
    ).toMatchObject({ value: 0, sampleSize: 0 });
  });

  test("measures triage closures against only needs-triage routes", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE events (
        event_type TEXT NOT NULL,
        data TEXT,
        timestamp INTEGER NOT NULL
      )`,
    );
    const now = Date.now();
    for (const [eventType, lane, timestamp] of [
      ["evaluation.routed", "needs_triage", now - 60_000],
      ["evaluation.routed", "needs_triage", now - 60_000],
      ["evaluation.routed", "success_candidate", now - 60_000],
      ["evaluation.triage_closed", "needs_triage", now - 60_000],
      ["evaluation.triage_closed", "needs_triage", now - 25 * 60 * 60_000],
    ] as const) {
      db.run(
        "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
        [eventType, JSON.stringify({ lane }), timestamp],
      );
    }

    expect(db.query(TRIAGE_CLOSURE_RATE_24H_SOURCE_QUERY).get()).toMatchObject({
      value: 0.5,
      sampleSize: 2,
    });

    db.run("DELETE FROM events");
    expect(db.query(TRIAGE_CLOSURE_RATE_24H_SOURCE_QUERY).get()).toMatchObject({
      value: 0,
      sampleSize: 0,
    });
  });

  test("measures false-good overturns against reviewed good verdicts", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE events (
        event_type TEXT NOT NULL,
        data TEXT,
        timestamp INTEGER NOT NULL
      )`,
    );
    const now = Date.now();
    for (const [eventType, verdict, timestamp] of [
      ["evaluation.reviewed", "good", now - 60_000],
      ["evaluation.reviewed", "good", now - 60_000],
      ["evaluation.reviewed", "needs_improvement", now - 60_000],
      ["evaluation.false_good", "needs_improvement", now - 60_000],
      ["evaluation.false_good", "needs_improvement", now - 25 * 60 * 60_000],
    ] as const) {
      db.run(
        "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
        [eventType, JSON.stringify({ verdict }), timestamp],
      );
    }

    expect(db.query(FALSE_GOOD_RATE_SAMPLE_SOURCE_QUERY).get()).toMatchObject({
      value: 0.5,
      sampleSize: 2,
    });

    db.run("DELETE FROM events");
    expect(db.query(FALSE_GOOD_RATE_SAMPLE_SOURCE_QUERY).get()).toMatchObject({
      value: 0,
      sampleSize: 0,
    });
  });

  test("measures project-finding delivery and pending age from one event contract", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE events (
        event_type TEXT NOT NULL,
        source TEXT,
        delivery_status TEXT,
        data TEXT,
        timestamp INTEGER NOT NULL
      )`,
    );
    const now = Date.now();
    for (const [source, status, reason, timestamp] of [
      [
        "evaluation.app",
        "accepted",
        "evaluation-project-health-feedback",
        now - 60_000,
      ],
      [
        "evaluation.app",
        "pending",
        "evaluation-project-health-feedback",
        now - 2 * 60 * 60_000,
      ],
      [
        "evaluation.app",
        "unhandled",
        "evaluation-project-health-feedback",
        now - 60 * 60_000,
      ],
      [
        "other.app",
        "pending",
        "evaluation-project-health-feedback",
        now - 60_000,
      ],
      ["evaluation.app", "pending", "different-reason", now - 60_000],
      [
        "evaluation.app",
        "pending",
        "evaluation-project-health-feedback",
        now - 25 * 60 * 60_000,
      ],
    ] as const) {
      db.run(
        `INSERT INTO events (event_type, source, delivery_status, data, timestamp)
         VALUES ('project.owner.requested', ?, ?, ?, ?)`,
        [source, status, JSON.stringify({ reason }), timestamp],
      );
    }

    expect(
      db.query(PROJECT_FINDING_DELIVERY_RATE_24H_SOURCE_QUERY).get(),
    ).toMatchObject({ value: 0.3333, sampleSize: 3 });
    expect(
      db.query(PROJECT_FEEDBACK_PENDING_AGE_SOURCE_QUERY).get(),
    ).toMatchObject({ sampleSize: 2 });
    expect(
      (
        db.query(PROJECT_FEEDBACK_PENDING_AGE_SOURCE_QUERY).get() as {
          value: number;
        }
      ).value,
    ).toBeGreaterThanOrEqual(2);

    db.run("DELETE FROM events");
    expect(
      db.query(PROJECT_FINDING_DELIVERY_RATE_24H_SOURCE_QUERY).get(),
    ).toMatchObject({ value: 0, sampleSize: 0 });
    expect(
      db.query(PROJECT_FEEDBACK_PENDING_AGE_SOURCE_QUERY).get(),
    ).toMatchObject({ value: 0, sampleSize: 0 });
  });

  test("counts canonical eligible sessions and preserves count evidence", () => {
    const db = new Database(":memory:");
    db.run(
      `CREATE TABLE sessions (
        sessionId TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        status TEXT NOT NULL,
        workflowRunId TEXT,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER
      )`,
    );
    db.run("CREATE TABLE evaluations (sessionId TEXT NOT NULL)");
    db.run(
      `CREATE TABLE events (
        id INTEGER PRIMARY KEY,
        event_type TEXT NOT NULL,
        session_id TEXT,
        source TEXT,
        data TEXT
      )`,
    );
    const endedAt = Date.now() - 20 * 60_000;
    const addSession = (
      sessionId: string,
      agent: string,
      status = "done",
      workflowRunId: string | null = null,
      end = endedAt,
    ) =>
      db.run(
        "INSERT INTO sessions (sessionId, agent, status, workflowRunId, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [sessionId, agent, status, workflowRunId, end - 1_000, end],
      );

    addSession("evaluated", "may");
    addSession("missing", "gym");
    addSession("routine-workflow", "gym", "done", "wr_1");
    addSession("evaluator", "evaluator");
    addSession("too-recent", "may", "done", null, Date.now() - 60_000);
    addSession("resumable", "may", "interrupted");
    db.run("INSERT INTO evaluations (sessionId) VALUES ('evaluated')");
    db.run(
      "INSERT INTO events (event_type, session_id, source, data) VALUES ('session.end', 'resumable', 'watchdog', ?)",
      [
        JSON.stringify({
          sessionId: "resumable",
          interruptionKind: "observation-timeout",
        }),
      ],
    );

    const sample = db.query(AFTERMATH_COVERAGE_SOURCE_QUERY).get() as {
      value: number;
      sampleSize: number;
      measuredAt: number;
      note: string;
    };
    expect(sample.value).toBe(0.5);
    expect(sample.sampleSize).toBe(2);
    expect(JSON.parse(sample.note)).toMatchObject({
      source: "canonical-terminal-sessions+evaluations",
      eligible: 2,
      evaluated: 1,
      graceMs: 420_000,
    });
  });
});

describe("evaluation fact admission", () => {
  test("keeps inbox and task selectors as exclusive routing authorities", () => {
    const inboxTypes = new Set(
      (app.subscriptions ?? []).map((subscription) =>
        typeof subscription.event === "string"
          ? subscription.event
          : subscription.event.type,
      ),
    );
    const taskTypes = new Set(
      (app.tasks?.subscriptions ?? []).map((selector) =>
        typeof selector === "string" ? selector : selector.type,
      ),
    );
    const observationTypes = new Set(
      (app.observations ?? []).map((selector) =>
        typeof selector === "string" ? selector : selector.type,
      ),
    );
    expect([...inboxTypes].filter((type) => taskTypes.has(type))).toEqual([]);
    expect(
      [...observationTypes].filter((type) => inboxTypes.has(type)),
    ).toEqual([]);
    expect([...observationTypes].filter((type) => taskTypes.has(type))).toEqual(
      [],
    );
    expect(observationTypes).toContain("evaluation.owner_reviewed");
    expect(app).not.toHaveProperty("inbox");

    const ended = event("session.end", {
      sessionId: "s_route_audit",
      agent: "coder",
    });
    expect(
      (app.subscriptions ?? []).some((subscription) =>
        matchesEventSelector(subscription.event, ended),
      ),
    ).toBeFalse();
    expect(taskIntentForEvent(ended)).toBeNull();
  });

  test("does not route automatic session endings into retired semantic review", () => {
    for (const agent of [
      "may",
      "gym",
      "evaluator",
      "evaluator-deepseek",
      "judge",
    ]) {
      expect(
        taskIntentForEvent(
          event("session.end", {
            sessionId: `s-${agent}`,
            agent,
            status: "error",
          }),
        ),
      ).toBeNull();
    }
  });

  test("creates an independent correction task that cannot reuse the inaccurate evaluation", () => {
    expect(
      taskIntentForEvent(
        event("evaluation.session.requested", {
          sessionId: "s_resume_lifecycle",
          supersedeExisting: true,
          correctionId: "complete-terminal-lifecycle-v1",
        }),
      ),
    ).toMatchObject({
      id: "runtime/compat/session-aftermath-repair/s_resume_lifecycle/complete-terminal-lifecycle-v1",
      input: {
        sessionId: "s_resume_lifecycle",
        supersedeExisting: true,
        correctionId: "complete-terminal-lifecycle-v1",
      },
    });
  });

  test("rejects unscoped aftermath requests while concrete requests proceed", () => {
    expect(
      taskIntentForEvent(event("evaluation.session.requested")),
    ).toBeNull();
    expect(
      taskIntentForInput({ kind: "evaluate-session", data: {} }),
    ).toBeNull();
    expect(
      taskIntentForEvent(
        event("evaluation.session.requested", {
          sessionId: "s_concrete_request",
        }),
      ),
    ).toMatchObject({
      id: "runtime/compat/session-aftermath/s_concrete_request",
      workflow: "evaluator-aftermath",
      input: { sessionId: "s_concrete_request" },
    });
  });

  test("does not admit retired metric breach or recovery events", () => {
    for (const type of ["metric.breach", "metric.recovered"]) {
      expect(
        taskInputForEvent(
          event(
            type,
            { metricId: "eval.llm-coverage-lag-h" },
            { owner: "agent:evaluator" },
          ),
        ),
      ).toBeNull();
    }
  });

  test("admits only Telegram replies addressed to evaluation", () => {
    expect(
      subscription("telegram-owner-reply").toInput(
        event("telegram.reply", { to: "evaluator", message: "Review this" }),
      ),
    ).toEqual({
      kind: "message",
      data: {
        message: "Review this",
        context: { to: "evaluator", message: "Review this" },
      },
    });
    expect(
      subscription("telegram-owner-reply").toInput(
        event("telegram.reply", { to: "app-ops", message: "Unrelated" }),
      ),
    ).toBeNull();
  });

  test("turns review failures into evaluation's own project-health request", () => {
    expect(
      taskInputForEvent(
        event("evaluation.review_failed", {
          sessionId: "s-1",
          reason: "artifact invalid",
        }),
      ),
    ).toMatchObject({
      kind: "owner-review",
      data: { reason: "review-failed" },
    });
  });
});

describe("evaluation task policy", () => {
  test("keeps explicit session task identities collision-safe", () => {
    const first = taskIntentForInput({
      kind: "evaluate-session",
      data: { sessionId: "s/eval:42" },
    });
    const second = taskIntentForInput({
      kind: "evaluate-session",
      data: { sessionId: "s:eval/42" },
    });
    expect(first?.id).not.toBe(second?.id);
    expect(first?.id.length).toBeLessThanOrEqual(
      "runtime/compat/session-aftermath/".length + 120,
    );
  });

  test("uses the complete normalized assessment contract as review identity", () => {
    const review = (data: Record<string, unknown>) =>
      taskIntentForInput({
        kind: "review-task-outcome",
        data: { appId: "may", taskId: "goal/example", ...data },
      });
    const omittedPurpose = review({});
    const explicitOutcome = review({ assessmentPurpose: "outcome" });
    const generationOnly = review({ subjectGeneration: 3 });
    const evidenceOnly = review({ evidenceHash: "a".repeat(64) });
    const full = review({
      subjectGeneration: 3,
      evidenceHash: "a".repeat(64),
    });
    const duplicate = review({
      assessmentPurpose: "outcome",
      subjectGeneration: 3,
      evidenceHash: "a".repeat(64),
    });
    const changedEvidence = review({
      subjectGeneration: 3,
      evidenceHash: "b".repeat(64),
    });
    const ongoing = review({ assessmentPurpose: "ongoing" });

    expect(omittedPurpose).toEqual(explicitOutcome);
    expect(full).toEqual(duplicate);
    expect(review({ taskId: "goal/example" })?.id).not.toBe(
      review({ taskId: "goal-example-96ccaaaa0f4c" })?.id,
    );
    expect(
      new Set([
        omittedPurpose?.id,
        generationOnly?.id,
        evidenceOnly?.id,
        full?.id,
        changedEvidence?.id,
        ongoing?.id,
      ]).size,
    ).toBe(6);
    expect(omittedPurpose).toMatchObject({
      id: expect.stringMatching(
        /^runtime\/task-outcome\/v2\/may\/goal-example-[a-f0-9]{12}\/outcome\/contract-[a-f0-9]{64}$/,
      ),
      input: { assessmentPurpose: "outcome" },
    });
    expect(generationOnly?.id).toContain("/outcome/generation-3/contract-");
    expect(evidenceOnly?.id).toContain(`/outcome/evidence-${"a".repeat(64)}`);
    expect(full?.id).toContain(
      `/outcome/generation-3/evidence-${"a".repeat(64)}`,
    );
    expect(ongoing).toMatchObject({
      id: expect.stringMatching(
        /^runtime\/task-outcome\/v2\/may\/goal-example-[a-f0-9]{12}\/ongoing\/contract-[a-f0-9]{64}$/,
      ),
      workflow: "task-outcome-review",
      input: { assessmentPurpose: "ongoing" },
    });
  });

  test("recovers saved unpinned reviews without changing the historical collided Task", async () => {
    const root = mkdtempSync(join(tmpdir(), "evaluation-v2-admission-"));
    const config = appTaskTestContext({
      appDir: root,
      appId: "evaluation",
      agent: "evaluator",
      maxConcurrent: 1,
      tree: {
        groups: {
          "evaluation-system": { id: "evaluation-system", parent_id: null },
        },
      },
    });
    applyDbSchema(config.resourceStore.db);
    const subject = {
      appId: "may",
      taskId: "goal/historical-subject",
      assessmentPurpose: "ongoing",
    } as const;
    const currentPinned = taskIntentForInput({
      kind: "review-task-outcome",
      data: { ...subject, subjectGeneration: 1 },
    })!;
    const historicalPinned = {
      ...currentPinned,
      id: currentPinned.id
        .replace("runtime/task-outcome/v2/", "runtime/task-outcome/")
        .replace("/generation-1", "")
        .replace(/\/contract-[a-f0-9]{64}$/, ""),
    };
    const callerAdmissionKey = "task:historical-caller";
    observeAppTaskIntent(config, {
      appAgent: "evaluator",
      intent: historicalPinned,
      creator: { appId: "may", taskId: subject.taskId },
      admissionKey: callerAdmissionKey,
    });
    const claim = claimObservedAppTask(config, {
      taskId: historicalPinned.id,
      appAgent: "evaluator",
      handler: "workflow:task-outcome-review",
    });
    if (claim.kind !== "claimed") throw new Error("expected historical claim");
    const reviewAt = Date.now() + 86_400_000;
    deferAppTask(config, claim, {
      disposition: "waiting",
      report: true,
      summary: "Semantic allowance is exhausted",
      facts: ["allowance:budget-deferred"],
      reviewAt,
    });
    const before = config.resourceStore.readTask(historicalPinned.id);
    const beforeAttempt = config.resourceStore.readAttempt(claim.attemptId);
    const beforeCallerAdmission = config.resourceStore.readTaskContext({
      taskIds: [],
      admissionIds: [callerAdmissionKey],
    }).appTaskAdmissions?.[callerAdmissionKey];

    const requestIds = ["periodic-a", "periodic-b", "periodic-c"];
    for (const id of requestIds) {
      createAppInboxItem(config.resourceStore.db, {
        id,
        appId: "evaluation",
        source: { kind: "system", id: "periodic-review" },
        input: { kind: "review-task-outcome", data: subject },
      });
    }
    const failures: string[] = [];
    const host = new AppInboxHost({
      db: config.resourceStore.db,
      apps: [app],
      attachTask: (input) => admitTaskInput(config, input),
      onFailure: (failure) => failures.push(failure.error),
    });
    try {
      await host.recoverAdmissions();
      const recoveredId = taskIntentForInput({
        kind: "review-task-outcome",
        data: subject,
      })!.id;
      expect(recoveredId).not.toBe(historicalPinned.id);
      expect(requestIds.map((id) => host.get(id)?.waitingOn)).toEqual(
        requestIds.map(() => ({ kind: "task", id: recoveredId })),
      );
      expect(failures).toEqual([]);
      expect(config.resourceStore.readTask(historicalPinned.id)).toEqual(
        before,
      );
      expect(config.resourceStore.readAttempt(claim.attemptId)).toEqual(
        beforeAttempt,
      );
      expect(before).toMatchObject({
        metadata: {
          creator: { appId: "may", taskId: subject.taskId },
          generation: 1,
        },
        status: {
          phase: "waiting",
          facts: ["allowance:budget-deferred"],
          reviewAt,
        },
      });
      expect(
        config.resourceStore.readTaskContext({
          taskIds: [],
          admissionIds: [callerAdmissionKey],
        }).appTaskAdmissions?.[callerAdmissionKey],
      ).toEqual(beforeCallerAdmission);

      const recoveredContext = config.resourceStore.readTaskContext({
        taskIds: [recoveredId],
        admissionIds: requestIds.map((id) => `task:${id}`),
      });
      expect(
        requestIds.map(
          (id) => recoveredContext.appTaskAdmissions?.[`task:${id}`]?.taskId,
        ),
      ).toEqual(requestIds.map(() => recoveredId));
      expect(
        Object.values(recoveredContext.attempts ?? {}).filter(
          (attempt) => attempt.taskId === recoveredId,
        ),
      ).toEqual([]);
      expect(config.resourceStore.readTask(recoveredId)).toMatchObject({
        metadata: { creator: { appId: "evaluation" }, generation: 1 },
        spec: {
          input: { ...subject },
          workflow: "task-outcome-review",
        },
        status: { phase: "pending" },
      });

      const recoveredBeforeReplay = config.resourceStore.readTask(recoveredId);
      await host.recoverAdmissions();
      expect(config.resourceStore.readTask(recoveredId)).toEqual(
        recoveredBeforeReplay,
      );
      expect(requestIds.map((id) => host.get(id)?.waitingOn)).toEqual(
        requestIds.map(() => ({ kind: "task", id: recoveredId })),
      );
    } finally {
      host.close();
      config.resourceStore.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("routes production failure dispositions only when automatic review is enabled", () => {
    const previous = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    try {
      delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      const failed = event("project.task.reconciled", {
        project: "may",
        taskId: "goal/example",
        generation: 3,
        disposition: "retrying",
      });
      expect(taskInputForEvent(failed)).toBeNull();
      process.env.EVALUATION_AUTO_REVIEW_ENABLED = "true";
      for (const disposition of ["incomplete", "retrying"]) {
        expect(
          taskInputForEvent(
            event("project.task.reconciled", {
              project: "may",
              taskId: "goal/example",
              generation: 3,
              disposition,
            }),
          ),
        ).toEqual({
          kind: "review-task-outcome",
          data: {
            appId: "may",
            taskId: "goal/example",
            assessmentPurpose: "ongoing",
          },
        });
      }
      expect(
        taskInputForEvent(
          event("project.task.reconciled", {
            project: "may",
            taskId: "goal/example",
            generation: 3,
            disposition: "converged",
          }),
        ),
      ).toBeNull();
      expect(
        taskInputForEvent(
          event("project.task.reconciled", {
            project: "evaluation",
            taskId: "runtime/example",
            generation: 1,
            disposition: "incomplete",
          }),
        ),
      ).toBeNull();
    } finally {
      if (previous === undefined)
        delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      else process.env.EVALUATION_AUTO_REVIEW_ENABLED = previous;
    }
  });

  test("preserves assessment purpose from a review request into workflow input", () => {
    const input = taskInputForEvent(
      event("evaluation.task.review.requested", {
        appId: "may",
        taskId: "goal/example",
        subjectGeneration: 7,
        evidenceHash: "b".repeat(64),
        assessmentPurpose: "ongoing",
      }),
    );
    expect(input).toEqual({
      kind: "review-task-outcome",
      data: {
        appId: "may",
        taskId: "goal/example",
        subjectGeneration: 7,
        evidenceHash: "b".repeat(64),
        assessmentPurpose: "ongoing",
      },
    });
    expect(taskIntentForInput(input!)).toMatchObject({
      workflow: "task-outcome-review",
      input: {
        subjectGeneration: 7,
        evidenceHash: "b".repeat(64),
        assessmentPurpose: "ongoing",
      },
    });
  });

  test("keeps every supported input independent of retired legacy grouping parents", () => {
    const inputs: AppInput[] = [
      {
        kind: "review-task-outcome",
        data: { appId: "may", taskId: "goal/example" },
      },
      { kind: "read-reports", data: { operation: "list" } },
      { kind: "automatic-review", data: {} },
      { kind: "evaluate-session", data: { sessionId: "s-example" } },
      { kind: "deep-eval", data: { sessionId: "s-example" } },
      { kind: "deep-scan", data: {} },
      { kind: "project-review", data: { targetProject: "may.app" } },
      {
        kind: "codex-goal-trial",
        data: { targetProject: "may.app", focus: "bounded check" },
      },
      {
        kind: "workflow-trial",
        data: { targetProject: "may.app", focus: "bounded check" },
      },
      {
        kind: "feedback-record",
        data: {
          evaluation: {
            sessionId: "s-example",
            agent: "may",
            quality: 0.5,
            verdict: "needs_improvement",
            issues: ["Missing evidence."],
          },
        },
      },
      { kind: "owner-review", data: {} },
    ];
    const intents = inputs.map((input) => taskIntentForInput(input));
    for (const intent of intents) {
      expect(intent).not.toBeNull();
      expect(intent?.parentId).toBe("evaluation-system");
    }
    expect(intents.slice(0, 3).map((intent) => intent?.id)).toEqual([
      expect.stringMatching(
        /^runtime\/task-outcome\/v2\/may\/goal-example-[a-f0-9]{12}\/outcome\/contract-[a-f0-9]{64}$/,
      ),
      "runtime/report-reader/latest",
      "runtime/task-outcome-selector",
    ]);
    for (const intent of intents.slice(3)) {
      expect(intent?.id).toStartWith("runtime/compat/");
    }
    expect(
      taskForEvaluationInput({
        id: "app_message",
        input: { kind: "message", data: { message: "Review this" } },
      } as AppTaskInput).intent,
    ).toMatchObject({
      id: "runtime/compat/input/app_message",
      parentId: "evaluation-system",
    });
  });

  test("uses standing maintain tasks for recurring responsibilities", () => {
    expect(
      taskIntentForInput({
        kind: "owner-review",
        data: { reason: "metric.breach" },
      }),
    ).toMatchObject({
      id: "runtime/compat/owner-review",
      agent: "evaluator",
      executor: "codex-goal",
    });
    const evaluation = {
      sessionId: "s_feedback",
      agent: "may",
      quality: 0.6,
      verdict: "needs_improvement",
      issues: ["Verify the result."],
      createdAt: 1_700_000_000_000,
    };
    expect(
      taskIntentForInput({
        kind: "feedback-record",
        data: { evaluation },
      }),
    ).toMatchObject({
      id: "runtime/compat/evaluation-feedback/may",
      workflow: "evaluation-feedback-projection",
      input: { evaluation, feedbackKey: "may" },
    });
    expect(
      taskIntentForInput({
        kind: "owner-review",
        data: { reason: "scheduled" },
      }),
    ).toMatchObject({
      id: "runtime/compat/owner-review",
      executor: "codex-goal",
    });
  });

  test("routes recorded shallow and deep evaluations directly to per-agent feedback tasks", () => {
    const evaluation = {
      sessionId: "s_feedback",
      agent: "app/ops",
      quality: 0.5,
      verdict: "needs_improvement",
      issues: ["Missing evidence."],
    };
    const shallow = taskIntentForEvent(
      event(
        "evaluation.recorded",
        { evaluation },
        { target: { project: "evaluation" } },
      ),
    );
    const deep = taskIntentForEvent(
      event(
        "evaluation.deep_recorded",
        { evaluation },
        { target: { project: "evaluation" } },
      ),
    );
    expect(shallow).toEqual(deep);
    expect(shallow).toMatchObject({
      id: "runtime/compat/evaluation-feedback/app-ops-bae9bad818b6",
      workflow: "evaluation-feedback-projection",
      input: {
        evaluation,
        feedbackKey: "app-ops-bae9bad818b6",
      },
    });
    expect(app.tasks?.subscriptions).toEqual(
      expect.arrayContaining([
        { type: "evaluation.recorded", project: "evaluation" },
        { type: "evaluation.deep_recorded", project: "evaluation" },
      ]),
    );
  });

  test("keeps gym.app in standing project-health coverage", () => {
    expect(
      taskIntentForInput({
        kind: "project-review",
        data: { targetProject: "gym.app" },
      }),
    ).toMatchObject({
      id: "runtime/compat/project-audit/gym.app",
      workflow: "project-health-evaluator",
      input: {
        targetProject: "gym.app",
      },
    });
    expect(app.schedules).not.toContainEqual(
      expect.objectContaining({ id: "project-health-loop-gym.app" }),
    );
  });

  test("keeps wake observations out of standing project-health specifications", () => {
    const scheduled = taskIntentForInput({
      kind: "project-review",
      data: { targetProject: "aks-rp-e2e.app", reason: "scheduled" },
    });
    const manual = taskIntentForInput({
      kind: "project-review",
      data: { targetProject: "aks-rp-e2e.app", reason: "manual" },
    });
    expect(scheduled?.input).toEqual(manual?.input);
  });

  test("keeps reliability parents structural", () => {
    const seed = JSON.parse(
      readFileSync(new URL("./tasks/seed.json", import.meta.url), "utf8"),
    ) as { groups: Record<string, Record<string, unknown>> };
    expect(seed.groups["evaluator-reliability"]).toMatchObject({
      id: "evaluator-reliability",
      parent_id: "evaluation-system",
      owner: "evaluator",
    });
    expect(seed.groups["pipeline-health"]).toMatchObject({
      id: "pipeline-health",
      parent_id: "evaluator-reliability",
      owner: "evaluator",
    });
    expect(seed.groups["evaluator-reliability"]).not.toHaveProperty("workflow");
    expect(seed.groups["pipeline-health"]).not.toHaveProperty("workflow");
  });

  test("marks project-health inner evaluator calls as persistent-task guard exempt", () => {
    expect(PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE).toBe(
      "persistent-task: skip",
    );
    expect(
      projectHealthEvaluatorAgentPrompt(
        { targetProject: "scout-knowledge-lib.app", reason: "scheduled" },
        {},
      ),
    ).toStartWith("persistent-task: skip\n\n");
  });

  test("requires canonical typed subjects for evaluator-owned Conditions", () => {
    const instructions = readFileSync(
      new URL("./agents/evaluator/AGENTS.md", import.meta.url),
      "utf8",
    );
    expect(instructions).toContain("exact `<type>:<id>` form");
    expect(instructions).toContain("event:project.task.child-transitioned");
    expect(instructions).toContain("Put target filters");
    expect(instructions).toContain("never use prose");
  });

  test("keeps Task actions inside open-ended Evaluation work", () => {
    expect(
      validateEvaluationTaskAction({
        kind: "unblock-task",
        taskId: "runtime/compat/project-audit/may-agent.app",
        expectedGeneration: 1,
        reason: "Retry the reconciler-owned task",
      }),
    ).toContain("cannot mutate reconciler-owned task");
    expect(
      validateEvaluationTaskAction({
        kind: "unblock-task",
        taskId: "bounded-child",
        expectedGeneration: 1,
        reason: "New evidence arrived",
      }),
    ).toBeNull();
  });
});
