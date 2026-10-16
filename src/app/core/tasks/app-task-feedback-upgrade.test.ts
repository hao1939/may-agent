import { expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineApp, Type } from "@may-agent/sdk";
import { DbWriter } from "../../../lib/db-writer.js";
import { closeDb, getDb } from "../../../lib/requests.js";
import { EventBus, type AgentEvent } from "../events/bus.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { appInputFeedbackEvent } from "../inbox/input-result.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskInput } from "../state/inbox.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import { matchingAppTaskConditionTaskIds, trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import {
  appTaskContext, claimObservedAppTask, deferAppTask, failAppTaskAttempt,
  listRunnableAppTaskIds, observeAppTaskIntent, readAppTaskAdmissionOutcome,
} from "./app-task-reconciler.js";

it.each([false, true])("replays historical publications across restart without losing progress or the first failure (missing old attempt: %s)", async (missingAttempt) => {
  const root = mkdtempSync(join(tmpdir(), "task-feedback-upgrade-"));
  const apps = ["caller", "worker"].map((id) => defineApp({ id, version: 1, agent: "owner", tasks: {},
    inputSchema: Type.Object({ kind: Type.Literal("ask"), data: Type.Object({}) }),
    task: () => ({ kind: "existing", taskId: "work" }),
  }));
  const context = (appId: string) => appTaskContext({ appDir: join(root, `${appId}.app`), projectDir: root,
    agent: "owner", maxConcurrent: 1, resourceStore: AppTaskResourceStore.fromDb(getDb(root), appId) });
  let caller = context("caller");
  let worker = context("worker");
  for (const config of [caller, worker]) {
    appTaskTestContext({ ...config, appId: config.resourceStore.appId, tree: {
      root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "owner" } },
    } });
    observeAppTaskIntent(config, { appAgent: "owner", intent: {
      id: "work", parentId: "root", outcome: "Return a measurement", acceptance: ["Measurement received"],
    } });
  }
  const failures: unknown[] = [];
  let bus: EventBus;
  const install = () => {
    bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "app.dependency.updated") return;
      const ids = matchingAppTaskConditionTaskIds(caller, event);
      trackAppTaskConditionEventForTasks(caller, event, ids);
      return { accepted: true, by: "fixture-conditions", route: "direct" };
    });
    return new AppInboxHost({ db: getDb(root), apps,
      attachTask: (input) => admitTaskInput(input.appId === "worker" ? worker : caller, input),
      readDependency: async ({ dependency, admissionKey }) => ({ kind: "task", id: dependency.id, status: "waiting",
        reports: (["progress", "failure"] as const).flatMap((kind) => {
          const report = readAppTaskAdmissionOutcome(worker, dependency.id, admissionKey!, kind);
          return report ? [report] : [];
        }),
      }),
      onRequestUpdated: (item, result, status) => { bus.emit(appInputFeedbackEvent(item, result, status)!); return true; },
      onFailure: (failure) => { failures.push(failure); },
    });
  };
  let host = install();
  const restart = () => {
    host.close();
    closeDb(root);
    caller = context("caller");
    worker = context("worker");
    host = install();
  };
  const claim = (config: typeof caller) => {
    const result = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
    if (result.kind !== "claimed") throw new Error(`Expected claim, got ${result.kind}`);
    return result;
  };
  const conditionId = "app-request:request";
  try {
    host.admit({ id: "original", appId: "caller", source: { kind: "system", id: "fixture" }, input: { kind: "ask", data: {} } });
    deferAppTask(caller, claim(caller), { disposition: "waiting", summary: "Await the measurement", conditions: [{
      id: conditionId, type: "app.dependency.updated", subject: "id:request",
      expected: { field: "status", equals: "done" }, owner: "app:worker",
    }] });
    host.admit({ id: "request", appId: "worker", source: { kind: "app", id: "caller" }, input: { kind: "ask", data: {} } });
    const item = host.get("request")!;
    const admissionKey = item.taskAdmissionKey!;
    const oldEvents: AgentEvent[] = [];
    let lastAttemptId = "";
    // Seed the previous Host's exact wire publications, selected reference and
    // single observed report. Both progress reports were already considered.
    for (let revision = 1; revision <= 2; revision++) {
      const attempt = claim(worker);
      lastAttemptId = attempt.attemptId;
      deferAppTask(worker, attempt, { disposition: "waiting", continue: true, report: true,
        summary: `Collected ${revision} samples`, facts: [`samples:${revision}`] });
      const report = readAppTaskAdmissionOutcome(worker, "work", admissionKey, "progress")!;
      const event = appInputFeedbackEvent(item, report, "blocked")!;
      event.data.status = "blocked";
      delete event.data.reportKind;
      oldEvents.push(structuredClone(event));
      bus!.emit(event);
      deferAppTask(caller, claim(caller), { disposition: "waiting", summary: "Considered progress" });
    }
    const admission = worker.resourceStore.readTaskContext({ taskIds: [], admissionIds: [admissionKey] }).appTaskAdmissions![admissionKey]!;
    delete admission.feedback;
    Object.assign(admission, { reportAttemptId: lastAttemptId, reportRevision: 2 });
    worker.resourceStore.commit({ fences: [{ taskId: "work", resourceVersion: worker.resourceStore.readTask("work")!.metadata.resourceVersion }],
      admissions: [{ taskId: admissionKey, value: admission }], ...(missingAttempt ? { deleteAttemptIds: [lastAttemptId] } : {}),
    });
    const condition = caller.resourceStore.readTaskConditions("work")[0]!;
    delete condition.status.reports;
    condition.status.observed!.state = "blocked";
    delete condition.status.observed!.reportKind;
    caller.resourceStore.commit({ fences: [{ taskId: "work", resourceVersion: caller.resourceStore.readTask("work")!.metadata.resourceVersion }], conditions: [condition] });
    restart();
    await host.refreshTaskResults("worker", "work");
    expect(failures).toEqual([]);
    expect(listRunnableAppTaskIds(caller)).toEqual([]);
    expect(getDb(root).prepare("SELECT count(*) AS count FROM events WHERE event_type = 'app.dependency.updated'").get()).toEqual({ count: 2 });
    const failure = claim(worker);
    failAppTaskAttempt(worker, failure, "Measurement source failed");
    await host.refreshTaskResults("worker", "work");
    expect(listRunnableAppTaskIds(caller)).toEqual(["work"]);
    const reports = caller.resourceStore.readTaskConditions("work")[0]!.status.reports!;
    expect(reports.failure).toMatchObject({ reportAttemptId: failure.attemptId, reportRevision: 3 });
    expect(reports[missingAttempt ? "unknown" : "progress"]).toMatchObject({ reportAttemptId: lastAttemptId, reportRevision: 2 });
    deferAppTask(caller, claim(caller), { disposition: "waiting", summary: "Considered failure" });
    restart();
    await host.refreshTaskResults("worker", "work");
    for (const event of oldEvents) {
      // Journal recovery has no new publication. Exercise its read-only routing
      // and persisted observation paths, including an older legacy revision.
      expect(matchingAppTaskConditionTaskIds(caller, event)).toEqual([]);
      expect(trackAppTaskConditionEventForTasks(caller, event, ["work"])).toEqual([]);
      bus!.emit(structuredClone(event));
    }
    expect(failures).toEqual([]);
    expect(listRunnableAppTaskIds(caller)).toEqual([]);
    expect(host.get("request")?.status).toBe("handling");
  } finally { host.close(); closeDb(root); rmSync(root, { recursive: true, force: true }); }
});

