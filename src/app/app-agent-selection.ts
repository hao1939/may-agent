import type { AppDefinition, AppTaskAttachment, TaskIntent, TSchema } from "@may-agent/sdk";

export type HostAppDefinition<TInputSchema extends TSchema = TSchema> = Omit<
  AppDefinition<TInputSchema>,
  "agent" | "owner"
> & {
  /** Canonical public name. */
  agent: string;
  /** Private compatibility alias used by retained Host execution state. */
  owner: string;
};

function optionalName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function selectedAgent(
  value: { agent?: unknown; owner?: unknown },
  label: string,
  required: boolean,
): string | undefined {
  if (value.agent !== undefined && !optionalName(value.agent)) {
    throw new Error(`${label} agent must be a non-empty string when present`);
  }
  if (value.owner !== undefined && !optionalName(value.owner)) {
    throw new Error(`${label} legacy owner must be a non-empty string when present`);
  }
  const agent = optionalName(value.agent);
  const owner = optionalName(value.owner);
  if (agent && owner && agent !== owner) {
    throw new Error(`${label} declares conflicting agent and legacy owner values`);
  }
  const selected = agent ?? owner;
  if (required && !selected) throw new Error(`${label} agent must be a non-empty string`);
  return selected;
}

/** Translate public Task intent to retained Host storage vocabulary. */
export function normalizeTaskAgent(intent: TaskIntent, label = `Task ${intent.id}`): TaskIntent {
  const owner = selectedAgent(intent, label, false);
  const normalized = { ...intent };
  delete normalized.agent;
  if (owner) normalized.owner = owner;
  else delete normalized.owner;
  return normalized;
}

function normalizeAttachment(attachment: AppTaskAttachment, appId: string): AppTaskAttachment {
  if (attachment.kind === "existing") return attachment;
  return { ...attachment, intent: normalizeTaskAgent(attachment.intent, `App ${appId} Task ${attachment.intent.id}`) };
}

/** Normalize one loaded App once; Runtime keeps its retained `owner` alias private. */
export function normalizeAppAgent<TInputSchema extends TSchema>(
  definition: AppDefinition<TInputSchema>,
): HostAppDefinition<TInputSchema> {
  const agent = selectedAgent(definition, `App ${definition.id}`, true)!;
  return {
    ...definition,
    agent,
    owner: agent,
    ...(definition.task ? { task: (input) => normalizeAttachment(definition.task!(input), definition.id) } : {}),
    ...(definition.tasks
      ? {
          tasks: {
            ...definition.tasks,
            ...(definition.tasks.resolve
              ? {
                  resolve: (event) => {
                    const intent = definition.tasks!.resolve!(event);
                    return intent ? normalizeTaskAgent(intent, `App ${definition.id} Task ${intent.id}`) : null;
                  },
                }
              : {}),
          },
        }
      : {}),
  } as HostAppDefinition<TInputSchema>;
}
