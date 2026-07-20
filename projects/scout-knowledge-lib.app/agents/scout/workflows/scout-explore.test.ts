import { describe, expect, it } from "bun:test";
import { buildExploreTask, xhsWaitResult } from "./scout-explore";

describe("scout-explore workflow prompt", () => {
  it("adds an explicit output contract to routine discovery tasks", () => {
    const task = buildExploreTask(
      "Explore Hacker News for AI agent discussions.",
    );

    expect(task).toContain("Explore Hacker News for AI agent discussions.");
    expect(task).toContain("/app/projects/scout-knowledge-lib/knowledge/");
    expect(task).toContain(
      "/app/projects/scout-knowledge-lib/knowledge/findings/",
    );
    expect(task).toContain(
      "/app/projects/scout-knowledge-lib.app/agents/scout/workspace/findings/",
    );
    expect(task).toContain(
      "Never create new top-level folders under `projects/`",
    );
    expect(task).toContain("do not write paths like `projects/explore/...`");
  });

  it("returns an exact credential wait before dispatch while XHS login is unavailable", () => {
    const task = `work\n\n## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { source: "xhs" } })}\n\`\`\``;
    const result = xhsWaitResult(task, {
      credential: "xhs",
      state: "unavailable",
      reason: "XHS login is required",
      evidence: ["login-wall:true"],
    });

    expect(result).toMatchObject({
      state: "waiting",
      actions: [],
      conditions: [
        {
          id: "credential-ready:xhs",
          type: "credential.ready",
          subject: "credential:xhs",
          expected: { field: "state", equals: "ready" },
        },
      ],
    });
  });

  it("allows XHS exploration after the credential is observed ready", () => {
    const task = `work\n\n## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { source: "xhs" } })}\n\`\`\``;
    expect(
      xhsWaitResult(task, {
        credential: "xhs",
        state: "ready",
        reason: "source content is readable",
        evidence: ["note-count:12"],
      }),
    ).toBeNull();
  });
});
