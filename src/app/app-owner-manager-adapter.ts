import { Type, type Static } from "@earendil-works/pi-ai";
import { Check, Errors } from "typebox/value";
import type { AppDefinition, AppRequest } from "@may-agent/sdk";
import {
  APP_INBOX_RECOVERY_OWNER,
  appInboxHumanRequestId,
  type AppOwnerDispositionResult,
  type AppOwnerInvoker,
} from "./app-inbox-host.js";

const appInputSchema = Type.Object(
  {
    kind: Type.String({ minLength: 1 }),
    data: Type.Unknown(),
  },
  { additionalProperties: false },
);

const taskIntentSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    parentId: Type.String({ minLength: 1 }),
    outcome: Type.String({ minLength: 1 }),
    acceptance: Type.Array(Type.String()),
    mode: Type.Union([Type.Literal("achieve"), Type.Literal("maintain")]),
    workflow: Type.Optional(Type.String()),
  },
  { additionalProperties: true },
);

const appAnalysisSchema = Type.Object(
  {
    tool: Type.Union([Type.Literal("codex"), Type.Literal("claude")]),
    question: Type.String({ minLength: 1 }),
    cwd: Type.Optional(Type.String({ minLength: 1 })),
    files: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    timeoutMs: Type.Number({ minimum: 1, maximum: 1_800_000 }),
    expectedOutput: Type.Optional(
      Type.Object(
        {
          format: Type.Union([Type.Literal("markdown"), Type.Literal("json")]),
          requiredFields: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const completeDispositionSchema = Type.Object(
  {
    type: Type.Literal("complete"),
    summary: Type.String({ minLength: 1 }),
    response: Type.Optional(Type.String()),
    evidence: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);
const delegateDispositionSchema = Type.Object(
  {
    type: Type.Literal("delegate"),
    appId: Type.String({ minLength: 1 }),
    input: appInputSchema,
    reviewAfterMs: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
);
const taskDispositionSchema = Type.Object(
  {
    type: Type.Literal("task"),
    task: Type.Union([
      Type.Object(
        { kind: Type.Literal("existing"), taskId: Type.String({ minLength: 1 }) },
        { additionalProperties: false },
      ),
      Type.Object({ kind: Type.Literal("desired"), intent: taskIntentSchema }, { additionalProperties: false }),
    ]),
  },
  { additionalProperties: false },
);
const analyzeDispositionSchema = Type.Object(
  {
    type: Type.Literal("analyze"),
    analysis: appAnalysisSchema,
    acknowledgement: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

const appWorkDispositionSchema = Type.Union([
  completeDispositionSchema,
  delegateDispositionSchema,
  taskDispositionSchema,
  analyzeDispositionSchema,
]);

const mayContinuationDispositionSchema = Type.Union([
  completeDispositionSchema,
  delegateDispositionSchema,
  analyzeDispositionSchema,
]);

export const appDispositionSchema = Type.Union([
  appWorkDispositionSchema,
  Type.Object(
    {
      type: Type.Literal("continue"),
      requestId: Type.String({ minLength: 1 }),
      disposition: mayContinuationDispositionSchema,
      response: Type.Optional(Type.String({ minLength: 1 })),
    },
    { additionalProperties: false },
  ),
]);

export const appOwnerBatchResultSchema = Type.Object(
  {
    dispositions: Type.Array(
      Type.Object(
        {
          requestId: Type.String({ minLength: 1 }),
          disposition: appDispositionSchema,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

type AppOwnerBatchResult = Static<typeof appOwnerBatchResultSchema>;

export type AppOwnerManager = {
  hasAgent(agent: string): boolean;
  run(
    agent: string,
    task: string,
    options: {
      source: string;
      kind: "call" | "job";
      projectId: string;
      requestId: string;
      conversationId?: string;
      channelMessageId?: number;
      recoveryOwner: typeof APP_INBOX_RECOVERY_OWNER;
      requireFinish: true;
      outputSchema: typeof appOwnerBatchResultSchema;
      toolPolicy: "app-owner-full" | "app-owner-deputy";
    },
  ): string;
  waitFor(sessionId: string): Promise<{
    status: "done" | "error" | "interrupted";
    structuredResult?: unknown;
    error?: string;
    lastAssistantText?: string | null;
  }>;
  cancel(sessionId: string): void;
};

function ownerPrompt(app: AppDefinition, requests: AppRequest[], humanResponse: boolean): string {
  return [
    `You are the owner of App ${app.id}. Handle this bounded inbox batch.`,
    "Return exactly one disposition for every requestId by calling finish() with the required structured result.",
    "A complete disposition answers or finishes this input. A delegate disposition creates one child App input.",
    ...(app.tasks?.attach === true
      ? ["This App may return a task disposition to link durable desired work."]
      : [
          `This App cannot attach tasks. Return complete or delegate${app.id === "may" ? ", or May-only analyze" : ""}; never return a task disposition.`,
        ]),
    ...(app.id === "may"
      ? [
          "May may return analyze for one bounded, non-mutating Codex or Claude evidence request. The Host starts it only after admitting the disposition; do not call run_cli_agent.",
          "When the analysis means the human will wait, include one short natural acknowledgement stating what you are checking. It is durable progress on this same request, not a new task.",
          "Use analyze only for understanding or a reviewed proposal. Delegate implementation, service operation, repeated convergence, and proof to the accountable App.",
          "A human message is not automatically new work. When it is feedback about one unfinished request shown in conversation.work, return continue with that exact requestId and the complete, delegate, or analyze disposition to apply now. This advances the original work in this owner turn; do not create a second commitment or ask May to reconcile itself later.",
          "Use continue only for a request present in conversation.work. For a synchronous completion, put the human answer in the nested complete response and omit the outer response. For asynchronous work, the optional outer response is the immediate natural acknowledgement.",
        ]
      : ["Only the canonical May App may return an analyze disposition."]),
    "If a request has dependency, it is the current read-only observation of the exact child, task, analysis, or recovered Runtime session that woke this request. Review that observation instead of querying runtime storage.",
    `Use bounded agent or workflow calls only when you can review their result in this attempt. Durable asynchronous ownership must be returned as ${
      app.id === "may"
        ? "a delegate or May-only analyze disposition"
        : app.tasks?.attach === true
          ? "a delegate or task disposition"
          : "a delegate disposition"
    }.`,
    "Do not invent lifecycle states, mutate inbox storage, or omit a request. Preserve each current requestId exactly; a continue disposition's target requestId is separate.",
    "When conversation evidence is present, use its ordered durable messages and exact reply links to understand natural follow-up. Command and meaningful tool output are messages too. Transient progress and notifications are deliberately absent. If more than one unfinished subject remains plausible, ask one focused clarification instead of guessing.",
    "Conversation work is semantic: when an item contains result, give the human that result directly. Never discuss channels, delivery receipts, display confirmation, or transport uncertainty unless the human explicitly asks for an operational delivery diagnosis.",
    ...(humanResponse
      ? [
          "This is one human-origin request. Put the exact concise human-facing progress or final reply in the finish summary as well as in the disposition response when completing.",
        ]
      : []),
    "",
    "## App requests",
    "```json",
    JSON.stringify(requests, null, 2),
    "```",
  ].join("\n");
}

function admittedBatch(value: unknown): AppOwnerDispositionResult[] {
  if (!Check(appOwnerBatchResultSchema, value)) {
    const first = [...Errors(appOwnerBatchResultSchema, value)][0];
    throw new Error(`Invalid App owner result: ${first?.message ?? "schema mismatch"}`);
  }
  return (value as AppOwnerBatchResult).dispositions as AppOwnerDispositionResult[];
}

export function createManagerAppOwnerInvoker(manager: AppOwnerManager): AppOwnerInvoker {
  return async ({ app, requests, transport, onSessionStarted }) => {
    const sessionId = manager.run(app.owner, ownerPrompt(app, requests, Boolean(transport)), {
      source: transport?.channel ?? "app-inbox-owner",
      kind: transport ? "job" : "call",
      projectId: app.id,
      requestId: transport
        ? appInboxHumanRequestId(requests[0]!.id)
        : `app-inbox:${requests.map((request) => request.id).join(",")}`,
      conversationId: transport?.conversationId,
      channelMessageId: transport?.channelMessageId,
      recoveryOwner: APP_INBOX_RECOVERY_OWNER,
      requireFinish: true,
      outputSchema: appOwnerBatchResultSchema,
      toolPolicy: transport ? "app-owner-deputy" : "app-owner-full",
    });
    try {
      onSessionStarted(sessionId);
    } catch (error) {
      manager.cancel(sessionId);
      throw error;
    }
    const result = await manager.waitFor(sessionId);
    if (result.status !== "done") {
      throw new Error(
        result.error ?? result.lastAssistantText ?? `App owner session ${sessionId} ended with ${result.status}`,
      );
    }
    return admittedBatch(result.structuredResult);
  };
}
