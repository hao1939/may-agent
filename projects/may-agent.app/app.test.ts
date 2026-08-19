import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import type { AppEvent, AppInput } from "@may-agent/sdk";
import { Check } from "typebox/value";
import app, {
  OWNER_HEARTBEAT_INTERVAL_MS,
  OWNER_REVIEW_TASK_ID,
  PLATFORM_METRIC_INTERVAL_MS,
  PLATFORM_REVIEW_INTERVAL_MS,
  resolveMayAgentTask,
  taskForMayAgentInput,
  taskInputForEvent,
} from "./app.ts";

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return { type, data, ...extra };
}

function admittedInput(input: AppInput) {
  return {
    id: "request-1",
    source: { kind: "system" as const, id: "test" },
    input,
  };
}

describe("canonical may-agent platform App", () => {
  it("owns one manifest and keeps addressed work separate from task wakes", () => {
    expect(app).toMatchObject({
      id: "may-agent",
      version: 1,
      owner: "may",
      inbox: { batch: "single", maxConcurrent: 2 },
      tasks: { maxConcurrent: 2 },
    });
    expect(app.task).toBe(taskForMayAgentInput);
    expect(app.route).toBeUndefined();
    expect(app.tasks?.resolve).toBe(resolveMayAgentTask);
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "project-comment",
      "project-owner-request",
    ]);
    expect(app.observations).not.toContain("project.task.reconciled");
    expect(app.observations).toContain("runtime.daemon.heartbeat");
    expect(app.observations).toContain("metric.recovered");
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(app).not.toHaveProperty("budget");
    expect(existsSync(new URL("./inbox.ts", import.meta.url))).toBe(false);
  });

  it("publishes every periodic background wake as a fact", () => {
    expect(
      app.schedules?.find(({ id }) => id === "platform-review")?.intervalMs,
    ).toBe(PLATFORM_REVIEW_INTERVAL_MS);
    expect(
      app.schedules?.find(({ id }) => id === "platform-metrics"),
    ).toMatchObject({
      intervalMs: PLATFORM_METRIC_INTERVAL_MS,
      event: {
        type: "trigger.metrics-snapshot",
        data: { reason: "scheduled-platform-measurement" },
        target: { appId: "may-agent", project: "may-agent" },
      },
    });
    expect(
      app.schedules?.find(({ id }) => id === "owner-heartbeat")?.intervalMs,
    ).toBe(OWNER_HEARTBEAT_INTERVAL_MS);
    for (const schedule of app.schedules ?? []) {
      expect(schedule).toHaveProperty("event");
      expect(schedule).not.toHaveProperty("input");
    }
  });

  it("turns the platform action into an addressed App input", () => {
    expect(
      app.actions?.["advance-project"]?.toInput({ scope: "runtime" }),
    ).toMatchObject({
      kind: "owner-review",
      data: { reason: "manual-advance", params: { scope: "runtime" } },
    });
  });
});

