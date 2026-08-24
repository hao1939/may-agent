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
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import type { WorkflowContext } from "@may-agent/sdk";
import {
  admittedOutputPaths,
  buildExploreTask,
  duplicateSourceReferences,
  executeScoutExplore,
  replacedExistingOutputs,
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
): WorkflowContext {
  return createTestAppWorkflowContext({
    input: { source },
    reconciliation: {
      appId: "scout-knowledge-lib",
      taskId: `explore-${source}`,
      generation: 1,
      resourceVersion: 1,
      agent: "scout",
      mode: "maintain",
      outcome: `Explore ${source}`,
      acceptance: ["Current source checked"],
      input: { source },
      children: { live: [], completed: [] },
    },
    workspace: {
      appRoot: "/app/projects/scout-knowledge-lib.app",
      projectRoot: "/app/projects/scout-knowledge-lib",
      root: "/app/projects/scout-knowledge-lib",
      output: "/app/projects/scout-knowledge-lib.app/.state/output",
    },
    callAgent: (async (agent: string, task: string, options?: unknown) => {
      const result = (await runAgent(agent, task, options)) as Record<
        string,
        unknown
      >;
      const status =
        result.status === "error" || result.status === "interrupted"
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
      };
    }) as WorkflowContext["agents"]["call"],
  });
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
        },
      ],
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
      status: "blocked",
      summary: "XHS search failed: search page timed out",
      evidence: { evidence: ["access:ready", "note-count:12", "exit:1"] },
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
      status: "done",
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
    const root = mkdtempSync(join(tmpdir(), "scout-xhs-run-"));
    temporaryRoots.push(root);
    const appDir = join(root, "scout.app");
    const projectDir = join(root, "scout");
    const knowledgeDir = join(projectDir, "knowledge");
    const digestDir = join(appDir, "agents", "scout", "workspace", "digest");
    const output = join(digestDir, "today.md");
    mkdirSync(knowledgeDir, { recursive: true });
    mkdirSync(digestDir, { recursive: true });
    let prompt = "";
    let runOptions: unknown;
    let agentCalls = 0;
    const ctx = workflowContext(async (_agent, task, options) => {
      agentCalls += 1;
      prompt = task;
      runOptions = options;
      writeFileSync(output, "Current XHS finding.\n");
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
          outputs: [output],
        },
      };
    });
    ctx.workspace!.appRoot = appDir;
    ctx.workspace!.projectRoot = projectDir;
    const result = await executeScoutExplore(ctx, {
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
    });

    expect(agentCalls).toBe(1);
    expect(runOptions).toMatchObject({ schema: expect.any(Object) });
    expect(prompt).toContain('"id": "note-1"');
    expect(result).toMatchObject({
      status: "done",
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
        evidence: expect.arrayContaining([
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
      evidence: {
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
        evidence: expect.arrayContaining([
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

    const ctx = workflowContext(async () => {
      writeFileSync(duplicate, "Source: https://example.com/research\n");
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
          outputs: [duplicate],
        },
      };
    }, "hn");
    ctx.workspace!.appRoot = appDir;
    ctx.workspace!.projectRoot = projectDir;

    expect(await executeScoutExplore(ctx)).toMatchObject({
      status: "blocked",
      summary:
        "Scout exploration created a finding with duplicate source references",
      evidence: {
        duplicates: [
          {
            kind: "existing-file",
            output: duplicate,
            sourceUrl: "https://example.com/research",
            existingFiles: [existing],
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

    const ctx = workflowContext(async () => {
      writeFileSync(existing, "Source: https://example.com/replacement\n");
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
          outputs: [existing],
        },
      };
    }, "hn");
    ctx.workspace!.appRoot = appDir;
    ctx.workspace!.projectRoot = projectDir;

    expect(await executeScoutExplore(ctx)).toMatchObject({
      status: "blocked",
      summary:
        "Scout exploration removed primary sources from an existing output",
      evidence: {
        replacements: [
          {
            kind: "existing-output-replaced",
            output: existing,
            removedPrimarySources: ["https://example.com/original"],
            currentPrimarySources: ["https://example.com/replacement"],
          },
        ],
        executionId: "s_replacement",
      },
    });
  });
});
