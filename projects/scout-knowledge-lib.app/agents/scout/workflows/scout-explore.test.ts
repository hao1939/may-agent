import { describe, expect, it } from "bun:test";
import {
  buildExploreTask,
  executeScoutExplore,
  xhsWaitResult,
} from "./scout-explore";

const xhsTask = `work\n\n## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { source: "xhs" } })}\n\`\`\``;

function workflowContext(
  runAgent: (
    agent: string,
    task: string,
    options?: unknown,
  ) => Promise<unknown>,
): any {
  return {
    task: xhsTask,
    appDir: "/app/projects/scout-knowledge-lib.app",
    projectDir: "/app/projects/scout-knowledge-lib",
    runAgent,
    done(summary: string, output?: unknown) {
      return { type: "done", summary, output };
    },
    blocked(reason: string, context?: unknown) {
      return { type: "blocked", reason, context };
    },
    summarize() {
      return "summary";
    },
  };
}

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
    expect(task).not.toContain("Return summary, evidence, and outputs");
  });

  it("returns an exact credential wait before dispatch while XHS login is unavailable", () => {
    const result = xhsWaitResult(xhsTask, {
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
    expect(
      xhsWaitResult(xhsTask, {
        credential: "xhs",
        state: "ready",
        reason: "source content is readable",
        evidence: ["note-count:12"],
      }),
    ).toBeNull();
  });

  it("passes the workflow-acquired XHS packet and forbids blocked-scan artifacts", () => {
    const prompt = buildExploreTask(xhsTask, undefined, {
      query: "AI agent 智能体",
      items: [
        {
          id: "note-1",
          title: "Agent workflow",
          author: "author",
          likes: "12",
          link: "https://www.xiaohongshu.com/explore/note-1?xsec_token=test",
        },
      ],
    });

    expect(prompt).toContain("Current XHS source packet");
    expect(prompt).toContain('"id": "note-1"');
    expect(prompt).toContain(
      "Do not infer current access from old blocked findings",
    );
    expect(prompt).toContain(
      "Never create or update a blocked-scan knowledge or digest artifact",
    );
  });

  it("does not dispatch an agent while the current credential is unavailable", async () => {
    let agentCalls = 0;
    let searchCalls = 0;
    const result = await executeScoutExplore(
      workflowContext(async () => {
        agentCalls += 1;
        return {};
      }),
      {
        inspectXhsCredential: () => ({
          credential: "xhs",
          state: "unavailable",
          reason: "login required",
          evidence: ["login-wall:true"],
        }),
        searchXhs: () => {
          searchCalls += 1;
          throw new Error("search must not run");
        },
      },
    );

    expect(agentCalls).toBe(0);
    expect(searchCalls).toBe(0);
    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "waiting",
        conditions: [{ id: "credential-ready:xhs" }],
      },
    });
  });

  it("reports a current search failure without dispatching an artifact-writing agent", async () => {
    let agentCalls = 0;
    const result = await executeScoutExplore(
      workflowContext(async () => {
        agentCalls += 1;
        return {};
      }),
      {
        inspectXhsCredential: () => ({
          credential: "xhs",
          state: "ready",
          reason: "ready",
          evidence: ["note-count:12"],
        }),
        searchXhs: (_appDir, query) => ({
          state: "failed",
          query,
          reason: "search page timed out",
          evidence: ["exit:1"],
        }),
      },
    );

    expect(agentCalls).toBe(0);
    expect(result).toMatchObject({
      type: "blocked",
      reason: "XHS search failed: search page timed out",
      context: { evidence: ["access:ready", "note-count:12", "exit:1"] },
    });
  });

  it("records an evidence-backed no-op when the current search is empty", async () => {
    let agentCalls = 0;
    const result = await executeScoutExplore(
      workflowContext(async () => {
        agentCalls += 1;
        return {};
      }),
      {
        inspectXhsCredential: () => ({
          credential: "xhs",
          state: "ready",
          reason: "ready",
          evidence: ["note-count:12"],
        }),
        searchXhs: (_appDir, query) => ({
          state: "success",
          query,
          items: [],
          evidence: ["source:xhs", `query:${query}`, "items:0"],
        }),
      },
    );

    expect(agentCalls).toBe(0);
    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "converged",
        evidence: expect.arrayContaining([
          "source:xhs",
          "items:0",
          "result:evidence-backed-no-op",
        ]),
        actions: [],
      },
    });
  });

  it("dispatches current search data once and returns reviewable evidence", async () => {
    let prompt = "";
    let runOptions: unknown;
    let agentCalls = 0;
    const result = await executeScoutExplore(
      workflowContext(async (_agent, task, options) => {
        agentCalls += 1;
        prompt = task;
        runOptions = options;
        return {
          status: "done",
          sessionId: "s_xhs",
          structuredResult: {
            summary: "Recorded one source-grounded XHS finding.",
            evidence: ["note:note-1"],
            outputs: [
              "/app/projects/scout-knowledge-lib/knowledge/findings/xhs-note-1.md",
            ],
          },
        };
      }),
      {
        inspectXhsCredential: () => ({
          credential: "xhs",
          state: "ready",
          reason: "ready",
          evidence: ["note-count:12", "login-wall:false"],
        }),
        searchXhs: (_appDir, query) => ({
          state: "success",
          query,
          items: [
            {
              id: "note-1",
              title: "Agent workflow",
              author: "author",
              likes: "12",
              link: "https://www.xiaohongshu.com/explore/note-1?xsec_token=test",
            },
          ],
          evidence: [
            "source:xhs",
            `query:${query}`,
            "items:1",
            "source-ids:note-1",
          ],
        }),
      },
    );

    expect(agentCalls).toBe(1);
    expect(runOptions).toMatchObject({ schema: expect.any(Object) });
    expect(prompt).toContain('"id": "note-1"');
    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "converged",
        summary: "Recorded one source-grounded XHS finding.",
        evidence: expect.arrayContaining([
          "access:ready",
          "source:xhs",
          "query:AI agent 智能体",
          "items:1",
          "source-ids:note-1",
          "note:note-1",
          "output:/app/projects/scout-knowledge-lib/knowledge/findings/xhs-note-1.md",
          "session:s_xhs",
        ]),
        actions: [],
      },
    });
  });

  it("rejects relative output paths even when they resolve under an allowed root", async () => {
    const result = await executeScoutExplore(
      workflowContext(async () => ({
        status: "done",
        sessionId: "s_xhs",
        structuredResult: {
          summary: "Wrote a finding.",
          evidence: [],
          outputs: [
            "projects/scout-knowledge-lib/knowledge/findings/xhs-note-1.md",
          ],
        },
      })),
      {
        inspectXhsCredential: () => ({
          credential: "xhs",
          state: "ready",
          reason: "ready",
          evidence: [],
        }),
        searchXhs: (_appDir, query) => ({
          state: "success",
          query,
          items: [
            {
              id: "note-1",
              title: "Agent workflow",
              author: "author",
              likes: "12",
              link: "https://www.xiaohongshu.com/explore/note-1?xsec_token=test",
            },
          ],
          evidence: ["source:xhs", "items:1"],
        }),
      },
    );

    expect(result).toMatchObject({
      type: "blocked",
      reason: "Scout exploration returned an output outside the allowed roots",
    });
  });
});
