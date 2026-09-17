import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  automaticReviewConfig,
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
      maxApps: 100,
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
      version: 2,
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
        task("may", "goal/recent", 1, "needs-attention"),
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
        task("may", "goal/closed", 0, "closed"),
        task("may", "goal/cancelled", 0, "cancelled"),
      ],
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
    expect([first.candidate?.taskId, second.candidate?.taskId]).toEqual([
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
    expect(result.state).not.toHaveProperty("taskCursor");
    expect(result.state.version).toBe(2);
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
