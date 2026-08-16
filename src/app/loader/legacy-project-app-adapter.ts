import type { AppDefinition, AppEvent, AppInput, EventSelector, TaskAction, TaskIntent } from "@may-agent/sdk";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function canonicalEvent(value: unknown): AppEvent<Record<string, unknown>> {
  const event = record(value);
  if (!event || typeof event.type !== "string" || !event.type.trim()) {
    throw new Error("Legacy ProjectApp emitted an event without a non-empty type");
  }
  return { ...event, data: record(event.data) ?? {} } as AppEvent<Record<string, unknown>>;
}

function legacyInput(kind: string, data: Record<string, unknown>): AppInput {
  return { kind, data };
}

/**
 * Normalize the retired ProjectApp declaration only at the immutable host
 * boundary. This lets a staged Runtime load an older App package while its
 * canonical source migration is integrated, without weakening validation for
 * declarations that already provide inputSchema.
 */
export function adaptLegacyProjectApp(definition: unknown): AppDefinition | null {
  const legacy = record(definition);
  if (!legacy || record(legacy.inputSchema)) return null;
  if (!Array.isArray(legacy.events) && !record(legacy.tasks) && !Array.isArray(legacy.schedules)) return null;
  if (typeof legacy.id !== "string" || typeof legacy.owner !== "string" || legacy.version !== 1) return null;

  const schedules = Array.isArray(legacy.schedules)
    ? legacy.schedules.flatMap((value, scheduleIndex) => {
        const schedule = record(value);
        if (!schedule || !Array.isArray(schedule.emits)) return [];
        return schedule.emits.map((event, eventIndex) => {
          const canonical = canonicalEvent(event);
          return {
            id: `${String(schedule.id || `legacy-schedule-${scheduleIndex}`)}:${eventIndex + 1}`,
            enabled: schedule.enabled !== false,
            intervalMs: Number(schedule.intervalMs),
            event: canonical,
            // Keep the legacy projection during staged host transitions. A
            // previous Runtime may validate the newly prepared App set before
            // the staged Runtime takes over; dropping `emits` made that strict
            // validator observe an empty schedule even though source declared
            // an event. Canonical scheduling continues to use `event`.
            emits: [canonical],
          };
        });
      })
    : [];

  const actions = record(legacy.actions);
  const canonicalActions = actions
    ? Object.fromEntries(
        Object.entries(actions).map(([id, value]) => {
          const action = record(value);
          if (!action || typeof action.event !== "function") {
            throw new Error(`Legacy ProjectApp action ${id} requires event`);
          }
          return [
            id,
            {
              description: String(action.description || id),
              inputSchema: record(action.inputSchema) ?? {},
              toInput: (params: unknown) =>
                legacyInput("legacy-action", {
                  actionId: id,
                  event: canonicalEvent((action.event as (input: unknown) => unknown)(params)),
                }),
            },
          ];
        }),
      )
    : undefined;

  const tasks = record(legacy.tasks);
  const taskSubscriptions = tasks && Array.isArray(tasks.accepts) ? (tasks.accepts as EventSelector[]) : [];
  const taskResolver = tasks?.resolve;
  const taskValidator = tasks?.validateAction;
  const maxConcurrent = record(legacy.budget)?.maxConcurrent;

  return {
    id: legacy.id,
    version: 1,
    owner: legacy.owner,
    ...(typeof legacy.description === "string" ? { description: legacy.description } : {}),
    inputSchema: {
      type: "object",
      required: ["kind", "data"],
      properties: { kind: { type: "string", minLength: 1 }, data: { type: "object" } },
      additionalProperties: false,
    },
    observations: Array.isArray(legacy.events) ? (legacy.events as EventSelector[]) : undefined,
    schedules,
    actions: canonicalActions,
    ...(record(legacy.workspace) ? { workspace: record(legacy.workspace) as AppDefinition["workspace"] } : {}),
    tasks: tasks
      ? {
          attach: true,
          subscriptions: taskSubscriptions,
          resolve:
            typeof taskResolver === "function"
              ? (event) => (taskResolver as (event: Record<string, unknown>) => TaskIntent | null)(event)
              : undefined,
          validateAction:
            typeof taskValidator === "function"
              ? (action: TaskAction) => (taskValidator as (action: TaskAction) => string | null)(action)
              : undefined,
          ...(Number.isSafeInteger(maxConcurrent) && Number(maxConcurrent) > 0
            ? { maxConcurrent: Number(maxConcurrent) }
            : {}),
          ...(typeof tasks.resyncIntervalMs === "number" ? { resyncIntervalMs: tasks.resyncIntervalMs } : {}),
        }
      : undefined,
  } as AppDefinition;
}
