import { Type } from "@earendil-works/pi-ai";
import { Check, Errors } from "typebox/value";

const text = Type.String({ minLength: 1, maxLength: 4_000 });
const reference = Type.String({ minLength: 1, maxLength: 800 });

export const directHumanReplySchema = Type.Object(
  {
    response: text,
    commitment: Type.Union([
      Type.Object({ kind: Type.Literal("none") }, { additionalProperties: false }),
      Type.Object(
        {
          kind: Type.Literal("routing"),
          intendedOwner: reference,
          acceptanceNeeded: reference,
        },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          kind: Type.Literal("owned"),
          owner: reference,
          workRef: reference,
          terminalProof: reference,
          completionWake: reference,
          reviewCheckpoint: reference,
        },
        { additionalProperties: false },
      ),
    ]),
  },
  { additionalProperties: false },
);

export type DirectHumanReply =
  | { response: string; commitment: { kind: "none" } }
  | {
      response: string;
      commitment: {
        kind: "routing";
        intendedOwner: string;
        acceptanceNeeded: string;
      };
    }
  | {
      response: string;
      commitment: {
        kind: "owned";
        owner: string;
        workRef: string;
        terminalProof: string;
        completionWake: string;
        reviewCheckpoint: string;
      };
    };

export type DirectHumanReplyAdmission =
  | { ok: true; reply: DirectHumanReply }
  | { ok: false; error: string };

export function admitDirectHumanReply(value: unknown): DirectHumanReplyAdmission {
  if (!Check(directHumanReplySchema, value)) {
    const first = [...Errors(directHumanReplySchema, value)][0];
    return {
      ok: false,
      error: `direct reply schema rejected ${first?.instancePath || "reply"}: ${first?.message ?? "invalid value"}`,
    };
  }
  return { ok: true, reply: structuredClone(value) as DirectHumanReply };
}

export const DIRECT_HUMAN_REPLY_INSTRUCTIONS = [
  "Finish a direct human turn with one structured reply.",
  'Use commitment kind "none" only when the response answers now and promises no later result.',
  'Use commitment kind "routing" while durable ownership is still being accepted. State only that routing is pending; do not promise a later result. The acceptance requirement names an accepted work reference, terminal proof, completion wake, and bounded review checkpoint.',
  'Use commitment kind "owned" before promising a later result. Name the accepted owner, durable work reference, terminal proof, completion wake, and bounded review checkpoint.',
  "A started worker, owner claim, or progress event is not terminal proof.",
].join("\n");
