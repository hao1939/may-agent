/** A legacy project comment is recorded evidence; only an owning App may change work state. */
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
      cronJson: { may: [] },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "comment is recorded without changing project state or selecting a worker",
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

      expect(existsSync(discFile)).toBe(false);
      expect(readFileSync(projectFile, "utf-8")).toBe(beforeBody);

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
            if (created.length >= 1) return { created, nudges };
            return null;
          },
          { timeoutMs: 5_000, intervalMs: 200, description: "comment.created event" },
        );

        expect(result.created.length).toBeGreaterThanOrEqual(1);
        expect(result.nudges).toEqual([]);

        const createdRow = result.created[0];
        expect(createdRow.source).toBe("control-socket");
        expect(createdRow.owner).toBe("agent:may");
        expect(eventPayload(createdRow)).toEqual({
          projectPath: `projects/${projectId}`,
          comment: commentText,
          author: "e2e",
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
