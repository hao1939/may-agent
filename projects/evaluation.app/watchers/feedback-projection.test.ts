import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { projectEvaluationFeedback } from "./feedback-projection.ts";

describe("evaluation feedback projection", () => {
  test("projects evaluator feedback into an app-local agent context", () => {
    const root = mkdtempSync(join(tmpdir(), "evaluation-feedback-"));
    const appDir = join(root, "projects/evaluation.app");
    const agentDir = join(root, "projects/example.app/agents/local");
    mkdirSync(appDir, { recursive: true });
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(
      join(agentDir, "agent.json"),
      JSON.stringify({ name: "local-agent" }),
    );

    const now = Date.parse("2026-08-05T08:00:00.000Z");
    const result = projectEvaluationFeedback(
      {
        appPath: (path: string) => join(appDir, path),
        emit: () => undefined,
        noop: (reason: string) => ({ reason }),
        query: {
          sql(statement: string) {
            if (statement.includes("SELECT DISTINCT agent")) {
              return { rows: [{ agent: "local-agent" }] };
            }
            if (statement.includes("SELECT sessionId")) {
              return {
                rows: [
                  {
                    sessionId: "s_local",
                    quality: 0.42,
                    verdict: "needs_improvement",
                    issues: JSON.stringify(["needs sharper evidence"]),
                    createdAt: now - 1000,
                  },
                ],
              };
            }
            return {
              rows: [{ issues: JSON.stringify(["needs sharper evidence"]) }],
            };
          },
        },
      } as never,
      now,
    );

    const output = readFileSync(join(agentDir, "last-eval.md"), "utf8");
    expect(output).toContain("**Latest session:** s_local");
    expect(output).toContain("- needs sharper evidence");
    expect(result).toEqual({
      reason: "Projected evaluation feedback for 1 agents.",
    });
  });
});
