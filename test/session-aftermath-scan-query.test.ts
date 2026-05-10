import { describe, expect, it } from "vitest";
import { create } from "../agents/may/handlers/session-aftermath-scan.ts";
import type { HandlerContext } from "../src/lib/handler-context.js";
import type { CronEntry } from "../src/lib/cron-tool.js";

describe("session-aftermath-scan handler", () => {
  it("uses sdk.query for deterministic preflight and dispatches evaluator workflow", async () => {
    const sqlCalls: string[] = [];
    const workflowCalls: Array<{ workflow: string; task: string; opts: unknown }> = [];
    const logs: string[] = [];

    const ctx = {
      sdk: {
        query: {
          sql: (sql: string) => {
            sqlCalls.push(sql);
            if (sql.includes("COUNT(*) AS c")) return { rows: [{ c: 0 }], rowCount: 1, limit: 1, truncated: false };
            return {
              rows: [{ sessionId: "s_needs_eval", agent: "arc", status: "error" }],
              rowCount: 1,
              limit: 2,
              truncated: false,
            };
          },
        },
        getDb: () => {
          throw new Error("handler should use sdk.query, not getDb");
        },
        runWorkflow: async (workflow: string, task: string, opts?: unknown) => {
          workflowCalls.push({ workflow, task, opts });
          return { status: "done" as const, summary: "ok" };
        },
        log: (_level: "info" | "warn" | "error", msg: string) => {
          logs.push(msg);
        },
      },
    } as unknown as HandlerContext;

    const entry = {
      name: "session-aftermath-scan",
      enabled: true,
      handlerConfig: { limit: 2, maxConcurrent: 2 },
    } as CronEntry;

    await create(ctx, entry)();

    expect(sqlCalls).toHaveLength(2);
    expect(workflowCalls).toHaveLength(1);
    expect(workflowCalls[0]).toMatchObject({
      workflow: "evaluator-aftermath",
      opts: { source: "evaluator" },
    });
    expect(workflowCalls[0].task).toContain("s_needs_eval");
    expect(logs.some((line) => line.includes("Dispatching 1 session"))).toBe(true);
  });
});
