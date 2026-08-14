import { Type, defineApp } from "@may-agent/sdk";

const messageInputSchema = Type.Object(
  {
    kind: Type.Literal("message"),
    data: Type.Object(
      {
        message: Type.String({ minLength: 1 }),
        context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export default defineApp({
  id: "may",
  version: 1,
  owner: "may",
  description:
    "Conversation App for one durable human request at a time; answers directly or delegates domain work to another App.",
  inputSchema: messageInputSchema,
  inbox: { batch: "single" },
});
