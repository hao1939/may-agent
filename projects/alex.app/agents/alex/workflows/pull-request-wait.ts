import { Type, type Static } from "@may-agent/sdk";
import { observationCondition, type AppWorkflowContext } from "@may-agent/sdk/app";

export const name = "pull-request-wait";
export const description =
  "Build a GitHub PR feedback Condition from Alex's installed github-pull-request observer. Input: {id,repository,number,fingerprint:null|observedSHA256}. Returns {condition}; save it in the owning Task result's conditions while waiting. Null requests an initial snapshot; rearm with the actual observed fingerprint after judgment. Does not register a wait, poll GitHub or judge readiness.";
export const inputSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  repository: Type.String({ pattern: "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$" }),
  number: Type.Integer({ minimum: 1 }),
  fingerprint: Type.Union([Type.Null(), Type.String({ pattern: "^[0-9a-f]{64}$" })]),
}, { additionalProperties: false });

export async function execute(ctx: AppWorkflowContext<Static<typeof inputSchema>>) {
  const contract = await ctx.read.contract("alex");
  const capability = contract.observations.find(x => x.id === "github-pull-request" && x.appId === "alex");
  if (!capability) return ctx.blocked("Alex GitHub pull-request observation is unavailable");
  const {id, repository, number, fingerprint} = ctx.input;
  const condition = observationCondition(capability, {
    id, observerId: capability.id, resource: `github:${repository}#${number}`,
    expected: {field: "fingerprint", notEquals: fingerprint},
  });
  return ctx.done("Return this Condition with the owning Task's external wait", {condition});
}
