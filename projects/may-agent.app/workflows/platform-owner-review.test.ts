import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestRuntime } from "@may-agent/sdk/testing";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./platform-owner-review.ts";

describe("platform-owner-review", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns typed owner proposals without giving the agent mutation authority", async () => {
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
    let agentPrompt = "";
    let agentSchema: unknown;
    const ownerResult = {
      disposition: "converged" as const,
      summary: "Current platform evidence is covered by existing work.",
      evidence: ["packet:.state/review-packet.json"],
      actions: [],
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
      query: runtime.sdk.query,
      commands: runtime.sdk.commands,
      log: () => {},
      notify: () => {},
      metrics: runtime.sdk.metrics,
      persistDir: root,
      projectRoot: root,
      agentsRoot: runtime.agents,
      sharedRoot: runtime.shared,
      projectsRoot: runtime.projects,
      runAgent: (async (_agent: string, prompt: string, opts?: unknown) => {
        agentPrompt = prompt;
        agentSchema = (opts as { schema?: unknown } | undefined)?.schema;
        return {
          sessionId: "s_owner_review",
          status: "done" as const,
          lastAssistantText: ownerResult.summary,
          messages: [],
          duration: "1s",
          outputDir: root,
          finishResult: { status: "success", summary: ownerResult.summary },
          structuredResult: ownerResult,
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

    const result = await execute(ctx);
    runtime.close();

    expect(result).toEqual({
      type: "done",
      summary: ownerResult.summary,
      output: ownerResult,
    });
    expect(agentSchema).toMatchObject({
      type: "object",
      required: ["disposition", "summary", "evidence", "actions"],
    });
    expect(agentPrompt).toContain(
      "The generic reconciler is the sole task-tree mutation authority.",
    );
    expect(agentPrompt).toContain(
      "Return task-tree changes only as typed actions in finish.",
    );
    expect(existsSync(join(appDir, ".state", "review-packet.json"))).toBe(true);
    expect(emitted.at(-1)).toMatchObject({
      type: "project.owner.reviewed",
      disposition: "converged",
      proposedActions: [],
      evidence: ownerResult.evidence,
    });
  });
});
