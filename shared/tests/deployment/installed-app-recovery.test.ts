import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import alexApp from "../../../projects/alex.app/app.ts";
import mayApp from "../../../projects/may.app/app.ts";
import scoutApp from "../../../projects/scout-knowledge-lib.app/app.ts";
import { discoverAppDefinitions, listAppDefinitionFiles } from "../../../projects/may-agent/src/app/adapters/discovery/app-definitions.js";
import { startAppInboxRuntime } from "../../../projects/may-agent/src/app/composition/app-inbox-runtime.js";
import { AppRegistry } from "../../../projects/may-agent/src/app/core/apps/registry.js";
import { EventBus, EVENT_ROW_ID } from "../../../projects/may-agent/src/app/core/events/bus.js";
import { HostCapacity } from "../../../projects/may-agent/src/app/core/scheduling/host-capacity.js";
import { listAppInboxItems } from "../../../projects/may-agent/src/app/core/state/app-inbox-store.js";
import { AppTaskResourceStore } from "../../../projects/may-agent/src/app/core/state/app-task-resource-store.js";
import { createAppTaskCapability } from "../../../projects/may-agent/src/app/core/tasks/app-task-capability.js";
import {
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../../../projects/may-agent/src/app/core/tasks/app-task-runtime.js";
import { makeTaskRetryDue } from "../../../projects/may-agent/src/app/core/tasks/app-task-test-support.js";
import type { TaskAgentRunner } from "../../../projects/may-agent/src/app/core/tasks/execution.js";
import { closeDb, getDb } from "../../../projects/may-agent/src/lib/db/connection.js";
import { DbWriter } from "../../../projects/may-agent/src/lib/db-writer.js";

function dispatch() {
  const now = Date.now();
  return { lane: "normal" as const, enqueuedAt: now, startedAt: now, readyWaitMs: 0 };
}

async function until(check: () => boolean, label = "condition") {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
    await Bun.sleep(5);
  }
}

