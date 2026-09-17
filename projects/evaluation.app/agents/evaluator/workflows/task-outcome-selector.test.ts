import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  automaticReviewConfig,
  selectFairCandidate,
} from "./task-outcome-selector.ts";
import type { PublicCommand } from "./lib/public-task-evidence.ts";

function command(): PublicCommand {
  return async (request) => {
    if (request.type === "apps.list")
      return {
        type: "ok",
        command: "apps.list",
        apps: [{ id: "evaluation" }, { id: "may" }, { id: "scout" }],
      };
    if (request.type === "app.tasks.list")
      return {
        type: "ok",
        command: "app.tasks.list",
        appId: request.appId,
        tasks: {
          items: [{ id: `goal/${request.appId}`, status: "done" }],
          nextCursor: null,
        },
      };
    throw new Error("unexpected");
  };
}

describe("automatic task outcome selector", () => {
  test("is initially off and bounded by configuration", () => {
    expect(automaticReviewConfig({})).toMatchObject({
      enabled: false,
      maxApps: 20,
      maxTasksPerApp: 20,
    });
    expect(
      automaticReviewConfig({
        EVALUATION_AUTO_REVIEW_ENABLED: "true",
        EVALUATION_AUTO_REVIEW_MAX_APPS: "1000",
      }),
    ).toMatchObject({ enabled: true, maxApps: 100 });
  });

  test("rotates within one page so an unchanged first item cannot starve later tasks", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-page-"));
    const pageCommand: PublicCommand = async (request) => {
      if (request.type === "apps.list")
        return { type: "ok", command: "apps.list", apps: [{ id: "may" }] };
      if (request.type === "app.tasks.list")
        return {
          type: "ok",
          command: "app.tasks.list",
          appId: "may",
          tasks: {
            items: ["one", "two", "three"].map((id) => ({
              id: `goal/${id}`,
              status: "done",
            })),
            nextCursor: null,
          },
        };
      throw new Error("unexpected");
    };
    const config = {
      enabled: true,
      intervalMs: 1,
      maxApps: 10,
      maxTasksPerApp: 10,
    };
    const first = await selectFairCandidate(pageCommand, config, root);
    const second = await selectFairCandidate(
      pageCommand,
      config,
      root,
      first.state,
    );
    const third = await selectFairCandidate(
      pageCommand,
      config,
      root,
      second.state,
    );
    expect([first.candidate, second.candidate, third.candidate]).toEqual([
      { appId: "may", taskId: "goal/one" },
      { appId: "may", taskId: "goal/two" },
      { appId: "may", taskId: "goal/three" },
    ]);
  });

  test("selects one external App fairly and never Evaluation", async () => {
    const root = mkdtempSync(join(tmpdir(), "selector-"));
    const candidate = await selectFairCandidate(
      command(),
      { enabled: true, intervalMs: 1, maxApps: 10, maxTasksPerApp: 10 },
      root,
    );
    expect(candidate.candidate).toEqual({ appId: "may", taskId: "goal/may" });
    const next = await selectFairCandidate(
      command(),
      {
        enabled: true,
        intervalMs: 1,
        maxApps: 10,
        maxTasksPerApp: 10,
      },
      root,
      candidate.state,
    );
    expect(next.candidate).toEqual({ appId: "scout", taskId: "goal/scout" });
  });
});
