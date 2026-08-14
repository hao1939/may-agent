import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute } from "./evaluation-feedback-projection.js";

function workspace(): { root: string; feedbackPath: string } {
  const root = mkdtempSync(join(tmpdir(), "evaluation-feedback-"));
  return {
    root,
    feedbackPath: join(root, "generated", "agent-feedback", "sample.md"),
  };
}

describe("evaluation feedback projection", () => {
  test("projects one durable evaluation fact without querying evaluation history", async () => {
    const { root, feedbackPath } = workspace();
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "sample",
        evaluation: {
          sessionId: "s_latest",
          agent: "sample",
          quality: 0.4,
          verdict: "needs_improvement",
          issues: ["Did not verify the requested result."],
          createdAt: 1_700_000_000_000,
        },
      },
      workspace: { root, output: join(root, ".output") },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        actions: [],
        evidence: ["evaluated-session:s_latest", "feedback-updated:sample"],
      },
    });
    const output = readFileSync(feedbackPath, "utf8");
    expect(output).toContain("**Latest session:** s_latest");
    expect(output).toContain("Did not verify the requested result.");
    expect(output).not.toContain("Recent Issue Patterns");
  });

  test("removes stale feedback when the latest evaluation has no issues", async () => {
    const { root, feedbackPath } = workspace();
    await execute(
      createTestAppWorkflowContext({
        input: {
          feedbackKey: "sample",
          evaluation: {
            sessionId: "s_old",
            agent: "sample",
            quality: 0.2,
            verdict: "needs_improvement",
            issues: ["old issue"],
          },
        },
        workspace: { root, output: join(root, ".output") },
      }),
    );
    writeFileSync(feedbackPath, "stale feedback");
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "sample",
        evaluation: {
          sessionId: "s_clean",
          agent: "sample",
          quality: 1,
          verdict: "good",
          issues: [],
        },
      },
      workspace: { root, output: join(root, ".output") },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      output: {
        state: "converged",
        evidence: ["evaluated-session:s_clean", "feedback-removed:sample"],
      },
    });
    expect(existsSync(feedbackPath)).toBe(false);
  });

  test("blocks when no bounded App workspace is allocated", async () => {
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "sample",
        evaluation: {
          sessionId: "s_latest",
          agent: "sample",
          quality: 0.4,
          verdict: "needs_improvement",
          issues: ["issue"],
        },
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "blocked",
      summary:
        "evaluation-feedback-projection requires an allocated App workspace",
    });
  });

  test("rejects a feedback key that could escape the generated projection directory", async () => {
    const { root } = workspace();
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "../may",
        evaluation: {
          sessionId: "s_latest",
          agent: "may",
          quality: 0.4,
          verdict: "needs_improvement",
          issues: ["issue"],
        },
      },
      workspace: { root, output: join(root, ".output") },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "blocked",
      summary: "Feedback key for may is invalid; no projection changed.",
    });
    expect(existsSync(join(root, "may.md"))).toBe(false);
  });
});
