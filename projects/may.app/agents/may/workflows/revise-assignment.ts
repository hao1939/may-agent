import { Type, type Static } from "@may-agent/sdk";
import type { AppWorkflowContext } from "@may-agent/sdk/app";

export const name = "revise-assignment";
export const description =
  "Revise saved requirements of an existing delegated Task through the Host creator capability. Input: {prompt,data:{appId, taskId, expectedGeneration, input:{kind,data}}}. Read the exact current assignment first and supply its complete corrected ordinary input, preserving scope, progress, caller and consumed allowance. This replaces requirements; it neither creates work nor grants authority. A message to an existing Task is only feedback and cannot replace this revision. Returns the saved Task; stale generation and unauthorized creator are rejected by the Host.";
const dataSchema = Type.Object({
  appId: Type.String({ minLength: 1 }),
  taskId: Type.String({ minLength: 1 }),
  expectedGeneration: Type.Integer({ minimum: 1 }),
  input: Type.Object({
    kind: Type.String({ minLength: 1 }),
    data: Type.Record(Type.String(), Type.Unknown()),
  }, { additionalProperties: false }),
}, { additionalProperties: false });
export const inputSchema = Type.Object({
  prompt: Type.String({ minLength: 1 }),
  data: dataSchema,
}, { additionalProperties: false });

export async function execute(ctx: AppWorkflowContext<Static<typeof inputSchema>>) {
  if (!ctx.reviseTask) return ctx.blocked("Creator-authorized Task revision is unavailable");
  const task = await ctx.reviseTask(ctx.input.data);
  return ctx.done("Saved corrected assignment on the same Task", task);
}
