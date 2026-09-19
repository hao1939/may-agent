import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
} from "@may-agent/sdk";

const detailsSchema = Type.Record(Type.String(), Type.Unknown());
const teamAssignmentSchema = Type.Object(
  {
    agent: Type.Union([
      Type.Literal("may"),
      Type.Literal("may-bob"),
      Type.Literal("may-tech-lead"),
    ]),
  },
  { additionalProperties: false },
);

const mayInputSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("goal"),
      data: Type.Object(
        {
          outcome: Type.String({ minLength: 1 }),
          constraints: Type.Optional(
            Type.Array(Type.String({ minLength: 1 }), { maxItems: 32 }),
          ),
          acceptance: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            maxItems: 32,
          }),
          revision: Type.Optional(
            Type.Object(
              {
                taskId: Type.String({ minLength: 1 }),
                expectedGeneration: Type.Integer({ minimum: 1 }),
              },
              { additionalProperties: false },
            ),
          ),
          assignment: Type.Optional(teamAssignmentSchema),
        },
        { additionalProperties: true },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("message"),
      data: Type.Object(
        {
          message: Type.String({ minLength: 1 }),
          context: Type.Optional(detailsSchema),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

const STANDING_RESEARCH_TASK_ID = "research-adoption";
const standingResearchOutcome =
  "Continuously assess qualified Scout findings and older archived research for small, evidence-backed improvements to this installation.";
const standingResearchAcceptance = [
  "Return a current-first Bob recommendation or a supported no-change, negative, or visible deferral outcome; retain source limits, linked evidence, owner and next action without applying a candidate.",
];

function requireStandingResearchContract(
  data: Record<string, unknown>,
  outcome: string,
  acceptance: readonly string[],
): void {
  const matchesAcceptance =
    acceptance.length === standingResearchAcceptance.length &&
    acceptance.every(
      (item, index) => item.trim() === standingResearchAcceptance[index],
    );
  const allowedFields = new Set([
    "outcome",
    "acceptance",
    "assignment",
    "research",
  ]);
  const hasCallerSpecificRequirements = Object.keys(data).some(
    (field) => !allowedFields.has(field),
  );
  if (
    outcome !== standingResearchOutcome ||
    !matchesAcceptance ||
    hasCallerSpecificRequirements
  ) {
    throw new Error(
      "Standing research adoption requires the exact fixed contract without caller-specific requirements; use targeted mode to preserve additional requirements",
    );
  }
}

function selectedAgent(data: Record<string, unknown>): string {
  const assignment = record(data.assignment);
  if (Object.keys(assignment).length === 0) return "may";
  if (
    assignment.agent !== "may" &&
    assignment.agent !== "may-bob" &&
    assignment.agent !== "may-tech-lead"
  ) {
    throw new Error(
      "May goal assignment must select an installed May team role",
    );
  }
  return assignment.agent;
}

function researchMode(
  data: Record<string, unknown>,
  agent: string,
): "standing" | "targeted" | null {
  const research = record(data.research);
  if (research.adoption !== "research-adoption") return null;
  if (
    agent !== "may-bob" ||
    (research.mode !== "standing" && research.mode !== "targeted")
  ) {
    throw new Error(
      "Research adoption requires Bob and a standing or targeted mode",
    );
  }
  return research.mode;
}

export function taskForMayInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  if (admitted.input.kind !== "goal") {
    throw new Error(
      `Unsupported durable May input kind: ${admitted.input.kind}`,
    );
  }
  const data = record(admitted.input.data);
  const agent = selectedAgent(data);
  const mode = researchMode(data, agent);
  const outcome = String(data.outcome ?? "").trim();
  const acceptance = Array.isArray(data.acceptance)
    ? data.acceptance.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
  if (!outcome || acceptance.length === 0) {
    throw new Error("May goal requires outcome and acceptance");
  }
  if (mode === "standing") {
    requireStandingResearchContract(data, outcome, acceptance);
  }
  const hasRevision = Object.prototype.hasOwnProperty.call(data, "revision");
  const revision = record(data.revision);
  const revisionTaskId = optionalText(revision.taskId);
  const expectedGeneration = revision.expectedGeneration;
  const revisesExisting =
    hasRevision &&
    revisionTaskId.length > 0 &&
    Number.isSafeInteger(expectedGeneration) &&
    Number(expectedGeneration) > 0;
  if (hasRevision && !revisesExisting) {
    throw new Error(
      "May goal revision requires an exact taskId and positive expectedGeneration",
    );
  }
  const attachment = {
    kind: "desired" as const,
    ...(revisesExisting
      ? { expectedGeneration: Number(expectedGeneration) }
      : {}),
    intent: {
      id: revisesExisting
        ? revisionTaskId
        : mode === "standing"
          ? STANDING_RESEARCH_TASK_ID
          : `goal/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
      parentId: "may",
      outcome: mode === "standing" ? standingResearchOutcome : outcome,
      acceptance: mode === "standing" ? standingResearchAcceptance : acceptance,
      agent,
      input:
        mode === "standing"
          ? {
              kind: "goal",
              data: {
                outcome: standingResearchOutcome,
                acceptance: standingResearchAcceptance,
                assignment: { agent: "may-bob" },
                research: {
                  adoption: "research-adoption",
                  mode: "standing",
                },
              },
            }
          : { kind: admitted.input.kind, data },
      priority: "P1",
    },
  };
  return attachment;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requiredText(
  data: Record<string, unknown>,
  field: string,
  eventType: string,
): string {
  const value = typeof data[field] === "string" ? data[field].trim() : "";
  if (!value) {
    throw new Error(`${eventType} requires non-empty ${field}`);
  }
  return value;
}

export function scoutResearchHandoffInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  if (
    event.source !== "app-task:scout-knowledge-lib" ||
    data.producerAppId !== "scout-knowledge-lib"
  ) {
    return null;
  }
  for (const field of [
    "sourceUrl",
    "sourceRevision",
    "artifact",
    "artifactHash",
    "claim",
    "limits",
    "possibleApplication",
  ]) {
    requiredText(data, field, event.type);
  }
  if (!/^[a-f0-9]{64}$/.test(String(data.artifactHash))) {
    throw new Error(`${event.type} requires SHA-256 artifactHash`);
  }
  return {
    kind: "goal",
    data: {
      outcome: standingResearchOutcome,
      acceptance: standingResearchAcceptance,
      assignment: { agent: "may-bob" },
      research: {
        adoption: "research-adoption",
        mode: "standing",
        opportunity: "scout-qualified-handoff",
        handoff: structuredClone(data),
        transport: {
          source: event.source,
          localKey: event.localKey,
          target: structuredClone(event.target),
        },
      },
    },
  };
}

export function evaluationHumanDecisionInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput {
  const data = record(event.data);
  const message = requiredText(data, "message", event.type);
  requiredText(data, "dedupeKey", event.type);
  return {
    kind: "message",
    data: {
      message,
      // Preserve the original fact and its correlation data. An escalation
      // requests judgment; it is not a human decision or new authority.
      context: { event: structuredClone(event) },
    },
  };
}

function reportHash(data: Record<string, unknown>, field: string): string {
  const value = requiredText(data, field, "evaluation.task_report_published");
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(
      `evaluation.task_report_published requires SHA-256 ${field}`,
    );
  }
  return value;
}

/** Normalize immutable Evaluation publication facts into May's ordinary message path. */
export function evaluationTaskReportInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  const appId = requiredText(data, "appId", event.type);
  if (appId === "evaluation" || appId === "evaluation.app") return null;
  const taskId = requiredText(data, "taskId", event.type);
  const evidenceHash = reportHash(data, "evidenceHash");
  const executionId = requiredText(data, "executionId", event.type);
  const report = requiredText(data, "report", event.type);
  const facts = requiredText(data, "facts", event.type);
  const jsonHash = reportHash(data, "jsonHash");
  const markdownHash = reportHash(data, "markdownHash");
  const assessmentPurpose = optionalText(data.assessmentPurpose);
  const rubricVersion = optionalText(data.rubricVersion);
  const validityIdentity = optionalText(data.validityIdentity);
  const publication = {
    appId,
    taskId,
    evidenceHash,
    executionId,
    report,
    facts,
    jsonHash,
    markdownHash,
    ...(assessmentPurpose ? { assessmentPurpose } : {}),
    ...(rubricVersion ? { rubricVersion } : {}),
    ...(validityIdentity ? { validityIdentity } : {}),
  };
  return {
    kind: "message",
    data: {
      message: `Review the published Evaluation report for ${appId}/${taskId}. Verify publication integrity and current subject evidence, then record an ordinary Task disposition. Reuse linked work; do not prepare a candidate for a duplicate, no-op, or recovered finding.`,
      context: {
        publication,
        caller: {
          source: event.source,
          owner: event.owner,
          target: structuredClone(event.target),
          localKey: event.localKey,
        },
        event: structuredClone(event),
      },
    },
  };
}

export default defineApp({
  id: "may",
  version: 1,
  agent: "may",
  workspace: { kind: "git", localPath: ".", branch: "main" },
  description:
    "Hao's deputy: handles conversation and authorized direct work, owns ongoing Tasks, and involves other Apps when useful or required. Use goal for ongoing work. May chooses available tools, specialists and workflows to meet the outcome; procedure parameters belong in context, not new input kinds.",
  inputSchema: mayInputSchema,
  conversation: {
    mode: "agent",
    inputKinds: ["message"],
    conversationId: "may:primary",
  },
  schedules: [
    {
      id: "research-adoption-archive-review",
      enabled: true,
      intervalMs: 7 * 24 * 60 * 60 * 1000,
      catchUp: "latest",
      input: {
        kind: "goal",
        data: {
          outcome: standingResearchOutcome,
          acceptance: standingResearchAcceptance,
          assignment: { agent: "may-bob" },
          research: {
            adoption: "research-adoption",
            mode: "standing",
            opportunity: "weekly-archive-review",
            recordLimit: 3,
            candidateLimit: 1,
            navigation:
              "Continue after the last accepted archive cursor and wrap after the final record; retain the next cursor in the current-first result.",
          },
        },
      },
    },
    {
      id: "conversation-supervision-recovery",
      intervalMs: 900_000,
      event: {
        type: "conversation.supervision.review",
        source: "app:may:schedule:conversation-supervision-recovery",
        owner: "app:may",
        target: { appId: "may", project: "may" },
        data: { project: "may", limit: 100 },
      },
    },
  ],
  task: taskForMayInput,
  tasks: {
    maxConcurrent: 4,
  },
  subscriptions: [
    {
      id: "scout-research-qualified",
      event: { type: "scout.research.qualified", project: "may" },
      toInput: scoutResearchHandoffInput,
    },
    {
      id: "evaluation-human-decision",
      event: {
        type: "evaluation.human_decision.requested",
        project: "may",
      },
      toInput: evaluationHumanDecisionInput,
    },
    {
      id: "evaluation-task-report",
      // Publications target Evaluation; consumer admission must not add a May
      // target/project filter. Host routing of this cross-target subscription
      // is independently exercised during isolated installation review.
      event: { type: "evaluation.task_report_published" },
      toInput: evaluationTaskReportInput,
    },
  ],
});
