import { defineApp, Type } from "@may-agent/sdk";
import { join } from "node:path";
import { DbWriter } from "../../../src/lib/db-writer.js";
import { closeAllDbs } from "../../../src/lib/requests.js";
import { EventBus, EVENT_ROW_ID, type AgentEvent } from "../../../src/app/core/events/bus.js";
import { HostCapacity } from "../../../src/app/core/scheduling/host-capacity.js";
import {
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../../../src/app/core/tasks/app-task-runtime.js";

// Real worker publication and settlement, with its IPC relay deliberately held
// until the accepted result is durable. The parent uses the shipped relay.
const [root, taskId] = process.argv.slice(2);
if (!root || !taskId) throw new Error("Expected fixture root and Task id");
const bus = new EventBus();
const writer = new DbWriter(join(root, "state"));
bus.setPersistenceSubscriber(writer.handler);
bus.setDeliveryRecorder(writer.recordDelivery);
const publications: Array<{ kind: "event"; event: AgentEvent; eventId: number }> = [];
bus.subscribe((event) => {
  if (event.type === "sample.observed") {
    publications.push({ kind: "event", event, eventId: Number(event[EVENT_ROW_ID]) });
  }
});
try {
  await installAppTaskRuntimes({
    projectRoot: root,
    projectsRoot: join(root, "projects"),
    persistDir: join(root, "state"),
    hostCapacity: new HostCapacity(1),
    bus,
    installControllers: false,
    executors: {
      publisher: async (attempt) => {
        await attempt.publish("own", {
          type: "sample.observed",
          target: { appId: "sample", taskId },
          data: { revision: 1 },
        });
        await attempt.publish("peer", {
          type: "sample.observed",
          target: { appId: "sample", taskId: "work/peer" },
          data: { revision: 1 },
        });
        return { state: "converged", summary: "Worker settled before relay", facts: ["fixture:published"] };
      },
    },
    appRegistrySnapshot: {
      id: "delayed-publication-worker",
      generation: 1,
      entries: [
        {
          appDir: join(root, "projects", "sample.app"),
          definition: defineApp({
            id: "sample",
            version: 1,
            agent: "sample-owner",
            inputSchema: Type.Object({}, { additionalProperties: true }),
            workspace: { kind: "local", localPath: "." },
            tasks: { subscriptions: ["sample.work"], resolve: () => null },
          }),
        },
      ],
    },
  });
  await reconcileLoadedAppTaskOnce({
    bus,
    appId: "sample",
    taskId,
    dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
  });
  for (const publication of publications) {
    process.send!(publication);
    process.send!(publication); // Repeat the worker relay as well as delaying it.
  }
  await new Promise<void>((resolve, reject) => {
    process.send!({ kind: "result", dependentTaskIds: [] }, (error: Error | null) =>
      error ? reject(error) : resolve(),
    );
  });
} finally {
  await closeInstalledAppTaskRuntimes(bus);
  closeAllDbs();
  if (process.connected) process.disconnect();
}
