import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./evaluation-intake.ts";

describe("evaluation-intake", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("drains evaluations sequentially without per-evaluation intake tasks", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-evaluation-intake-"));
    roots.push(root);
    const appDir = join(root, "projects", "gym.app");
    const rows = [
      {
        id: 41,
        data: JSON.stringify({
          agent: "may",
          lane: "success_candidate",
          reviewedVerdict: "pass",
          sessionId: "session-good",
        }),
      },
      {
        id: 42,
        data: JSON.stringify({
          agent: "may",
          lane: "needs_triage",
          reviewedVerdict: "needs_improvement",
          sessionId: "session-bad",
        }),
      },
    ];
    const emitted: Record<string, unknown>[] = [];
    const queries: string[] = [];
    const ctx = {
      appDir,
      projectsRoot: join(root, "projects"),
      query: {
        sql(sql: string, params: unknown[], options: { limit: number }) {
          queries.push(sql);
          const after = Number(params[0]);
          return {
            rows: rows.filter((row) => row.id > after).slice(0, options.limit),
          };
        },
      },
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      done(summary: string, output?: unknown) {
        return { type: "done" as const, summary, output };
      },
      blocked(reason: string) {
        return { type: "blocked" as const, reason };
      },
    } as unknown as WorkflowContext;

    await execute(ctx);
    expect(queries[0]).toContain("json_extract(data, '$.agent')");
    expect(queries[0]).toContain("= 'may'");
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "project.task.tick",
        target: { project: "gym", taskId: "runtime/evaluation-intake" },
      }),
    ]);
    expect(
      existsSync(
        join(appDir, ".state", "learning", "evidence", "session-good.json"),
      ),
    ).toBe(true);

    emitted.length = 0;
    await execute(ctx);
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.review.requested",
        requestKey: "incident-session-bad",
      }),
    ]);
    expect(
      existsSync(join(appDir, ".state", "incidents", "session-bad.json")),
    ).toBe(true);
    expect(
      JSON.parse(
        readFileSync(
          join(appDir, ".state", "learning", "evaluation-intake.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({ lastProcessedEventId: 42 });

    emitted.length = 0;
    const current = await execute(ctx);
    expect(current).toMatchObject({
      type: "done",
      summary: "Evaluation intake is current.",
    });
    expect(emitted).toEqual([]);
  });

  it("starts a new frontier at the event that created it", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-evaluation-bootstrap-"));
    roots.push(root);
    const appDir = join(root, "projects", "gym.app");
    const rows = [
      {
        id: 40,
        data: JSON.stringify({ agent: "may", sessionId: "already-handled" }),
      },
      {
        id: 41,
        data: JSON.stringify({ agent: "may", sessionId: "current-event" }),
      },
    ];
    const ctx = {
      appDir,
      projectsRoot: join(root, "projects"),
      task: `## Trigger Event\n\n\`\`\`json\n${JSON.stringify({
        type: "evaluation.reviewed",
        eventId: 41,
      })}\n\`\`\``,
      query: {
        sql(_sql: string, params: unknown[], options: { limit: number }) {
          return {
            rows: rows
              .filter((row) => row.id > Number(params[0]))
              .slice(0, options.limit),
          };
        },
      },
      emit() {},
      done(summary: string, output?: unknown) {
        return { type: "done" as const, summary, output };
      },
      blocked(reason: string) {
        return { type: "blocked" as const, reason };
      },
    } as unknown as WorkflowContext;

    await execute(ctx);

    expect(
      existsSync(
        join(appDir, ".state", "learning", "evidence", "current-event.json"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(appDir, ".state", "learning", "evidence", "already-handled.json"),
      ),
    ).toBe(false);
  });
});
