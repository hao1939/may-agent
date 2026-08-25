import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type TaskIntent,
} from "@may-agent/sdk";

const projectId = "may-agent";
const hostOperationsAgent = "may";
const detailsSchema = Type.Record(Type.String(), Type.Unknown());
const nonEmptyString = Type.String({ minLength: 1 });
const stringList = Type.Array(nonEmptyString, { minItems: 1 });
const platformObligationDataSchema = Type.Object(
  {
    outcome: nonEmptyString,
    constraints: Type.Optional(stringList),
    acceptance: Type.Optional(stringList),
  },
  { additionalProperties: true },
);

export const OWNER_REVIEW_TASK_ID = "runtime/platform-owner-review";
export const PLATFORM_REVIEW_INTERVAL_MS = 28_800_000;
export const PLATFORM_METRIC_INTERVAL_MS = 300_000;
export const OWNER_HEARTBEAT_INTERVAL_MS = 86_400_000;

export const platformInputSchema = Type.Union([
  Type.Object(
    { kind: Type.Literal("owner-review"), data: detailsSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("runtime-deployment.adjudicate-current-host-state"),
      data: Type.Intersect([
        platformObligationDataSchema,
        Type.Object({ currentEvidence: detailsSchema }),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("runtime-capability-request"),
      data: Type.Intersect([
        platformObligationDataSchema,
        Type.Object({ acceptance: stringList, evidence: stringList }),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("dependency-authority-runtime-review"),
      data: Type.Object(
        {
          outcome: nonEmptyString,
          acceptance: stringList,
          sourceRequestId: Type.Literal("appdep_b0fced12cada9800c8035457"),
          requestingAppId: Type.Literal("aks-rp-e2e"),
          requestingTaskId: Type.Literal("runtime/owner-review"),
          requestingTaskGeneration: Type.Literal(154),
          sourceEventIds: Type.Tuple([
            Type.Literal(5810518),
            Type.Literal(5810519),
          ]),
          historicalSessionId: Type.Literal("s_1787054895397_14"),
          suppliedDependencyAuthority: Type.Literal(true),
          hostPrivateProjectionReadsAllowed: Type.Literal(false),
          safetyBounds: stringList,
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("installed-app-resolver-observation"),
      data: Type.Object(
        {
          outcome: nonEmptyString,
          acceptance: stringList,
          sourceRequestId: Type.Literal("appdep_c486e1db18a2121dd83a2d69"),
          requestingAppId: Type.Literal("aks-rp-e2e"),
          requestingTaskId: Type.Literal(
            "ops/verify-loaded-runtime-master-validation-authority-parity-20260820",
          ),
          targetAppId: Type.Literal("aks-rp-e2e"),
          syntheticEvent: Type.Object(
            {
              type: Type.Literal("project.task.tick"),
              action: Type.Literal("master-validation-compact"),
              taskId: Type.Literal("master-validation-compact"),
              data: Type.Object(
                { taskId: Type.Literal("master-validation-compact") },
                { additionalProperties: false },
              ),
            },
            { additionalProperties: false },
          ),
          evidenceArtifact: Type.Literal(
            "agents/app-ops/workspace/verify-loaded-runtime-master-validation-authority-parity-20260820/compatibility-gap.md",
          ),
          safetyBounds: stringList,
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("app-deployment-adjudication"),
      data: Type.Intersect([
        platformObligationDataSchema,
        Type.Object({
          requestingApp: Type.Literal("aks-rp-e2e"),
          requestingTaskId: nonEmptyString,
          historicalArtifact: nonEmptyString,
        }),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("runtime-source-deployment-request"),
      data: Type.Intersect([
        platformObligationDataSchema,
        Type.Object({
          context: Type.Object(
            {
              callerApp: Type.Literal("aks-rp-e2e"),
              callerTask: nonEmptyString,
            },
            { additionalProperties: true },
          ),
          acceptance: stringList,
        }),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("protected-agent-config-repair"),
      data: Type.Intersect([
        platformObligationDataSchema,
        Type.Object({
          acceptance: stringList,
          requestCorrelation: Type.Literal("appdep_69d1bbe3d001c5aeec77b979"),
          targetApp: Type.Literal("evaluation"),
          targetAgent: Type.Literal("evaluator"),
          configPath: Type.Literal(
            "/app/projects/evaluation.app/agents/evaluator/agent.json",
          ),
          field: Type.Literal("model"),
          currentValue: Type.Literal("gpt-5.6-sol"),
          proposedValue: Type.Literal("claude-opus-5"),
          credentialMutation: Type.Literal(false),
          requiresHaoApproval: Type.Literal(true),
        }),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("status-readonly-supervisor-activation"),
      data: Type.Object(
        {
          outcome: nonEmptyString,
          acceptance: stringList,
          sourceRequestId: Type.Literal("appdep_a403431cd372972301012d47"),
          sourceEventIds: Type.Tuple([
            Type.Literal(5799145),
            Type.Literal(5799146),
          ]),
          taskId: Type.Literal("harden-status-invocation-readonly-20260819"),
          correlation: Type.Literal("status-readonly-9f5d4d7f-20260819T2355Z"),
          receipt: Type.Literal(
            "/app/projects/may-agent/.state/deploy-receipts/status-readonly-9f5d4d7f-20260819T2355Z.json",
          ),
          sourceCommit: Type.Literal(
            "9f5d4d7f59143a855a546fd092002e56cf9a4a18",
          ),
          artifactSha: Type.Literal(
            "ef6f641daced640ea8644a9f681147913583c1e042b7a35aa32367f650ba7b02",
          ),
          safetyBounds: stringList,
          currentEvidence: detailsSchema,
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("contain-external-and-replayed-workspace-writer"),
      data: Type.Object(
        {
          project: Type.Literal("aks-rp-e2e"),
          sourceTaskId: Type.Literal(
            "ops/contain-event5648100-mv-speed-live-post-guard-producer-20260819",
          ),
          sourceEventId: Type.Literal(5648100),
          incidentPath: Type.Literal(
            "/app/worktrees/aks-master-validation-speed",
          ),
          staleGitAdminPath: Type.Literal(
            "/app/.git/worktrees/aks-master-validation-speed",
          ),
          externalRootPid: Type.Integer({ minimum: 1 }),
          observedLiveDescendant: Type.Object(
            {
              pid: Type.Integer({ minimum: 1 }),
              ppid: Type.Integer({ minimum: 1 }),
              startedAt: nonEmptyString,
              command: nonEmptyString,
            },
            { additionalProperties: false },
          ),
          writeSignature: Type.Literal(
            ".tmp-default-fleet-overlay-*/staging.json",
          ),
          sourceConstructor: Type.Literal(
            "runner/check-default-fleet-overlay.test.ts",
          ),
          replayedSessions: stringList,
          workflowRuns: stringList,
          workflow: Type.Literal("domain-task-execution"),
          requiredOutcome: nonEmptyString,
          evidenceArtifacts: stringList,
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

const deferredMetrics = new Set([
  "project.health.finding-count",
  "project.owner-incomplete-count",
  "project.agent-judgment-needed-count",
  "capability.zombie-session-count",
  "runtime.stale-running-session-count",
]);

const platformRuntimeMetrics = new Set([
  "infra.bus.subscriber-failed-count-1h",
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function eventData(
  event: AppEvent<Record<string, unknown>>,
): Record<string, unknown> {
  return record(event.data);
}

function platformOwnerReview(
  reason: string,
  details: Record<string, unknown> = {},
): AppInput {
  return { kind: "owner-review", data: { reason, ...details } };
}

function isPlatformMetric(event: AppEvent<Record<string, unknown>>): boolean {
  const data = eventData(event);
  const owner = stringValue(
    event.owner ?? data.owner ?? event.target?.owner,
  ).replace(/^agent:/, "");
  return !owner || owner === hostOperationsAgent || owner === "may";
}

export function taskIntentForInput(input: AppInput): TaskIntent | null {
  switch (input.kind) {
    case "owner-review":
      return {
        id: OWNER_REVIEW_TASK_ID,
        parentId: "platform-system-review-feedback-loop",
        outcome:
          "Keep platform state reviewed by its accountable owner and organize the smallest useful follow-up from current evidence.",
        acceptance: [
          "The owner performs one useful platform step or records an evidence-backed no-op, with task-resource changes proposed as typed actions.",
        ],
        mode: "maintain",
        agent: hostOperationsAgent,
        input: { scope: "may-agent-platform" },
        priority: "P1",
      };
    case "contain-external-and-replayed-workspace-writer": {
      const data = record(input.data);
      return {
        id: "",
        parentId: "platform-system-review-feedback-loop",
        outcome: stringValue(data.requiredOutcome),
        acceptance: [
          "Return exact process/session/workflow lineage, supported containment operations, fail-closed replay repair proof, and at least 180 seconds of quiescence without changing the incident path or Git metadata.",
        ],
        mode: "achieve",
        agent: hostOperationsAgent,
        input: { kind: input.kind, data },
        priority: "P0",
      };
    }
    case "runtime-deployment.adjudicate-current-host-state":
    case "runtime-capability-request":
    case "dependency-authority-runtime-review":
    case "installed-app-resolver-observation":
    case "app-deployment-adjudication":
    case "runtime-source-deployment-request":
    case "protected-agent-config-repair":
    case "status-readonly-supervisor-activation": {
      const data = record(input.data);
      return {
        id: "",
        parentId: "platform-system-review-feedback-loop",
        outcome: stringValue(data.outcome),
        acceptance: Array.isArray(data.acceptance)
          ? data.acceptance.filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0,
            )
          : [
              "Return a terminal, evidence-backed platform disposition through the supported control plane.",
            ],
        mode: "achieve",
        agent: hostOperationsAgent,
        input: { kind: input.kind, data },
        priority: "P1",
      };
    }
    default:
      return null;
  }
}

export function taskInputForEvent(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = eventData(event);
  switch (event.type) {
    case "project.tick":
      return platformOwnerReview("scheduled-project-review", data);
    case "project.tasks.ready":
      return platformOwnerReview("ready-tasks-available", data);
    case "metric.recovered":
      return null;
    case "metric.breach":
    case "metric.stalled": {
      const metricId = stringValue(
        data.metricId ?? data.metric_id ?? event.target?.metricId,
      );
      return (isPlatformMetric(event) ||
        platformRuntimeMetrics.has(metricId)) &&
        !deferredMetrics.has(metricId)
        ? platformOwnerReview("metric-signal", {
            metricId,
            metric: data,
          })
        : null;
    }
    default:
      return null;
  }
}

export function resolveHostOperationsTask(
  event: AppEvent<Record<string, unknown>>,
): TaskIntent | null {
  const input = taskInputForEvent(event);
  return input ? taskIntentForInput(input) : null;
}

export function taskForHostOperationsInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  if (
    admitted.input.kind === "protected-agent-config-repair" &&
    (admitted.source.kind !== "app" || admitted.source.id !== "evaluation")
  ) {
    throw new Error(
      "protected-agent-config-repair is accepted only from App evaluation",
    );
  }
  if (
    admitted.input.kind === "dependency-authority-runtime-review" &&
    (admitted.source.kind !== "app" || admitted.source.id !== "aks-rp-e2e")
  ) {
    throw new Error(
      "dependency-authority-runtime-review is accepted only from App aks-rp-e2e",
    );
  }
  if (
    admitted.input.kind === "installed-app-resolver-observation" &&
    (admitted.source.kind !== "app" || admitted.source.id !== "aks-rp-e2e")
  ) {
    throw new Error(
      "installed-app-resolver-observation is accepted only from App aks-rp-e2e",
    );
  }
  if (
    admitted.input.kind === "contain-external-and-replayed-workspace-writer" &&
    (admitted.source.kind !== "app" || admitted.source.id !== "aks-rp-e2e")
  ) {
    throw new Error(
      "contain-external-and-replayed-workspace-writer is accepted only from App aks-rp-e2e",
    );
  }
  if (
    admitted.input.kind === "status-readonly-supervisor-activation" &&
    (admitted.source.kind !== "app" || admitted.source.id !== "may-agent")
  ) {
    throw new Error(
      "status-readonly-supervisor-activation is accepted only from App may-agent",
    );
  }
  const resolved = taskIntentForInput(admitted.input);
  if (!resolved) {
    throw new Error(
      `Unsupported Host Operations input kind: ${admitted.input.kind}`,
    );
  }
  const requestTaskId = `app-request/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
  const intent =
    admitted.input.kind === "owner-review"
      ? {
          ...resolved,
          id: requestTaskId,
          outcome:
            stringValue(record(admitted.input.data).outcome) ||
            "Review and resolve the addressed Host Operations request.",
          acceptance: Array.isArray(record(admitted.input.data).acceptance)
            ? (record(admitted.input.data).acceptance as unknown[]).filter(
                (item): item is string =>
                  typeof item === "string" && item.trim().length > 0,
              )
            : [
                "Return a terminal, evidence-backed platform disposition through the supported control plane.",
              ],
          mode: "achieve" as const,
          input: {
            kind: admitted.input.kind,
            data: record(admitted.input.data),
          },
        }
      : resolved.id
        ? resolved
        : {
            ...resolved,
            id: requestTaskId,
          };
  return { kind: "desired", intent };
}

/** @deprecated Use `resolveHostOperationsTask`. */
export const resolveMayAgentTask = resolveHostOperationsTask;

/** @deprecated Use `taskForHostOperationsInput`. */
export const taskForMayAgentInput = taskForHostOperationsInput;

function scheduledEvent(
  type: string,
  data: Record<string, unknown>,
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data,
    target: { appId: projectId, project: projectId },
  };
}

const app = defineApp({
  id: projectId,
  version: 1,
  agent: hostOperationsAgent,
  description:
    "Host Operations App: runtime contracts, execution, persistence, SDK, UI, and App conventions.",
  inputSchema: platformInputSchema,
  task: taskForHostOperationsInput,
  workspace: { kind: "local", localPath: "../may-agent" },
  subscriptions: [
    {
      id: "project-comment",
      event: { type: "project.comment.created", project: projectId },
      toInput(event) {
        return platformOwnerReview("project-comment", eventData(event));
      },
    },
    {
      id: "project-owner-request",
      event: { type: "project.owner.requested", project: projectId },
      toInput(event) {
        const data = eventData(event);
        return platformOwnerReview(
          stringValue(data.reason) || "project-owner-request",
          data,
        );
      },
    },
  ],
  observations: [
    "runtime.daemon.heartbeat",
    "metric.recovered",
    "handler.workflow_dispatched",
    "handler.skipped",
    "metric.feedback.routed",
    "metric.alert_judged",
    "project.task.handler.recovered",
    "project.task.handler.unavailable",
    "project.task.verification.failed",
    "guard.triggered",
    "skill.loaded",
  ],
  schedules: [
    {
      id: "platform-review",
      intervalMs: PLATFORM_REVIEW_INTERVAL_MS,
      event: scheduledEvent("project.tick", {
        reason: "scheduled-project-review",
        lane: "platform-review",
      }),
    },
    {
      id: "platform-metrics",
      intervalMs: PLATFORM_METRIC_INTERVAL_MS,
      event: scheduledEvent("trigger.metrics-snapshot", {
        reason: "scheduled-platform-measurement",
      }),
    },
    {
      id: "owner-heartbeat",
      intervalMs: OWNER_HEARTBEAT_INTERVAL_MS,
      event: scheduledEvent("project.tick", {
        reason: "owner-heartbeat",
        lane: "owner-heartbeat",
      }),
    },
  ],
  actions: {
    "advance-project": {
      description: "Request review and advancement of the May Host project.",
      inputSchema: Type.Object({}, { additionalProperties: true }),
      toInput: (data) =>
        platformOwnerReview("manual-advance", { params: data }),
    },
  },
  tasks: {
    subscriptions: [
      { type: "project.tick", project: projectId },
      { type: "project.tasks.ready", project: projectId },
      "metric.breach",
      "metric.stalled",
    ],
    resolve: resolveHostOperationsTask,
    maxConcurrent: 2,
  },
});

export default app;
