/**
 * E2 — Project comment roundtrip (intake portion)
 *
 * Lifted from scripts/e2e-platform-comment.mjs. The original drove a real
 * browser; this version drives the same daemon command path the HTTP endpoint
 * uses (socket emit of project.comment.created), without the UI dependency.
 * The UI is exercised separately by e8-project-comment-ui.test.ts.
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
 * Task reconciliation is covered by the controller, queue, Condition, and
 * app-loader integration suites rather than this legacy project.md harness.
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

function eventPayload(row: { data: string | null }): Record<string, unknown> {
  return JSON.parse(row.data ?? "{}") as Record<string, unknown>;
}

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

        const createdRow = result.created[0];
        expect(createdRow.source).toBe("control-socket");
        expect(createdRow.owner).toBe("agent:may");
        expect(eventPayload(createdRow)).toEqual({
          projectPath: `projects/${projectId}`,
          comment: commentText,
          author: "e2e",
        });

        const nudgeRow = result.nudges[0];
        expect(nudgeRow.source).toBe("control-socket");
        expect(nudgeRow.owner).toBe("agent:may");
        expect(eventPayload(nudgeRow)).toEqual({
          projectPath: `projects/${projectId}`,
          comment: true,
          commentText,
        });
      } finally {
        db.close();
      }
    },
    30_000,
  );

  test(
    "rejects flat dot-named socket events before persistence",
    async () => {
      const t0 = Date.now();
      await expect(
        socketEmit(sb.socketPath, "project.comment.created", {
          source: "e2e-test",
          owner: "agent:may",
          projectPath: `projects/${projectId}`,
          comment: `flat comment ${Date.now()}`,
          author: "e2e",
        }),
      ).rejects.toThrow("requires object field 'data'");

      const db = openSandboxDb(sb.dbPath);
      try {
        const flatRows = queryEvents(db, { types: ["project.comment.created"], since: t0, limit: 5 })
          .filter((row) => (row.data ?? "").includes("flat comment"));
        expect(flatRows).toEqual([]);
      } finally {
        db.close();
      }
    },
    10_000,
  );
});
