import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../lib/requests.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { applyAppTaskConditionEvent } from "../tasks/app-task-condition-tracker.js";
import { EventBus } from "./bus.js";
import { createEventInterface } from "./interface.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "approval-contract-"));
  roots.push(root);
  const db = getDb(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const condition = {
    metadata: { id: "release", generation: 1, resourceVersion: 1 },
    spec: {
      type: "project.approval.submitted",
      subject: "approvalId:release",
      owner: "human",
      requestedAction: "Apply reviewed candidate",
      reviewAfterMs: 60_000,
      expected: { approvalId: "release", allowedDecisions: ["approve", "reject", "defer"] },
    },
    status: { state: "unknown", observedGeneration: 0 },
  };
  const tree: any = {
    project: "sample",
    project_lifecycle: "active",
    version: 1,
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null } },
    resources: {
      work: {
        metadata: { id: "work", generation: 1, resourceVersion: 1 },
        spec: { outcome: "Deliver candidate", acceptance: ["done"], parentId: "root" },
        status: {
          phase: "waiting",
          observedGeneration: 0,
          conditionIds: ["release"],
          updatedAt: new Date().toISOString(),
        },
      },
    },
    conditions: { release: condition },
  };
  AppTaskResourceStore.fromDb(db, "sample").bootstrapSnapshot(tree, "fixture");
  const events = createEventInterface({
    bus,
    db,
    validateAppInput: () => {},
    hasApp: (id) => id === "sample",
    hasAgent: () => false,
    hasSession: () => false,
  });
  const proposal = {
    taskGeneration: 1,
    conditionId: "release",
    conditionGeneration: 1,
    subject: condition.spec.subject,
    expected: condition.spec.expected,
    requestedAction: condition.spec.requestedAction,
  };
  return { tree, events, proposal };
}

function authorization(kind: "human" | "operator") {
  return {
    actor: { kind, id: kind === "human" ? "telegram-user-7" : "local-operator" },
    reference: kind === "human" ? "telegram:chat-2:message-9" : "operator:change-41",
    evidence: { decisionText: "approve" },
  };
}

describe("Host verified approval contract", () => {
  it("accepts the same minimal proposal through Telegram and operator authority", () => {
    for (const [source, kind] of [
      ["telegram", "human"],
      ["control-socket", "operator"],
    ] as const) {
      const { tree, events, proposal } = fixture();
      const receipt = events.publish(
        {
          type: "project.approval.submitted",
          target: { appId: "sample", taskId: "work" },
          data: { decision: "approve", proposal },
          idempotencyKey: `${source}-approval`,
        },
        { source, approvalAuthorization: authorization(kind) },
      );
      const event = events.get(receipt.eventId)!.event;
      expect(event.data).toMatchObject({ decision: "approve", proposal });
      expect(event.data.hostApproval).toMatchObject({ ingressSource: source, actor: { kind } });
      expect(applyAppTaskConditionEvent(tree, event)).toEqual([{ taskId: "work", conditionId: "release" }]);
    }
  });

  it("denies forged and stale decisions and makes exact replay safe", () => {
    const { events, proposal } = fixture();
    const input = {
      type: "project.approval.submitted",
      target: { appId: "sample", taskId: "work" },
      data: { decision: "approve", proposal },
      idempotencyKey: "operator-approval",
    };
    expect(() => events.publish(input, { source: "app-task:sample" })).toThrow("trusted ingress authorization");
    const first = events.publish(input, {
      source: "control-socket",
      approvalAuthorization: authorization("operator"),
    });
    expect(
      events.publish(input, { source: "control-socket", approvalAuthorization: authorization("operator") }).eventId,
    ).toBe(first.eventId);
    expect(() =>
      events.publish(
        { ...input, data: { ...input.data, decision: "reject" } },
        { source: "control-socket", approvalAuthorization: authorization("operator") },
      ),
    ).toThrow("already used with different event input");
    expect(() =>
      events.publish(
        {
          ...input,
          idempotencyKey: "stale",
          data: { ...input.data, proposal: { ...proposal, taskGeneration: 2 } },
        },
        { source: "control-socket", approvalAuthorization: authorization("operator") },
      ),
    ).toThrow("generation changed");
  });

  it("does not replay one verified decision across App, Task, or generation", () => {
    const { tree, events, proposal } = fixture();
    const receipt = events.publish(
      {
        type: "project.approval.submitted",
        target: { appId: "sample", taskId: "work" },
        data: { decision: "approve", proposal },
        idempotencyKey: "scoped",
      },
      { source: "control-socket", approvalAuthorization: authorization("operator") },
    );
    const event = events.get(receipt.eventId)!.event;
    const changedGeneration = structuredClone(tree);
    changedGeneration.resources.work.metadata.generation = 2;
    expect(applyAppTaskConditionEvent(changedGeneration, event)).toEqual([]);
    const changedTask = structuredClone(tree);
    changedTask.resources.other = { ...changedTask.resources.work, metadata: { id: "other", generation: 1, resourceVersion: 1 } };
    delete changedTask.resources.work;
    expect(applyAppTaskConditionEvent(changedTask, event)).toEqual([]);
    const changedApp = structuredClone(tree);
    changedApp.project = "other";
    expect(applyAppTaskConditionEvent(changedApp, event)).toEqual([]);
  });
});
