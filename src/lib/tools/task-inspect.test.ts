import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskInspectTool } from "./task-inspect.js";
import { appTaskTestContext } from "../../app/core/tasks/app-task-test-support.js";
import {
  claimObservedAppTask,
  deferAppTask,
  observeAppTaskIntent,
} from "../../app/core/tasks/app-task-reconciler.js";
import { admitTaskInput } from "../../app/core/state/inbox.js";
import { closeDb } from "../db/connection.js";

describe("task_inspect tool", () => {
  test("reads Task detail by ref or appId+taskId and lists Tasks by appId and status", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-inspect-tool-"));
    const databasePath = join(root, "may.db");
    const config = appTaskTestContext({
      appDir: root,
      databasePath,
      agent: "owner",
      maxConcurrent: 1,
      tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
    });
    try {
      observeAppTaskIntent(config, {
        appAgent: "owner",
        intent: {
          id: "workstream/spec-fixer",
          parentId: "root",
          outcome: "Repair all active specs",
          acceptance: ["All active specs repaired"],
        },
      });
      admitTaskInput(config, {
        appId: "sample",
        attachment: { kind: "existing", taskId: "workstream/spec-fixer" },
        idempotencyKey: "start-spec-fixer",
        inputContext: {
          id: "start-spec-fixer",
          source: { kind: "human", id: "hao" },
          input: { kind: "start-workstream", data: { stream: "spec-fixer" } },
        },
      });
      const claimed = claimObservedAppTask(config, {
        taskId: "workstream/spec-fixer",
        appAgent: "owner",
        handler: "agent",
      });
      if (claimed.kind !== "claimed") throw new Error(claimed.kind);
      deferAppTask(config, claimed, {
        disposition: "waiting",
        summary: "Blocked on row 102 and row 758 decisions",
        facts: ["row186:repaired"],
        conditions: [
          {
            id: "spec-fixer-deciding-input",
            type: "app.task.requested",
            subject: "task:workstream/spec-fixer",
            expected: { state: "provided" },
            requestedAction: "Supply row 102 and row 758 scope decisions",
            owner: "human",
          },
        ],
      });

      const tool = createTaskInspectTool({ persistDir: root });
      const listed = await tool.execute("call-1", { action: "list", appId: "sample", status: "waiting" });
      const listPayload = JSON.parse((listed.content[0] as { text: string }).text);
      expect(listPayload.count).toBe(1);
      expect(listPayload.items[0]).toMatchObject({
        appId: "sample",
        taskId: "workstream/spec-fixer",
        status: "waiting",
        generation: 1,
        conditionIds: ["spec-fixer-deciding-input"],
      });

      const ref = listPayload.items[0].ref;
      const byRef = await tool.execute("call-2", { action: "get", ref });
      const detail = JSON.parse((byRef.content[0] as { text: string }).text);
      expect(detail).toMatchObject({
        appId: "sample",
        taskId: "workstream/spec-fixer",
        ref,
        generation: 1,
        status: "waiting",
        summary: "Blocked on row 102 and row 758 decisions",
        facts: ["row186:repaired"],
      });
      expect(detail.conditions).toEqual([
        expect.objectContaining({
          id: "spec-fixer-deciding-input",
          owner: "human",
          requestedAction: "Supply row 102 and row 758 scope decisions",
        }),
      ]);
    } finally {
      config.resourceStore.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
