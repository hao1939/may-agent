import { Type, defineApp, type Static } from "@may-agent/sdk";

export const reviewInputSchema = Type.Object({
  kind: Type.Literal("review"),
  data: Type.Object({
    subject: Type.String({ minLength: 1, description: "The review question and desired outcome." }),
    references: Type.Optional(Type.Array(Type.String({ minLength: 1 }), {
      maxItems: 16,
      description: "Readable source paths or evidence links relevant to this review.",
    })),
  }, { additionalProperties: false }),
}, { additionalProperties: false });

export default defineApp({
  id: "sample",
  version: 1,
  agent: "sample-reviewer",
  description: "Review supplied material and return findings with evidence; a runnable example of ordinary App cooperation.",
  inputSchema: Type.Union([
    reviewInputSchema,
    Type.Object({
      kind: Type.Literal("message"),
      data: Type.Object({ message: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
    }, { additionalProperties: false }),
  ]),
  tasks: {},
  task(request) {
    if (request.input.kind !== "review") {
      throw new Error("Address a message to an existing sample Task; use review to start new work.");
    }
    const input = request.input as Static<typeof reviewInputSchema>;
    return {
      kind: "desired",
      intent: {
        id: `review/${request.id}`,
        parentId: "root",
        outcome: `Review ${input.data.subject}`,
        acceptance: [
          "Answer the review question using the supplied material and distinguish observed facts from uncertainty.",
          "Cite evidence for findings, preserve corrections and outstanding requests, and report actual coverage.",
        ],
        input,
      },
    };
  },
});
