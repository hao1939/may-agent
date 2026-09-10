import type { AppTaskAttachment } from "@may-agent/sdk";
import { openDatabase } from "../../src/lib/db.js";
import { AppTaskResourceStore } from "../../src/app/app-task-resource-store.js";
import { appTaskContext, claimObservedAppTask, completeAppTask } from "../../src/app/app-task-reconciler.js";
import { getAppInboxItem } from "../../src/app/app-inbox-store.js";
import { admitTaskRequest, attachRequestToTask } from "../../src/app/core/state/requests.js";

export const testAttachment = (taskId = "work/one"): AppTaskAttachment => ({
  kind: "desired",
  intent: { id: taskId, parentId: "project", mode: "achieve", outcome: "Finish the example", acceptance: ["Verified"] },
});

export function openState(path: string, appId = "example") {
  const db = openDatabase(path);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  const store = AppTaskResourceStore.activeFromDb(db, appId);
  if (!store) throw new Error("Fixture requires initialized state");
  return appTaskContext({
    appDir: "unused",
    projectDir: "unused",
    agent: "example-owner",
    maxConcurrent: 1,
    resourceStore: store,
  });
}

export function finishTask(config: ReturnType<typeof openState>, taskId = "work/one") {
  const claim = claimObservedAppTask(config, { taskId, appAgent: "example-owner", handler: "agent:example-owner" });
  if (claim.kind !== "claimed") throw new Error(`Expected Task claim, got ${claim.kind}`);
  const result = completeAppTask(config, claim, { summary: "Verified", evidence: ["fixture:checked"] });
  if (result.status !== "applied") throw new Error(`Unexpected result: ${result.status}`);
}

if (import.meta.main) {
  const [path, action, taskId = "work/one"] = process.argv.slice(2);
  const config = openState(path!);
  const db = config.resourceStore.db;
  try {
    if (action === "complete") finishTask(config, taskId);
    else {
      const item = getAppInboxItem(db, "request-one");
      if (!item?.lease) throw new Error("Request is no longer owned");
      if (action === "crash-admission-existing" || action === "crash-admission-desired") {
        const kind = action === "crash-admission-existing" ? "existing" : "desired";
        // Released Hosts committed admission before the request wait/Topic link.
        admitTaskRequest(config, {
          appId: "example",
          attachment: kind === "existing" ? { kind, taskId } : testAttachment(taskId),
          idempotencyKey: `task:${item.id}:${kind}:${taskId}`,
          request: { id: item.id, source: item.source, input: item.input },
        });
        process.kill(process.pid, "SIGKILL");
      }
      if (action === "crash-before") {
        const run = db.run.bind(db);
        db.run = (sql, params) => {
          if (sql.includes("INSERT OR IGNORE INTO conversation_topic_tasks")) process.kill(process.pid, "SIGKILL");
          return run(sql, params);
        };
      }
      attachRequestToTask(config, {
        appId: "example",
        attachment: testAttachment(taskId),
        idempotencyKey: "task:request-one",
        request: { id: item.id, source: item.source, input: item.input },
        claim: { item, owner: item.lease.owner, generation: item.lease.generation },
      });
      if (action === "crash-after") process.kill(process.pid, "SIGKILL");
    }
  } finally {
    db.close();
  }
}
