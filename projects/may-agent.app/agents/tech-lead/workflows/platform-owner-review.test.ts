import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestRuntime } from "@may-agent/sdk/testing";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./platform-owner-review.ts";

describe("platform-owner-review", () => {
  const tempDirs: string[] = [];

  function makeHarness(status: "done" | "error") {
    const root = join(
      tmpdir(),
      `may-agent-owner-review-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const appDir = join(root, "projects", "may-agent.app");
    const projectDir = join(root, "projects", "may-agent");
    tempDirs.push(root);
    mkdirSync(appDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(appDir, "project.json"),
      JSON.stringify({ id: "may-agent.app", owner: "tech-lead" }),
    );

    const runtime = createTestRuntime({
      root,
      persist: root,
      agents: join(root, "agents"),
      shared: join(root, "shared"),
      projects: join(root, "projects"),
    });
    const emitted: Array<{ type: string; [key: string]: unknown }> = [];
    const reviewed: Array<{ ids: number[]; owner?: string }> = [];
    const observed: { prompt: string; schema?: unknown } = { prompt: "" };
    const ownerResult = {
      state: "converged" as const,
      summary: "Current platform evidence is covered by existing work.",
      evidence: ["packet:.state/review-packet.json"],
      actions: [],
    };
    const query = Object.create(runtime.sdk.query) as WorkflowContext["query"];
    query.heartbeatContext = () => ({
      metrics: [],
      projects: [],
      alerts: [],
      inbox: [
        { id: 101, eventType: "message.created" },
        { id: 102, eventType: "escalation.created" },
        { id: 103, eventType: "metric.breach" },
      ],
    });
    const commands = Object.create(
      runtime.sdk.commands,
    ) as WorkflowContext["commands"];
    commands.reviewInboxEvents = (ids, owner) => {
      reviewed.push({ ids: [...ids], owner });
      return ids.length;
    };

    const ctx: WorkflowContext = {
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "## Trigger Event",
        '{"type":"project.owner.requested"}',
      ].join("\n"),
      agent: "tech-lead",
      emit: (event) => emitted.push(event),
      dispatchEvent: () => {},
      getDb: () => runtime.db,
      query,
      commands,
      log: () => {},
      notify: () => {},
      metrics: runtime.sdk.metrics,
      persistDir: root,
      projectRoot: root,
      agentsRoot: runtime.agents,
      sharedRoot: runtime.shared,
      projectsRoot: runtime.projects,
      runAgent: (async (_agent: string, prompt: string, opts?: unknown) => {
        observed.prompt = prompt;
        observed.schema = (opts as { schema?: unknown } | undefined)?.schema;
        return status === "done"
          ? {
              sessionId: "s_owner_review",
              status: "done" as const,
              lastAssistantText: ownerResult.summary,
              messages: [],
              duration: "1s",
              outputDir: root,
              finishResult: {
                status: "success",
                summary: ownerResult.summary,
              },
              structuredResult: ownerResult,
            }
          : {
              sessionId: "s_owner_review_failed",
              status: "error" as const,
              lastAssistantText: "provider failed",
              messages: [],
              duration: "1s",
              outputDir: root,
              error: "provider failed",
            };
      }) as WorkflowContext["runAgent"],
      runWorkflow: async () => ({ type: "done", summary: "unused" }),
      runFunction: async () => ({
        sessionId: "fn_unused",
        agent: "function",
        status: "done",
        lastAssistantText: "",
        messages: [],
        duration: "0s",
        outputDir: root,
      }),
      summarize: () => "unused",
      done: (summary, output) => ({ type: "done", summary, output }),
      blocked: (reason, context) => ({ type: "blocked", reason, context }),
      createSession: async () => ({
        prompt: async () => {},
        lastText: () => "",
        close: () => {},
      }),
    };

    return {
      appDir,
      ctx,
      emitted,
      observed,
      ownerResult,
      reviewed,
      runtime,
    };
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns typed owner proposals without giving the agent mutation authority", async () => {
    const harness = makeHarness("done");
    const { appDir, ctx, emitted, observed, ownerResult, reviewed, runtime } =
      harness;
    const result = await execute(ctx);
    runtime.close();

    expect(result).toEqual({
      type: "done",
      summary: ownerResult.summary,
      output: ownerResult,
    });
    expect(observed.schema).toMatchObject({
      type: "object",
      required: ["state", "summary", "evidence"],
    });
    expect(observed.prompt).toContain(
      "The generic reconciler is the sole task-tree mutation authority.",
    );
    expect(observed.prompt).toContain(
      "Return task-tree changes only as typed actions in finish.",
    );
    expect(existsSync(join(appDir, ".state", "review-packet.json"))).toBe(true);
    expect(emitted.at(-1)).toMatchObject({
      type: "project.owner.reviewed",
      state: "converged",
      proposedActions: [],
      evidence: ownerResult.evidence,
    });
    expect(reviewed).toEqual([
      { ids: [101], owner: "tech-lead" },
      { ids: [102], owner: "tech-lead" },
      { ids: [103], owner: "tech-lead" },
    ]);
  });

  it("keeps inbox work open when the owner session fails", async () => {
    const { ctx, emitted, reviewed, runtime } = makeHarness("error");

    const result = await execute(ctx);
    runtime.close();

    expect(result).toMatchObject({
      type: "blocked",
      reason: "Platform owner review session failed",
    });
    expect(reviewed).toEqual([]);
    expect(emitted).not.toContainEqual(
      expect.objectContaining({ type: "project.owner.reviewed" }),
    );
  });
});
