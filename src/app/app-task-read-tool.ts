import { Type } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type {
  AppInput,
  TaskListOptions,
  TaskChanges,
  TaskAttempt,
  TaskCommunicationQuery,
  TaskOutcomePage,
  TaskOutcomeProjection,
  TaskPage,
  TaskReadOptions,
  TaskView,
} from "@may-agent/sdk";
import type { EventBus } from "./core/events/bus.js";
import { taskChangesSchema, observationCondition, type ObservationInterest } from "@may-agent/sdk";

const parameters = Type.Object(
  {
    action: Type.Union([
      Type.Literal("list"),
      Type.Literal("outcomes"),
      Type.Literal("get"),
      Type.Literal("contract"),
      Type.Literal("publish"),
      Type.Literal("update"),
      Type.Literal("apply"),
      Type.Literal("communication"),
    ]),
    taskId: Type.Optional(
      Type.String({ minLength: 1, description: "Exact Task id; required for get, outcomes and update" }),
    ),
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
    inputKeys: Type.Optional(
      Type.Array(Type.String({ minLength: 1 }), {
        maxItems: 8,
        description:
          "For get: original input events by exact keys from currentObligations.inputWaits. Reading does not settle input.",
      }),
    ),
    observation: Type.Optional(
      Type.Object(
        {
          observerId: Type.String({ minLength: 1 }),
          id: Type.String({ minLength: 1 }),
          resource: Type.String({ minLength: 1 }),
          expected: Type.Record(Type.String(), Type.Unknown()),
          reviewAfterMs: Type.Optional(
            Type.Integer({
              minimum: 60_000,
              description: "Legacy field; use Task reviewAt for deliberate agent reconsideration.",
            }),
          ),
        },
        {
          additionalProperties: false,
          description: "With contract: build a Condition to return in your Task result. Does not start a wait.",
        },
      ),
    ),
    acceptedEvidence: Type.Optional(
      Type.Object(
        {
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 8 })),
          cursor: Type.Optional(Type.String({ minLength: 1 })),
        },
        { additionalProperties: false },
      ),
    ),
    inputId: Type.Optional(Type.String({ minLength: 1 })),
    communicationQuery: Type.Optional(
      Type.Union([
        Type.Object({ action: Type.Literal("request"), id: Type.String({ minLength: 1 }) }),
        Type.Object({ action: Type.Literal("requests"), afterId: Type.Optional(Type.String()) }),
        Type.Object({
          action: Type.Literal("find"),
          query: Type.String(),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
        }),
        Type.Object({ action: Type.Literal("read"), topicId: Type.String({ minLength: 1 }) }),
      ]),
    ),
    changes: Type.Optional(Type.Unsafe<TaskChanges>(taskChangesSchema)),
    expectedGeneration: Type.Optional(Type.Integer({ minimum: 1 })),
    input: Type.Optional(
      Type.Object({ kind: Type.String({ minLength: 1 }), data: Type.Unknown() }, { additionalProperties: false }),
    ),
  },
  { additionalProperties: false },
);