describe("installed App operational recovery and startup loadability", () => {
  test("discovers and loads all active App manifests without optional external PATH tools", async () => {
    const projectsRoot = resolve(process.cwd(), "projects");
    const previousPath = process.env.PATH;
    process.env.PATH = "";
    try {
      const files = listAppDefinitionFiles(projectsRoot, projectsRoot);
      const loaded = await discoverAppDefinitions(projectsRoot, projectsRoot)();
      const ids = loaded.map((item) => (item.definition as { id?: string }).id).sort();
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(ids).toEqual(["alex", "may", "scout-knowledge-lib"]);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    }
  });

  test("routes an exhausted standing Scout Task through the installed Alex recovery declaration back to the original Task", async () => {
    const root = mkdtempSync(join(tmpdir(), "installed-app-recovery-"));
    const previousAutoReview = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    process.env.EVALUATION_AUTO_REVIEW_ENABLED = "false";
    let inbox: Awaited<ReturnType<typeof startAppInboxRuntime>> | undefined;
    const bus = new EventBus();
    try {
      mkdirSync(join(root, "scout-knowledge-lib"), { recursive: true });
      for (const [id, group] of [
        ["alex", "root"],
        ["may", "may"],
        ["scout-knowledge-lib", "ongoing-research"],
      ] as const) {
        const dir = join(root, `${id}.app`, "tasks");
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, "seed.json"),
          JSON.stringify({
            project: id,
            root_task_id: group,
            groups: {
              [group]: { id: group, parent_id: null },
              ...(id === "scout-knowledge-lib" ? { "library-operations": { id: "library-operations", parent_id: null } } : {}),
            },
          }),
        );
      }

      let prerequisiteRepaired = false;
      const executed: string[] = [];
      const db = getDb(root);
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);

      const registry = new AppRegistry(async () => [
        { appDir: join(root, "alex.app"), definition: { ...alexApp, workspace: undefined, schedules: [], observers: [], metrics: [] } },
        { appDir: join(root, "may.app"), definition: { ...mayApp, workspace: undefined, schedules: [], observers: [], metrics: [] } },
        {
          appDir: join(root, "scout-knowledge-lib.app"),
          definition: {
            ...scoutApp,
            workspace: undefined,
            schedules: [],
            observers: [],
            task(admitted) {
              const attached = scoutApp.task!(admitted);
              if (attached.kind !== "desired" || !attached.intent.outputs) return attached;
              return {
                ...attached,
                intent: {
                  ...attached.intent,
                  outputs: attached.intent.outputs.map((out) => out.replace("/app/projects", root)),
                },
              };
            },
          },
        },
      ]);
      await registry.reload();

      const capability = createAppTaskCapability({ bus });
      const agents: TaskAgentRunner = {
        available: () => true,
        prepare: async () => true,
        role: (agent) => ({ agent, instructions: "Execute assigned work." }),
        snapshot: () => agents,
        async execute({ descriptor, attempt }) {
          executed.push(`${descriptor.id}:${attempt.task.id}:gen${attempt.task.generation}`);
          if (descriptor.id === "scout-knowledge-lib") {
            if (!prerequisiteRepaired) {
              throw new Error("ENOSPC: no space left on device, write");
            }
            return {
              runId: attempt.attemptId,
              handlerResult: {
                state: "converged",
                summary: "Completed XHS scan after prerequisite repair",
                facts: ["source:xhs", "repaired:true"],
                requests: [],
              },
            };
          }
          if (descriptor.id === "alex") {
            expect(attempt.task.id).toStartWith("runtime/recovery/scout-knowledge-lib-explore-xhs-");
            prerequisiteRepaired = true;
            const scoutTask = AppTaskResourceStore.activeFromDb(db, "scout-knowledge-lib")!.readTask("explore-xhs")!;
            capability.retry({
              appId: "scout-knowledge-lib",
              taskId: "explore-xhs",
              expectedGeneration: scoutTask.metadata.generation,
              expectedResourceVersion: scoutTask.metadata.resourceVersion,
            });
            return {
              runId: attempt.attemptId,
              handlerResult: {
                state: "converged",
                summary: "Cleared ENOSPC prerequisite and issued fenced retry on scout-knowledge-lib/explore-xhs",
                facts: ["repaired:scout-knowledge-lib/explore-xhs"],
                requests: [],
              },
            };
          }
          throw new Error(`Unexpected execution in ${descriptor.id}`);
        },
      };

      await installAppTaskRuntimes(
        {
          projectRoot: root,
          projectsRoot: root,
          persistDir: root,
          bus,
          appRegistrySnapshot: registry.snapshot(),
          hostCapacity: new HostCapacity(3),
          agents,
        },
        { deferRecovery: true },
      );

      inbox = await startAppInboxRuntime({
        db,
        bus,
        registry,
        persistDir: root,
        schedulesEnabled: false,
        attachTask: capability.attach,
        readDependency: capability.readDependency,
        admitConversation: capability.admitConversation,
        admitTaskEvent: capability.admitEvent,
        hasTaskTarget: capability.has,
        previewTaskEvent: capability.previewEvent,
        previewTaskEventRoutes: capability.previewEventRoutes,
      });

      // Trigger standing explore-xhs via the real Scout schedule event
      const trigger = bus.emit({
        type: "scout.explore",
        source: "app:scout-knowledge-lib:schedule:scout-explore-xhs",
        owner: "app:scout-knowledge-lib",
        target: { appId: "scout-knowledge-lib", project: "scout-knowledge-lib" },
        data: { project: "scout-knowledge-lib", source: "xhs" },
      });
      await until(
        () =>
          (db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(trigger[EVENT_ROW_ID]!) as { delivery_status: string } | null)
            ?.delivery_status === "accepted",
        "scout.explore admission",
      );

      const scoutStore = AppTaskResourceStore.activeFromDb(db, "scout-knowledge-lib")!;
      const alexStore = AppTaskResourceStore.activeFromDb(db, "alex")!;
      await until(() => Boolean(scoutStore.readTask("explore-xhs")), "explore-xhs task creation");

      // Fail 3 attempts to hit retryExhausted (attempts 1 & 2 stay quiet; attempt 3 emits disposition=exhausted)
      for (let i = 1; i <= 3; i++) {
        await reconcileLoadedAppTaskOnce({ bus, appId: "scout-knowledge-lib", taskId: "explore-xhs", dispatch: dispatch() });
        if (i < 3) {
          expect(listAppInboxItems(db, { appId: "alex" })).toHaveLength(0);
          makeTaskRetryDue(scoutStore, "explore-xhs");
        }
      }

      expect(scoutStore.readTask("explore-xhs")?.status.phase).toBe("attention");
      expect(scoutStore.readTask("explore-xhs")?.status.retryExhausted?.failures).toBe(3);

      // Installed Alex subscription admits the exhaustion notice to one stable recovery Task
      await until(() => {
        const items = listAppInboxItems(db, { appId: "alex" });
        return items.length === 1 && Boolean(items[0]?.waitingOn?.id);
      }, "Alex recovery Task admission");

      const recoveryTaskId = listAppInboxItems(db, { appId: "alex" })[0]!.waitingOn!.id;
      expect(recoveryTaskId).toStartWith("runtime/recovery/scout-knowledge-lib-explore-xhs-");
      expect(alexStore.readTask(recoveryTaskId)?.spec.owner).toBe("alex");

      // Execute Alex recovery -> repairs prerequisite and issues fenced retry on explore-xhs
      await reconcileLoadedAppTaskOnce({ bus, appId: "alex", taskId: recoveryTaskId, dispatch: dispatch() });
      expect(prerequisiteRepaired).toBe(true);
      expect(scoutStore.readTask("explore-xhs")?.status.phase).toBe("pending");
      expect(scoutStore.readTask("explore-xhs")?.metadata.generation).toBe(1);

      // Original Scout Task now converges on the exact same Task identity and generation!
      await reconcileLoadedAppTaskOnce({ bus, appId: "scout-knowledge-lib", taskId: "explore-xhs", dispatch: dispatch() });
      expect(scoutStore.readTask("explore-xhs")?.status.phase).toBe("converged");
      expect(scoutStore.readTask("explore-xhs")?.metadata.generation).toBe(1);
      expect(scoutStore.readTask("explore-xhs")?.status.facts).toContain("repaired:true");
      expect(executed).toEqual([
        "scout-knowledge-lib:explore-xhs:gen1",
        "scout-knowledge-lib:explore-xhs:gen1",
        "scout-knowledge-lib:explore-xhs:gen1",
        `alex:${recoveryTaskId}:gen1`,
        "scout-knowledge-lib:explore-xhs:gen1",
      ]);
    } finally {
      if (previousAutoReview === undefined) delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      else process.env.EVALUATION_AUTO_REVIEW_ENABLED = previousAutoReview;
      inbox?.close();
      await closeInstalledAppTaskRuntimes(bus);
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
