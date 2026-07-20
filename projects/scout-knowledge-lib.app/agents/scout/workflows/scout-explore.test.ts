import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  admittedOutputPaths,
  buildExploreTask,
  executeScoutExplore,
  xhsWaitResult,
} from "./scout-explore";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const xhsTask = `work\n\n## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { source: "xhs" } })}\n\`\`\``;

function workflowContext(
  runAgent: (
    agent: string,
    task: string,
    options?: unknown,
  ) => Promise<unknown>,
  source = "xhs",
): any {
  return {
    task: `work\n\n## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { source } })}\n\`\`\``,
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
  it("admits only existing files whose real path stays inside an output root", () => {
    const root = mkdtempSync(join(tmpdir(), "scout-output-admission-"));
    temporaryRoots.push(root);
    const appDir = join(root, "scout.app");
    const projectDir = join(root, "scout");
    const knowledgeDir = join(projectDir, "knowledge");
    const workspaceDir = join(appDir, "agents", "scout", "workspace");
    mkdirSync(knowledgeDir, { recursive: true });
    mkdirSync(workspaceDir, { recursive: true });
    const admitted = join(knowledgeDir, "finding.md");
    const outside = join(root, "outside.md");
    const escapingLink = join(knowledgeDir, "escaping-link.md");
    writeFileSync(admitted, "finding");
    writeFileSync(outside, "outside");
    symlinkSync(outside, escapingLink);

    expect(admittedOutputPaths([admitted], { appDir, projectDir })).toEqual([
      admitted,
    ]);
    expect(
      admittedOutputPaths([join(knowledgeDir, "missing.md")], {
        appDir,
        projectDir,
      }),
    ).toBeNull();
    expect(
      admittedOutputPaths([escapingLink], { appDir, projectDir }),
    ).toBeNull();
  });

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
    expect(task).toContain("Return summary, source, and outputs");
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
            source: {
              name: "xhs",
              queryOrFeed: "ignored because the workflow owns XHS evidence",
              checkedAt: new Date().toISOString(),
              itemIdsOrUrls: [],
            },
            outputs: [
              "/app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md",
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
          "source-provenance:workflow",
          "output:/app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md",
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
          source: {
            name: "xhs",
            queryOrFeed: "ignored",
            checkedAt: new Date().toISOString(),
            itemIdsOrUrls: [],
          },
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
      reason:
        "Scout exploration returned a missing output or an output outside the allowed roots",
    });
  });

  it("rejects a successful non-XHS session without a structured source result", async () => {
    const result = await executeScoutExplore(
      workflowContext(
        async () => ({ status: "done", sessionId: "s_hn" }),
        "hn",
      ),
    );
    expect(result).toMatchObject({
      type: "blocked",
      reason: "Scout exploration did not return a structured source result",
    });
  });

  it("accepts a reviewable non-XHS no-op and labels its provenance", async () => {
    const result = await executeScoutExplore(
      workflowContext(
        async (_agent, _task, options) => ({
          status: "done",
          sessionId: "s_hn",
          structuredResult: {
            summary: "The current feed had no useful new agent finding.",
            source: {
              name: "hn",
              queryOrFeed: "https://news.ycombinator.com/newest?token=secret",
              checkedAt: new Date().toISOString(),
              itemIdsOrUrls: [
                "https://news.ycombinator.com/item?id=123&token=secret",
              ],
            },
            outputs: [],
          },
          options,
        }),
        "hn",
      ),
    );
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "converged",
        evidence: expect.arrayContaining([
          "source-provenance:agent-result",
          "result:evidence-backed-no-op",
          "session:s_hn",
        ]),
      },
    });
    expect(serialized).toContain("item?id=123");
    expect(serialized).not.toContain("token=secret");
  });

  it("rejects source evidence for a different lane", async () => {
    const result = await executeScoutExplore(
      workflowContext(
        async () => ({
          status: "done",
          sessionId: "s_hn",
          structuredResult: {
            summary: "Checked a source.",
            source: {
              name: "github",
              queryOrFeed: "agents",
              checkedAt: new Date().toISOString(),
              itemIdsOrUrls: [],
            },
            outputs: [],
          },
        }),
        "hn",
      ),
    );

    expect(result).toMatchObject({
      type: "blocked",
      reason: "Scout exploration returned invalid current-source evidence",
    });
  });
});
