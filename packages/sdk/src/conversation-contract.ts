import { Type } from "typebox";

export type AppConversationRequest = {
  id: string;
  revision: number;
  scope: string;
  status: "open" | "closed";
  topicId?: string;
  /** Relevant Task identities; references alone do not assign work or subscribe to results. */
  taskRefs: Array<{ appId: string; taskId: string }>;
  closure?: { disposition: "fulfilled" | "withdrawn" | "unfulfilled"; reason: string; messageId: string };
};

/** App judgment; expectedRevision=0 accepts a new ask. Closing cannot silently change scope. */
export type AppConversationRequestUpdate = {
  id: string;
  expectedRevision: number;
  /** Inputs establishing or refining this intention. Required for an unlinked Request in a mixed batch. */
  inputIds?: string[];
  /** Required for a new ask. Omit to retain an existing Request's exact scope. */
  scope?: string;
  disposition: "open" | "fulfilled" | "withdrawn" | "unfulfilled";
  /**
   * Required for closure; optional for open updates in live and final Task changes.
   * Legacy Conversation final results require it for every update.
   */
  reason?: string;
  /** Add relevant Task references; omitted/empty lists retain earlier references. At most 32 distinct references. */
  taskRefs?: Array<{ appId: string; taskId: string }>;
};

export const MAX_CONVERSATION_REQUESTS_PER_TURN = 8;

export const conversationRequestUpdatesSchema = Type.Array(
  Type.Object(
    {
      id: Type.String({ minLength: 1, maxLength: 200 }),
      inputIds: Type.Optional(
        Type.Array(Type.String({ minLength: 1 }), {
          minItems: 1,
          maxItems: 96,
          uniqueItems: true,
          description:
            "Input IDs establishing or refining this ask; omit for a single input or unchanged associations, and set explicitly for a new Request in a mixed batch.",
        }),
      ),
      expectedRevision: Type.Integer({
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER - 1,
        description: "Observed Request revision, or 0 for a new ask.",
      }),
      scope: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 2000,
          description: "Complete accepted ask on creation or revision; omit when unchanged or closing.",
        }),
      ),
      disposition: Type.Union([
        Type.Literal("open"),
        Type.Literal("fulfilled"),
        Type.Literal("withdrawn"),
        Type.Literal("unfulfilled"),
      ]),
      reason: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 2000,
          pattern: "\\S",
          description:
            "Required when closing (fulfilled, withdrawn, or unfulfilled) alongside a human-facing explanation; optional context when open.",
        }),
      ),
      taskRefs: Type.Optional(
        Type.Array(
          Type.Object(
            { appId: Type.String({ minLength: 1 }), taskId: Type.String({ minLength: 1 }) },
            { additionalProperties: false },
          ),
          {
            maxItems: 32,
            description: "Relevant Task references to add (omitted/empty retains existing; max 32 distinct).",
          },
        ),
      ),
    },
    { additionalProperties: false },
  ),
  {
    maxItems: MAX_CONVERSATION_REQUESTS_PER_TURN,
    description:
      "Accept, revise, link or close human promises. Omit unchanged scope after creation, and close only with an explanatory response.",
  },
);

/** Scoped reads; input admission supplies the Conversation identity. */
export type TaskCommunicationQuery =
  | { action: "find"; query: string; limit?: number }
  | { action: "read"; topicId: string }
  | { action: "request"; id: string }
  | { action: "requests"; afterId?: string };
