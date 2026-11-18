/**
 * E2 — Canonical App input owns feedback end-to-end.
 * The real daemon admits a Task and runs an isolated workflow (no model).
 * Retained Markdown is history, not an alternative dispatch or status store.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { openSandboxDb, pollUntil, queryEvents, socketEmit } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E2: App feedback roundtrip", () => {
  let sb: Sandbox;
  const legacyPath = "projects/e2e-comment-sandbox";

  beforeEach(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureProjects: ["e2e-comment-sandbox", "comment.app"],
      fixtureWorkflows: { may: ["e2e-noop-workflow"] },
      daemonArgs: ["--socket"],
    });
    await sb.daemonReady;
  }, 60_000);

  afterEach(async () => {
    if (sb) await sb.close();
  });

  test("declared App input owns feedback without legacy Markdown dispatch", async () => {
    const projectFile = join(sb.root, legacyPath, "project.md");
    const before = readFileSync(projectFile, "utf8");
    const comment = "Review the retained project";
    // Project history can be referenced without becoming the execution owner.
    const published = await socketEmit(sb.socketPath, "publish", {
      event: {
        type: "app.input.requested",
        target: { appId: "comment" },
        idempotencyKey: "comment-1",
        data: { input: { kind: "owner-review", data: { message: comment } } },
      },
    });
    expect(published).toMatchObject({ type: "ok" });
    const db = openSandboxDb(sb.dbPath);
    try {
      const store = AppTaskResourceStore.activeFromDb(db, "comment")!;
      const attempt = await pollUntil(
        () => {
          const id = store.readTask("work/comment")?.status.observedAttemptId;
          const result = id ? store.readAttempt(id) : null;
          return result?.acceptedResult?.state === "converged" ? result : null;
        },
        { timeoutMs: 15_000, intervalMs: 100, description: "App accepts the comment workflow result" },
      );
      expect(attempt).toMatchObject({ taskId: "work/comment", taskGeneration: 1, state: "completed" });
      expect(store.readTask("work/comment")?.spec.outcome).toBe(comment);
      expect(store.isCancelled("work/comment")).toBe(false);
      expect(queryEvents(db, { types: ["app.input.requested"] })).toHaveLength(1);
      expect(queryEvents(db, { types: ["project.comment.created"] })).toEqual([]);
      expect(queryEvents(db, { types: ["e2e.workflow_ran"] })).toHaveLength(1);
      expect(queryEvents(db, { types: ["project.nudge"] })).toEqual([]);
      expect(readFileSync(projectFile, "utf8")).toBe(before);
      expect(existsSync(join(sb.root, legacyPath, "discussion.md"))).toBe(false);
    } catch (error) {
      console.error(sb.getLogs().slice(-6000));
      throw error;
    } finally {
      db.close();
    }
  }, 30_000);

  test("rejects flat dot-named socket events before persistence", async () => {
    await expect(
      socketEmit(sb.socketPath, "project.comment.created", {
        source: "e2e-test",
        owner: "agent:may",
        projectPath: legacyPath,
        comment: "flat comment",
        author: "e2e",
      }),
    ).rejects.toThrow("requires object field 'data'");
    const db = openSandboxDb(sb.dbPath);
    try {
      expect(queryEvents(db, { types: ["project.comment.created"] })).toEqual([]);
    } finally {
      db.close();
    }
  });
});
