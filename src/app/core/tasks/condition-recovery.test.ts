import { expect, setSystemTime, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Condition } from "@may-agent/sdk";
import { appTaskRuntimeTestSuite } from "../../../../test/fixtures/app-task-runtime.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { EVENT_ROW_ID } from "../events/bus.js";
import { matchesAppTaskCondition, trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import { claimObservedAppTask, deferAppTask, observeAppTaskIntent } from "./app-task-reconciler.js";
import { recoverTaskConditions } from "./dependency-admission.js";
import type { AppTaskRuntimeDescriptor } from "./runtime-definition.js";

const { fixture, eventBus, definition, options, loadedTaskConfig } = appTaskRuntimeTestSuite();
const source = "app:sample:observer:reader";
const fresh = { state: "ready", source, timestamp: { gte: 2000 } };

function recoveryFixture() {
  const f = fixture();
  const bus = eventBus();
  const opts = options(f, bus);
  setSystemTime(new Date(2000));
  let config = loadedTaskConfig(f);
  const persist = () => bus.setPersistenceSubscriber(new DbWriter(opts.persistDir).handler);
  persist();
  return {
    ...f,
    get config() {
      return config;
    },
    get db() {
      return getDb(opts.persistDir);
    },
    wait(id: string, expected: Record<string, unknown>, subject = "resource:sample", others: Condition[] = []) {
      observeAppTaskIntent(config, {
        appAgent: "sample-owner",
        intent: {
          id,
          parentId: "operations",
          outcome: "Review the exact fact",
          acceptance: ["Evidence received"],
        },
      });
      const claim = claimObservedAppTask(config, { taskId: id, appAgent: "sample-owner", handler: "agent" });
      if (claim.kind !== "claimed") throw new Error(`Expected claim, got ${claim.kind}`);
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "Await evidence",
        conditions: [{ id: `${id}:ready`, type: "sample.observed", subject, expected, owner: "app:sample" }, ...others],
      });
    },
    publish(timestamp: number, data: Record<string, unknown> = {}) {
      return bus.emit({
        type: "sample.observed",
        source,
        owner: "app:sample",
        timestamp,
        target: { project: "sample", sessionId: "provider" },
        data: { resource: "sample", state: "ready", ...data },
      });
    },
    recover() {
      const descriptor: AppTaskRuntimeDescriptor = {
        id: "sample",
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        app: definition(),
        reconciliationPaused: false,
        resourceStore: config.resourceStore,
      };
      return recoverTaskConditions(opts, descriptor, config);
    },
    reopen() {
      closeDb(opts.persistDir);
      config = loadedTaskConfig(f);
      persist();
    },
  };
}

test("Condition recovery and live admission agree on event time across a database reopen", () => {
  const f = recoveryFixture();
  f.wait("work", fresh, "resource:sample", [
    {
      id: "approval",
      type: "approval.submitted",
      subject: "approval:independent",
      expected: true,
      owner: "human:reviewer",
    },
  ]);
  setSystemTime(new Date(3000));
  const stale = f.publish(1000, { timestamp: 9000 });
  const eventId = Number(stale[EVENT_ROW_ID]);
  expect(
    f.db
      .prepare("SELECT timestamp, json_extract(envelope_json, '$.timestamp') AS event_time FROM events WHERE id = ?")
      .get(eventId),
  ).toEqual({ timestamp: 3000, event_time: 1000 });
  const live = { ...stale, eventId };
  expect(trackAppTaskConditionEventForTasks(f.config, live, ["work"])).toEqual([]);
  expect(f.recover()).toEqual([]);
  f.reopen();
  expect(f.recover()).toEqual([]);
  expect(f.config.resourceStore.readTaskConditions("work").map((c) => c.status.state)).toEqual(["unknown", "unknown"]);

  f.wait("history", { state: "ready", source });
  expect(f.recover()).toEqual(["history"]);
  expect(f.config.resourceStore.readTaskContext({ taskIds: ["history"] }).taskTriggers?.history?.event).toMatchObject({
    eventId,
    timestamp: 1000,
    data: stale.data,
  });

  setSystemTime(new Date(4000));
  const current = f.publish(2500);
  expect(
    matchesAppTaskCondition(
      f.config.resourceStore.readTaskConditions("work").find((c) => c.metadata.id === "work:ready"),
      current,
    ),
  ).toBe(true);
  f.reopen();
  expect(f.recover()).toEqual(["work"]);
  const context = f.config.resourceStore.readTaskContext({ taskIds: ["work"] });
  expect(context.conditions?.approval?.status.state).toBe("unknown");
  expect(context.taskTriggers?.work?.event).toMatchObject({
    eventId: Number(current[EVENT_ROW_ID]),
    timestamp: 2500,
    data: current.data,
  });
  const trigger = structuredClone(context.taskTriggers?.work);
  expect(f.recover()).toEqual([]);
  expect(f.config.resourceStore.readTaskContext({ taskIds: ["work"] }).taskTriggers?.work).toEqual(trigger);
});

