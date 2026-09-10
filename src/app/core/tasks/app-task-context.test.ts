import { describe, expect, it } from "bun:test";
import {
  projectAppTaskChildPromptContext,
  projectAppTaskReconciliationEvents,
  projectAppTaskWaitPromptContext,
  readAppTaskWaitPromptContext,
} from "./app-task-context.js";
import type { AppTaskCondition } from "./app-task-state.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";

function condition(id: string, state: AppTaskCondition["status"]["state"] = "unknown"): AppTaskCondition {
  return {
    metadata: { id, generation: 1, resourceVersion: 1 },
    spec: { type: "app.dependency.completed", subject: `id:${id}`, expected: true },
    status: { observedGeneration: 1, state },
  };
}

describe("Task context projections", () => {
  it("preserves event order and exposes a cursor only for a fully identified batch", () => {
    const claim = {
      events: [12, 11].map((eventId) => ({
        observedAt: `observed-${eventId}`,
        event: { eventId, type: "sample.updated", data: { value: eventId } },
      })),
      eventsTruncated: true,
    };
    const before = structuredClone(claim);
    expect(projectAppTaskReconciliationEvents(claim)).toEqual({
      items: [12, 11].map((eventId) => ({
        eventId,
        observedAt: `observed-${eventId}`,
        event: { type: "sample.updated", data: { value: eventId } },
      })),
      throughEventId: 12,
      truncated: true,
    });
    expect(claim).toEqual(before);
    expect(projectAppTaskReconciliationEvents({ events: [], eventsTruncated: false })).toEqual({
      items: [],
      truncated: false,
    });
  });

  it.each([undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "does not invent a batch cursor when an event ID is %s",
    (eventId) => {
      const result = projectAppTaskReconciliationEvents({
        events: [
          { observedAt: "first", event: { type: "sample.updated", eventId: 11 } },
          { observedAt: "second", event: { type: "sample.updated", eventId } },
        ],
        eventsTruncated: false,
      });
      expect(result).not.toHaveProperty("throughEventId");
      expect(result.items[0]?.eventId).toBe(11);
      expect(result.items[1]).not.toHaveProperty("eventId");
      expect(result.items).toHaveLength(2);
    },
  );

  it("keeps requested and resolved Task identities distinct without mutating wait evidence", () => {
    const waits: Parameters<typeof projectAppTaskWaitPromptContext>[0] = [
      {
        conditionId: "wait:review",
        condition: condition("review"),
        dependency: {
          appId: "evaluation",
          status: "handling",
          targetTaskId: "requested-task",
          waitingOn: { kind: "task", id: "resolved-task" },
        },
      },
      { conditionId: "wait:missing", condition: condition("missing", "false") },
      { conditionId: "wait:done", condition: condition("done", "true") },
      {
        conditionId: "wait:new",
        condition: condition("new"),
        dependency: { appId: "evaluation", status: "handling", waitingOn: { kind: "task", id: "new-task" } },
      },
    ];
    const before = structuredClone(waits);
    const projected = projectAppTaskWaitPromptContext(waits);
    expect(projected.open).toEqual([
      {
        conditionId: "wait:review",
        type: "app.dependency.completed",
        subject: "id:review",
        state: "unknown",
        dependency: {
          requestId: "review",
          appId: "evaluation",
          status: "handling",
          targetTaskId: "requested-task",
          resolvedTaskId: "resolved-task",
        },
      },
      { conditionId: "wait:missing", type: "app.dependency.completed", subject: "id:missing", state: "false" },
      {
        conditionId: "wait:new",
        type: "app.dependency.completed",
        subject: "id:new",
        state: "unknown",
        dependency: { requestId: "new", appId: "evaluation", status: "handling", resolvedTaskId: "new-task" },
      },
    ]);
    expect(projected.note).toContain("do not copy it into taskId when targetTaskId is absent");
    expect(waits).toEqual(before);
  });

  it("reads only linked open waits and tolerates missing requests or a missing Task", () => {
    const store = AppTaskResourceStore.openStandalone(":memory:", "sample");
    try {
      store.bootstrapSnapshot(
        {
          resources: {
            current: {
              metadata: { id: "current", generation: 1, resourceVersion: 1 },
              spec: { parentId: "root", outcome: "Review", acceptance: ["Reviewed"], mode: "achieve" },
              status: {
                observedGeneration: 1,
                phase: "waiting",
                updatedAt: "2026-01-01T00:00:00Z",
                conditionIds: ["open", "done", "absent"],
              },
            },
          },
          conditions: { open: condition("open"), done: condition("done", "true"), unrelated: condition("unrelated") },
        },
        "context-test",
      );
      expect(readAppTaskWaitPromptContext(store, null, "current").open).toEqual([
        { conditionId: "open", type: "app.dependency.completed", subject: "id:open", state: "unknown" },
      ]);
      expect(readAppTaskWaitPromptContext(store, null, "absent").open).toEqual([]);
    } finally {
      store.close();
    }
  });

  it("keeps parent prompts bounded while preserving child identity and state", () => {
    const hiddenDetail = "exact-child-detail-" + "x".repeat(8_000);
    const context: Parameters<typeof projectAppTaskChildPromptContext>[0] = {
      live: Array.from({ length: 16 }, (_, index) => ({
        taskId: `live-${index}`,
        parentId: "parent",
        generation: 1,
        phase: "waiting",
        outcome: `Resolve child ${index} ${"o".repeat(800)}`,
        agent: "sample-owner",
        input: { hiddenDetail },
        conditions: [
          {
            id: `condition-${index}`,
            type: "external.state",
            subject: `child:${index}`,
            expected: { hiddenDetail },
          },
        ],
        readiness: {
          state: "condition-blocked",
          reason: `Waiting for child ${index} ${"r".repeat(800)}`,
          relatedTaskIds: [`condition-${index}`],
        },
        hasLiveChildren: false,
        summary: `Still waiting ${"s".repeat(800)}`,
        evidence: Array.from({ length: 4 }, () => `evidence-${"e".repeat(800)}`),
      })),
      cancelled: [
        {
          taskId: "cancelled-0",
          parentId: "parent",
          generation: 1,
          outcome: `Optional work ${"o".repeat(800)}`,
          summary: `Not achieved ${"s".repeat(800)}`,
          evidence: Array.from({ length: 4 }, () => `evidence-${"e".repeat(800)}`),
          cancelledAt: "2026-08-20T00:00:00.000Z",
        },
      ],
      completed: Array.from({ length: 8 }, (_, index) => ({
        taskId: `done-${index}`,
        parentId: "parent",
        generation: 1,
        outcome: `Complete child ${index} ${"o".repeat(800)}`,
        agent: "sample-owner",
        input: { hiddenDetail },
        conditions: [],
        hasLiveChildren: false,
        summary: `Completed ${"s".repeat(800)}`,
        evidence: Array.from({ length: 4 }, () => `evidence-${"e".repeat(800)}`),
        completedAt: "2026-08-20T00:00:00.000Z",
      })),
    };

    const projected = projectAppTaskChildPromptContext(context);
    const encoded = JSON.stringify(projected);

    expect(encoded.length).toBeLessThan(40_000);
    expect(encoded).not.toContain("exact-child-detail");
    expect(encoded).not.toContain("external.state");
    expect(projected.live[0]).toMatchObject({
      taskId: "live-0",
      generation: 1,
      phase: "waiting",
      agent: "sample-owner",
    });
    expect(projected.live[0]).not.toHaveProperty("owner");
    expect(projected.completed[0]).toMatchObject({
      taskId: "done-0",
      generation: 1,
      agent: "sample-owner",
    });
    expect(projected.completed[0]).not.toHaveProperty("owner");
    expect(projected.cancelled?.[0]).toMatchObject({ taskId: "cancelled-0", generation: 1 });
    expect(projected.cancelled?.[0]?.summary.length).toBeLessThanOrEqual(256);
    expect(projected.cancelled?.[0]?.evidence).toHaveLength(2);
    expect(projected.live.some((child) => child.taskId === "cancelled-0")).toBe(false);
    expect(projected.completed.some((child) => child.taskId === "cancelled-0")).toBe(false);
  });
});
