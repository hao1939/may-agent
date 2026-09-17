import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { publicationTestFixture } from "./lib/publication-test-fixture";
import { admitTaskReconcileResult, type WorkflowContext } from "@may-agent/sdk";
import {
  admittedOutputPaths,
  buildExploreTask,
  duplicateSourceReferences,
  executeScoutExplore,
  replacedExistingOutputs,
  xhsWaitResult,
} from "./scout-explore";

const temporaryRoots: string[] = [];
const defaultFixture = publicationTestFixture();
afterAll(() =>
  rmSync(defaultFixture.repositoryRoot, { recursive: true, force: true }),
);

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const xhsTask = `work\n\n## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { source: "xhs" } })}\n\`\`\``;

function initRepository(root: string): void {
  for (const dir of [join(root, "knowledge"), join(root, "scout/knowledge")]) {
    if (existsSync(dir) && !existsSync(join(dir, "README.md")))
      writeFileSync(join(dir, "README.md"), "# Knowledge\n");
  }
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  writeFileSync(
    join(root, ".gitignore"),
    "output/\nartifacts/\n**/agents/scout/workspace/\n",
  );
  git("add", ".");
  git("commit", "--allow-empty", "-m", "fixture");
}

function candidateProjectFromPrompt(task: string): string {
  const candidate = task.match(
    /Durable Scout notes and findings belong under `(.+)\/knowledge\/`/,
  )?.[1];
  if (!candidate) throw new Error("candidate project missing from prompt");
  return candidate;
}

function workflowContext(
  runAgent: (
    agent: string,
    task: string,
    options?: unknown,
  ) => Promise<unknown>,
  source = "xhs",
): WorkflowContext {
  return createTestAppWorkflowContext({
    input: { source },
    reconciliation: {
      appId: "scout-knowledge-lib",
      taskId: `explore-${source}`,
      generation: 1,
      resourceVersion: 1,
      agent: "scout",
      outcome: `Explore ${source}`,
      acceptance: ["Current source checked"],
      input: { source },
      children: { live: [], completed: [] },
    },
    workspace: { ...defaultFixture.workspace },
    callAgent: (async (agent: string, task: string, options?: unknown) => {
      const result = (await runAgent(agent, task, options)) as Record<
        string,
        unknown
      >;
      const status =
        result.status === "error" ||
        result.status === "interrupted" ||
        result.status === "blocked"
          ? result.status
          : "done";
      return {
        id: String(result.sessionId ?? "s_test"),
        kind: "agent",
        status,
        summary: String(result.lastAssistantText ?? status),
        ...(result.structuredResult !== undefined
          ? { output: result.structuredResult }
          : {}),
        ...(result.evidence !== undefined ? { facts: result.evidence } : {}),
      };
    }) as WorkflowContext["agents"]["call"],
  });
}

