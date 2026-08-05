import { Type } from "@earendil-works/pi-ai";
import { Check, Errors } from "typebox/value";

const text = Type.String({ minLength: 1, maxLength: 4_000 });
const reference = Type.String({ minLength: 1, maxLength: 800 });
const evidence = Type.Array(Type.String({ minLength: 1, maxLength: 1_200 }), { maxItems: 20 });

const immediateMayTurn = (disposition: "answer" | "clarify" | "reject") =>
  Type.Object(
    {
      disposition: Type.Literal(disposition),
      response: text,
    },
    { additionalProperties: false },
  );

export const mayTurnDecisionSchema = Type.Union([
  immediateMayTurn("answer"),
  immediateMayTurn("clarify"),
  immediateMayTurn("reject"),
  Type.Object(
    {
      disposition: Type.Literal("route"),
      response: text,
      project: reference,
      outcome: text,
      requiredProof: text,
      constraints: Type.Optional(evidence),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      disposition: Type.Literal("break-glass"),
      response: text,
      reason: text,
      scope: text,
      terminalProof: text,
      stopCondition: text,
    },
    { additionalProperties: false },
  ),
]);

export type MayTurnDecision =
  | { disposition: "answer" | "clarify" | "reject"; response: string }
  | {
      disposition: "route";
      response: string;
      project: string;
      outcome: string;
      requiredProof: string;
      constraints?: string[];
    }
  | {
      disposition: "break-glass";
      response: string;
      reason: string;
      scope: string;
      terminalProof: string;
      stopCondition: string;
    };

export const mayBreakGlassResultSchema = Type.Union([
  Type.Object(
    {
      disposition: Type.Literal("closed"),
      summary: text,
      evidence,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      disposition: Type.Literal("hand-back"),
      summary: text,
      evidence,
      project: reference,
      outcome: text,
      requiredProof: text,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      disposition: Type.Literal("blocked"),
      summary: text,
      evidence,
      blocker: text,
    },
    { additionalProperties: false },
  ),
]);

export type MayBreakGlassResult =
  | { disposition: "closed"; summary: string; evidence: string[] }
  | {
      disposition: "hand-back";
      summary: string;
      evidence: string[];
      project: string;
      outcome: string;
      requiredProof: string;
    }
  | { disposition: "blocked"; summary: string; evidence: string[]; blocker: string };

type Admission<T> = { ok: true; value: T } | { ok: false; error: string };

function admit<T>(schema: typeof mayTurnDecisionSchema, value: unknown, label: string): Admission<T>;
function admit<T>(schema: typeof mayBreakGlassResultSchema, value: unknown, label: string): Admission<T>;
function admit<T>(schema: any, value: unknown, label: string): Admission<T> {
  if (!Check(schema, value)) {
    const first = [...Errors(schema, value)][0];
    return {
      ok: false,
      error: `${label} rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
    };
  }
  return { ok: true, value: structuredClone(value) as T };
}

export function admitMayTurnDecision(value: unknown): Admission<MayTurnDecision> {
  return admit<MayTurnDecision>(mayTurnDecisionSchema, value, "May turn");
}

export function admitMayBreakGlassResult(value: unknown): Admission<MayBreakGlassResult> {
  return admit<MayBreakGlassResult>(mayBreakGlassResultSchema, value, "May break-glass result");
}

export const MAY_TURN_INSTRUCTIONS = [
  "Handle one human turn and call finish() with the required structured result.",
  "Put the exact plain-language human reply in both finish summary and result.response.",
  "Choose answer, clarify, reject, route, or break-glass.",
  "Route normal durable work to one existing project app. State the outcome and proof; never choose its internal task, owner, workflow, session, or wake mechanism.",
  "For route, tell the human that routing is in progress and app-owner acceptance is pending. Do not claim the owner accepted, started, or will finish the work.",
  "Choose break-glass only when Hao explicitly asked May to take over, the normal path is broken after bounded recovery, urgent harm would result from waiting, or no app owns a bounded outcome.",
  "Convenience, curiosity, healthy owner progress, one ordinary retry, or unclear human intent never justify break glass.",
  "Break glass never grants missing authority or bypasses security, credentials, approval, or irreversible-change constraints.",
].join("\n");
