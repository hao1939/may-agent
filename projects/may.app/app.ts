import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type TaskIntent,
} from "@may-agent/sdk";

const detailsSchema = Type.Record(Type.String(), Type.Unknown());

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
  Type.Object(
    {
      kind: Type.Literal("human-decision"),
      data: Type.Object(
        {
          message: Type.String({ minLength: 1 }),
          dedupeKey: Type.String({ minLength: 1 }),
          sourceSessionId: Type.Optional(Type.String({ minLength: 1 })),
          targetAppId: Type.Optional(Type.String({ minLength: 1 })),
          verdict: Type.Optional(Type.String({ minLength: 1 })),
          requestedHumanAction: Type.Optional(Type.String({ minLength: 1 })),
          evidence: Type.Optional(Type.Array(Type.String())),
        },
        { additionalProperties: true },
      ),
    },
    { additionalProperties: false },
  ),
]);

export const MAY_FOLLOW_UP_TASK_ID = "conversation/follow-up";

const MAY_SUPERVISION_EVENTS = new Set([
  "conversation.task.linked",
  "conversation.task.changed",
]);

export function mayFollowUpTask(
  event: AppEvent<Record<string, unknown>>,
): TaskIntent | null {
  if (!MAY_SUPERVISION_EVENTS.has(event.type)) return null;
  return {
    id: MAY_FOLLOW_UP_TASK_ID,
    parentId: "may",
    outcome:
      "Keep human-linked Tasks aligned with their Topics and return useful progress, decisions, and results to the shared Conversation.",
    acceptance: [
      "Each changed Topic-linked Task is left healthy, steered by exact identity, exposed for a human decision, or reported usefully in its Conversation.",
      "The supervision Task never parents, waits on, copies, or replaces the responsible Task.",
      "Repeated Task events are safe to coalesce, and healthy linked work returns this maintain Task to an up-to-date state.",
      "An unchanged recovery review records Task evidence without repeating a Conversation message; new material facts, human questions and Request dispositions still receive useful answers.",
      "Useful progress, a concrete human decision, or a terminal result is returned in result.conversation with exact conversation, Topic, event, and Task identities.",
      "An accepted Request closes only when its latest scope is addressed or explicitly withdrawn or unfulfilled, with its explanation recorded in the Conversation; Task completion alone is not closure.",
    ],
    mode: "maintain",
    agent: "may",
    input: {
      role: "conversation-supervision",
      instructions: [
        "Supervise the exact Task named by the conversation.task.linked or conversation.task.changed Event. Read its current state with tasks.get and target.appId, including on recovery wakes.",
        "Leave healthy progress and valid waits alone. For drift or a semantic stall, send useful feedback to that same Task through one fenced project.comment.created Event. Runtime owns mechanical recovery.",
        "Do not create a dependency, child, wrapper, watcher, polling loop, or replacement for the linked Task. Its App owns the outcome and acceptance.",
        "Return a useful progress update, result, or concrete human decision only when it matters. Use result.conversation with the Event's conversationId, topicId, followUpId, and exact taskRefs; do not invent identities or report delivery bookkeeping.",
        "Past Conversation messages are historical context, not proof of what triggered this cycle. Fresh progress on a maintained Task is not another fulfillment of an already-closed Request. Attribute a retry or human-requested run only when current evidence establishes that link. If the trigger is unknown, report the finding without guessing its cause; useful independent progress can still merit an update.",
        "Review event.data.requests against the actual Task evidence. A finished Task may still owe an answer to an open Request. Preserve its exact id, scope and revision; a late review must not overwrite a human correction. If context omits the required ask, obtain current evidence or leave it open, never guess its scope.",
        "When the accepted ask is addressed, return result.conversation.requestUpdates with id, expectedRevision, unchanged scope, disposition (fulfilled, withdrawn or unfulfilled), and a plain-language reason. The Conversation text must explain that outcome. Progress, blockers and clarification leave the ask open; omit requestUpdates when no accepted ask changes. Account for any independently running work before acknowledging withdrawal.",
        "An open Request does not authorize restarting a stopped turn, creating a proxy Task, or polling a discussion awaiting the human. Independent Tasks retain their own controls. Review current evidence on the next normal wake if a closure is rejected because the scope changed.",
        "On an automated recovery wake, an unchanged wait or previously reported unavailable App is not a new human-facing result. Preserve the linked Task and record that review in summary and evidence; do not repeat 'no new progress' or 'nothing needed' notices. An intentionally disabled App is not authorization to enable it. Report a new material blocker, changed fact, concrete human decision or accepted Request disposition, and answer an explicit human status question.",
        "Return an evidence-backed no-op when no update or steering is useful: {state: 'converged', summary: 'Reviewed; no material change', evidence: ['exact observation'], actions: []}. Omit result.conversation entirely for this quiet result. Converged means this supervision review is up to date, not that the linked work is complete.",
      ],
      resultContract: {
        usage:
          "The conversation field is optional. Use it only for a useful human-facing change or Request disposition, not to acknowledge every reviewed event.",
        conversation: {
          conversationId: "string",
          topicId: "string",
          followUpId: "string",
          text: "plain language",
          taskRefs: [{ appId: "string", taskId: "string" }],
          requestUpdates: [
            {
              id: "accepted Request id",
              expectedRevision: "observed revision (number)",
              scope: "unchanged accepted scope",
              disposition: "fulfilled | withdrawn | unfulfilled",
              reason:
                "plain-language outcome; omit the array when no ask changes",
            },
          ],
        },
      },
    },
    priority: "P0",
  };
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
  return {
    kind: "desired",
    intent: {
      id: `goal/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
      parentId: "may",
      outcome,
      acceptance,
      mode: "achieve",
      agent: "may",
      input: { kind: admitted.input.kind, data },
      priority: "P1",
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

export function evaluationHumanDecisionInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput {
  const data = record(event.data);
  return {
    kind: "human-decision",
    data: {
      ...data,
      message: requiredText(data, "message", event.type),
      dedupeKey: requiredText(data, "dedupeKey", event.type),
    },
  };
}

export default defineApp({
  id: "may",
  version: 1,
  agent: "may",
  description:
    "Hao's deputy: handles conversation and authorized direct work, owns ongoing Tasks, and involves other Apps when useful or required.",
  inputSchema: mayInputSchema,
  requests: {
    mode: "agent",
    inputKinds: ["message", "human-decision"],
    conversationId: "may:primary",
  },
  schedules: [
    {
      id: "conversation-supervision-recovery",
      intervalMs: 900_000,
      event: {
        type: "conversation.supervision.review",
        source: "app:may:schedule:conversation-supervision-recovery",
        owner: "app:may",
        target: { appId: "may", project: "may" },
        data: { project: "may", minQuietMs: 900_000, limit: 100 },
      },
    },
  ],
  task: taskForMayInput,
  tasks: {
    subscriptions: [
      { type: "conversation.task.linked", project: "may" },
      { type: "conversation.task.changed", project: "may" },
    ],
    resolve: mayFollowUpTask,
    maxConcurrent: 4,
  },
  subscriptions: [
    {
      id: "evaluation-human-decision",
      event: {
        type: "evaluation.human_decision.requested",
        project: "may",
      },
      toInput: evaluationHumanDecisionInput,
    },
  ],
});
