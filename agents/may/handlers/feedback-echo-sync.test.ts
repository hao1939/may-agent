import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { create } from "./feedback-echo-sync.js";

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("feedback-echo-sync handler", () => {
  it("writes last-eval feedback to app-local agent directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "feedback-echo-"));
    const appAgentDir = join(root, "projects/example.app/agents/local");
    mkdirSync(appAgentDir, { recursive: true });
    writeJson(join(appAgentDir, "agent.json"), {
      name: "local-agent",
      heartbeat: false,
    });

    const emitted: Array<{ type: string; data: unknown }> = [];
    const db = {
      prepare(sql: string) {
        return {
          all(...params: unknown[]) {
            if (sql.includes("SELECT DISTINCT agent")) {
              expect(params).toHaveLength(1);
              return [{ agent: "local-agent" }];
            }
            if (sql.includes("SELECT DISTINCT issues")) {
              expect(params[0]).toBe("local-agent");
              return [{ issues: JSON.stringify(["needs sharper evidence"]) }];
            }
            return [];
          },
          get(agent: string) {
            expect(agent).toBe("local-agent");
            return {
              sessionId: "s_local",
              quality: 0.42,
              verdict: "needs_improvement",
              issues: JSON.stringify(["needs sharper evidence"]),
              createdAt: Date.parse("2026-06-20T10:00:00.000Z"),
            };
          },
        };
      },
    };

    const handler = create(
      {
        sdk: {
          getDb: () => db,
          paths: { root },
          emit: (type: string, data: unknown) => emitted.push({ type, data }),
        },
      } as any,
      {} as any,
    );

    await handler();

    const output = readFileSync(join(appAgentDir, "last-eval.md"), "utf8");
    expect(output).toContain("**Latest session:** s_local");
    expect(output).toContain("- needs sharper evidence");
    expect(emitted).toEqual([
      {
        type: "handler.completed",
        data: {
          handler: "feedback-echo-sync",
          summary: "Updated 1 agent last-eval.md files",
        },
      },
    ]);
  });
});
