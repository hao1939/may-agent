import type { TaskCommunication } from "@may-agent/sdk";
import { dirname } from "node:path";
import { EventBus } from "../../src/app/core/events/bus.js";
import { createAppTaskEvents } from "../../src/app/core/tasks/app-task-emitter.js";
import { readTaskInputs } from "../../src/app/core/tasks/app-task-inputs.js";
import {
  assertAppTaskClaimCurrent,
  completeAppTask,
  type AppTaskClaim,
} from "../../src/app/core/tasks/app-task-reconciler.js";
import type { AppTaskContext } from "../../src/app/core/tasks/app-task-store.js";
import {
  applyTaskCommunication,
  readTaskCommunicationInput,
  settleTaskCommunicationInputs,
} from "../../src/app/core/tasks/task-communication.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";

export function readCommunicationInputs(config: AppTaskContext, claim: AppTaskClaim) {
  return readTaskInputs(config, claim).map((input) => readTaskCommunicationInput(config, claim, input.id));
}

/** Low-level state tests settle through the same production communication and Task operations. */
export function completeCommunicationTask(
  config: AppTaskContext,
  claim: AppTaskClaim,
  result: {
    summary: string;
    response?: string;
    facts?: string[];
    topic?: TaskCommunication["topic"];
    requestUpdates?: TaskCommunication["requestUpdates"];
  },
  options: Pick<Parameters<typeof completeAppTask>[2], "now" | "acceptanceBasis"> = {},
) {
  return stateTransaction(config.resourceStore.db, () => {
    assertAppTaskClaimCurrent(config, claim);
    const inputs = readCommunicationInputs(config, claim);
    const input = inputs.filter(({ source }) => source.kind === "human").at(-1) ?? inputs.at(-1)!;
    const db = config.resourceStore.db;
    const mainFile = db.prepare("PRAGMA database_list").all().find((row) => row.name === "main")?.file;
    if (typeof mainFile !== "string" || !mainFile) throw new Error("Communication fixture requires file-backed state");
    const persistDir = dirname(mainFile);
    const bus = new EventBus();
    const writer = new DbWriter(persistDir);
    bus.setPersistenceSubscriber(writer.handler);
    const events = createAppTaskEvents({
      bus,
      db,
      persistDir,
      appId: config.resourceStore.appId,
      claim,
      communication: true,
    });
    if (result.response || result.topic || result.requestUpdates?.length)
      applyTaskCommunication(
        config,
        claim,
        [
          {
            id: claim.attemptId,
            inputId: input.id,
            message: result.response,
            topic: result.topic,
            requestUpdates: result.requestUpdates,
          },
        ],
        events,
      );
    const applied = completeAppTask(config, claim, {
      ...options,
      summary: result.summary,
      response: result.response,
      facts: result.facts ?? [],
    });
    if (applied.status === "applied") settleTaskCommunicationInputs(config, claim);
    return applied;
  });
}
