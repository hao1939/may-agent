import type { AppDefinition, AppTaskAttachment, TSchema, TaskIntent } from "@may-agent/sdk";

export type HostAppDefinition<TInputSchema extends TSchema = TSchema> = AppDefinition<TInputSchema>;

function optionalName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Validate current Task authoring without accepting retired aliases. */
export function normalizeTaskAgent(intent: TaskIntent, label = `Task ${intent.id}`): TaskIntent {
  if ("owner" in intent) throw new Error(`${label} owner is retired; use agent`);
  if (intent.agent !== undefined && !optionalName(intent.agent))
    throw new Error(`${label} agent must be a non-empty string when present`);
  return { ...intent, ...(intent.agent !== undefined ? { agent: intent.agent.trim() } : {}) };
}

function normalizeAttachment(attachment: AppTaskAttachment, appId: string): AppTaskAttachment {
  if (attachment.kind === "existing") return attachment;
  return { ...attachment, intent: normalizeTaskAgent(attachment.intent, `App ${appId} Task ${attachment.intent.id}`) };
}

/** Validate the loaded App and normalize its Task authoring. */
export function normalizeAppAgent<TInputSchema extends TSchema>(
  definition: AppDefinition<TInputSchema>,
): HostAppDefinition<TInputSchema> {
  if ("owner" in definition) throw new Error(`App ${definition.id} owner is retired; use agent`);
  const agent = optionalName(definition.agent);
  if (!agent) throw new Error(`App ${definition.id} agent must be a non-empty string`);
  return {
    ...definition,
    agent,
    ...(definition.task ? { task: (input) => normalizeAttachment(definition.task!(input), definition.id) } : {}),
  } as HostAppDefinition<TInputSchema>;
}
