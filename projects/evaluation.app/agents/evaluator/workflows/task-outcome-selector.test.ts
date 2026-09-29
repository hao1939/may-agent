import { describe, expect, test } from "bun:test";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  automaticReviewConfig,
  populationEvidenceDigest,
  runTaskOutcomeSelector,
  selectFairCandidate,
  selectorStateFact,
} from "./task-outcome-selector.ts";
import type { PublicCommand } from "./lib/public-task-evidence.ts";
import { readSubjectTask } from "./lib/public-task-evidence.ts";
import {
  hashReport,
  listTaskReports,
  markTaskReportPublished,
  renderTaskReportMarkdown,
  taskReportPaths,
  TASK_OUTCOME_RUBRIC_VERSION,
  writeImmutable,
} from "./lib/task-report-store.ts";

const NOW = Date.UTC(2026, 8, 17);
const DAY = 86_400_000;
const config = {
  enabled: true,
  reviewer: "evaluator" as const,
  intervalMs: DAY,
  maxApps: 10,
  maxTasksPerApp: 2,
  maxPagesPerApp: 2,
  recentWindowMs: 7 * DAY,
};
const deepseekConfig = {
  ...config,
  reviewer: "evaluator-deepseek" as const,
  intervalMs: 300_000,
};

function task(
  appId: string,
  taskId: string,
  ageDays = 0,
  status = "up-to-date",
) {
  return { appId, taskId, status, updatedAt: NOW - ageDays * DAY };
}

