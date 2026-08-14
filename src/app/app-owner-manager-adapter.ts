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

export const appDispositionSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal("complete"),
      summary: Type.String({ minLength: 1 }),
      response: Type.Optional(Type.String()),
      evidence: Type.Optional(Type.Array(Type.String())),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal("delegate"),
      appId: Type.String({ minLength: 1 }),
      input: appInputSchema,
      reviewAfterMs: Type.Optional(Type.Number({ minimum: 0 })),
    },
    { additionalProperties: false },
  ),
  Type.Object(
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
      : ["This App cannot attach tasks. Return complete or delegate; never return a task disposition."]),
    "If a request has dependency, it is the current read-only observation of the exact child, task, or recovered Runtime session that woke this request. Review that observation instead of querying runtime storage.",
    "Use bounded agent or workflow calls only when you can review their result in this attempt. Durable asynchronous ownership must be returned as a delegate or task disposition.",
    "Do not invent lifecycle states, mutate inbox storage, or omit a request. Preserve each requestId exactly.",
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