type Params = {
  observation?: ObservationInterest;
  action: "list" | "outcomes" | "get" | "contract" | "publish" | "update" | "apply" | "communication";
  inputId?: string;
  communicationQuery?: TaskCommunicationQuery;
  changes?: TaskChanges;
  expectedGeneration?: number;
  input?: AppInput;
  taskId?: string;
  localKey?: string;
  eventType?: string;
  data?: Record<string, unknown>;
  target?: { appId?: string; taskId?: string };
  status?: TaskView["status"][];
  limit?: number;
  cursor?: string;
  includeDone?: boolean;
  acceptedEvidence?: TaskReadOptions["acceptedEvidence"];
  inputKeys?: string[];
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
    get(input: {
      bus: EventBus;
      appId: string;
      taskId: string;
      options?: TaskReadOptions;
    }): TaskView | null | Promise<TaskView | null>;
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
  /** Resolve the live attempt capability at invocation time; shared tools must not retain one session's scope. */
  communicationReader?: () => TaskAttempt["read"]["communication"];
  applier?: () => ((changes: TaskChanges) => Promise<unknown>) | undefined;
}): AgentTool {
  return {
    name: "tasks",
    label: "Tasks",
    description:
      "List or get Tasks, read an App input contract, publish facts, update an assignment you created, or apply typed changes. apply takes changes {requests?, conditions?, actions?, communication?, inputKeys?, facts?}, uses the same admission as final results, returns saved receipts, and keeps this attempt running. Use it to request review and continue testing. communication changes publish or update accepted asks through inputId from the saved inputs, without transport details. Use action communication with inputId for current discussion context; optional communicationQuery reads an exact Request, pages Requests or reads/finds Topics. A Condition {requestId} can refer to a request in this call or one already admitted in this caller generation. contract returns the App owner agent, full installed input schema and observation capabilities for target.appId (default: current App). Supply observation {observerId,id,resource,expected} to build a Condition; return it in your Task result to retain the interest. Infra recovers missed facts without invoking the agent. Use Task reviewAt only when deliberate reconsideration is useful. No registration or taskId is needed. Exact apps.list reads expose live observer health; last changed fact is not a heartbeat. Before reusing or revising work, read the exact Task and compare outcome, acceptance, input and execution method; a matching topic alone is insufficient. For update, supply the observed expectedGeneration and complete revised input, preserving required references. Code checks creator authority, saves requirements and wakes the worker. Return proposed changes to your own assignment to its creator. target.appId selects another responsible App; the operation is the same.",
    parameters,
    execute: async (_toolCallId: string, raw: unknown): Promise<AgentToolResult<undefined>> => {
      const params = raw as Params;
      const scope = options.scope?.();
      const appId = (scope?.appId ?? options.appId?.())?.trim();
      if (!appId) return result({ error: "No current App Task scope" });
      try {
        if (params.action === "contract") {
          const contract = (await import("./core/tasks/app-task-runtime.js")).getLoadedAppInputContract({
            bus: options.bus,
            appId: params.target?.appId?.trim() || appId,
          });
          if (!params.observation) return result(contract);
          const capability = contract.observations.find((item) => item.id === params.observation!.observerId);
          if (!capability)
            throw new Error(`App ${contract.appId} has no installed observer ${params.observation.observerId}`);
          return result({ ...contract, condition: observationCondition(capability, params.observation) });
        }
        if (params.action === "communication") {
          if (!scope?.taskId || !scope.attemptId || !params.inputId)
            throw new Error("communication requires a current Task attempt and inputId");
          const read = options.communicationReader?.();
          if (!read) throw new Error("Current Task communication reader is unavailable");
          return result(await read(params.inputId, params.communicationQuery));
        }
        if (params.action === "apply") {
          if (!scope?.taskId || !scope.generation || !scope.attemptId)
            return result({ error: "No current fenced Task attempt" });
          if (!params.changes) return result({ error: "apply requires changes" });
          const apply = options.applier?.();
          if (!apply) return result({ error: "Current Task apply capability is unavailable" });
          return result(await apply(params.changes));
        }
        if (params.action === "update") {
          if (!scope?.taskId || !scope.generation || !scope.attemptId)
            return result({ error: "No current fenced Task attempt" });
          if (!params.taskId || !params.expectedGeneration || !params.input)
            return result({ error: "update requires taskId, expectedGeneration and the complete App input" });
          return result(
            (await import("./core/tasks/app-task-runtime.js")).reviseLoadedAppTask({
              bus: options.bus,
              binding: { appId, taskId: scope.taskId, generation: scope.generation, attemptId: scope.attemptId },
              change: {
                appId: params.target?.appId?.trim().replace(/\.app$/, "") || appId,
                taskId: params.taskId.trim(),
                expectedGeneration: params.expectedGeneration,
                input: params.input,
              },
            }),
          );
        }
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
          return result(value);
        }
        if (params.action === "get") {
          const taskId = params.taskId?.trim();
          if (!taskId) return result({ error: "taskId is required for get" });
          const readAppId = params.target?.appId?.trim() || appId;
          const readOptions = {
            ...(params.acceptedEvidence ? { acceptedEvidence: params.acceptedEvidence } : {}),
            ...(params.inputKeys ? { inputKeys: params.inputKeys } : {}),
          };
          const reader = options.reader ?? (await import("./core/tasks/app-task-runtime.js"));
          const value =
            "get" in reader
              ? await reader.get({
                  bus: options.bus,
                  appId: readAppId,
                  taskId,
                  ...(Object.keys(readOptions).length ? { options: readOptions } : {}),
                })
              : await reader.getLoadedAppTaskView({
                  bus: options.bus,
                  appId: readAppId,
                  taskId,
                  ...(Object.keys(readOptions).length ? { options: readOptions } : {}),
                });
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