function publishReport(
  root: string,
  appId: string,
  taskId: string,
  evidenceHash: string,
  createdAt: number,
  reviewer = "evaluator",
): void {
  const paths = taskReportPaths(
    appId,
    taskId,
    evidenceHash,
    TASK_OUTCOME_RUBRIC_VERSION,
    "",
    reviewer,
  );
  const executionId = `fixture-${createHash("sha256").update(taskId).digest("hex").slice(0, 12)}`;
  const payload = {
    version: 1,
    rubricVersion: TASK_OUTCOME_RUBRIC_VERSION,
    sourceRevision: "selector-regression",
    createdAt,
    disposition: "assessed",
    subject: { appId, taskId, evidenceHash },
    evaluator: {
      executionId,
      ...(reviewer === "evaluator" ? {} : { reviewer }),
    },
    judgment: {
      disposition: "assessed",
      summary: "Fixture report",
      responsibility: "Fixture",
      delivery: "Fixture",
      findings: [],
      verification: [],
    },
  };
  const markdown = renderTaskReportMarkdown(payload)!;
  writeImmutable(
    join(root, paths.jsonPath),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  writeImmutable(join(root, paths.markdownPath), markdown);
  markTaskReportPublished(root, {
    appId,
    taskId,
    evidenceHash,
    executionId,
    ...(reviewer === "evaluator" ? {} : { reviewer }),
    jsonPath: paths.jsonPath,
    markdownPath: paths.markdownPath,
    jsonSha256: hashReport(join(root, paths.jsonPath)),
    markdownSha256: hashReport(join(root, paths.markdownPath)),
  });
}

function populationReport(
  end: number,
  examples: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const totals = {
    started: examples.length,
    terminal: examples.length,
    completed: examples.filter((item) => item.state === "completed").length,
    failed: examples.filter((item) => item.state === "failed").length,
    interrupted: examples.filter((item) => item.state === "interrupted").length,
    nonterminalAtCut: 0,
    undatedTerminal: 0,
    failedTaskCount: new Set(
      examples
        .filter((item) => item.state === "failed")
        .map((item) => item.taskId),
    ).size,
    failurePercent: examples.length
      ? (examples.filter((item) => item.state === "failed").length * 100) /
        examples.length
      : null,
    failedWallMs: 0,
    failedDurationMeasured: 0,
    failedDurationUnknown: 0,
  };
  return {
    version: 1,
    available: true,
    appId: "gym",
    taskId: null,
    end,
    windowMs: DAY,
    population: "attempt cohort",
    denominator: "terminal attempts",
    previous: {
      start: end - 2 * DAY,
      end: end - DAY,
      totals: { ...totals, started: 0, terminal: 0, completed: 0 },
      byHandler: [],
      byFailureReason: [],
      groupsTruncated: false,
      examples: [],
    },
    current: {
      start: end - DAY,
      end,
      totals,
      byHandler: [{ handler: "goal", ...totals }],
      byFailureReason: [],
      groupsTruncated: false,
      examples,
    },
    limits: { groups: 20, examples: 12, summaryChars: 800 },
    unknowns: ["bounded retained history"],
    ...overrides,
  };
}

function populationCommand(
  population: () => Record<string, unknown>,
  tasks: Record<string, Record<string, unknown>[]>,
): PublicCommand {
  const fallback = catalogCommand(tasks);
  return async (request) => {
    if (request.type === "task.attempts.read") return population();
    return fallback(request);
  };
}

function catalogCommand(
  tasks: Record<string, Record<string, unknown>[]>,
  seen: Record<string, unknown>[] = [],
): PublicCommand {
  return async (request) => {
    seen.push(request);
    if (request.type === "apps.list")
      return {
        type: "ok",
        command: "apps.list",
        apps: [
          { id: "evaluation" },
          ...Object.keys(tasks).map((id) => ({ id })),
        ],
      };
    if (request.type === "tasks.list") {
      const statuses = Array.isArray(request.status)
        ? new Set(request.status.map(String))
        : null;
      const items = (tasks[String(request.appId)] ?? []).filter(
        (item) => !statuses || statuses.has(String(item.status)),
      );
      const start = request.cursor ? Number(request.cursor) : 0;
      const limit = Number(request.limit);
      const page = items.slice(start, start + limit);
      return {
        type: "ok",
        command: "tasks.list",
        tasks: {
          items: page,
          nextCursor:
            start + limit < items.length ? String(start + limit) : null,
        },
      };
    }
    const appId = String(request.appId);
    const exactTaskId = String(request.taskId);
    const listed = (tasks[appId] ?? []).find(
      (item) => item.taskId === exactTaskId,
    );
    if (request.type === "app.task.get")
      return {
        type: "ok",
        command: "app.task.get",
        appId,
        taskId: exactTaskId,
        task: {
          id: exactTaskId,
          generation: 1,
          creator: { appId },
          agent: listed?.agent ?? "worker",
          outcome: `Review ${exactTaskId}`,
          result: { status: listed?.status },
        },
      };
    if (request.type === "task.get")
      return {
        type: "ok",
        command: "task.get",
        task: {
          ...listed,
          appId,
          taskId: exactTaskId,
          generation: 1,
        },
      };
    throw new Error("unexpected");
  };
}

describe("automatic task outcome selector", () => {
  test("is initially off and bounds recent navigation configuration", () => {
    expect(automaticReviewConfig({})).toMatchObject({
      enabled: false,
      reviewer: "evaluator",
      intervalMs: DAY,
      maxApps: 20,
      maxTasksPerApp: 20,
      maxPagesPerApp: 2,
      recentWindowMs: 7 * DAY,
    });
    expect(
      automaticReviewConfig({
        EVALUATION_AUTO_REVIEW_ENABLED: "true",
        EVALUATION_AUTO_REVIEW_REVIEWER: "evaluator-deepseek",
        EVALUATION_AUTO_REVIEW_MAX_APPS: "1000",
        EVALUATION_AUTO_REVIEW_MAX_PAGES_PER_APP: "99",
        EVALUATION_AUTO_REVIEW_RECENT_WINDOW_MS: String(99 * DAY),
      }),
    ).toMatchObject({
      enabled: true,
      reviewer: "evaluator-deepseek",
      maxApps: 20,
      maxPagesPerApp: 5,
      recentWindowMs: 30 * DAY,
    });
  });

  test("does not select an externally owned Task assigned to an Evaluation worker", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-self-worker-"));
    const result = await selectFairCandidate(
      catalogCommand({
        may: [
          {
            ...task("may", "goal/delegated-review"),
            agent: "evaluator-deepseek",
          },
        ],
      }),
      deepseekConfig,
      root,
      undefined,
      NOW,
    );
    expect(result.candidate).toBeNull();
  });

  test("uses the recent tasks.list contract and advances within an App", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-page-"));
    const seen: Record<string, unknown>[] = [];
    const command = catalogCommand(
      {
        may: [task("may", "goal/one"), task("may", "goal/two")],
      },
      seen,
    );
    const first = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    const second = await selectFairCandidate(
      command,
      config,
      root,
      first.state,
      NOW,
    );
    expect([first.candidate, second.candidate]).toEqual([
      { appId: "may", taskId: "goal/one" },
      { appId: "may", taskId: "goal/two" },
    ]);
    expect(
      seen.filter((item) => item.type === "tasks.list").slice(0, 2),
    ).toEqual([
      {
        type: "tasks.list",
        appId: "may",
        status: ["pending", "waiting", "attention"],
        limit: 1,
      },
      { type: "tasks.list", appId: "may", includeDone: true, limit: 1 },
    ]);
  });

  test("advances past long Unicode Task identities with a bounded state fact", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-long-id-"));
    const long = `goal/${"任务-🚀-".repeat(80)}`;
    const command = catalogCommand({
      may: [task("may", long), task("may", "goal/after-long")],
    });
    const first = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    const second = await selectFairCandidate(
      command,
      config,
      root,
      first.state,
      NOW,
    );
    expect(first.candidate?.taskId).toBe(long);
    expect(second.candidate?.taskId).toBe("goal/after-long");

    const manyEntries = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [
        `${index}-应用-${"界".repeat(100)}`,
        String(index % 10).repeat(64),
      ]),
    );
    const fact = selectorStateFact({
      version: 6,
      appId: "应用-next",
      appIndex: 99,
      taskCursorByApp: manyEntries,
      unresolvedCursorByApp: manyEntries,
      unresolvedExhaustedByApp: manyEntries,
    });
    const simulatedResult = {
      facts: [`selected:may/${long}`, fact],
      response: "Selected one candidate.",
      summary: "Selected one candidate.",
    };
    expect(Buffer.byteLength(fact)).toBeLessThan(8_200);
    expect(Buffer.byteLength(JSON.stringify(simulatedResult))).toBeLessThan(
      16_000,
    );

    const migrated = selectorStateFact({
      version: 5,
      appId: "a".repeat(64),
      appIndex: 2,
      taskCursorByApp: { ["b".repeat(64)]: "historical-cursor" },
    } as never);
    const decoded = JSON.parse(
      Buffer.from(
        migrated.slice("selector-state:".length),
        "base64url",
      ).toString("utf8"),
    );
    expect(decoded).toMatchObject({
      version: 8,
      taskCursorByApp: { ["b".repeat(64)]: "historical-cursor" },
      unresolvedCursorByApp: {},
      unresolvedExhaustedByApp: {},
    });
  });

  test("retains the public keyset continuation for a long Task identity", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-long-keyset-"));
    const long = `goal/${"x".repeat(400)}`;
    const items = [
      task("may", long, 0, "waiting"),
      task("may", "goal/older", 0, "waiting"),
    ];
    const token = Buffer.from(
      JSON.stringify({
        updatedAt: items[0]!.updatedAt,
        appId: "may",
        taskId: long,
        terminal: 0,
      }),
    ).toString("base64url");
    expect(Buffer.byteLength(token)).toBeGreaterThan(512);
    const exact = catalogCommand({ may: items });
    const command: PublicCommand = async (request) => {
      if (request.type !== "tasks.list") return exact(request);
      return {
        type: "ok",
        command: "tasks.list",
        tasks: request.cursor
          ? { items: [items[1]], nextCursor: null }
          : { items: [items[0]], nextCursor: token },
      };
    };

    const first = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    const second = await selectFairCandidate(
      command,
      config,
      root,
      first.state,
      NOW,
    );
    expect(first.candidate?.taskId).toBe(long);
    expect(second.candidate?.taskId).toBe("goal/older");
    expect(Object.values(first.state.unresolvedCursorByApp)).toEqual([token]);
    expect(selectorStateFact(first.state).length).toBeLessThan(8_000);
  });

  test("treats every opaque unresolved cursor as data, including a tilde", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-opaque-tilde-"));
    const items = [
      task("may", "goal/first", 0, "waiting"),
      task("may", "goal/second", 0, "waiting"),
    ];
    const exact = catalogCommand({ may: items });
    const cursors: unknown[] = [];
    const command: PublicCommand = async (request) => {
      if (request.type !== "tasks.list") return exact(request);
      cursors.push(request.cursor);
      const item = request.cursor === "~" ? items[1] : items[0];
      return {
        type: "ok",
        command: "tasks.list",
        tasks: { items: [item], nextCursor: request.cursor ? null : "~" },
      };
    };

    const first = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    const second = await selectFairCandidate(
      command,
      config,
      root,
      first.state,
      NOW,
    );
    expect(first.candidate?.taskId).toBe("goal/first");
    expect(second.candidate?.taskId).toBe("goal/second");
    expect(cursors).toEqual([undefined, "~"]);
  });

  test("keeps the actual selected result bounded while emitting the full identity", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-selected-budget-"));
    const long = `goal/${"任务🚀".repeat(2_000)}`;
    let emitted: Record<string, unknown> | undefined;
    const ctx = {
      reconciliation: {
        taskId: "automatic-review",
        resourceVersion: 1,
        taskSnapshot: { live: [], truncated: false },
      },
      read: { tasks: { get: async () => ({ facts: [] }) } },
      events: {
        emit: async (event: Record<string, unknown>) => {
          emitted = event;
        },
      },
      done: (_summary: string, result: Record<string, unknown>) => result,
    } as never;
    const result = await runTaskOutcomeSelector(
      ctx,
      // The production entry uses the wall clock; keep this outcome recent.
      catalogCommand({
        may: [{ ...task("may", long), updatedAt: Date.now() }],
      }),
      deepseekConfig,
      root,
    );
    expect((emitted?.data as Record<string, unknown>).taskId).toBe(long);
    expect((emitted?.data as Record<string, unknown>).reviewer).toBe(
      "evaluator-deepseek",
    );
    expect(String(emitted?.localKey).length).toBeLessThan(100);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(16 * 1_024);
  });

  test("gives retained requested reviews priority over routine sampling", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-request-priority-"));
    const routine = { ...task("may", "goal/routine"), updatedAt: Date.now() };
    let emitted = false;
    const context = (live: Record<string, unknown>[], truncated = false) =>
      ({
        reconciliation: {
          taskId: "runtime/task-outcome-selector",
          resourceVersion: 1,
          taskSnapshot: { live, truncated },
        },
        read: { tasks: { get: async () => ({ facts: [] }) } },
        events: {
          emit: async () => {
            emitted = true;
          },
        },
        done: (_summary: string, result: Record<string, unknown>) => result,
      }) as never;
    const requested = await runTaskOutcomeSelector(
      context([
        {
          taskId:
            "runtime/task-outcome/v2/may/goal-one/outcome/reviewer-evaluator-deepseek/contract-one",
          status: "waiting",
        },
      ]),
      catalogCommand({ may: [routine] }),
      deepseekConfig,
      root,
    );
    expect((requested as { facts: string[] }).facts).toEqual(
      expect.arrayContaining([
        "selector:requested-reviews-first:1",
        "requested-review:runtime/task-outcome/v2/may/goal-one/outcome/reviewer-evaluator-deepseek/contract-one",
        expect.stringMatching(/^selector-state:/),
      ]),
    );
    expect(emitted).toBeFalse();

    await runTaskOutcomeSelector(
      context([
        {
          taskId: "runtime/task-outcome/v2/may/goal-sol/outcome/contract-sol",
          status: "waiting",
        },
      ]),
      catalogCommand({ may: [routine] }),
      deepseekConfig,
      root,
    );
    expect(emitted).toBeTrue();
    emitted = false;

    const solRequested = await runTaskOutcomeSelector(
      context([
        {
          taskId: "runtime/task-outcome/v2/may/goal-sol/outcome/contract-sol",
          status: "waiting",
        },
      ]),
      catalogCommand({ may: [routine] }),
      config,
      root,
    );
    expect((solRequested as { facts: string[] }).facts).toEqual(
      expect.arrayContaining(["selector:requested-reviews-first:1"]),
    );
    expect(emitted).toBeFalse();

    const incomplete = await runTaskOutcomeSelector(
      context([], true),
      catalogCommand({ may: [routine] }),
      config,
      root,
    );
    expect((incomplete as { facts: string[] }).facts).toEqual(
      expect.arrayContaining([
        "selector:requested-review-backlog-unknown",
        "selector:task-snapshot-truncated",
        expect.stringMatching(/^selector-state:/),
      ]),
    );
    expect(emitted).toBeFalse();
  });

  test("round-robins discovered Apps and never Evaluation", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-fair-"));
    const command = catalogCommand({
      may: [task("may", "goal/may-1"), task("may", "goal/may-2")],
      scout: [task("scout", "goal/scout-1"), task("scout", "goal/scout-2")],
      zeta: [task("zeta", "goal/zeta-1")],
    });
    const selected = [];
    let state;
    for (let index = 0; index < 4; index += 1) {
      const result = await selectFairCandidate(
        command,
        config,
        root,
        state,
        NOW,
      );
      selected.push(result.candidate);
      state = result.state;
    }
    expect(selected).toEqual([
      { appId: "may", taskId: "goal/may-1" },
      { appId: "scout", taskId: "goal/scout-1" },
      { appId: "zeta", taskId: "goal/zeta-1" },
      { appId: "may", taskId: "goal/may-2" },
    ]);
  });

  test("includes canonical Gym and arbitrary external Apps while excluding Evaluation", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-external-apps-"));
    const base = catalogCommand({
      delegated: [task("delegated", "goal/evaluation-created")],
      gym: [task("gym", "goal/gym")],
      "new-external-app": [task("new-external-app", "goal/new-external-app")],
    });
    const command: PublicCommand = async (request) => {
      if (request.type === "apps.list")
        return {
          type: "ok",
          command: "apps.list",
          apps: [
            { id: "Evaluation.app", appId: "evaluation" },
            { id: "delegated.app" },
            { id: "gym.app" },
            { appId: "new-external-app.app" },
          ],
        };
      const response = await base(request);
      if (request.type !== "app.task.get" || request.appId !== "delegated")
        return response;
      return {
        ...response,
        task: {
          ...(response.task as Record<string, unknown>),
          creator: { source: { appId: "Evaluation.app" } },
        },
      };
    };

    const first = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    const second = await selectFairCandidate(
      command,
      config,
      root,
      first.state,
      NOW,
    );
    expect([first.candidate, second.candidate]).toEqual([
      { appId: "gym", taskId: "goal/gym" },
      { appId: "new-external-app", taskId: "goal/new-external-app" },
    ]);
  });

  test("selects an open obligation even when historical outcomes age out", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-window-"));
    const command = catalogCommand({
      may: [
        task("may", "goal/running", 40, "running"),
        task("may", "goal/recent", 1, "up-to-date"),
        task("may", "goal/old", 8),
        task("may", "goal/older", 9),
      ],
    });
    const result = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    expect(result.candidate).toEqual({
      appId: "may",
      taskId: "goal/running",
      assessmentPurpose: "ongoing",
    });
  });

  test("uses the filtered pass to reach an old open obligation before historical outcomes", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-old-open-continuation-"));
    const seen: Record<string, unknown>[] = [];
    const command = catalogCommand(
      {
        may: [
          task("may", "goal/old-done-1", 30, "done"),
          task("may", "goal/old-done-2", 29, "done"),
          task("may", "goal/old-done-3", 28, "done"),
          task("may", "goal/old-done-4", 27, "done"),
          task("may", "goal/old-wait", 40, "waiting"),
        ],
      },
      seen,
    );

    const result = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    expect(result.candidate).toEqual({
      appId: "may",
      taskId: "goal/old-wait",
      assessmentPurpose: "ongoing",
    });
    expect(seen.filter((request) => request.type === "tasks.list")).toEqual([
      {
        type: "tasks.list",
        appId: "may",
        status: ["pending", "waiting", "attention"],
        limit: 1,
      },
    ]);
  });

  test("advances beyond dropped selected requests without starving an older obligation", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-dropped-selection-"));
    const seen: Record<string, unknown>[] = [];
    const command = catalogCommand(
      {
        may: [
          task("may", "goal/recent-1", 0, "done"),
          task("may", "goal/recent-2", 0, "done"),
          task("may", "goal/recent-3", 0, "done"),
          task("may", "goal/recent-4", 0, "done"),
          task("may", "goal/old-wait", 40, "waiting"),
        ],
      },
      seen,
    );

    let state;
    const selected = [];
    // Model requests that are selected but dropped before publication. Both
    // filtered and historical cursors must keep making bounded progress.
    for (let index = 0; index < 8; index += 1) {
      const result = await selectFairCandidate(
        command,
        config,
        root,
        state,
        NOW,
      );
      selected.push(result.candidate?.taskId);
      state = result.state;
    }

    expect(selected).toEqual([
      "goal/old-wait",
      "goal/recent-1",
      "goal/old-wait",
      "goal/recent-2",
      "goal/old-wait",
      "goal/recent-3",
      "goal/old-wait",
      "goal/recent-4",
    ]);
    expect(
      seen
        .filter((request) => request.type === "tasks.list")
        .map((request) => request.cursor),
    ).toEqual([
      undefined,
      undefined,
      undefined,
      "1",
      undefined,
      "2",
      undefined,
      "3",
    ]);
  });

  test("revisits fresh unresolved work after one bounded historical turn", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-fresh-unresolved-"));
    const tasks = {
      may: [
        task("may", "goal/existing-wait", 1, "waiting"),
        ...Array.from({ length: 20 }, (_, index) =>
          task("may", `goal/history-${index}`, 0, "done"),
        ),
      ],
    };
    const command = catalogCommand(tasks);
    const first = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    const second = await selectFairCandidate(
      command,
      config,
      root,
      first.state,
      NOW,
    );
    tasks.may.unshift(task("may", "goal/new-wait", 0, "waiting"));
    const third = await selectFairCandidate(
      command,
      config,
      root,
      second.state,
      NOW,
    );

    expect(first.candidate?.taskId).toBe("goal/existing-wait");
    expect(second.candidate?.taskId).toBe("goal/history-0");
    expect(third.candidate?.taskId).toBe("goal/new-wait");
    expect(Object.values(third.state.taskCursorByApp)).toHaveLength(1);
  });

  test("discovers a new unresolved head on the next finite pass while old work progresses", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-next-filtered-pass-"));
    const items = Array.from({ length: 5 }, (_, index) => ({
      ...task("may", `goal/old-${index}`, 0, "waiting"),
      updatedAt: NOW - index,
    }));
    const tasks = { may: items };
    const base = catalogCommand(tasks);
    const command: PublicCommand = async (request) => {
      if (request.type !== "tasks.list") return base(request);
      const statuses = Array.isArray(request.status)
        ? new Set(request.status.map(String))
        : null;
      const ordered = [...tasks.may]
        .filter((item) => !statuses || statuses.has(String(item.status)))
        .sort(
          (left, right) =>
            Number(right.updatedAt) - Number(left.updatedAt) ||
            String(left.taskId).localeCompare(String(right.taskId)),
        );
      const decoded = request.cursor
        ? JSON.parse(
            Buffer.from(String(request.cursor), "base64url").toString("utf8"),
          )
        : null;
      const remaining = decoded
        ? ordered.filter(
            (item) =>
              Number(item.updatedAt) < Number(decoded.updatedAt) ||
              (Number(item.updatedAt) === Number(decoded.updatedAt) &&
                String(item.taskId) > String(decoded.taskId)),
          )
        : ordered;
      const item = remaining[0];
      const nextCursor =
        item && remaining.length > 1
          ? Buffer.from(
              JSON.stringify({
                updatedAt: item.updatedAt,
                taskId: item.taskId,
              }),
            ).toString("base64url")
          : null;
      return {
        type: "ok",
        command: "tasks.list",
        tasks: { items: item ? [item] : [], nextCursor },
      };
    };

    let state;
    const selected: Array<string | undefined> = [];
    for (let wake = 0; wake < 7; wake += 1) {
      const result = await selectFairCandidate(
        command,
        { ...config, maxTasksPerApp: 1, maxPagesPerApp: 1 },
        root,
        state,
        NOW + wake,
      );
      state = result.state;
      selected.push(result.candidate?.taskId);
      if (wake === 0)
        tasks.may.unshift({
          ...task("may", "goal/new-head", 0, "waiting"),
          updatedAt: NOW + 100,
        });
    }

    expect(selected).toEqual([
      "goal/old-0",
      "goal/old-1",
      "goal/old-2",
      "goal/old-3",
      "goal/old-4",
      undefined,
      "goal/new-head",
    ]);
  });

  test("remains fair when each selected Task moves back to the front", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-moving-order-"));
    const tasks = {
      may: [
        task("may", "goal/one", 0, "waiting"),
        task("may", "goal/two", 0, "waiting"),
        task("may", "goal/three", 0, "waiting"),
        task("may", "goal/four", 0, "waiting"),
        task("may", "goal/old-five", 40, "waiting"),
      ],
    };
    const command = catalogCommand(tasks);
    let state;
    const selected = [];
    for (let index = 0; index < 5; index += 1) {
      const result = await selectFairCandidate(
        command,
        config,
        root,
        state,
        NOW + index,
      );
      selected.push(result.candidate?.taskId);
      state = result.state;
      const chosen = tasks.may.find(
        (item) => item.taskId === result.candidate?.taskId,
      );
      if (chosen) chosen.updatedAt = NOW + index + 1;
      tasks.may.sort((left, right) => right.updatedAt - left.updatedAt);
    }
    expect(selected).toEqual([
      "goal/one",
      "goal/two",
      "goal/three",
      "goal/four",
      "goal/old-five",
    ]);
  });

  test("eventually selects 100 reordered Tasks through bounded keyset state", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-keyset-100-"));
    const tasks = Array.from({ length: 100 }, (_, index) =>
      task("may", `goal/task-${index}`, 0, "waiting"),
    );
    let listReads = 0;
    let exactReads = 0;
    const base = catalogCommand({ may: tasks });
    const command: PublicCommand = async (request) => {
      if (request.type === "apps.list" || request.type === "task.attempts.read")
        return base(request);
      if (request.type !== "tasks.list") {
        exactReads += 1;
        return base(request);
      }
      listReads += 1;
      const ordered = [...tasks].sort(
        (left, right) =>
          Number(right.updatedAt) - Number(left.updatedAt) ||
          String(left.taskId).localeCompare(String(right.taskId)),
      );
      const decoded = request.cursor
        ? JSON.parse(
            Buffer.from(String(request.cursor), "base64url").toString("utf8"),
          )
        : null;
      const remaining = decoded
        ? ordered.filter(
            (item) =>
              Number(item.updatedAt) < Number(decoded.updatedAt) ||
              (Number(item.updatedAt) === Number(decoded.updatedAt) &&
                String(item.taskId) > String(decoded.taskId)),
          )
        : ordered;
      const item = remaining[0];
      const nextCursor =
        item && remaining.length > 1
          ? Buffer.from(
              JSON.stringify({
                updatedAt: item.updatedAt,
                taskId: item.taskId,
              }),
            ).toString("base64url")
          : null;
      return {
        type: "ok",
        command: "tasks.list",
        tasks: { items: item ? [item] : [], nextCursor },
      };
    };

    let state;
    const selected = new Set<string>();
    for (let wake = 0; wake < 205 && selected.size < 100; wake += 1) {
      const beforeLists = listReads;
      const beforeExact = exactReads;
      const result = await selectFairCandidate(
        command,
        { ...config, maxTasksPerApp: 20, maxPagesPerApp: 5 },
        root,
        state,
        NOW + wake,
      );
      expect(listReads - beforeLists).toBeLessThanOrEqual(5);
      // One additional exact read is the explicit bounded accepted-evidence page.
      expect(exactReads - beforeExact).toBeLessThanOrEqual(3);
      state = result.state;
      if (!result.candidate) continue;
      selected.add(result.candidate.taskId);
      const chosen = tasks.find(
        (item) => item.taskId === result.candidate?.taskId,
      )!;
      chosen.updatedAt = NOW + wake + 1;
      expect(Buffer.byteLength(selectorStateFact(state))).toBeLessThan(1_000);
    }

    expect(selected.size).toBe(100);
    expect(listReads).toBe(100);
    expect(exactReads).toBe(300);
    expect(state).not.toHaveProperty("attemptedTaskByApp");
    expect(state).not.toHaveProperty("lastTaskByApp");
  });

  test("population evidence identity ignores only rolling-window coordinates", () => {
    const first = populationReport(NOW, [
      {
        appId: "gym",
        taskId: "goal/population",
        attemptId: "attempt-one",
        state: "failed",
        failureReason: "provider timeout",
        startedAt: new Date(NOW - 1_000).toISOString(),
        finishedAt: new Date(NOW - 500).toISOString(),
      },
    ]);
    const shifted = structuredClone(first);
    shifted.end = NOW + 60 * 60_000;
    Object.assign(shifted.previous as Record<string, unknown>, {
      start: NOW - 2 * DAY + 60 * 60_000,
      end: NOW - DAY + 60 * 60_000,
    });
    Object.assign(shifted.current as Record<string, unknown>, {
      start: NOW - DAY + 60 * 60_000,
      end: NOW + 60 * 60_000,
    });
    expect(populationEvidenceDigest(shifted)).toBe(
      populationEvidenceDigest(first),
    );

    const differentAttempt = structuredClone(shifted);
    (
      (differentAttempt.current as Record<string, unknown>).examples as Record<
        string,
        unknown
      >[]
    )[0]!.attemptId = "attempt-two";
    expect(populationEvidenceDigest(differentAttempt)).not.toBe(
      populationEvidenceDigest(first),
    );

    const differentFailure = structuredClone(shifted);
    (
      (differentFailure.current as Record<string, unknown>).examples as Record<
        string,
        unknown
      >[]
    )[0]!.failureReason = "schema rejection";
    expect(populationEvidenceDigest(differentFailure)).not.toBe(
      populationEvidenceDigest(first),
    );
  });

  test("skips a clock-only population repeat without suppressing ordinary or changed evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-population-evidence-"));
    const populationTask = task("gym", "goal/population", 0, "done");
    const dueTask = task("gym", "goal/due", 0, "waiting");
    const example = {
      appId: "gym",
      taskId: "goal/population",
      attemptId: "attempt-one",
      generation: 1,
      handler: "goal",
      state: "completed",
      startedAt: new Date(NOW - 1_000).toISOString(),
      finishedAt: new Date(NOW - 500).toISOString(),
      failureReason: null,
      summary: "complete",
      sessionId: "session-one",
    };
    let currentPopulation = populationReport(NOW, [example]);
    const command = populationCommand(() => currentPopulation, {
      gym: [dueTask, populationTask],
    });

    const first = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    expect(first.candidate).toEqual({
      appId: "gym",
      taskId: "goal/population",
      assessmentPurpose: "ongoing",
      populationEnd: NOW,
    });

    currentPopulation = populationReport(NOW + 60 * 60_000, [example]);
    const clockOnly = await selectFairCandidate(
      command,
      config,
      root,
      { ...first.state, populationTurn: true },
      NOW + 60 * 60_000,
    );
    expect(clockOnly.navigationFacts).toContain(
      `selector:population-unchanged:gym:cut=${NOW + 60 * 60_000}`,
    );
    expect(clockOnly.candidate).toEqual({
      appId: "gym",
      taskId: "goal/due",
      assessmentPurpose: "ongoing",
    });

    currentPopulation = populationReport(NOW + 2 * 60 * 60_000, [
      { ...example, attemptId: "attempt-two", sessionId: "session-two" },
    ]);
    const newAttempt = await selectFairCandidate(
      command,
      config,
      root,
      clockOnly.state,
      NOW + 2 * 60 * 60_000,
    );
    expect(newAttempt.candidate).toEqual({
      appId: "gym",
      taskId: "goal/population",
      assessmentPurpose: "ongoing",
      populationEnd: NOW + 2 * 60 * 60_000,
    });

    currentPopulation = populationReport(NOW + 3 * 60 * 60_000, [
      { ...example, attemptId: "attempt-two", sessionId: "session-two" },
    ]);
    (currentPopulation.current as Record<string, unknown>).groupsTruncated =
      true;
    const changedCoverage = await selectFairCandidate(
      command,
      config,
      root,
      { ...newAttempt.state, populationTurn: true },
      NOW + 3 * 60 * 60_000,
    );
    expect(changedCoverage.candidate).toEqual({
      appId: "gym",
      taskId: "goal/population",
      assessmentPurpose: "ongoing",
      populationEnd: NOW + 3 * 60 * 60_000,
    });
    expect(selectorStateFact(changedCoverage.state).length).toBeLessThan(8_000);
  });

  test("keeps resolved and unresolved historical outcomes reviewable", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-status-"));
    const command = catalogCommand({
      may: [
        task("may", "goal/attention", 0, "attention"),
        task("may", "goal/done", 0, "done"),
        task("may", "goal/closed", 0, "closed"),
        task("may", "goal/cancelled", 0, "cancelled"),
        task("may", "goal/obsolete", 0, "needs-attention"),
      ],
    });
    const first = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    const selected = [first.candidate?.taskId];
    let state = first.state;
    for (let index = 0; index < 5; index += 1) {
      const next = await selectFairCandidate(command, config, root, state, NOW);
      selected.push(next.candidate?.taskId);
      state = next.state;
    }
    expect(selected).toEqual([
      "goal/attention",
      "goal/done",
      "goal/attention",
      "goal/closed",
      "goal/attention",
      "goal/cancelled",
    ]);
  });

  test("rotates past malformed pages and resets legacy cursor state", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-invalid-"));
    const base = catalogCommand({ scout: [task("scout", "goal/good")] });
    const command: PublicCommand = async (request) => {
      if (request.type === "apps.list")
        return {
          type: "ok",
          command: "apps.list",
          apps: [{ id: "may" }, { id: "scout" }],
        };
      if (request.type === "tasks.list" && request.appId === "may")
        return {
          type: "ok",
          command: "tasks.list",
          tasks: { items: [{ appId: "may", taskId: "broken" }] },
        };
      return base(request);
    };
    const legacy = {
      appId: "may",
      appIndex: 0,
      taskCursor: "old-app-tasks-cursor",
      taskOffset: 99,
    } as never;
    const result = await selectFairCandidate(
      command,
      config,
      root,
      legacy,
      NOW,
    );
    expect(result.candidate).toEqual({ appId: "scout", taskId: "goal/good" });
    expect(
      result.navigationFacts.filter(
        (f) => !f.startsWith("selector:population-"),
      ),
    ).toEqual([
      "selector-navigation-failed:may:pages-read=1:tasks.list item has no usable updatedAt",
      "selector-navigation-failed:may:pages-read=2:tasks.list item has no usable updatedAt",
    ]);
    expect(result.state).not.toHaveProperty("taskCursor");
    expect(result.state.version).toBe(8);
  });

  test("advances past malformed and non-reviewable items within a page", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-invalid-items-"));
    const base = catalogCommand({ may: [task("may", "goal/valid")] });
    const command: PublicCommand = async (request) => {
      if (request.type !== "tasks.list") return base(request);
      return {
        type: "ok",
        command: "tasks.list",
        tasks: {
          items: [
            { appId: "may", taskId: "goal/malformed" },
            task("may", "goal/running", 0, "running"),
            task("may", "goal/valid"),
          ],
        },
      };
    };
    const result = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    expect(result.candidate).toEqual({
      appId: "may",
      taskId: "goal/running",
      assessmentPurpose: "ongoing",
    });
    expect(
      result.navigationFacts.filter(
        (f) => !f.startsWith("selector:population-"),
      ),
    ).toEqual([
      "selector-navigation-failed:may:pages-read=1:tasks.list item has no usable updatedAt",
    ]);
  });

  test("preserves two-App exhaustion state so a newly inserted May Task is selected", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-exhaustion-"));
    const tasks = {
      may: [task("may", "goal/may-old", 8, "done")],
      scout: [task("scout", "goal/scout-old", 8, "done")],
    };
    const command = catalogCommand(tasks);
    const exhausted = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    expect(exhausted.candidate).toBeNull();
    expect(exhausted.state.taskCursorByApp).toEqual({});

    tasks.may.unshift(task("may", "goal/may-new"));
    const selected = await selectFairCandidate(
      command,
      config,
      root,
      exhausted.state,
      NOW,
    );
    expect(selected.candidate).toEqual({
      appId: "may",
      taskId: "goal/may-new",
    });
  });

  test("continues from a malformed first page to a valid later page", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-malformed-page-"));
    const cursors: unknown[] = [];
    const base = catalogCommand({ may: [task("may", "goal/later")] });
    const command: PublicCommand = async (request) => {
      if (request.type !== "tasks.list") return base(request);
      if (request.status)
        return {
          type: "ok",
          command: "tasks.list",
          tasks: { items: [], nextCursor: null },
        };
      cursors.push(request.cursor);
      return request.cursor
        ? {
            type: "ok",
            command: "tasks.list",
            tasks: { items: [task("may", "goal/later")] },
          }
        : {
            type: "ok",
            command: "tasks.list",
            tasks: { items: "malformed", nextCursor: "later" },
          };
    };
    const result = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      NOW,
    );
    expect(result.candidate).toEqual({ appId: "may", taskId: "goal/later" });
    expect(cursors).toEqual([undefined, "later"]);
    expect(
      result.navigationFacts.filter(
        (f) => !f.startsWith("selector:population-"),
      ),
    ).toEqual([
      "selector-navigation-failed:may:pages-read=2:tasks.list response has no items array",
    ]);
  });

  test("bounds diagnostics and the full result at configured maximums", async () => {
    const apps = [
      { id: "may" },
      { id: "scout" },
      { id: "scout-knowledge-lib" },
      ...Array.from({ length: 97 }, (_, index) => ({
        id: `${String(index).padStart(3, "0")}-${"应用🚀".repeat(50)}`,
      })),
    ];
    const command: PublicCommand = async (request) => {
      if (request.type === "apps.list")
        return { type: "ok", command: "apps.list", apps };
      return {
        type: "ok",
        command: "tasks.list",
        tasks: { items: [{ taskId: `goal/${"任务".repeat(200)}` }] },
      };
    };
    const result = await selectFairCandidate(
      command,
      { ...config, maxApps: 100, maxTasksPerApp: 100, maxPagesPerApp: 5 },
      mkdtempSync(join(tmpdir(), "selector-budget-")),
      undefined,
      NOW,
    );
    const simulatedResult = {
      state: "converged",
      summary:
        "No eligible recent external Task candidate was found within selector bounds; ordinary Task navigation advanced.",
      response:
        "No eligible recent external Task candidate was found within selector bounds; ordinary Task navigation advanced.",
      facts: [
        "selector:no-candidate",
        selectorStateFact(result.state),
        ...result.navigationFacts,
      ],
      actions: [],
    };
    expect(result.candidate).toBeNull();
    expect(result.navigationFacts.length).toBeGreaterThan(0);
    expect(
      Buffer.byteLength(JSON.stringify(result.navigationFacts)),
    ).toBeLessThanOrEqual(3_000);
    expect(Buffer.byteLength(JSON.stringify(simulatedResult))).toBeLessThan(
      16 * 1_024,
    );
    expect(
      admitTaskReconcileResult(simulatedResult, { allowNeedsAgent: false }).ok,
    ).toBeTrue();
  });

  test("enforces the App bound even when the catalog returns too many items", async () => {
    let taskReads = 0;
    const command: PublicCommand = async (request) => {
      if (request.type === "apps.list")
        return {
          type: "ok",
          command: "apps.list",
          apps: [
            { id: "may" },
            { id: "scout" },
            { id: "scout-knowledge-lib" },
            ...Array.from({ length: 27 }, (_, index) => ({
              id: `app-${String(index).padStart(2, "0")}`,
            })),
          ],
        };
      taskReads += 1;
      return { type: "ok", command: "tasks.list", tasks: { items: [] } };
    };
    const result = await selectFairCandidate(
      command,
      { ...config, maxApps: 3 },
      mkdtempSync(join(tmpdir(), "selector-app-cap-")),
      undefined,
      NOW,
    );
    expect(result.candidate).toBeNull();
    // Three bounded aggregate reads plus six ordinary navigation reads.
    expect(taskReads).toBe(9);
  });

  test("deduplicates unchanged evidence outside recent-100 while allowing changed evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-exact-report-"));
    const item: Record<string, unknown> = {
      ...task("may", "goal/stable"),
      result: { output: { ref: "artifact:original" } },
    };
    const command = catalogCommand({ may: [item] });
    const subject = await readSubjectTask(
      { appId: "may", taskId: "goal/stable" },
      command,
    );
    expect(subject.disposition).toBe("eligible");
    publishReport(
      root,
      "may",
      "goal/stable",
      subject.evidenceHash!,
      NOW - 1,
      "evaluator-deepseek",
    );
    for (let i = 0; i < 100; i++) {
      publishReport(
        root,
        "may",
        `goal/newer-${i}`,
        createHash("sha256").update(String(i)).digest("hex"),
        NOW + i,
      );
    }
    const recent = listTaskReports(root, 100);
    expect(recent).toHaveLength(100);
    expect(recent.some((entry) => entry.taskId === "goal/stable")).toBe(false);
    const paths = taskReportPaths(
      "may",
      "goal/stable",
      subject.evidenceHash!,
      TASK_OUTCOME_RUBRIC_VERSION,
      "",
      "evaluator-deepseek",
    );
    const reportBefore = hashReport(join(root, paths.jsonPath));
    expect(
      (await selectFairCandidate(command, deepseekConfig, root, undefined, NOW))
        .candidate,
    ).toBeNull();
    Object.assign(item, {
      ref: "expanded-display-ref",
      resourceVersion: 9,
      updatedAt: NOW + 1,
      progress: { stage: "refresh" },
    });
    expect(
      (await selectFairCandidate(command, deepseekConfig, root, undefined, NOW))
        .candidate,
    ).toBeNull();
    item.result = { output: { ref: "artifact:replacement" } };
    expect(
      (await selectFairCandidate(command, deepseekConfig, root, undefined, NOW))
        .candidate,
    ).toEqual({ appId: "may", taskId: "goal/stable" });
    expect(hashReport(join(root, paths.jsonPath))).toBe(reportBefore);
  });

  test("does not deduplicate a different full hash at the same shortened report path", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-hash-collision-"));
    const command = catalogCommand({ may: [task("may", "goal/one")] });
    const subject = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect(subject.disposition).toBe("eligible");
    const hash = subject.evidenceHash!;
    const other = hash.slice(0, -1) + (hash.endsWith("0") ? "1" : "0");
    publishReport(root, "may", "goal/one", other, NOW);
    expect(taskReportPaths("may", "goal/one", other)).toEqual(
      taskReportPaths("may", "goal/one", hash),
    );
    expect(
      (await selectFairCandidate(command, config, root, undefined, NOW))
        .candidate,
    ).toEqual({ appId: "may", taskId: "goal/one" });
  });

  test("does not deduplicate corrupted report evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-corrupt-report-"));
    const command = catalogCommand({ may: [task("may", "goal/one")] });
    const subject = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect(subject.disposition).toBe("eligible");
    publishReport(root, "may", "goal/one", subject.evidenceHash!, NOW);
    const paths = taskReportPaths("may", "goal/one", subject.evidenceHash!);
    writeFileSync(join(root, paths.markdownPath), "corrupt fixture");
    expect(
      (await selectFairCandidate(command, config, root, undefined, NOW))
        .candidate,
    ).toEqual({ appId: "may", taskId: "goal/one" });
  });

  test("disabled selection performs no public reads", async () => {
    let reads = 0;
    const result = await selectFairCandidate(
      async () => {
        reads += 1;
        throw new Error("must not read");
      },
      { ...config, enabled: false },
      mkdtempSync(join(tmpdir(), "selector-off-")),
      undefined,
      NOW,
    );
    expect(result.candidate).toBeNull();
    expect(reads).toBe(0);
  });
});
