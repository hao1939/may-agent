import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestRuntime } from "@may-agent/sdk/testing";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute, normalizeOwnerResult } from "./platform-owner-review.ts";

describe("platform-owner-review", () => {
  const tempDirs: string[] = [];

  function makeHarness(
    status: "done" | "error",
    errorMessage = "provider failed",
    duringOwnerRun?: (appDir: string) => void,
  ) {
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
    mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
    writeFileSync(
      join(appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        updated_at: "2026-08-04T06:09:15.373Z",
        tasks: {
          project: {
            item_type: "group",
            id: "project",
            parent_id: null,
            children: [
              "runtime/platform-owner-review",
              "evidence-archive-secret-redaction",
            ],
            owner: "tech-lead",
          },
          "runtime/platform-owner-review": {
            item_type: "task",
            id: "runtime/platform-owner-review",
            parent_id: "project",
            children: [],
            owner: "tech-lead",
            outcome:
              "Keep platform state reviewed by its accountable owner and organize the smallest useful follow-up from current evidence.",
            phase: "running",
            readiness: {
              state: "not-applicable",
              reason: "Task phase is running",
              related_ids: [],
            },
          },
          "evidence-archive-secret-redaction": {
            item_type: "task",
            id: "evidence-archive-secret-redaction",
            parent_id: "project",
            children: [],
            owner: "may",
            outcome: "Add secret redaction to the evidence archival pipeline.",
            phase: "attention",
            readiness: {
              state: "not-applicable",
              reason: "Task phase is attention",
              related_ids: [],
            },
          },
        },
      }),
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
        '{"type":"project.owner.requested","eventId":5030987}',
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
        duringOwnerRun?.(appDir);
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
              lastAssistantText: errorMessage,
              messages: [],
              duration: "1s",
              outputDir: root,
              error: errorMessage,
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

  it("normalizes contradictory converged child creation to waiting", () => {
    const result = normalizeOwnerResult({
      state: "converged",
      summary: "Acceptance remains unmet; delegate the required continuation.",
      evidence: ["session:s_1786402159373_40"],
      actions: [
        {
          kind: "create-task",
          id: "required-continuation",
          parentId: "runtime/platform-owner-review",
          outcome: "Complete and verify the unmet acceptance items.",
          acceptance: ["All remaining acceptance items are verified."],
          priority: "P1",
          owner: "dev",
        },
      ],
    });

    expect(result).toMatchObject({
      state: "waiting",
      actions: [
        {
          kind: "create-task",
          id: "required-continuation",
          parentId: "runtime/platform-owner-review",
        },
      ],
    });
    expect(result.evidence).toContain(
      "owner-result-normalized: create-task actions require waiting until delegated work converges",
    );
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
    expect(observed.prompt).toContain(
      "Routing or task creation is progress, not message completion.",
    );
    expect(existsSync(join(appDir, ".state", "review-packet.json"))).toBe(true);
    expect(observed.prompt).toContain(
      `${appDir}/agents/tech-lead/workflows/platform-owner-review.ts`,
    );
    expect(observed.prompt).toContain("Running: runtime/platform-owner-review");
    expect(observed.prompt).toContain(
      "Attention: evidence-archive-secret-redaction",
    );
    expect(observed.prompt).toContain(
      "Loss-prevention discipline for this owner review:",
    );
    expect(observed.prompt).toContain("immediately call checkpoint()");
    const artifactPath = join(
      appDir,
      ".state",
      "owner-review-artifacts",
      "event-5030987.json",
    );
    expect(observed.prompt).toContain(artifactPath);
    expect(existsSync(artifactPath)).toBe(true);
    expect(
      JSON.parse(readFileSync(artifactPath, "utf-8")) as Record<
        string,
        unknown
      >,
    ).toMatchObject({
      status: "converged",
      owner_session: {
        session_id: "s_owner_review",
        status: "done",
      },
      owner_result: ownerResult,
    });
    expect(emitted).not.toContainEqual(
      expect.objectContaining({ type: "project.owner.reviewed" }),
    );
    expect(reviewed).toEqual([
      { ids: [102], owner: "tech-lead" },
      { ids: [103], owner: "tech-lead" },
    ]);
  });

  it("preserves owner worklog and interim note during finalization", async () => {
    const worklog = {
      required_before_speculative_edits: true,
      prompt: "Record bounded progress.",
      current_hypothesis: "The historical delivery cause is unknown.",
      next_step: "Wait for an exact recurrence with lifecycle telemetry.",
      updated_at: "2026-08-07T10:55:00.000Z",
    };
    const harness = makeHarness("done", "provider failed", (appDir) => {
      const artifactPath = join(
        appDir,
        ".state",
        "owner-review-artifacts",
        "event-5030987.json",
      );
      const artifact = JSON.parse(
        readFileSync(artifactPath, "utf-8"),
      ) as Record<string, unknown>;
      writeFileSync(
        artifactPath,
        `${JSON.stringify({
          ...artifact,
          owner_worklog: worklog,
          interim_note:
            "Later accepted deliveries prove non-recurrence, not root cause.",
        })}\n`,
      );
    });

    await execute(harness.ctx);
    harness.runtime.close();

    const artifactPath = join(
      harness.appDir,
      ".state",
      "owner-review-artifacts",
      "event-5030987.json",
    );
    expect(JSON.parse(readFileSync(artifactPath, "utf-8"))).toMatchObject({
      status: "converged",
      owner_worklog: worklog,
      interim_note:
        "Later accepted deliveries prove non-recurrence, not root cause.",
      owner_result: harness.ownerResult,
    });
  });

  it("returns a waiting owner result when the owner session fails on auth", async () => {
    const authError =
      'OpenAI API error (401): {"message":"litellm.AuthenticationError: AuthenticationError: Github_copilotException - IDE token expired: unauthorized: token expired"}';
    const { appDir, ctx, emitted, reviewed, runtime } = makeHarness(
      "error",
      authError,
    );

    const result = await execute(ctx);
    runtime.close();

    const artifactPath = join(
      appDir,
      ".state",
      "owner-review-artifacts",
      "event-5030987.json",
    );
    expect(result).toEqual({
      type: "done",
      summary:
        "Platform owner review could not complete because the tech-lead session hit a GitHub Copilot authentication failure; refresh the credential and rerun the owner review.",
      output: {
        state: "waiting",
        summary:
          "Platform owner review could not complete because the tech-lead session hit a GitHub Copilot authentication failure; refresh the credential and rerun the owner review.",
        evidence: [
          "owner-session:s_owner_review_failed",
          `provider-auth:${authError}`,
          `artifact:${artifactPath}`,
        ],
        actions: [],
        conditions: [
          {
            id: "owner-provider-auth-restored",
            type: "external.fact",
            subject: "credential:github-copilot",
            expected: { status: "valid", agent: "tech-lead" },
            owner: "human",
            reviewAfterMs: 300_000,
          },
        ],
      },
    });
    expect(
      JSON.parse(readFileSync(artifactPath, "utf-8")) as Record<
        string,
        unknown
      >,
    ).toMatchObject({
      status: "waiting",
      owner_session: {
        session_id: "s_owner_review_failed",
        status: "error",
        summary: authError,
      },
      owner_result: {
        state: "waiting",
      },
    });
    expect(reviewed).toEqual([]);
    expect(emitted).not.toContainEqual(
      expect.objectContaining({ type: "project.owner.reviewed" }),
    );
  });

  it("keeps inbox work open when the owner session fails", async () => {
    const { appDir, ctx, emitted, reviewed, runtime } = makeHarness("error");

    const result = await execute(ctx);
    runtime.close();

    const artifactPath = join(
      appDir,
      ".state",
      "owner-review-artifacts",
      "event-5030987.json",
    );
    expect(result).toMatchObject({
      type: "blocked",
      reason: "Platform owner review session failed",
      context: expect.objectContaining({ artifactPath }),
    });
    expect(
      JSON.parse(readFileSync(artifactPath, "utf-8")) as Record<
        string,
        unknown
      >,
    ).toMatchObject({
      status: "blocked",
      owner_session: {
        session_id: "s_owner_review_failed",
        status: "error",
        summary: "provider failed",
      },
    });
    expect(reviewed).toEqual([]);
    expect(emitted).not.toContainEqual(
      expect.objectContaining({ type: "project.owner.reviewed" }),
    );
  });

  it("makes an explicit owner instruction the primary review request", async () => {
    const harness = makeHarness("done");
    harness.ctx.task = [
      `app: ${harness.appDir}`,
      "## Trigger Event",
      JSON.stringify({
        type: "project.owner.requested",
        params: {
          instruction: "Review the task workspace convention proposal.",
        },
      }),
    ].join("\n");

    await execute(harness.ctx);
    harness.runtime.close();

    expect(harness.observed.prompt).toContain(
      "Review the task workspace convention proposal.",
    );
    expect(harness.observed.prompt).toContain(
      "treat that instruction as the primary bounded owner request",
    );
    expect(harness.observed.prompt.indexOf("Current trigger:")).toBeLessThan(
      harness.observed.prompt.indexOf("The full system-review packet is at:"),
    );
  });
});
