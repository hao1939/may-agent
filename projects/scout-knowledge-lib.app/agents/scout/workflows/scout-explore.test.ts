import { describe, expect, it } from "bun:test";
import { buildExploreTask, xhsWaitResult } from "./scout-explore";

describe("scout-explore workflow prompt", () => {
  it("adds an explicit output contract to routine discovery tasks", () => {
    const task = buildExploreTask(
      "Explore Hacker News for AI agent discussions.",
    );

    expect(task).toContain("Explore Hacker News for AI agent discussions.");
    expect(task).toContain("projects/scout-knowledge-lib/knowledge/");
    expect(task).toContain("projects/scout-knowledge-lib/knowledge/findings/");
    expect(task).toContain(
      "projects/scout-knowledge-lib.app/agents/scout/workspace/findings/",
    );
    expect(task).toContain(
      "Never create new top-level folders under `projects/`",
    );
    expect(task).toContain("do not write paths like `projects/explore/...`");
  });

  it("returns an exact wait before dispatch while XHS cookie refresh is blocked", () => {
    const task = `work\n\n## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { source: "xhs" } })}\n\`\`\``;
    const result = xhsWaitResult(task, {
      tasks: {
        "xhs-cookie-refresh-blocked": { state: "blocked" },
      },
    });

    expect(result).toMatchObject({
      disposition: "waiting",
      actions: [],
      conditions: [
        {
          id: "task-done:xhs-cookie-refresh-blocked",
          taskId: "xhs-cookie-refresh-blocked",
          expectedState: "done",
        },
      ],
    });
  });

  it("allows XHS exploration after the exact blocker task is done", () => {
    const task = `work\n\n## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { source: "xhs" } })}\n\`\`\``;
    expect(
      xhsWaitResult(task, {
        tasks: {
          "xhs-cookie-refresh-blocked": { state: "done" },
        },
      }),
    ).toBeNull();
  });
});