describe("scout-explore workflow prompt", () => {
  it("preserves a draft without accepting it as library integration", async () => {
    const root = mkdtempSync(join(tmpdir(), "scout-draft-result-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, "knowledge"));
    writeFileSync(join(root, "knowledge/README.md"), "# Knowledge\n");
    const scratch = join(root, "agents/scout/workspace");
    mkdirSync(join(scratch, "findings"), { recursive: true });
    mkdirSync(join(scratch, "digest"));
    const draft = join(scratch, "findings/draft.md");
    const digest = join(scratch, "digest/today.md");
    initRepository(root);
    const ctx = workflowContext(async () => {
      writeFileSync(
        draft,
        "Verified source; canonical integration unfinished\n",
      );
      writeFileSync(digest, "Draft details: ../findings/draft.md\n");
      return {
        status: "done",
        sessionId: "s_draft",
        evidence: { status: "success" },
        structuredResult: {
          summary: "Finding staged after a protected note rejected the edit",
          source: {
            name: "hn",
            queryOrFeed: "https://hn.algolia.com/api/v1/search",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=1"],
          },
          outputs: [draft, digest],
        },
      };
    }, "hn");
    ctx.workspace = {
      appRoot: root,
      projectRoot: root,
      root,
      output: join(root, "output"),
    };

    const result = await executeScoutExplore(ctx);

    expect(result.status).toBe("blocked");
    expect(result.facts).toMatchObject({
      executionId: "s_draft",
      outputs: [draft, digest],
      source: { name: "hn" },
    });
    expect(result).not.toHaveProperty("output.state", "converged");
    expect(readFileSync(draft, "utf8")).toContain("integration unfinished");
    expect(readFileSync(digest, "utf8")).toContain("Draft details");
  });

  it("does not turn an explicitly partial finish into a successful no-op", async () => {
    const root = mkdtempSync(join(tmpdir(), "scout-partial-result-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, "knowledge"));
    writeFileSync(join(root, "knowledge/README.md"), "# Knowledge\n");
    initRepository(root);
    let callOptions: unknown;
    const ctx = workflowContext(async (_agent, _task, options) => {
      callOptions = options;
      return {
        status: "done",
        sessionId: "s_partial",
        lastAssistantText: "Useful candidate found; integration unfinished",
        evidence: {
          status: "partial",
          next_steps: "Verify and integrate the selected paper",
        },
        structuredResult: {
          summary: "Stopped at the operation limit before integration",
          source: {
            name: "arxiv",
            queryOrFeed: "https://export.arxiv.org/api/query",
            itemIdsOrUrls: ["https://arxiv.org/abs/2609.00001"],
          },
          outputs: [],
        },
      };
    }, "arxiv");
    ctx.workspace = {
      appRoot: root,
      projectRoot: root,
      root,
      output: join(root, "output"),
    };

    const result = await executeScoutExplore(ctx);

    expect(result.status).toBe("blocked");
    expect(result.facts).toMatchObject({
      executionId: "s_partial",
      finish: {
        status: "partial",
        next_steps: "Verify and integrate the selected paper",
      },
    });
    expect(result).not.toHaveProperty("output.state", "converged");
    expect(callOptions).toMatchObject({ operationAllowance: 48 });
  });

  it("does not accept structured output from a blocked agent call", async () => {
    const root = mkdtempSync(join(tmpdir(), "scout-blocked-result-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, "knowledge"));
    initRepository(root);
    const ctx = workflowContext(
      async () => ({
        status: "blocked",
        sessionId: "s_blocked",
        lastAssistantText: "Current source evidence is incomplete",
        structuredResult: {
          summary: "Partial observation",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/",
            itemIdsOrUrls: [],
          },
          outputs: [],
        },
      }),
      "hn",
    );
    ctx.workspace = {
      appRoot: root,
      projectRoot: root,
      root,
      output: join(root, "output"),
    };

    const result = await executeScoutExplore(ctx);

    expect(result.status).toBe("blocked");
    expect(result.facts).toMatchObject({
      executionId: "s_blocked",
      status: "blocked",
    });
    expect(result).not.toHaveProperty("output.state", "converged");
  });

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

  it("admits a knowledge output before optional working directories exist", () => {
    const root = mkdtempSync(join(tmpdir(), "scout-output-initial-"));
    temporaryRoots.push(root);
    const appDir = join(root, "scout.app");
    const projectDir = join(root, "scout");
    const knowledgeDir = join(projectDir, "knowledge");
    mkdirSync(knowledgeDir, { recursive: true });
    const output = join(knowledgeDir, "finding.md");
    writeFileSync(output, "Source-grounded finding\n");

    expect(admittedOutputPaths([output], { appDir, projectDir })).toEqual([
      output,
    ]);
    expect(
      admittedOutputPaths([join(appDir, "agents/scout/workspace/missing.md")], {
        appDir,
        projectDir,
      }),
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
    expect(task).toContain("The workflow supplies checkedAt");
    expect(task).toContain("open it before deciding");
    expect(task).toContain(
      "Never create a new finding that repeats a primary source",
    );
    expect(task).toContain("Choose an unused descriptive topic slug");
    expect(task).toContain("Read every created or changed output back");
  });

  it("requires bounded arXiv retrieval and an evidence-backed no-op on source failure", () => {
    const task = buildExploreTask(
      "Explore arXiv for AI agent research.",
      undefined,
      undefined,
      "arxiv",
    );

    expect(task).toContain("Every arXiv HTTP request");
    expect(task).toContain("`--connect-timeout`");
    expect(task).toContain("`--max-time`");
    expect(task).toContain("do not run an unbounded retrieval");
    expect(task).toContain("Return an evidence-backed no-op with outputs: []");
    expect(task).toContain("do not substitute another source");
  });

  it("keeps GitHub exploration read-only, bounded, and complete-search aware", () => {
    const task = buildExploreTask(
      "Explore GitHub for AI agent repositories.",
      undefined,
      undefined,
      "github",
    );

    expect(task).toContain("GitHub execution contract");
    expect(task).toContain("read-only public endpoints only");
    expect(task).toContain("https://api.github.com/search/repositories");
    expect(task).toContain("Preserve `owner/name`");
    expect(task).toContain("pin the inspected commit revision");
    expect(task).toContain("descriptive User-Agent");
    expect(task).toContain("`--connect-timeout`");
    expect(task).toContain("`--max-time`");
    expect(task).toContain("`incomplete_results`");
    expect(task).toContain("paper indexes as proof");
    expect(task).toContain("exact HTTP status or retrieval error");
    expect(task).toContain("outputs: []");
    expect(task).toContain("do not bypass it or substitute another source");
  });

  it("keeps Reddit exploration observational and records exact access boundaries", () => {
    const task = buildExploreTask(
      "Explore Reddit for AI agent discussions.",
      undefined,
      undefined,
      "reddit",
    );

    expect(task).toContain("Reddit execution contract");
    expect(task).toContain("read-only public endpoints only");
    expect(task).toContain("https://www.reddit.com/search.rss");
    expect(task).toContain("stable `t3_...` post IDs");
    expect(task).toContain("metadata, not support for body-level claims");
    expect(task).toContain("Never post, comment, vote, save, follow, message");
    expect(task).toContain("descriptive User-Agent");
    expect(task).toContain("`--connect-timeout`");
    expect(task).toContain("`--max-time`");
    expect(task).toContain("network-security");
    expect(task).toContain("exact HTTP status or retrieval error");
    expect(task).toContain("outputs: []");
    expect(task).toContain("do not bypass it or substitute another source");
  });

  it("returns an exact credential wait before dispatch while XHS login is unavailable", () => {
    const result = xhsWaitResult("xhs", {
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
          type: "credential.state",
          subject: "credential:xhs",
          expected: { field: "state", equals: "ready" },
          owner: "human:operator",
          reviewAfterMs: 3_600_000,
        },
      ],
    });
    expect(result?.conditions?.[0]?.requestedAction).toContain(
      "container browser",
    );
    // Assert the production result contract, not just the workflow's old shape.
    expect(
      admitTaskReconcileResult(result, { allowNeedsAgent: false }),
    ).toMatchObject({
      ok: true,
      result: {
        state: "waiting",
        conditions: [{ owner: "human:operator", reviewAfterMs: 3_600_000 }],
      },
    });
  });

  it("allows XHS exploration after the credential is observed ready", () => {
    expect(
      xhsWaitResult("xhs", {
        credential: "xhs",
        state: "ready",
        reason: "source content is readable",
        evidence: ["note-count:12"],
      }),
    ).toBeNull();
  });

  it("passes the workflow-acquired XHS packet and forbids blocked-scan artifacts", () => {
    const prompt = buildExploreTask(
      xhsTask,
      undefined,
      {
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
      },
      "xhs",
    );

    expect(prompt).toContain("Current XHS source packet");
    expect(prompt).toContain('"id": "note-1"');
    expect(prompt).toContain(
      "Do not infer current access from old blocked findings",
    );
    expect(prompt).toContain(
      "Never create or update a blocked-scan knowledge or digest artifact",
    );
  });

  it("explains the existing XHS detail reader without assuming unread bodies are unavailable", () => {
    const prompt = buildExploreTask(
      xhsTask,
      { appDir: "/fixture/scout.app", projectDir: "/fixture/library" },
      { query: "AI agents", items: [] },
      "xhs",
    );

    expect(prompt).toContain(
      'node "/fixture/scout.app/agents/scout/tools/xhs-browse.mjs" read "FULL_RETURNED_LINK"',
    );
    expect(prompt).toContain("45-second tool timeout");
    expect(prompt).toContain("not inspected");
    expect(prompt).toContain("actual failed read");
    expect(prompt).toContain(
      "never copy access tokens into notes, digests, or result evidence",
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
        inspectXhsCredential: async () => ({
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
      status: "done",
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
        inspectXhsCredential: async () => ({
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
      status: "blocked",
      summary: "XHS search failed: search page timed out",
      facts: { facts: ["access:ready", "note-count:12", "exit:1"] },
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
        inspectXhsCredential: async () => ({
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
      status: "done",
      output: {
        state: "converged",
        facts: expect.arrayContaining([
          "source:xhs",
          "items:0",
          "result:evidence-backed-no-op",
        ]),
        actions: [],
      },
    });
  });

  it("dispatches current search data once and returns reviewable evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "scout-xhs-run-"));
    temporaryRoots.push(root);
    const appDir = join(root, "scout.app");
    const projectDir = join(root, "scout");
    const knowledgeDir = join(projectDir, "knowledge");
    const digestDir = join(appDir, "agents", "scout", "workspace", "digest");
    const output = join(digestDir, "today.md");
    const finding = join(knowledgeDir, "finding.md");
    mkdirSync(knowledgeDir, { recursive: true });
    mkdirSync(digestDir, { recursive: true });
    initRepository(root);
    let prompt = "";
    let runOptions: unknown;
    let agentCalls = 0;
    const ctx = workflowContext(async (_agent, task, options) => {
      agentCalls += 1;
      prompt = task;
      runOptions = options;
      const candidateFinding = join(
        candidateProjectFromPrompt(task),
        "knowledge/finding.md",
      );
      writeFileSync(output, "Current XHS finding.\n");
      writeFileSync(candidateFinding, "Source-grounded XHS knowledge note.\n");
      return {
        status: "done",
        sessionId: "s_xhs",
        structuredResult: {
          summary: "Recorded one source-grounded XHS finding.",
          source: {
            name: "xhs",
            queryOrFeed: "ignored because the workflow owns XHS evidence",
            itemIdsOrUrls: [],
          },
          outputs: [candidateFinding, output],
        },
      };
    });
    ctx.workspace!.appRoot = appDir;
    ctx.workspace!.projectRoot = projectDir;
    const result = await executeScoutExplore(ctx, {
      inspectXhsCredential: async () => ({
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
    });

    expect(agentCalls).toBe(1);
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const facts = (result.output as { facts: string[] }).facts;
    expect(facts).toContain(`publication:commit:${revision}`);
    expect(facts).toContain(`published-output:${finding}`);
    expect(
      execFileSync("git", ["show", `${revision}:scout/knowledge/finding.md`], {
        cwd: root,
        encoding: "utf8",
      }),
    ).toBe(readFileSync(finding, "utf8"));
    expect(
      execFileSync("git", ["status", "--porcelain", "--", "scout/knowledge"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
    ).toBe("");
    expect(runOptions).toMatchObject({ schema: expect.any(Object) });
    expect(prompt).toContain('"id": "note-1"');
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        summary: "Recorded one source-grounded XHS finding.",
        facts: expect.arrayContaining([
          "access:ready",
          "source:xhs",
          "query:AI agent 智能体",
          "items:1",
          "source-ids:note-1",
          "source-provenance:workflow",
          `output:${finding}`,
          `output:${output}`,
          "execution:s_xhs",
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
            itemIdsOrUrls: [],
          },
          outputs: [
            "projects/scout-knowledge-lib/knowledge/findings/xhs-note-1.md",
          ],
        },
      })),
      {
        inspectXhsCredential: async () => ({
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
      status: "blocked",
      summary:
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
      status: "blocked",
      summary: "Scout exploration did not return a structured source result",
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
      status: "done",
      output: {
        state: "converged",
        facts: expect.arrayContaining([
          "source-provenance:agent-result+workflow-time",
          "result:evidence-backed-no-op",
          "execution:s_hn",
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
              itemIdsOrUrls: [],
            },
            outputs: [],
          },
        }),
        "hn",
      ),
    );

    expect(result).toMatchObject({
      status: "blocked",
      summary: "Scout exploration returned invalid current-source evidence",
      facts: {
        source: "hn",
        invalidField: "name",
        reason: "expected hn",
      },
    });
  });

  it("owns checkedAt instead of trusting an agent-reported clock", async () => {
    const result = await executeScoutExplore(
      workflowContext(
        async () => ({
          status: "done",
          sessionId: "s_github",
          structuredResult: {
            summary: "Checked GitHub.",
            source: {
              name: "github",
              queryOrFeed: "agents",
              checkedAt: "not-a-time",
              itemIdsOrUrls: [],
            },
            outputs: [],
          },
        }),
        "github",
      ),
    );

    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        facts: expect.arrayContaining([
          "source-provenance:agent-result+workflow-time",
        ]),
      },
    });
    expect(JSON.stringify(result)).not.toContain("not-a-time");
  });

  it("rejects a newly created finding whose source URL already exists", () => {
    const root = mkdtempSync(join(tmpdir(), "scout-duplicate-admission-"));
    temporaryRoots.push(root);
    const projectDir = join(root, "scout");
    const findingsDir = join(projectDir, "knowledge", "findings");
    mkdirSync(findingsDir, { recursive: true });
    const existing = join(findingsDir, "existing.md");
    const duplicate = join(findingsDir, "duplicate.md");
    writeFileSync(
      existing,
      "Source: https://user:pass@example.com/research?token=secret\n",
    );
    const before = new Set([existing]);
    writeFileSync(
      duplicate,
      "Source: https://other:secret@example.com/research?token=other\n",
    );

    expect(duplicateSourceReferences([duplicate], before, projectDir)).toEqual([
      {
        kind: "existing-file",
        output: duplicate,
        sourceUrl: "https://example.com/research",
        existingFiles: [existing],
      },
    ]);
    expect(duplicateSourceReferences([existing], before, projectDir)).toEqual(
      [],
    );
  });

  it("rejects one primary source declared in two peer finding sections", () => {
    const root = mkdtempSync(join(tmpdir(), "scout-same-file-admission-"));
    temporaryRoots.push(root);
    const projectDir = join(root, "scout");
    const findingsDir = join(projectDir, "knowledge", "findings");
    mkdirSync(findingsDir, { recursive: true });
    const duplicate = join(findingsDir, "duplicate.md");
    writeFileSync(
      duplicate,
      [
        "## 1. First observation",
        "**Source:** https://example.com/research",
        "",
        "## 2. Repeated observation",
        "**Source:** https://example.com/research",
      ].join("\n"),
    );

    expect(
      duplicateSourceReferences([duplicate], new Set(), projectDir),
    ).toEqual([
      {
        kind: "repeated-primary-source",
        output: duplicate,
        sourceUrl: "https://example.com/research",
        sections: ["## 1. First observation", "## 2. Repeated observation"],
      },
    ]);
  });

  it("allows repeated links within one finding section", () => {
    const root = mkdtempSync(join(tmpdir(), "scout-same-section-admission-"));
    temporaryRoots.push(root);
    const projectDir = join(root, "scout");
    const findingsDir = join(projectDir, "knowledge", "findings");
    mkdirSync(findingsDir, { recursive: true });
    const finding = join(findingsDir, "finding.md");
    writeFileSync(
      finding,
      [
        "## 1. One observation",
        "**Source:** https://example.com/research",
        "The same [source](https://example.com/research) is discussed again.",
      ].join("\n"),
    );

    expect(duplicateSourceReferences([finding], new Set(), projectDir)).toEqual(
      [],
    );
  });

  it("compares only primary declarations across files", () => {
    const root = mkdtempSync(join(tmpdir(), "scout-reference-admission-"));
    temporaryRoots.push(root);
    const projectDir = join(root, "scout");
    const findingsDir = join(projectDir, "knowledge", "findings");
    mkdirSync(findingsDir, { recursive: true });
    const existing = join(findingsDir, "existing.md");
    const finding = join(findingsDir, "finding.md");
    writeFileSync(existing, "Source: https://example.com/research\n");
    writeFileSync(
      finding,
      [
        "Source: https://example.com/new",
        "See [prior work](https://example.com/research) for context.",
      ].join("\n"),
    );

    expect(
      duplicateSourceReferences([finding], new Set([existing]), projectDir),
    ).toEqual([]);
  });

  it("detects removal of a primary source from an existing output", () => {
    const root = mkdtempSync(join(tmpdir(), "scout-replacement-admission-"));
    temporaryRoots.push(root);
    const output = join(root, "finding.md");
    writeFileSync(output, "Source: https://example.com/original\n");
    const before = new Map([[output, ["https://example.com/original"]]]);
    writeFileSync(output, "Source: https://example.com/replacement\n");

    expect(replacedExistingOutputs([output], before)).toEqual([
      {
        kind: "existing-output-replaced",
        output,
        removedPrimarySources: ["https://example.com/original"],
        currentPrimarySources: ["https://example.com/replacement"],
      },
    ]);
  });

  it("does not converge a run that creates an exact-source duplicate", async () => {
    const root = mkdtempSync(join(tmpdir(), "scout-duplicate-run-"));
    temporaryRoots.push(root);
    const appDir = join(root, "scout.app");
    const projectDir = join(root, "scout");
    const findingsDir = join(projectDir, "knowledge", "findings");
    const workspaceDir = join(appDir, "agents", "scout", "workspace");
    mkdirSync(findingsDir, { recursive: true });
    mkdirSync(workspaceDir, { recursive: true });
    const existing = join(findingsDir, "existing.md");
    const duplicate = join(findingsDir, "duplicate.md");
    writeFileSync(existing, "Source: https://example.com/research\n");
    initRepository(root);
    let candidateDuplicate = "";

    const ctx = workflowContext(async (_agent, task) => {
      candidateDuplicate = join(
        candidateProjectFromPrompt(task),
        "knowledge/findings/duplicate.md",
      );
      writeFileSync(
        candidateDuplicate,
        "Source: https://example.com/research\n",
      );
      return {
        status: "done",
        sessionId: "s_duplicate",
        structuredResult: {
          summary: "Created a new finding.",
          source: {
            name: "hn",
            queryOrFeed: "topstories",
            itemIdsOrUrls: ["https://example.com/research"],
          },
          outputs: [candidateDuplicate],
        },
      };
    }, "hn");
    ctx.workspace!.appRoot = appDir;
    ctx.workspace!.projectRoot = projectDir;

    expect(await executeScoutExplore(ctx)).toMatchObject({
      status: "blocked",
      summary:
        "Scout exploration created a finding with duplicate source references",
      facts: {
        duplicates: [
          {
            kind: "existing-file",
            output: candidateDuplicate,
            sourceUrl: "https://example.com/research",
            existingFiles: [
              expect.stringContaining("/knowledge/findings/existing.md"),
            ],
          },
        ],
        executionId: "s_duplicate",
      },
    });
  });

  it("does not converge a run that replaces an existing output", async () => {
    const root = mkdtempSync(join(tmpdir(), "scout-replacement-run-"));
    temporaryRoots.push(root);
    const appDir = join(root, "scout.app");
    const projectDir = join(root, "scout");
    const findingsDir = join(projectDir, "knowledge", "findings");
    const workspaceDir = join(appDir, "agents", "scout", "workspace");
    mkdirSync(findingsDir, { recursive: true });
    mkdirSync(workspaceDir, { recursive: true });
    const existing = join(findingsDir, "existing.md");
    writeFileSync(existing, "Source: https://example.com/original\n");
    initRepository(root);
    let candidateExisting = "";

    const ctx = workflowContext(async (_agent, task) => {
      candidateExisting = join(
        candidateProjectFromPrompt(task),
        "knowledge/findings/existing.md",
      );
      writeFileSync(
        candidateExisting,
        "Source: https://example.com/replacement\n",
      );
      return {
        status: "done",
        sessionId: "s_replacement",
        structuredResult: {
          summary: "Updated a finding.",
          source: {
            name: "hn",
            queryOrFeed: "topstories",
            itemIdsOrUrls: ["https://example.com/replacement"],
          },
          outputs: [candidateExisting],
        },
      };
    }, "hn");
    ctx.workspace!.appRoot = appDir;
    ctx.workspace!.projectRoot = projectDir;

    expect(await executeScoutExplore(ctx)).toMatchObject({
      status: "blocked",
      summary:
        "Scout exploration removed primary sources from an existing output",
      facts: {
        replacements: [
          {
            kind: "existing-output-replaced",
            output: candidateExisting,
            removedPrimarySources: ["https://example.com/original"],
            currentPrimarySources: ["https://example.com/replacement"],
          },
        ],
        executionId: "s_replacement",
      },
    });
  });
});
