import { Type } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { TaskListOptions, TaskPage, TaskView } from "@may-agent/sdk";
import type { EventBus } from "./event-bus.js";

const parameters = Type.Object(
  {
    action: Type.Union([Type.Literal("list"), Type.Literal("get")]),
    taskId: Type.Optional(Type.String({ minLength: 1 })),
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
  },
  { additionalProperties: false },
);

type Params = {
  action: "list" | "get";
  taskId?: string;
  status?: TaskView["status"][];
  limit?: number;
  cursor?: string;
};

function result(value: unknown): AgentToolResult<undefined> {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], details: undefined };
}

/** Read-only Task collection scoped by the currently running App attempt. */
export function createAppTaskReadTool(options: {
  bus: EventBus;
  appId: () => string | undefined;
  reader?: {
    list(input: { bus: EventBus; appId: string; options?: TaskListOptions }): TaskPage | Promise<TaskPage>;
    get(input: { bus: EventBus; appId: string; taskId: string }): TaskView | null | Promise<TaskView | null>;
  };
}): AgentTool {
  return {
    name: "tasks",
    label: "Tasks",
    description: "List or get Tasks owned by the current App. This tool is read-only and cannot select another App.",
    parameters,
    execute: async (_toolCallId: string, raw: unknown): Promise<AgentToolResult<undefined>> => {
      const params = raw as Params;
      const appId = options.appId()?.trim();
      if (!appId) return result({ error: "No current App Task scope" });
      try {
        if (params.action === "get") {
          const taskId = params.taskId?.trim();
          if (!taskId) return result({ error: "taskId is required for get" });
          const reader = options.reader ?? (await import("./app-task-runtime.js"));
          const value =
            "get" in reader
              ? await reader.get({ bus: options.bus, appId, taskId })
              : await reader.getLoadedAppTaskView({ bus: options.bus, appId, taskId });
          return result(value);
        }
        const listOptions: TaskListOptions = {
          ...(params.status ? { status: params.status } : {}),
          ...(params.limit === undefined ? {} : { limit: params.limit }),
          ...(params.cursor ? { cursor: params.cursor } : {}),
        };
        const reader = options.reader ?? (await import("./app-task-runtime.js"));
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
