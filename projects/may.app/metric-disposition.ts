import { Type, type TaskReconcileResult } from "@may-agent/sdk";
import { Check } from "typebox/value";
import {
  metricReuseScopeSchema,
  readBoundMetricReuseScope,
} from "./metric-decision-reuse.js";

const text = Type.String({ minLength: 1, pattern: "\\S" });
export const metricDecisionSchema = Type.Object(
  {
    metricId: text,
    alertId: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    disposition: Type.Union([
      Type.Literal("observe", {
        description:
          "Legacy disposition; use no-change for passive collection.",
      }),
      Type.Literal("investigate"),
      Type.Literal("no-change"),
      Type.Literal("recovered"),
    ]),
    reason: text,
    evidence: Type.Array(text, { minItems: 1, maxItems: 16 }),
    nextAction: Type.Optional(text),
    reuseScope: Type.Optional(metricReuseScopeSchema),
  },
  { additionalProperties: false },
);

const factSchema = Type.Object(
  {
    ...metricDecisionSchema.properties,
    version: Type.Literal(1),
    // Scope composition adds its evidence basis. The existing reader validates it.
    reuseScope: Type.Optional(Type.Unknown()),
    linkedTask: Type.Optional(
      Type.Object(
        { appId: text, taskId: text },
        { additionalProperties: false },
      ),
    ),
    followThrough: Type.Optional(Type.Literal("task")),
    nextReviewAt: Type.Optional(Type.Integer({ minimum: 1 })), // historical fact spelling; never installs a timer
  },
  { additionalProperties: false },
);

/** App policy for the reserved fact namespace, including direct-agent results.
 * This validates readback and follow-through, not the quality of the judgment
 * or whether a proposed configuration change has been implemented. */
export function validateMetricTaskResult(
  result: Readonly<TaskReconcileResult>,
  context: Readonly<{ appId: string; taskId: string; conversation: boolean }>,
): string | null {
  const seen = new Set<string>();
  for (const fact of result.facts) {
    if (!fact.startsWith("metric-disposition:")) continue;
    const correction = (reason: string) =>
      `Metric decision rejected: ${reason}. Use metric-response with review:{task,decisions} and return its complete output. Keep proposed changes and their implementation status in task.result; do not invent a disposition or infer a reuse scope.`;
    if (Buffer.byteLength(fact) > 4000)
      return correction("fact exceeds 4000 bytes");
    let decision: unknown;
    try {
      decision = JSON.parse(fact.slice("metric-disposition:".length));
    } catch {
      return correction("fact is not JSON");
    }
    if (!Check(factSchema, decision))
      return correction(
        "expected version:1, metricId, explicit alertId (null or positive integer), supported disposition (investigate, observe, no-change, recovered), reason and evidence",
      );
    const key = JSON.stringify([decision.metricId, decision.alertId]);
    if (seen.has(key))
      return correction("return one decision per metric episode");
    seen.add(key);
    if (
      decision.reuseScope !== undefined &&
      !readBoundMetricReuseScope(decision.reuseScope)
    )
      return correction("reuseScope needs its code-bound evidence basis");
    if (["investigate", "observe"].includes(decision.disposition)) {
      if (
        context.conversation ||
        result.state !== "waiting" ||
        !decision.nextAction ||
        decision.followThrough !== "task" ||
        decision.linkedTask?.appId !== context.appId ||
        decision.linkedTask?.taskId !== context.taskId
      )
        return correction(
          "an unresolved decision needs a waiting result, nextAction and this owning Task as follow-through",
        );
    }
  }
  return null;
}
