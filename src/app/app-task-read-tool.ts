import { Type } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { TaskListOptions, TaskOutcomePage, TaskOutcomeProjection, TaskPage, TaskView } from "@may-agent/sdk";
import type { EventBus } from "./core/events/bus.js";

const parameters = Type.Object(
  {
    action: Type.Union([Type.Literal("list"), Type.Literal("outcomes"), Type.Literal("get"), Type.Literal("publish")]),
    taskId: Type.Optional(Type.String({ minLength: 1, description: "Exact Task id; required for get and outcomes" })),
    localKey: Type.Optional(Type.String({ minLength: 1, maxLength: 256 })),
    eventType: Type.Optional(Type.String({ minLength: 3 })),
    data: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    target: Type.Optional(
      Type.Object(
        {
          appId: Type.Optional(Type.String({ minLength: 1 })),
          taskId: Type.Optional(Type.String({ minLength: 1 })),
        },
        { additionalProperties: false },
      ),
    ),
    status: Type.Optional(
      Type.Array(
        Type.Union([
          Type.Literal("pending"),
          Type.Literal("running"),
          Type.Literal("waiting"),
          Type.Literal("attention"),
          Type.Literal("done"),
        ]),
      ),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    cursor: Type.Optional(Type.String({ minLength: 1 })),
    includeDone: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

type Params = {
  action: "list" | "outcomes" | "get" | "publish";
  taskId?: string;
  localKey?: string;
  eventType?: string;
  data?: Record<string, unknown>;
  target?: { appId?: string; taskId?: string };
  status?: TaskView["status"][];
  limit?: number;
  cursor?: string;
  includeDone?: boolean;
};

function result(value: unknown): AgentToolResult<undefined> {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], details: undefined };
}

/** Task collection and fenced event capability scoped to the running App attempt. */
export function createAppTaskReadTool(options: {
  bus: EventBus;
  appId?: () => string | undefined;
  scope?: () => { appId: string; taskId?: string; generation?: number; attemptId?: string } | undefined;
  reader?: {
    list(input: { bus: EventBus; appId: string; options?: TaskListOptions }): TaskPage | Promise<TaskPage>;
    outcomes?(input: {
      bus: EventBus;
      appId: string;
      projection?: TaskOutcomeProjection;
    }): TaskOutcomePage | Promise<TaskOutcomePage>;
    get(input: { bus: EventBus; appId: string; taskId: string }): TaskView | null | Promise<TaskView | null>;
  };
  publisher?: {
    publish(input: {
      bus: EventBus;
      binding: { appId: string; taskId: string; generation: number; attemptId: string };
      localKey: string;
      event: {
        type: string;
        data?: Record<string, unknown>;
        target?: { appId?: string; taskId?: string };
      };
    }): number | Promise<number>;
  };
}): AgentTool {
  return {
    name: "tasks",
    label: "Tasks",
    description:
      "List Tasks owned by the current App, get one exact Task (optionally in target.appId), read the outcome containing an owned task, or publish a fenced fact from the current Task attempt. Publishing never mutates Task state.",
    parameters,
    execute: async (_toolCallId: string, raw: unknown): Promise<AgentToolResult<undefined>> => {
      const params = raw as Params;
      const scope = options.scope?.();
      const appId = (scope?.appId ?? options.appId?.())?.trim();
      if (!appId) return result({ error: "No current App Task scope" });
      try {
        if (params.action === "publish") {
          const taskId = scope?.taskId?.trim();
          const localKey = params.localKey?.trim();
          const eventType = params.eventType?.trim();
          if (!taskId || !scope?.generation || !scope.attemptId) {
            return result({ error: "No current fenced Task attempt" });
          }
          if (!localKey) return result({ error: "localKey is required for publish" });
          if (!eventType?.includes(".")) return result({ error: "eventType must be dot-separated" });
          const publishInput = {
            bus: options.bus,
            binding: { appId, taskId, generation: scope.generation, attemptId: scope.attemptId },
            localKey,
            event: {
              type: eventType,
              ...(params.data ? { data: params.data } : {}),
              ...(params.target ? { target: params.target } : {}),
            },
          };
          const eventId = options.publisher
            ? await options.publisher.publish(publishInput)
            : (await import("./core/tasks/app-task-runtime.js")).publishLoadedAppTaskEvent(publishInput);
          return result({ eventId, type: eventType });
        }
        const requestedAppId = params.target?.appId?.trim().replace(/\.app$/, "");
        if (params.action !== "get" && requestedAppId && requestedAppId !== appId.replace(/\.app$/, "")) {
          return result({
            error:
              "list and outcomes are scoped to the current App; use get with target.appId for an exact cross-App Task",
          });
        }
        if (params.action === "outcomes") {
          const taskId = params.taskId?.trim();
          if (!taskId) return result({ error: "taskId is required for outcomes; use list for bounded discovery" });
          const projection: TaskOutcomeProjection = {
            taskId,
            ...(params.includeDone === undefined ? {} : { includeDone: params.includeDone }),
          };
          const value = options.reader?.outcomes
            ? await options.reader.outcomes({ bus: options.bus, appId, projection })
            : await (
                await import("./core/tasks/app-task-runtime.js")
              ).listLoadedAppTaskOutcomeViews({
                bus: options.bus,
                appId,
                projection,
              });
          const outcomes = value.outcomes.filter((outcome) => outcome.memberTaskIds.includes(taskId));
          return result({
            ...value,
            sourceCount: outcomes.reduce((count, outcome) => count + outcome.memberCount, 0),
            outcomeCount: outcomes.length,
            outcomes,
          });
        }
        if (params.action === "get") {
          const taskId = params.taskId?.trim();
          if (!taskId) return result({ error: "taskId is required for get" });
          const readAppId = params.target?.appId?.trim() || appId;
          const reader = options.reader ?? (await import("./core/tasks/app-task-runtime.js"));
          const value =
            "get" in reader
              ? await reader.get({ bus: options.bus, appId: readAppId, taskId })
              : await reader.getLoadedAppTaskView({ bus: options.bus, appId: readAppId, taskId });
          return result(value);
        }
        const listOptions: TaskListOptions = {
          ...(params.status ? { status: params.status } : {}),
          ...(params.limit === undefined ? {} : { limit: params.limit }),
          ...(params.cursor ? { cursor: params.cursor } : {}),
        };
        const reader = options.reader ?? (await import("./core/tasks/app-task-runtime.js"));
        const value =
          "list" in reader
            ? await reader.list({ bus: options.bus, appId, options: listOptions })
            : await reader.listLoadedAppTaskViews({ bus: options.bus, appId, options: listOptions });
        return result(value);
      } catch (error) {
        return result({ error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
