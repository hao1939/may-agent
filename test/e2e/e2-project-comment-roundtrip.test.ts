/**
 * E2 — Project comment roundtrip (intake portion)
 *
 * Lifted from scripts/e2e-platform-comment.mjs. The original drove a real
 * browser; this version drives the same daemon command path the HTTP endpoint
 * uses (socket emit of project.comment.created), without the UI dependency.
 * The UI is exercised separately by web-ui.test.ts.
 *
 * Validates documented behavior of:
 *   - user-guide.md § Events in Practice (comment flow)
 *   - command-router project.comment.created handling
 *
 * Asserts:
 *   1. comment is appended to discussion.md (created if missing)
 *   2. project.md status flips synchronously from waiting → active
 *   3. project.comment.created event lands in events table
 *   4. project.nudge event is emitted as a side effect
 *
 * Task dispatch and owner-judgment behavior are covered by E3a.
 *
 * Runs by default; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  openSandboxDb,
  pollUntil,
  queryEvents,
  socketEmit,
} from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E2: project comment roundtrip", () => {
  let sb: Sandbox;
  const projectId = "e2e-comment-sandbox";

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureProjects: ["e2e-comment-sandbox"],
      // No cron jobs needed; the comment flow runs synchronously in command-router.
      cronJson: { may: [] },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "comment lands, status flips, events recorded",
    async () => {
      const projectFile = join(sb.projectsRoot, projectId, "project.md");
      const discFile = join(sb.projectsRoot, projectId, "discussion.md");
      const commentText = `e2e comment ${Date.now()}`;

      // Sanity: fixture project loaded with status=waiting and no discussion yet.
      const beforeBody = readFileSync(projectFile, "utf-8");
      expect(beforeBody).toMatch(/status:\s*waiting/);
      expect(existsSync(discFile)).toBe(false);

      const t0 = Date.now();

      // Send the same socket event the HTTP endpoint sends.
      const resp = (await socketEmit(sb.socketPath, "project.comment.created", {
        source: "e2e-test",
        owner: "agent:may",
        data: {
          projectPath: `projects/${projectId}`,
          comment: commentText,
          author: "e2e",
        },
      })) as { type?: string };
      expect(resp.type).toBe("ok");

      // ── Filesystem assertions (synchronous in command-router) ─────────
      // Small wait for the event to be applied; should be near-instant.
      await pollUntil(
        () => existsSync(discFile) && /status:\s*active/.test(readFileSync(projectFile, "utf-8")),
        { timeoutMs: 5_000, intervalMs: 100, description: "discussion.md + status flip" },
      );

      const discAfter = readFileSync(discFile, "utf-8");
      expect(discAfter).toContain(commentText);
      expect(discAfter).toContain("### e2e -"); // author + date heading

      const projAfter = readFileSync(projectFile, "utf-8");
      expect(projAfter).toMatch(/status:\s*active/);
      expect(projAfter).not.toMatch(/status:\s*waiting/);

      // ── DB assertions ────────────────────────────────────────────────
      const db = openSandboxDb(sb.dbPath);
      try {
        const result = await pollUntil(
          () => {
            const created = queryEvents(db, {
              types: ["project.comment.created"],
              since: t0,
              limit: 5,
            });
            const nudges = queryEvents(db, {
              types: ["project.nudge"],
              since: t0,
              limit: 5,
            });
            if (created.length >= 1 && nudges.length >= 1) return { created, nudges };
            return null;
          },
          { timeoutMs: 5_000, intervalMs: 200, description: "comment.created + nudge events" },
        );

        expect(result.created.length).toBeGreaterThanOrEqual(1);
        expect(result.nudges.length).toBeGreaterThanOrEqual(1);

        // Nudge carries the comment text.
        const nudgeData = JSON.parse(result.nudges[0].data ?? "{}");
        expect(nudgeData.data?.commentText ?? nudgeData.commentText).toBe(commentText);
      } finally {
        db.close();
      }
    },
    30_000,
  );
});
