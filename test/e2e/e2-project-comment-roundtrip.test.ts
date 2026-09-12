/**
 * E2 — A declared App subscription owns a project comment end-to-end.
 * The real daemon admits a Task and runs an isolated workflow (no model).
 * Retained Markdown is history, not an alternative dispatch or status store.
 * E8 covers the browser/HTTP journey using the same ordinary App fixture.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { openSandboxDb, pollUntil, queryEvents, socketEmit } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E2: project comment roundtrip", () => {
  let sb: Sandbox;
  const legacyPath = "projects/e2e-comment-sandbox";

  beforeEach(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureProjects: ["e2e-comment-sandbox", "comment.app"],
      fixtureWorkflows: { may: ["e2e-noop-workflow"] },
      cronJson: { may: [] },
      daemonArgs: ["--socket"],
    });
    await sb.daemonReady;
  }, 60_000);

  afterEach(async () => {
    if (sb) await sb.close();
  });

  test("a declared subscription owns the comment without legacy Markdown dispatch", async () => {
    const projectFile = join(sb.root, legacyPath, "project.md");
    const before = readFileSync(projectFile, "utf8");
    const comment = "Review the retained project";
    const data = { project: "comment", projectPath: legacyPath, comment, author: "e2e" };
    // Project history can be referenced without becoming the execution owner.
    const published = await socketEmit(sb.socketPath, "publish", {
      event: {
        type: "project.comment.created",
        target: { appId: "comment" },
        idempotencyKey: "comment-1",
        data,
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
      expect(store.readReceipt("work/comment")).toBeNull();
      const events = queryEvents(db, { types: ["project.comment.created"] });
      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0].data!)).toEqual({ ...data, appId: "comment", idempotencyKey: "comment-1" });
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
