import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import { dirname, join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { parseXhsCredentialOutput } from "../tools/lib/xhs-credential";
import { parseXhsSearchOutput } from "../tools/lib/xhs-source";
import { publicationTestFixture } from "./lib/publication-test-fixture";
import { admitTaskReconcileResult, type WorkflowContext } from "@may-agent/sdk";
import { Check } from "typebox/value";
import {
  admittedOutputPaths,
  buildExploreTask,
  duplicateSourceReferences,
  executeScoutExplore,
  ExploreAgentResultSchema,
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
    expect(task).toContain("exactly one concise relative Markdown link");
    expect(task).toContain(
      "Ground that INDEX description in the inspected source",
    );
    expect(task).toContain("state the material evidence limitation");
    expect(task).toContain("do not overstate source support");
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
      loginWall: true,
    });

    expect(result).toMatchObject({
      state: "waiting",
      actions: [],
      conditions: [
        {
          id: "credential-ready:xhs",
          type: "credential.state",
          subject: "resource:xhs",
          expected: {
            field: "state",
            equals: "ready",
            source: "app:scout-knowledge-lib:observer:xhs-credential",
          },
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
        prepareXhsSession: async () => ({
          credential: "xhs",
          state: "unavailable",
          reason: "login required",
          evidence: ["login-wall:true"],
          loginWall: true,
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

  it.each([
    JSON.stringify({ status: "error", error: "No XHS tab found" }),
    JSON.stringify({ status: "error", error: "ECONNREFUSED" }),
    "null",
    "invalid JSON",
    JSON.stringify({
      status: "success",
      data: { ready: false, loginWall: false, reason: "no readable content" },
    }),
  ])(
    "returns uncertain access to the owner without inventing a human wait: %s",
    async (stdout) => {
      const ctx = workflowContext(async () => {
        throw Error("research must not run");
      });
      const result = await executeScoutExplore(ctx, {
        prepareXhsSession: async () => parseXhsCredentialOutput(stdout),
        searchXhs: () => {
          throw Error("search must not run");
        },
      });
      expect(result.status).toBe("blocked");
      expect(result.output).toBeUndefined();
      expect(result.facts).toMatchObject({
        nextStep: expect.stringContaining("same Task"),
      });
      expect(JSON.stringify(result)).not.toContain("human:operator");
    },
  );

  it("does not accept unusable search rows as an evidence-backed no-op", async () => {
    const result = await executeScoutExplore(
      workflowContext(async () => {
        throw Error("research must not run");
      }),
      {
        prepareXhsSession: async () =>
          parseXhsCredentialOutput(
            JSON.stringify({ status: "success", data: { ready: true } }),
          ),
        searchXhs: (_app, query) =>
          parseXhsSearchOutput(
            query,
            JSON.stringify({
              status: "success",
              data: [{ id: "missing-content" }],
            }),
          ),
      },
    );
    expect(result.status).toBe("blocked");
    expect(result.summary).toContain("none had usable");
    expect(JSON.stringify(result)).not.toContain("evidence-backed-no-op");
  });

  it("reports a current search failure without dispatching an artifact-writing agent", async () => {
    let agentCalls = 0;
    const result = await executeScoutExplore(
      workflowContext(async () => {
        agentCalls += 1;
        return {};
      }),
      {
        prepareXhsSession: async () => ({
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

  it("rejects empty extraction when page status observed stable note identities", async () => {
    let agentCalls = 0;
    const result = await executeScoutExplore(
      workflowContext(async () => {
        agentCalls += 1;
        return {};
      }),
      {
        prepareXhsSession: async () =>
          parseXhsCredentialOutput(
            JSON.stringify({
              status: "success",
              data: { ready: true, noteCount: 27, loginWall: false },
            }),
          ),
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
      status: "blocked",
      summary:
        "XHS extraction failed: page status observed 27 visible note identities, but search extraction returned no usable items",
      facts: {
        facts: expect.arrayContaining(["note-count:27", "items:0"]),
      },
    });
    expect(JSON.stringify(result)).not.toContain("evidence-backed-no-op");
  });

  it("records an evidence-backed no-op when current status and search support emptiness", async () => {
    let agentCalls = 0;
    const result = await executeScoutExplore(
      workflowContext(async () => {
        agentCalls += 1;
        return {};
      }),
      {
        prepareXhsSession: async () => ({
          credential: "xhs",
          state: "ready",
          reason: "ready",
          evidence: ["note-count:0"],
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
          "note-count:0",
          "source:xhs",
          "items:0",
          "result:evidence-backed-no-op",
        ]),
        actions: [],
      },
    });
  });

  it("preserves an empty result when status has no contradictory note-count evidence", async () => {
    const result = await executeScoutExplore(
      workflowContext(async () => {
        throw Error("research must not run");
      }),
      {
        prepareXhsSession: async () => ({
          credential: "xhs",
          state: "ready",
          reason: "ready",
          evidence: ["login-wall:false"],
        }),
        searchXhs: (_appDir, query) => ({
          state: "success",
          query,
          items: [],
          evidence: ["source:xhs", `query:${query}`, "items:0"],
        }),
      },
    );

    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        facts: expect.arrayContaining([
          "login-wall:false",
          "items:0",
          "result:evidence-backed-no-op",
        ]),
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
    const emitted: Record<string, unknown>[] = [];
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
          researchRecommendation: {
            sourceUrl: "https://www.xiaohongshu.com/explore/note-1",
            pinnedSourceRevision: "note-1@observed",
            artifact: candidateFinding,
            claim: "The pattern may improve local agent maintenance.",
            limits: "One observational source; not locally reproduced.",
            possibleApplication: "Compare in May's existing research task.",
          },
        },
      };
    });
    ctx.events.emit = (async (event: Record<string, unknown>) => {
      emitted.push(event);
      return { accepted: true };
    }) as WorkflowContext["events"]["emit"];
    ctx.workspace!.appRoot = appDir;
    ctx.workspace!.projectRoot = projectDir;
    const result = await executeScoutExplore(ctx, {
      prepareXhsSession: async () => ({
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
    expect(facts).toContain("research-handoff:may");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "scout.research.qualified",
      localKey: expect.stringMatching(/^research-[a-f0-9]{64}$/),
      data: {
        artifact: finding,
        producerAppId: "scout-knowledge-lib",
        sourceRevision: "note-1@observed",
      },
    });
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
    expect(prompt).toStartWith("Bounded Scout research assignment:");
    expect(prompt).toContain(
      "You are the researcher/writer already running inside scout-explore",
    );
    expect(prompt).toContain("Do not redispatch this same scan through");
    expect(prompt).toContain("scout-explore as a substitute for the research");
    expect(prompt).toContain(
      "does not prohibit independent useful agents or workflows",
    );
    expect(prompt).toContain("Standing Task background");
    expect(prompt).toContain('"acceptance": [');
    expect(prompt).toContain('"source": "xhs"');
    expect(prompt.indexOf("Bounded Scout research assignment:")).toBeLessThan(
      prompt.indexOf("Standing Task background"),
    );
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

  it("rejects a new flat finding without INDEX before publication", async () => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    const originalHead = fixture.git("rev-parse", "HEAD");
    const ctx = workflowContext(async (_agent, task) => {
      const finding = join(
        candidateProjectFromPrompt(task),
        "knowledge/findings/unindexed.md",
      );
      mkdirSync(join(candidateProjectFromPrompt(task), "knowledge/findings"), {
        recursive: true,
      });
      writeFileSync(finding, "# Source-grounded but unindexed\n");
      return {
        status: "done",
        sessionId: "s_unindexed",
        structuredResult: {
          summary: "Created one source-grounded finding.",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/newest",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=900"],
          },
          outputs: [finding],
        },
      };
    }, "hn");
    ctx.workspace = { ...fixture.workspace };

    const result = await executeScoutExplore(ctx);

    expect(result).toMatchObject({
      status: "blocked",
      summary:
        "Scout exploration created a finding without exactly one resolving INDEX link",
      facts: {
        executionId: "s_unindexed",
        indexIssues: [{ basename: "unindexed.md", reason: "index-unchanged" }],
      },
    });
    expect(fixture.git("rev-parse", "HEAD")).toBe(originalHead);
  });

  it("publishes one new finding and its resolving INDEX link in one commit", async () => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    const originalHead = fixture.git("rev-parse", "HEAD");
    const ctx = workflowContext(async (_agent, task) => {
      const project = candidateProjectFromPrompt(task);
      const finding = join(project, "knowledge/findings/atomic-index.md");
      const index = join(project, "knowledge/INDEX.md");
      mkdirSync(dirname(finding), { recursive: true });
      writeFileSync(
        finding,
        "# Atomic finding\n\nSource: https://example.test/atomic\n",
      );
      writeFileSync(
        index,
        "# Index\n\n`<!--` is documented syntax, not an HTML comment.\n\n- [Atomic finding](findings/atomic-index.md) — source-backed observation; limited to one unreplicated report.\n",
      );
      return {
        status: "done",
        sessionId: "s_atomic_index",
        structuredResult: {
          summary: "Published one source-grounded, limitation-aware finding.",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/newest",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=901"],
          },
          outputs: [finding, index],
        },
      };
    }, "hn");
    ctx.workspace = { ...fixture.workspace };

    const result = await executeScoutExplore(ctx);
    const commit = fixture.git("rev-parse", "HEAD");
    const changed = fixture
      .git("diff-tree", "--no-commit-id", "--name-only", "-r", commit)
      .split("\n");
    const indexContent = readFileSync(
      join(fixture.workspace.projectRoot, "knowledge/INDEX.md"),
      "utf8",
    );

    expect(result).toMatchObject({
      status: "done",
      output: { state: "converged" },
    });
    expect(commit).not.toBe(originalHead);
    expect(changed.sort()).toEqual(
      [
        "projects/scout-knowledge-lib/knowledge/INDEX.md",
        "projects/scout-knowledge-lib/knowledge/findings/atomic-index.md",
      ].sort(),
    );
    expect(indexContent.match(/atomic-index\.md/g)).toHaveLength(1);
  });

  it("publishes an existing flat finding update without INDEX churn", async () => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    const canonicalFinding = join(
      fixture.workspace.projectRoot,
      "knowledge/findings/existing.md",
    );
    const canonicalIndex = join(
      fixture.workspace.projectRoot,
      "knowledge/INDEX.md",
    );
    mkdirSync(dirname(canonicalFinding), { recursive: true });
    writeFileSync(
      canonicalFinding,
      "# Existing finding\n\nOriginal evidence.\n",
    );
    writeFileSync(
      canonicalIndex,
      "# Index\n\n- [Existing](findings/existing.md) — original source evidence; not independently reproduced.\n",
    );
    fixture.git("add", "projects/scout-knowledge-lib/knowledge");
    fixture.git("commit", "-m", "seed existing finding");
    const originalIndex = readFileSync(canonicalIndex, "utf8");
    const ctx = workflowContext(async (_agent, task) => {
      const finding = join(
        candidateProjectFromPrompt(task),
        "knowledge/findings/existing.md",
      );
      writeFileSync(
        finding,
        "# Existing finding\n\nUpdated source evidence.\n",
      );
      return {
        status: "done",
        sessionId: "s_existing_finding",
        structuredResult: {
          summary: "Updated the existing finding for the same source.",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/newest",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=903"],
          },
          outputs: [finding],
        },
      };
    }, "hn");
    ctx.workspace = { ...fixture.workspace };

    const result = await executeScoutExplore(ctx);
    const commit = fixture.git("rev-parse", "HEAD");

    expect(result).toMatchObject({
      status: "done",
      output: { state: "converged" },
    });
    expect(
      fixture.git("diff-tree", "--no-commit-id", "--name-only", "-r", commit),
    ).toBe("projects/scout-knowledge-lib/knowledge/findings/existing.md");
    expect(readFileSync(canonicalIndex, "utf8")).toBe(originalIndex);
  });

  it.each([
    {
      label: "duplicate",
      links:
        "- [One](findings/rejected-index.md)\n- [Two](findings/rejected-index.md)\n",
      reason: "duplicate-link",
    },
    {
      label: "broken",
      links: "- [Broken](elsewhere/rejected-index.md)\n",
      reason: "broken-link",
    },
    {
      label: "comment-only",
      links: "<!-- [Hidden](findings/rejected-index.md) -->\n",
      reason: "missing-link",
    },
    {
      label: "comment inside destination",
      links: "- [Malformed](findings/rejected-<!-- hidden -->index.md)\n",
      reason: "missing-link",
    },
    {
      label: "trailing-slash destination",
      links: "- [Directory form](findings/rejected-index.md/)\n",
      reason: "broken-link",
    },
    {
      label: "image-only",
      links: "![Not navigation](findings/rejected-index.md)\n",
      reason: "missing-link",
    },
    {
      label: "reference-style duplicate",
      links:
        "- [Inline](findings/rejected-index.md)\n- [Reference][finding]\n\n[finding]: findings/rejected-index.md\n",
      reason: "duplicate-link",
    },
    {
      label: "shortcut-reference duplicate",
      links:
        "- [Inline](findings/rejected-index.md)\n- [finding]\n\n[finding]: findings/rejected-index.md\n",
      reason: "duplicate-link",
    },
    {
      label: "decimal character-reference duplicate",
      links:
        "- [Inline](findings/rejected-index.md)\n- [Encoded](findings/rejected-i&#110;dex.md)\n",
      reason: "duplicate-link",
    },
    {
      label: "hex character-reference duplicate",
      links:
        "- [Inline](findings/rejected-index.md)\n- [Encoded](findings/rejected-i&#x6e;dex.md)\n",
      reason: "duplicate-link",
    },
    {
      label: "named character-reference duplicate",
      links:
        "- [Inline](findings/rejected-index.md)\n- [Encoded](findings/rejected-index&period;md)\n",
      reason: "duplicate-link",
    },
    {
      label: "indented-code-only",
      links: "    [Code](findings/rejected-index.md)\n",
      reason: "missing-link",
    },
    {
      label: "unclosed-fence-only",
      links: "```md\n[Code](findings/rejected-index.md)\n",
      reason: "missing-link",
    },
    {
      label: "unclosed-comment-only",
      links: "<!--\n[Hidden](findings/rejected-index.md)\n",
      reason: "missing-link",
    },
    {
      label: "escaped-link-only",
      links: "\\[Escaped](findings/rejected-index.md)\n",
      reason: "missing-link",
    },
    {
      label: "first reference definition wins",
      links:
        "[Finding][target]\n\n[target]: elsewhere/rejected-index.md\n[target]: findings/rejected-index.md\n",
      reason: "broken-link",
    },
    {
      label: "absolute candidate",
      links: "ABSOLUTE_CANDIDATE_LINK",
      reason: "broken-link",
    },
  ])("rejects a $label INDEX reference", async ({ links, reason }) => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    const originalHead = fixture.git("rev-parse", "HEAD");
    const ctx = workflowContext(async (_agent, task) => {
      const project = candidateProjectFromPrompt(task);
      const finding = join(project, "knowledge/findings/rejected-index.md");
      const index = join(project, "knowledge/INDEX.md");
      mkdirSync(dirname(finding), { recursive: true });
      writeFileSync(finding, "# Finding\n");
      const candidateLinks =
        links === "ABSOLUTE_CANDIDATE_LINK"
          ? `- [Ephemeral candidate](${finding})\n`
          : links;
      writeFileSync(index, `# Index\n\n${candidateLinks}`);
      return {
        status: "done",
        sessionId: "s_rejected_index",
        structuredResult: {
          summary: "Candidate finding.",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/newest",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=902"],
          },
          outputs: [finding, index],
        },
      };
    }, "hn");
    ctx.workspace = { ...fixture.workspace };

    const result = await executeScoutExplore(ctx);

    expect(result).toMatchObject({
      status: "blocked",
      facts: { indexIssues: [{ basename: "rejected-index.md", reason }] },
    });
    expect(fixture.git("rev-parse", "HEAD")).toBe(originalHead);
  });

  it("publishes before diagnosing a malformed optional recommendation", async () => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    const canonical = join(
      fixture.workspace.projectRoot,
      "knowledge/findings/malformed-recommendation.md",
    );
    const malformed = { sourceUrl: "https://example.test/incomplete" };
    const emitted: Record<string, unknown>[] = [];
    const ctx = workflowContext(async (_agent, task) => {
      const candidate = join(
        candidateProjectFromPrompt(task),
        "knowledge/findings/malformed-recommendation.md",
      );
      mkdirSync(join(candidateProjectFromPrompt(task), "knowledge/findings"), {
        recursive: true,
      });
      writeFileSync(candidate, "# Published despite malformed advice\n");
      const index = join(
        candidateProjectFromPrompt(task),
        "knowledge/INDEX.md",
      );
      writeFileSync(
        index,
        "# Index\n\n- [Malformed advice finding](findings/malformed-recommendation.md) — HN source evidence; limited to one observed item.\n",
      );
      return {
        status: "done",
        sessionId: "s_malformed_recommendation",
        structuredResult: {
          summary: "Published a source-grounded finding.",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/newest",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=321"],
          },
          outputs: [candidate, index],
          researchRecommendation: malformed,
        },
      };
    }, "hn");
    ctx.workspace = { ...fixture.workspace };
    ctx.events.emit = (async (event: Record<string, unknown>) => {
      emitted.push(event);
      return { accepted: true };
    }) as WorkflowContext["events"]["emit"];

    expect(
      Check(ExploreAgentResultSchema, {
        summary: "Valid publication result",
        source: { name: "hn", queryOrFeed: "feed", itemIdsOrUrls: [] },
        outputs: ["/candidate/finding.md"],
        researchRecommendation: malformed,
      }),
    ).toBeTrue();
    const result = await executeScoutExplore(ctx);

    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        result: {
          researchRecommendation: malformed,
          researchHandoffOutcome: {
            status: "invalid",
            reason: expect.stringContaining("admitted durable output"),
          },
        },
        facts: expect.arrayContaining([
          expect.stringContaining(
            "research-handoff:invalid:Qualified research artifact must be an admitted durable output",
          ),
        ]),
      },
    });
    expect(readFileSync(canonical, "utf8")).toBe(
      "# Published despite malformed advice\n",
    );
    expect(fixture.git("rev-list", "--count", "HEAD")).toBe("2");
    expect(emitted).toEqual([]);
  });

  it("retries an accepted handoff without rerunning its one publication", async () => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    const canonical = join(
      fixture.workspace.projectRoot,
      "knowledge/findings/recovered-handoff.md",
    );
    let writerCalls = 0;
    let emitAttempts = 0;
    const emitted: Record<string, unknown>[] = [];
    const attemptedEventKeys: string[] = [];
    const writer = async (_agent: string, task: string) => {
      writerCalls += 1;
      const candidate = join(
        candidateProjectFromPrompt(task),
        "knowledge/findings/recovered-handoff.md",
      );
      mkdirSync(join(candidateProjectFromPrompt(task), "knowledge/findings"), {
        recursive: true,
      });
      writeFileSync(candidate, "# Retry-stable research handoff\n");
      const index = join(
        candidateProjectFromPrompt(task),
        "knowledge/INDEX.md",
      );
      writeFileSync(
        index,
        "# Index\n\n- [Retry-stable handoff](findings/recovered-handoff.md) — one observed HN item; not locally reproduced.\n",
      );
      return {
        status: "done",
        sessionId: "s_handoff_publication",
        structuredResult: {
          summary: "Published a locally relevant finding.",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/newest",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=654"],
          },
          outputs: [candidate, index],
          researchRecommendation: {
            sourceUrl: "https://news.ycombinator.com/item?id=654",
            sourceRevision: "item-654@observed",
            artifact: candidate,
            claim: "The technique may reduce repeated local work.",
            limits: "One source; not locally reproduced.",
            possibleApplication: "Compare in the existing May research task.",
          },
        },
      };
    };
    const emit = async (event: Record<string, unknown>) => {
      emitAttempts += 1;
      attemptedEventKeys.push(String(event.localKey));
      if (emitAttempts < 3) throw new Error("controlled transient failure");
      emitted.push(event);
      return { accepted: true };
    };
    const firstContext = workflowContext(writer, "hn");
    firstContext.workspace = { ...fixture.workspace };
    firstContext.events.emit = emit as WorkflowContext["events"]["emit"];
    const first = await executeScoutExplore(firstContext);
    expect(structuredClone(first)).toMatchObject({
      status: "done",
      output: {
        state: "incomplete",
        result: {
          publication: {
            outputs: [
              canonical,
              join(fixture.workspace.projectRoot, "knowledge/INDEX.md"),
            ],
          },
          researchHandoff: { artifact: canonical },
        },
      },
    });
    expect(
      admitTaskReconcileResult(first.output, { allowNeedsAgent: false }),
    ).toMatchObject({ ok: true });

    const retry = async (acceptedResult: unknown) => {
      const ctx = workflowContext(async () => {
        throw new Error("recovery must not rerun the writer");
      }, "hn");
      ctx.workspace = { ...fixture.workspace };
      ctx.events.emit = emit as WorkflowContext["events"]["emit"];
      ctx.reconciliation!.previousAttempt = {
        attemptId: `attempt-${emitAttempts}`,
        generation: 1,
        state: "completed",
        acceptedResult: acceptedResult as never,
      };
      return executeScoutExplore(ctx);
    };

    const second = await retry(first.output);
    expect(structuredClone(second)).toMatchObject({
      status: "done",
      output: { state: "incomplete", result: first.output!.result },
    });
    expect(
      admitTaskReconcileResult(second.output, { allowNeedsAgent: false }),
    ).toMatchObject({ ok: true });
    const third = await retry(second.output);

    expect(structuredClone(third)).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        result: {
          publication: {
            outputs: [
              canonical,
              join(fixture.workspace.projectRoot, "knowledge/INDEX.md"),
            ],
          },
          researchHandoffOutcome: { status: "emitted" },
        },
        facts: expect.arrayContaining([
          expect.stringMatching(/^publication:commit:/),
          "research-handoff:may",
        ]),
      },
    });
    expect(
      admitTaskReconcileResult(third.output, { allowNeedsAgent: false }),
    ).toMatchObject({ ok: true });
    expect(writerCalls).toBe(1);
    expect(emitAttempts).toBe(3);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "scout.research.qualified",
      localKey: expect.stringMatching(/^research-[a-f0-9]{64}$/),
      data: { artifact: canonical },
    });
    expect(new Set(attemptedEventKeys).size).toBe(1);
    expect(fixture.git("rev-list", "--count", "HEAD")).toBe("2");

    let nextRunCalls = 0;
    const next = workflowContext(async () => {
      nextRunCalls += 1;
      return { status: "blocked", sessionId: "s_next_routine" };
    }, "hn");
    next.workspace = { ...fixture.workspace };
    next.reconciliation!.previousAttempt = {
      attemptId: "attempt-after-emission",
      generation: 1,
      state: "completed",
      acceptedResult: third.output as never,
    };
    await executeScoutExplore(next);
    expect(nextRunCalls).toBe(1);
  });

  it.each([
    {
      name: "malformed retained data",
      mutate: (value: Record<string, unknown>) => {
        value.researchHandoff = { sourceUrl: "https://example.test/missing" };
      },
      reason: "requires sourceRevision",
    },
    {
      name: "changed canonical bytes",
      mutate: (value: Record<string, unknown>) => {
        writeFileSync(
          (value.researchHandoff as { artifact: string }).artifact,
          "changed after publication\n",
        );
      },
      reason: "no longer matches its pinned hash",
    },
  ])("does not replay $name", async ({ mutate, reason }) => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    const artifact = join(fixture.workspace.projectRoot, "knowledge/README.md");
    const artifactHash = createHash("sha256")
      .update(readFileSync(artifact))
      .digest("hex");
    const retained: Record<string, unknown> = {
      publication: {
        state: "unchanged",
        commit: fixture.git("rev-parse", "HEAD"),
        files: [],
        outputs: [artifact],
      },
      researchHandoffOutcome: { status: "pending" },
      researchHandoff: {
        sourceUrl: "https://example.test/paper",
        sourceRevision: "v1",
        artifact,
        artifactHash,
        claim: "A useful claim.",
        limits: "A bounded source.",
        possibleApplication: "Investigate locally.",
      },
    };
    mutate(retained);
    let emitted = 0;
    const ctx = workflowContext(async () => {
      throw new Error("invalid recovery must not rerun the writer");
    }, "hn");
    ctx.workspace = { ...fixture.workspace };
    ctx.events.emit = (async () => {
      emitted += 1;
      return { accepted: true };
    }) as WorkflowContext["events"]["emit"];
    ctx.reconciliation!.previousAttempt = {
      attemptId: "attempt-invalid",
      generation: 1,
      state: "completed",
      acceptedResult: {
        state: "incomplete",
        summary: "Publication complete; handoff pending.",
        facts: ["publication:no-change"],
        result: retained,
      },
    };

    const result = await executeScoutExplore(ctx);
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        result: {
          researchHandoffOutcome: {
            status: "invalid",
            reason: expect.stringContaining(reason),
          },
        },
        facts: expect.arrayContaining([
          expect.stringContaining(`research-handoff:invalid:`),
        ]),
      },
    });
    expect(emitted).toBe(0);

    let nextRunCalls = 0;
    const next = workflowContext(async () => {
      nextRunCalls += 1;
      return { status: "blocked", sessionId: "s_after_invalid" };
    }, "hn");
    next.workspace = { ...fixture.workspace };
    next.reconciliation!.previousAttempt = {
      attemptId: "attempt-after-invalid",
      generation: 1,
      state: "completed",
      acceptedResult: result.output as never,
    };
    await executeScoutExplore(next);
    expect(nextRunCalls).toBe(1);
  });

  it("does not execute a handoff found only in unaccepted evidence", async () => {
    let emissions = 0;
    const ctx = workflowContext(async () => {
      throw new Error("No source assignment was supplied");
    }, "hn");
    ctx.reconciliation.input = undefined;
    ctx.reconciliation.previousAttempt = {
      attemptId: "rejected-attempt",
      generation: 1,
      state: "failed",
      unacceptedResult: {
        facts: [
          'research-handoff:pending:{"artifact":"/unaccepted.md","artifactHash":"untrusted"}',
        ],
      },
    };
    ctx.events.emit = async () => {
      emissions += 1;
    };

    const result = await executeScoutExplore(ctx);

    expect(emissions).toBe(0);
    expect(result.status).toBe("blocked");
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
        prepareXhsSession: async () => ({
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

  it.each([false, true])(
    "returns a readable canonical summary link after publication (changed=%s)",
    async (changed) => {
      const fixture = publicationTestFixture();
      temporaryRoots.push(fixture.repositoryRoot);
      const canonical = join(
        fixture.workspace.projectRoot,
        "knowledge/README.md",
      );
      const originalHead = fixture.git("rev-parse", "HEAD");
      let candidateOutput = "";
      const ctx = workflowContext(async (_agent, task) => {
        candidateOutput = join(
          candidateProjectFromPrompt(task),
          "knowledge/README.md",
        );
        if (changed) writeFileSync(candidateOutput, "# Updated knowledge\n");
        return {
          status: "done",
          sessionId: "s_summary_link",
          structuredResult: {
            summary: `See [the note](${candidateOutput}) for the assessed source.`,
            source: {
              name: "hn",
              queryOrFeed: "https://news.ycombinator.com/newest",
              itemIdsOrUrls: ["https://news.ycombinator.com/item?id=123"],
            },
            outputs: changed ? [candidateOutput] : [],
          },
        };
      }, "hn");
      ctx.workspace = { ...fixture.workspace };
      const result = await executeScoutExplore(ctx);
      const expected = `See [the note](${canonical}) for the assessed source.`;
      expect(result).toMatchObject({
        status: "done",
        summary: expected,
        output: { state: "converged", summary: expected },
      });
      expect(existsSync(candidateOutput)).toBe(false);
      expect(readFileSync(canonical, "utf8")).toBe(
        changed ? "# Updated knowledge\n" : "# Knowledge\n",
      );
      expect(
        Number(fixture.git("rev-list", "--count", `${originalHead}..HEAD`)),
      ).toBe(changed ? 1 : 0);
    },
  );

  it("rejects a stale reported output when another publication changed its bytes", async () => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    const canonical = join(
      fixture.workspace.projectRoot,
      "knowledge/README.md",
    );
    const originalHead = fixture.git("rev-parse", "HEAD");
    let writerCalls = 0;
    const ctx = workflowContext(async (_agent, task) => {
      writerCalls += 1;
      const candidateOutput = join(
        candidateProjectFromPrompt(task),
        "knowledge/README.md",
      );
      writeFileSync(canonical, "# Concurrent publication\n");
      fixture.git("add", "projects/scout-knowledge-lib/knowledge/README.md");
      fixture.git("commit", "-m", "concurrent publication");
      return {
        status: "done",
        sessionId: "s_stale_output",
        structuredResult: {
          summary: "The existing note already covered this source.",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/newest",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=1"],
          },
          outputs: [candidateOutput],
        },
      };
    }, "hn");
    ctx.workspace = { ...fixture.workspace };

    const result = await executeScoutExplore(ctx);
    const concurrentHead = fixture.git("rev-parse", "HEAD");

    expect(writerCalls).toBe(1);
    expect(result).toMatchObject({
      status: "blocked",
      summary: "Scout exploration was accepted but not published",
      facts: {
        executionId: "s_stale_output",
        error: expect.stringContaining("Reviewed output changed"),
      },
    });
    expect(concurrentHead).not.toBe(originalHead);
    expect(fixture.git("rev-list", "--count", "HEAD")).toBe("2");
    expect(readFileSync(canonical, "utf8")).toBe("# Concurrent publication\n");
  });

  it("accepts a no-op reported output across a disjoint independent publication", async () => {
    const fixture = publicationTestFixture();
    temporaryRoots.push(fixture.repositoryRoot);
    let writerCalls = 0;
    const ctx = workflowContext(async (_agent, task) => {
      writerCalls += 1;
      const candidateOutput = join(
        candidateProjectFromPrompt(task),
        "knowledge/README.md",
      );
      writeFileSync(
        join(fixture.repositoryRoot, "independent.txt"),
        "independent work\n",
      );
      fixture.git("add", "independent.txt");
      fixture.git("commit", "-m", "independent publication");
      return {
        status: "done",
        sessionId: "s_disjoint_output",
        structuredResult: {
          summary: "The existing note already covered this source.",
          source: {
            name: "hn",
            queryOrFeed: "https://news.ycombinator.com/newest",
            itemIdsOrUrls: ["https://news.ycombinator.com/item?id=2"],
          },
          outputs: [candidateOutput],
        },
      };
    }, "hn");
    ctx.workspace = { ...fixture.workspace };

    const result = await executeScoutExplore(ctx);

    expect(writerCalls).toBe(1);
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        facts: expect.arrayContaining([
          "publication:no-change",
          "execution:s_disjoint_output",
        ]),
      },
    });
    expect(fixture.git("rev-list", "--count", "HEAD")).toBe("2");
    expect(
      readFileSync(join(fixture.repositoryRoot, "independent.txt"), "utf8"),
    ).toBe("independent work\n");
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