describe("may-agent task routing", () => {
  it("routes App-owned platform facts to the runnable canonical owner", () => {
    const intent = resolveMayAgentTask(
      event("project.tick", { reason: "scheduled" }),
    );
    expect(intent).toMatchObject({
      id: OWNER_REVIEW_TASK_ID,
      mode: "maintain",
      owner: "may",
      input: { scope: "may-agent-platform" },
    });
    expect(intent).not.toHaveProperty("workflow");
    expect(resolveMayAgentTask(event("project.ops_health.tick"))).toBeNull();
    expect(resolveMayAgentTask(event("project.ops_digest.tick"))).toBeNull();
  });

  it("keeps mechanical session recovery and one-time state migration in Runtime", () => {
    expect(
      resolveMayAgentTask(
        event("session.recovery.requested", { sessionId: "s_failed/17" }),
      ),
    ).toBeNull();
    expect(
      resolveMayAgentTask(event("may-agent.resource-migration.requested")),
    ).toBeNull();
  });

  it("filters recovered, deferred, and foreign metric observations", () => {
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "runtime.some-platform-metric" },
          { owner: "agent:may" },
        ),
      ),
    ).toMatchObject({
      kind: "owner-review",
      data: { reason: "metric-signal" },
    });
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "project.health.finding-count" },
          { owner: "agent:may" },
        ),
      ),
    ).toBeNull();
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "other.metric" },
          { owner: "agent:other-app" },
        ),
      ),
    ).toBeNull();
    expect(taskInputForEvent(event("metric.recovered"))).toBeNull();
  });

  it("maps addressed input directly to its stable task", () => {
    expect(
      taskForMayAgentInput(
        admittedInput({ kind: "owner-review", data: { reason: "manual" } }),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: { id: OWNER_REVIEW_TASK_ID },
    });
  });

  it("golden-traces every explicit AKS-to-May obligation through schema and task handling", () => {
    const inputs: AppInput[] = [
      {
        kind: "runtime-deployment.adjudicate-current-host-state",
        data: {
          outcome: "Adjudicate current host state.",
          currentEvidence: { health: "healthy" },
        },
      },
      {
        kind: "runtime-capability-request",
        data: {
          outcome: "Expose a bounded runtime capability.",
          acceptance: ["Prove propagation and default compatibility."],
          evidence: ["sdk-current/src/workflow.ts"],
        },
      },
      {
        kind: "app-deployment-adjudication",
        data: {
          outcome: "Adjudicate the historical App deployment.",
          requestingApp: "aks-rp-e2e",
          requestingTaskId: "ops/example",
          historicalArtifact: "/app/.state/releases/apps/example",
        },
      },
      {
        kind: "runtime-source-deployment-request",
        data: {
          outcome: "Deploy the exact current source through May authority.",
          acceptance: ["Return terminal loaded-source proof."],
          context: {
            callerApp: "aks-rp-e2e",
            callerTask: "ops/promote-example",
          },
        },
      },
    ];

    for (const [index, input] of inputs.entries()) {
      expect(Check(app.inputSchema, input)).toBeTrue();
      expect(
        taskForMayAgentInput({
          ...admittedInput(input),
          id: `aks-request-${index + 1}`,
        }),
      ).toMatchObject({
        kind: "desired",
        intent: {
          id: `app-request/aks-request-${index + 1}`,
          owner: "may",
          mode: "achieve",
          outcome: input.data.outcome,
          input: { kind: input.kind },
        },
      });
    }
  });

  it("golden-traces the rejected AKS containment binding to one finite May task", () => {
    const input: AppInput = {
      kind: "contain-external-and-replayed-workspace-writer",
      data: {
        project: "aks-rp-e2e",
        sourceTaskId:
          "ops/contain-event5648100-mv-speed-live-post-guard-producer-20260819",
        sourceEventId: 5648100,
        incidentPath: "/app/worktrees/aks-master-validation-speed",
        staleGitAdminPath: "/app/.git/worktrees/aks-master-validation-speed",
        externalRootPid: 424986,
        observedLiveDescendant: {
          pid: 806179,
          ppid: 424986,
          startedAt: "2026-08-19T17:34:50Z",
          command: "bun runner/find-default-fleet-merge-opportunities.ts",
        },
        writeSignature: ".tmp-default-fleet-overlay-*/staging.json",
        sourceConstructor: "runner/check-default-fleet-overlay.test.ts",
        replayedSessions: ["s_1787163576487_5"],
        workflowRuns: ["wr_1787163576350_q7ch"],
        workflow: "domain-task-execution",
        requiredOutcome:
          "Contain only the attributed external and replayed writer through Host/Runtime supervision and prove quiescence without workspace mutation.",
        evidenceArtifacts: [
          "/app/projects/aks-rp-e2e.app/agents/app-ops/workspace/recovery/event5648100-mv-speed-post-recreation-stable-20260819/post-containment-attribution-poll.txt",
        ],
      },
    };

    expect(Check(app.inputSchema, input)).toBeTrue();
    expect(
      taskForMayAgentInput({
        id: "appdep_7d94713590078a6994af0d6d",
        source: { kind: "app", id: "aks-rp-e2e" },
        input,
      }),
    ).toMatchObject({
      kind: "desired",
      intent: {
        id: "app-request/appdep_7d94713590078a6994af0d6d",
        owner: "may",
        mode: "achieve",
        priority: "P0",
        outcome: input.data.requiredOutcome,
        input: {
          kind: "contain-external-and-replayed-workspace-writer",
          data: {
            incidentPath: "/app/worktrees/aks-master-validation-speed",
            staleGitAdminPath:
              "/app/.git/worktrees/aks-master-validation-speed",
          },
        },
      },
    });

    for (const malformed of [
      { ...input, kind: "contain-workspace-writer" },
      { ...input, data: { ...input.data, project: "other-app" } },
      { ...input, data: { ...input.data, incidentPath: "/app" } },
      { ...input, data: { ...input.data, mutateWorkspace: true } },
      { ...input, data: { ...input.data, replayedSessions: [] } },
    ]) {
      expect(Check(app.inputSchema, malformed)).toBeFalse();
    }
    expect(() =>
      taskForMayAgentInput({
        id: "wrong-containment-source",
        source: { kind: "system", id: "test" },
        input,
      }),
    ).toThrow(
      "contain-external-and-replayed-workspace-writer is accepted only from App aks-rp-e2e",
    );
  });

  it("golden-traces the exact evaluation protected-config request to a correlated May task", () => {
    const input: AppInput = {
      kind: "protected-agent-config-repair",
      data: {
        outcome:
          "Evaluate an approval-gated evaluator model-only configuration change.",
        acceptance: [
          "Return terminal authority proof or a terminal rejection without mutation.",
        ],
        requestCorrelation: "appdep_69d1bbe3d001c5aeec77b979",
        targetApp: "evaluation",
        targetAgent: "evaluator",
        configPath: "/app/projects/evaluation.app/agents/evaluator/agent.json",
        field: "model",
        currentValue: "gpt-5.6-sol",
        proposedValue: "claude-opus-5",
        credentialMutation: false,
        requiresHaoApproval: true,
      },
    };
    expect(Check(app.inputSchema, input)).toBeTrue();
    expect(
      taskForMayAgentInput({
        id: "evaluation-protected-config-proof-1",
        source: { kind: "app", id: "evaluation" },
        input,
      }),
    ).toMatchObject({
      kind: "desired",
      intent: {
        id: "app-request/evaluation-protected-config-proof-1",
        owner: "may",
        mode: "achieve",
        input: {
          kind: "protected-agent-config-repair",
          data: {
            requestCorrelation: "appdep_69d1bbe3d001c5aeec77b979",
            credentialMutation: false,
            requiresHaoApproval: true,
          },
        },
      },
    });
  });

  it("keeps unknown, generic, malformed, and cross-App deployment inputs rejected", () => {
    const rejected = [
      { kind: "unknown-platform-request", data: { outcome: "do anything" } },
      { kind: "request", data: { outcome: "generic catch-all" } },
      {
        kind: "runtime-capability-request",
        data: { outcome: "missing proof" },
      },
      {
        kind: "app-deployment-adjudication",
        data: {
          outcome: "wrong producer",
          requestingApp: "other-app",
          requestingTaskId: "task",
          historicalArtifact: "/tmp/example",
        },
      },
      {
        kind: "protected-agent-config-repair",
        data: {
          outcome: "mutate an unrelated protected config",
          acceptance: ["claim success"],
          requestCorrelation: "appdep_69d1bbe3d001c5aeec77b979",
          targetApp: "other-app",
          targetAgent: "owner",
          configPath: "/app/agents/owner/agent.json",
          field: "model",
          currentValue: "gpt-5.6-sol",
          proposedValue: "claude-opus-5",
          credentialMutation: false,
          requiresHaoApproval: true,
        },
      },
    ];
    for (const input of rejected) {
      expect(Check(app.inputSchema, input)).toBeFalse();
    }
    expect(() =>
      taskForMayAgentInput({
        id: "wrong-source",
        source: { kind: "system", id: "test" },
        input: {
          kind: "protected-agent-config-repair",
          data: {
            outcome: "request protected mutation",
            acceptance: ["return a terminal result"],
            requestCorrelation: "appdep_69d1bbe3d001c5aeec77b979",
            targetApp: "evaluation",
            targetAgent: "evaluator",
            configPath:
              "/app/projects/evaluation.app/agents/evaluator/agent.json",
            field: "model",
            currentValue: "gpt-5.6-sol",
            proposedValue: "claude-opus-5",
            credentialMutation: false,
            requiresHaoApproval: true,
          },
        },
      }),
    ).toThrow(
      "protected-agent-config-repair is accepted only from App evaluation",
    );
    expect(() =>
      taskForMayAgentInput(
        admittedInput({ kind: "request", data: { outcome: "generic" } }),
      ),
    ).toThrow("Unsupported may-agent input kind: request");
  });
});
