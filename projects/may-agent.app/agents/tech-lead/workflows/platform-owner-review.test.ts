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
import { Check } from "typebox/value";
import type {
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "@may-agent/sdk";
import {
  execute,
  normalizeOwnerResult,
  platformOwnerResultSchema,
} from "./platform-owner-review.ts";

type OwnerResult = Exclude<TaskReconcileResult, { state: "needs-agent" }>;

describe("platform-owner-review", () => {
  const tempDirs: string[] = [];

  function makeHarness(
    agentResult?: ExecutionResult<OwnerResult>,
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
      JSON.stringify({ id: "may-agent", owner: "tech-lead" }),
    );

    const ownerResult: OwnerResult = {
      state: "converged",
      summary: "Current platform evidence is covered by existing work.",
      result: {
        directOwnerSignalCount: 0,
        directOwnerSignals: [],
      },
      facts: ["packet:.state/review-packet.json"],
      actions: [],
    };
    const observed: { prompt: string; schema?: unknown } = { prompt: "" };
    const result =
      agentResult ??
      ({
        id: "exec_owner_review",
        kind: "agent",
        status: "done",
        summary: ownerResult.summary,
        output: ownerResult,
      } satisfies ExecutionResult<OwnerResult>);

    const ctx = {
      input: { scope: "may-agent-platform" },
      reconciliation: {
        appId: "may-agent",
        taskId: "runtime/platform-owner-review",
        generation: 7,
        resourceVersion: 19,
        owner: "tech-lead",
        outcome: "Keep platform state reviewed.",
        acceptance: ["A bounded owner judgment is preserved."],
        input: { scope: "may-agent-platform" },
        children: { live: [], completed: [] },
        taskSnapshot: {
          live: [
            {
              taskId: "evidence-archive-secret-redaction",
              parentId: "project",
              generation: 2,
              outcome: "Redact archive secrets.",
              evidence: [],
              input: {},
              conditions: [],
              hasLiveChildren: false,
              status: "attention",
            },
          ],
          truncated: false,
        },
        events: {
          items: [
            {
              eventId: 5030987,
              observedAt: "2026-08-26T00:00:00.000Z",
              event: {
                type: "project.owner.requested",
                data: { eventId: 5030987 },
                target: { appId: "may-agent", project: "may-agent" },
              },
            },
          ],
          throughEventId: 5030987,
          truncated: false,
        },
      },
      read: {
        appResult: async () => null,
        task: async () => null,
        execution: async () => null,
        metric: async () => null,
      },
      agents: {
        call: async (_agent: string, prompt: string, options?: unknown) => {
          observed.prompt = prompt;
          observed.schema = (
            options as { schema?: unknown } | undefined
          )?.schema;
          if (result.status === "done") {
            expect(Check(platformOwnerResultSchema, result.output)).toBe(true);
          }
          duringOwnerRun?.(appDir);
          return result;
        },
      },
      workflows: {
        run: async () => ({
          id: "unused",
          kind: "workflow",
          status: "done",
          summary: "unused",
        }),
      },
      events: { emit: async () => {} },
      workspace: {
        appRoot: appDir,
        projectRoot: projectDir,
        root: projectDir,
        output: projectDir,
      },
      log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      done: (summary: string, output?: unknown) => ({
        id: "workflow_owner_review",
        kind: "workflow" as const,
        status: "done" as const,
        summary,
        output,
      }),
      blocked: (reason: string, evidence?: unknown) => ({
        id: "workflow_owner_review",
        kind: "workflow" as const,
        status: "blocked" as const,
        summary: reason,
        evidence,
      }),
    } as WorkflowContext;

    return { appDir, ctx, observed, ownerResult };
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves the owner's decision about whether a request needs a wait", () => {
    const request = {
      id: "review-result",
      appId: "evaluation",
      input: {
        kind: "review-task-outcome",
        data: { appId: "may-agent", taskId: "runtime/platform-owner-review" },
      },
    };
    const results: OwnerResult[] = [
      {
        state: "converged",
        summary: "Delivered the repair; request an independent review.",
        facts: ["artifact:verified-repair"],
        requests: [request],
      },
      {
        state: "waiting",
        summary: "The requested review is needed before proceeding.",
        facts: ["artifact:review-candidate"],
        requests: [request],
        conditions: [{ requestId: request.id }],
        continue: true,
      },
    ];
    for (const ownerResult of results) {
      const result = normalizeOwnerResult(ownerResult);
      expect(result).toMatchObject(ownerResult);
      expect(Check(platformOwnerResultSchema, result)).toBe(true);
    }
  });

  it("always normalizes the direct owner signal disclosure", () => {
    const noSignalResult = normalizeOwnerResult({
      state: "converged",
      summary: "The existing owner lineage already covers the obligation.",
      facts: ["receipt:existing-owner-lineage"],
      actions: [],
    });
    expect(noSignalResult.result).toMatchObject({
      directOwnerSignalCount: 0,
      directOwnerSignals: [],
    });
    expect(Check(platformOwnerResultSchema, noSignalResult)).toBe(true);
    const { facts, ...withoutFacts } = noSignalResult;
    expect(Check(platformOwnerResultSchema, withoutFacts)).toBe(false);
    expect(
      Check(platformOwnerResultSchema, { ...withoutFacts, evidence: facts }),
    ).toBe(false);
    expect(
      Check(platformOwnerResultSchema, {
        state: "converged",
        summary: "Missing the required disclosure.",
        facts: [],
      }),
    ).toBe(false);

    const signaledResult = normalizeOwnerResult({
      state: "converged",
      summary: "The owner received the new material obligation.",
      result: {
        directOwnerSignalCount: 99,
        directOwnerSignals: [
          "recipient:dev; purpose:repair; receipt:message-123",
        ],
      },
      facts: ["message:message-123"],
      actions: [],
    });
    expect(signaledResult.result).toMatchObject({
      directOwnerSignalCount: 1,
      directOwnerSignals: [
        "recipient:dev; purpose:repair; receipt:message-123",
      ],
    });
  });

  it("uses only the bounded canonical context and preserves the owner result", async () => {
    const harness = makeHarness();
    const result = await execute(harness.ctx);

    expect(result).toMatchObject({
      status: "done",
      summary: harness.ownerResult.summary,
      output: harness.ownerResult,
    });
    expect(Check(platformOwnerResultSchema, result.output)).toBe(true);
    const resultSchema = JSON.stringify(harness.observed.schema);
    expect(resultSchema).toContain("directOwnerSignalCount");
    expect(resultSchema).toContain("directOwnerSignals");
    expect(harness.observed.prompt).toContain(
      "The generic reconciler is the sole task-tree mutation authority.",
    );
    expect(harness.observed.prompt).toContain(
      "Running: runtime/platform-owner-review",
    );
    expect(harness.observed.prompt).toContain(
      "Attention: evidence-archive-secret-redaction",
    );
    expect(
      existsSync(join(harness.appDir, ".state", "review-packet.json")),
    ).toBe(true);

    const artifactPath = join(
      harness.appDir,
      ".state",
      "owner-review-artifacts",
      "event-5030987.json",
    );
    expect(JSON.parse(readFileSync(artifactPath, "utf-8"))).toMatchObject({
      status: "converged",
      reconciliation_task_id: "runtime/platform-owner-review",
      owner_execution: {
        execution_id: "exec_owner_review",
        status: "done",
      },
      owner_result: harness.ownerResult,
    });
  });

  it("preserves owner worklog and interim note during finalization", async () => {
    const worklog = {
      required_before_speculative_edits: true,
      prompt: "Record bounded progress.",
      current_hypothesis: "The historical delivery cause is unknown.",
      next_step: "Wait for an exact recurrence with lifecycle telemetry.",
      updated_at: "2026-08-07T10:55:00.000Z",
    };
    const harness = makeHarness(undefined, (appDir) => {
      const artifactPath = join(
        appDir,
        ".state",
        "owner-review-artifacts",
        "event-5030987.json",
      );
      const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
      writeFileSync(
        artifactPath,
        `${JSON.stringify({
          ...artifact,
          owner_worklog: worklog,
          interim_note: "Later evidence supports a bounded no-op.",
        })}\n`,
      );
    });

    await execute(harness.ctx);
    const artifactPath = join(
      harness.appDir,
      ".state",
      "owner-review-artifacts",
      "event-5030987.json",
    );
    expect(JSON.parse(readFileSync(artifactPath, "utf-8"))).toMatchObject({
      status: "converged",
      owner_worklog: worklog,
      interim_note: "Later evidence supports a bounded no-op.",
    });
  });

  it("retains an unsuccessful attempt through the current result contract", async () => {
    const ownerResult: OwnerResult = {
      state: "incomplete",
      summary: "The inspected repair is still failing verification.",
      facts: ["check:focused-regression-failed"],
      result: { directOwnerSignalCount: 0, directOwnerSignals: [] },
    };
    const harness = makeHarness({
      id: "exec_owner_incomplete",
      kind: "agent",
      status: "done",
      summary: ownerResult.summary,
      output: ownerResult,
    });
    const result = await execute(harness.ctx);
    expect(result).toMatchObject({ status: "done", output: ownerResult });
    expect(
      JSON.parse(
        readFileSync(
          join(
            harness.appDir,
            ".state",
            "owner-review-artifacts",
            "event-5030987.json",
          ),
          "utf-8",
        ),
      ),
    ).toMatchObject({ status: "incomplete", owner_result: ownerResult });
  });

  it("returns waiting when the owner execution fails on authentication", async () => {
    const authError =
      "AuthenticationError: Github_copilotException unauthorized: token expired";
    const harness = makeHarness({
      id: "exec_owner_failed",
      kind: "agent",
      status: "error",
      summary: authError,
    });

    const result = await execute(harness.ctx);
    expect(Check(platformOwnerResultSchema, result.output)).toBe(true);
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "waiting",
        conditions: [
          {
            subject: "credential:github-copilot",
            owner: "human",
          },
        ],
      },
    });
  });

  it("keeps non-auth execution failures blocked", async () => {
    const harness = makeHarness({
      id: "exec_owner_failed",
      kind: "agent",
      status: "error",
      summary: "provider failed",
    });

    const result = await execute(harness.ctx);
    expect(result).toMatchObject({
      status: "blocked",
      summary: "Platform owner review execution failed",
      evidence: { executionId: "exec_owner_failed" },
    });
  });

  it("makes an explicit owner instruction the primary review request", async () => {
    const harness = makeHarness();
    harness.ctx.reconciliation!.events = {
      items: [
        {
          eventId: 5030988,
          observedAt: "2026-08-26T00:01:00.000Z",
          event: {
            type: "project.owner.requested",
            data: {
              eventId: 5030988,
              instruction: "Review the task workspace convention proposal.",
            },
          },
        },
      ],
      throughEventId: 5030988,
      truncated: false,
    };

    await execute(harness.ctx);
    expect(harness.observed.prompt).toContain(
      "Review the task workspace convention proposal.",
    );
    expect(harness.observed.prompt).toContain(
      "treat that instruction as the primary bounded owner request",
    );
    expect(harness.observed.prompt.indexOf("Current trigger:")).toBeLessThan(
      harness.observed.prompt.indexOf(
        "The bounded reconciliation review packet is at:",
      ),
    );
  });
});
