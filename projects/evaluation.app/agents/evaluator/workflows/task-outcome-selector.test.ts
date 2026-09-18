import { describe, expect, test } from "bun:test";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  automaticReviewConfig,
  runTaskOutcomeSelector,
  selectFairCandidate,
  selectorStateFact,
} from "./task-outcome-selector.ts";
import type { PublicCommand } from "./lib/public-task-evidence.ts";

const NOW = Date.UTC(2026, 8, 17);
const DAY = 86_400_000;
const config = {
  enabled: true,
  intervalMs: DAY,
  maxApps: 10,
  maxTasksPerApp: 2,
  maxPagesPerApp: 2,
  recentWindowMs: 7 * DAY,
};

function task(
  appId: string,
  taskId: string,
  ageDays = 0,
  status = "up-to-date",
) {
  return { appId, taskId, status, updatedAt: NOW - ageDays * DAY };
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
      const items = tasks[String(request.appId)] ?? [];
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
    throw new Error("unexpected");
  };
}

describe("automatic task outcome selector", () => {
  test("is initially off and bounds recent navigation configuration", () => {
    expect(automaticReviewConfig({})).toMatchObject({
      enabled: false,
      maxApps: 20,
      maxTasksPerApp: 20,
      maxPagesPerApp: 2,
      recentWindowMs: 7 * DAY,
    });
    expect(
      automaticReviewConfig({
        EVALUATION_AUTO_REVIEW_ENABLED: "true",
        EVALUATION_AUTO_REVIEW_MAX_APPS: "1000",
        EVALUATION_AUTO_REVIEW_MAX_PAGES_PER_APP: "99",
        EVALUATION_AUTO_REVIEW_RECENT_WINDOW_MS: String(99 * DAY),
      }),
    ).toMatchObject({
      enabled: true,
      maxApps: 20,
      maxPagesPerApp: 5,
      recentWindowMs: 30 * DAY,
    });
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
    expect(seen.filter((item) => item.type === "tasks.list")[0]).toEqual({
      type: "tasks.list",
      appId: "may",
      includeDone: true,
      limit: 2,
    });
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
      version: 3,
      appId: "应用-next",
      appIndex: 99,
      lastTaskByApp: manyEntries,
    });
    const simulatedResult = {
      facts: [`selected:may/${long}`, fact],
      response: "Selected one candidate.",
      summary: "Selected one candidate.",
    };
    expect(Buffer.byteLength(fact)).toBeLessThan(8_000);
    expect(Buffer.byteLength(JSON.stringify(simulatedResult))).toBeLessThan(
      16_000,
    );
  });

  test("keeps the actual selected result bounded while emitting the full identity", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-selected-budget-"));
    const long = `goal/${"任务🚀".repeat(2_000)}`;
    let emitted: Record<string, unknown> | undefined;
    const ctx = {
      reconciliation: { taskId: "automatic-review", resourceVersion: 1 },
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
      catalogCommand({ may: [task("may", long)] }),
      config,
      root,
    );
    expect((emitted?.data as Record<string, unknown>).taskId).toBe(long);
    expect(String(emitted?.localKey).length).toBeLessThan(100);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(16 * 1_024);
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

  test("skips unknown statuses and stops at the recent window boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-window-"));
    const command = catalogCommand({
      may: [
        task("may", "goal/running", 0, "running"),
        task("may", "goal/recent", 1, "attention"),
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
    expect(result.candidate).toEqual({ appId: "may", taskId: "goal/recent" });
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
    for (let index = 0; index < 3; index += 1) {
      const next = await selectFairCandidate(command, config, root, state, NOW);
      selected.push(next.candidate?.taskId);
      state = next.state;
    }
    expect(selected).toEqual([
      "goal/attention",
      "goal/done",
      "goal/closed",
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
    expect(result.navigationFacts).toEqual([
      "selector-navigation-failed:may:pages-read=1:tasks.list item has no usable updatedAt",
    ]);
    expect(result.state).not.toHaveProperty("taskCursor");
    expect(result.state.version).toBe(3);
  });

  test("advances past malformed and non-reviewable items within a page", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-invalid-items-"));
    const command: PublicCommand = async (request) => {
      if (request.type === "apps.list")
        return { type: "ok", command: "apps.list", apps: [{ id: "may" }] };
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
    expect(result.candidate).toEqual({ appId: "may", taskId: "goal/valid" });
    expect(result.navigationFacts).toEqual([
      "selector-navigation-failed:may:pages-read=1:tasks.list item has no usable updatedAt",
    ]);
  });

  test("preserves two-App exhaustion state so a newly inserted May Task is selected", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-exhaustion-"));
    const tasks = {
      may: [task("may", "goal/may-old", 0, "running")],
      scout: [task("scout", "goal/scout-old", 0, "running")],
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
    expect(exhausted.state.lastTaskByApp).toEqual({
      [createHash("sha256").update("may").digest("hex")]: createHash("sha256")
        .update("goal/may-old")
        .digest("hex"),
      [createHash("sha256").update("scout").digest("hex")]: createHash(
        "sha256",
      )
        .update("goal/scout-old")
        .digest("hex"),
    });

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
    const command: PublicCommand = async (request) => {
      if (request.type === "apps.list")
        return { type: "ok", command: "apps.list", apps: [{ id: "may" }] };
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
    expect(result.navigationFacts).toEqual([
      "selector-navigation-failed:may:pages-read=1:tasks.list response has no items array",
    ]);
  });

  test("bounds diagnostics and the full result at configured maximums", async () => {
    const apps = Array.from({ length: 100 }, (_, index) => ({
      id: `${String(index).padStart(3, "0")}-${"应用🚀".repeat(50)}`,
    }));
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
      evidence: [
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
          apps: Array.from({ length: 30 }, (_, index) => ({
            id: `app-${String(index).padStart(2, "0")}`,
          })),
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
    expect(taskReads).toBe(3);
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
