import type { AppDependencyObservation } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";
import { readRuntimeExecutionView } from "./app-read.js";
import type { AppTaskAttacher } from "./app-inbox-host.js";
import type { EventBus } from "./event-bus.js";
import {
  attachLoadedProjectAppTask,
  readLoadedProjectAppTaskView,
  runWithProjectAppRuntimeCapacity,
} from "./loader/project-app-loader.js";

export type AppTaskCapability = {
  runOwner<T>(work: () => Promise<T>): Promise<T>;
  attach(input: Parameters<AppTaskAttacher>[0] & { appDir: string }): ReturnType<AppTaskAttacher>;
  readDependency(input: {
    appDir: string;
    dependency: { kind: "task" | "session"; id: string };
  }): Promise<AppDependencyObservation | null>;
};

/**
 * Host-private boundary around the existing task-resource engine.
 *
 * The canonical App host depends on this capability, never on Project App
 * loader/storage/controller details. The implementation can therefore be
 * extracted and renamed without changing inbox ownership semantics.
 */
export function createAppTaskCapability(options: { bus: EventBus; getDb: () => SqliteDb }): AppTaskCapability {
  return {
    runOwner: (work) => runWithProjectAppRuntimeCapacity(options.bus, work),
    attach: async (input) => attachLoadedProjectAppTask({ ...input, bus: options.bus }),
    async readDependency({ appDir, dependency }) {
      if (dependency.kind === "task") {
        const task = readLoadedProjectAppTaskView({ bus: options.bus, appDir, taskId: dependency.id });
        return task
          ? {
              kind: "task",
              id: task.id,
              status: task.status,
              summary: task.summary,
              evidence: task.evidence,
            }
          : null;
      }
      const execution = readRuntimeExecutionView({ getDb: options.getDb }, dependency.id);
      return execution
        ? {
            kind: "session",
            id: execution.id,
            status: execution.status === "blocked" ? "waiting" : execution.status,
            summary: execution.summary,
          }
        : null;
    },
  };
}