it("delivers exhaustion after an earlier failure despite a failed publication and restart, without executing the worker", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-exhaustion-feedback-"));
  const apps = ["caller", "worker"].map((id) => defineApp({ id, version: 1, agent: "owner", tasks: { maxConsecutiveFailures: 2 },
    inputSchema: Type.Object({ kind: Type.Literal("ask"), data: Type.Object({}) }),
    task: () => ({ kind: "existing", taskId: "work" }),
  }));
  const context = (appId: string) => appTaskContext({ appDir: join(root, `${appId}.app`), projectDir: root,
    agent: "owner", maxConcurrent: 1, maxConsecutiveFailures: 2,
    resourceStore: AppTaskResourceStore.fromDb(getDb(root), appId) });
  let caller = context("caller");
  let worker = context("worker");
  for (const config of [caller, worker]) {
    appTaskTestContext({ ...config, appId: config.resourceStore.appId, tree: {
      root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "owner" } },
    } });
    observeAppTaskIntent(config, { appAgent: "owner", intent: {
      id: "work", parentId: "root", outcome: "Return a measurement", acceptance: ["Measurement received"],
    } });
  }
  let deliveryAvailable = true;
  let now = Date.now();
  const install = () => {
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "app.dependency.updated") return;
      const ids = matchingAppTaskConditionTaskIds(caller, event);
      trackAppTaskConditionEventForTasks(caller, event, ids);
      return { accepted: true, by: "fixture-conditions", route: "direct" };
    });
    return new AppInboxHost({ db: getDb(root), apps, now: () => now,
      attachTask: (input) => admitTaskInput(input.appId === "worker" ? worker : caller, input),
      readDependency: async ({ dependency, admissionKey }) => ({ kind: "task", id: dependency.id, status: "waiting",
        reports: (['progress', 'failure'] as const).flatMap((kind) => {
          const report = readAppTaskAdmissionOutcome(worker, dependency.id, admissionKey!, kind);
          return report ? [report] : [];
        }),
      }),
      onRequestUpdated: (item, result, status) => {
        if (!deliveryAvailable) throw new Error("Caller route temporarily unavailable");
        bus.emit(appInputFeedbackEvent(item, result, status)!);
        return true;
      },
    });
  };
  let host = install();
  const claim = (config: typeof caller) => {
    const result = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
    if (result.kind !== "claimed") throw new Error(`Expected claim, got ${result.kind}`);
    return result;
  };
  try {
    host.admit({ id: "original", appId: "caller", source: { kind: "system", id: "fixture" }, input: { kind: "ask", data: {} } });
    deferAppTask(caller, claim(caller), { disposition: "waiting", summary: "Await measurement", conditions: [{
      id: "app-request:request", type: "app.dependency.updated", subject: "id:request",
      expected: { field: "status", equals: "done" }, owner: "app:worker",
    }] });
    host.admit({ id: "request", appId: "worker", source: { kind: "app", id: "caller" }, input: { kind: "ask", data: {} } });
    // First failure was already reported, then a fresh human ask permits one claim.
    failAppTaskAttempt(worker, claim(worker), "Source unavailable");
    await host.refreshTaskResults("worker", "work");
    deferAppTask(caller, claim(caller), { disposition: "waiting", summary: "Failure considered" });
    admitTaskInput(worker, { appId: "worker", attachment: { kind: "existing", taskId: "work" },
      idempotencyKey: "human:repair", inputContext: { id: "repair", source: { kind: "human", id: "repair" },
        input: { kind: "ask", data: {} } } });
    const last = claim(worker);
    deliveryAvailable = false;
    failAppTaskAttempt(worker, last, "Source still unavailable");
    await host.refreshTaskResults("worker", "work");
    expect(listRunnableAppTaskIds(caller)).toEqual([]);
    const retained = worker.resourceStore.readAttempt(last.attemptId);
    now = host.get("request")!.recovery!["input-result"]!.retryAt + 1;
    expect(host.get("request")?.status).toBe("handling");
    host.close();
    closeDb(root);
    caller = context("caller");
    worker = context("worker");
    deliveryAvailable = true;
    host = install();
    await host.refreshTaskResults("worker", "work");
    const reports = caller.resourceStore.readTaskConditions("work")[0]!.status.reports!;
    expect(reports.failure).toMatchObject({ reportAttemptId: last.attemptId,
      summary: expect.stringContaining("Automatic retries exhausted") });
    expect(listRunnableAppTaskIds(caller)).toEqual(["work"]);
    expect(listRunnableAppTaskIds(worker)).toEqual([]);
    expect(worker.resourceStore.readAttempt(last.attemptId)).toEqual(retained);
    deferAppTask(caller, claim(caller), { disposition: "waiting", summary: "Owner reviewing exhaustion" });
    await host.refreshTaskResults("worker", "work");
    expect(listRunnableAppTaskIds(caller)).toEqual([]);
    expect(host.get("request")?.status).toBe("handling");
  } finally { host.close(); closeDb(root); rmSync(root, { recursive: true, force: true }); }
});