test("Condition recovery reads the complete verified body and saved envelope target", () => {
  const f = recoveryFixture();
  const proof = "Full source evidence. ".repeat(1000);
  f.wait("work", { ...fresh, proof }, "session:provider");
  setSystemTime(new Date(3000));
  const event = f.publish(2500, { proof });
  expect(
    f.db.prepare("SELECT body_ref FROM events WHERE id = ?").get(Number(event[EVENT_ROW_ID]))?.body_ref,
  ).toBeString();
  f.reopen();
  expect(f.recover()).toEqual(["work"]);
  expect(f.config.resourceStore.readTaskContext({ taskIds: ["work"] }).taskTriggers?.work?.event).toMatchObject({
    timestamp: 2500,
    target: event.target,
    data: event.data,
  });
});

test.each(["envelope", "inline body", "missing artifact", "corrupt artifact"])(
  "Condition recovery cannot prove a wait with a damaged %s",
  (damage) => {
    const f = recoveryFixture();
    f.wait("work", fresh);
    setSystemTime(new Date(3000));
    const event = f.publish(2500, damage.includes("artifact") ? { proof: "Evidence. ".repeat(2000) } : {});
    const id = Number(event[EVENT_ROW_ID]);
    if (damage === "envelope")
      f.db
        .prepare("UPDATE events SET envelope_json = json_set(envelope_json, '$.timestamp', 'damaged') WHERE id = ?")
        .run(id);
    else if (damage === "inline body")
      f.db.prepare("UPDATE events SET data = json_set(data, '$.state', 'ready', '$.changed', 1) WHERE id = ?").run(id);
    else {
      const row = f.db.prepare("SELECT body_ref FROM events WHERE id = ?").get(id)!;
      const path = join(f.root, "state", String(row.body_ref));
      if (damage === "missing artifact") rmSync(path);
      else writeFileSync(path, JSON.stringify({ resource: "sample", state: "ready", proof: "Altered" }));
    }
    f.reopen();
    expect(f.recover()).toEqual([]);
    expect(f.config.resourceStore.readTaskConditions("work")[0]?.status.state).toBe("unknown");
  },
);

test("Condition recovery retains the known publication time of pre-envelope history", () => {
  const f = recoveryFixture();
  f.wait("work", fresh);
  setSystemTime(new Date(3000));
  const event = f.publish(1000);
  f.db.prepare("UPDATE events SET envelope_json = NULL WHERE id = ?").run(Number(event[EVENT_ROW_ID]));
  f.reopen();
  expect(f.recover()).toEqual(["work"]);
  expect(f.config.resourceStore.readTaskContext({ taskIds: ["work"] }).taskTriggers?.work?.event).toMatchObject({
    timestamp: 3000,
    data: event.data,
  });
});
