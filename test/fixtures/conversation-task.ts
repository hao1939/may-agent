import type { SqliteDb } from "../../src/lib/db.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { appTaskContext } from "../../src/app/core/tasks/app-task-reconciler.js";

/** Real Task state for adapter fixtures; each caller owns its database and cleanup. */
export function conversationTaskContext(db: SqliteDb, root: string, appId = "may") {
  const active = AppTaskResourceStore.activeFromDb(db, appId);
  const store = active ?? AppTaskResourceStore.fromDb(db, appId);
  if (!active)
    store.bootstrapSnapshot(
      {
        project: appId,
        project_lifecycle: "active",
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
      },
      "conversation-adapter-fixture",
    );
  return appTaskContext({ appDir: root, projectDir: root, agent: appId, resourceStore: store });
}
