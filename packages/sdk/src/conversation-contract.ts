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
            "Current input IDs establishing or refining this same intention. Several inputs may belong to one Request. Omit for a single input or to retain this turn's existing Request associations; choose explicitly for a new Request in a mixed batch.",
        }),
      ),
      expectedRevision: Type.Integer({
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER - 1,
        description:
          "Observed Request revision, or 0 for a new ask. Use the revision from a scoped read or accepted update receipt; reread after a conflict.",
      }),
      scope: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 2000,
          description:
            "Complete accepted ask for creation or authorized revision. Omit to retain existing scope. Closing cannot change the scope.",
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
            "Required to close a Request; explain fulfillment, withdrawal or the unfulfilled outcome. Optional for an open Request in live and final Task changes; use it for useful context about remaining work. Closure also needs an accepted explanation to the human. A reply about another Request is not its explanation.",
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
            description:
              "Record relevant Task references without assigning work or subscribing to results. A handoff naming this Request in followUp.requestId adds its Task automatically. Empty or omitted lists retain existing references; at most 32 distinct references in total.",
          },
        ),
      ),
    },
    { additionalProperties: false },
  ),
  {
    maxItems: MAX_CONVERSATION_REQUESTS_PER_TURN,
    description:
      "Accept, revise, link or close conversational promises to the human. Routine automated handling belongs in turn/Task evidence; an automated result can advance an existing human promise. A simple ask may be accepted and fulfilled in one answer. After saving a Request, retain its returned revision and omit unchanged scope. Read omitted/truncated Requests before changing them. Close only with an explanatory response and a fulfillment, withdrawal or unfulfilled disposition; Task completion alone is not Request closure.",
  },
);

/** Scoped reads; input admission supplies the Conversation identity. */
export type TaskCommunicationQuery =
  | { action: "find"; query: string; limit?: number }
  | { action: "read"; topicId: string }
  | { action: "request"; id: string }
  | { action: "requests"; afterId?: string };
