import { describe, expect, test } from "bun:test";
import {
  completionReviewPendingActionV2,
  deliverPendingActionV2,
  projectPendingActionsV2,
  reviewApplicationPendingActionV2,
  type ProjectPendingActionsV2Input,
} from "./lib/project-pending-actions-v2.ts";

const NOW = Date.parse("2026-07-16T04:00:00.000Z");

function project(overrides: Partial<ProjectPendingActionsV2Input> = {}) {
  return projectPendingActionsV2({
    nowMs: NOW,
    reviewGraceMs: 15 * 60_000,
    reviewApplicationGraceMs: 5 * 60_000,
    attempts: [],
    reviews: [],
    conditions: [],
    ...overrides,
  });
}

describe("Project PendingAction V2 projection", () => {
  test("normalizes queued, accepted, and satisfied assignment delivery", () => {
    const actions = project({
      attempts: [
        {
          taskId: "queued",
          taskRevision: 1,
          attemptId: "attempt-queued",
          sessionId: "session-queued",
          assignmentState: "queued",
          runtimeState: "starting",
          assignedAt: "2026-07-16T03:59:00.000Z",
          lastActivityAt: null,
        },
        {
          taskId: "accepted",
          taskRevision: 2,
          attemptId: "attempt-accepted",
          sessionId: "session-accepted",
          assignmentState: "consumed",
          runtimeState: "missing",
          assignedAt: "2026-07-16T03:30:00.000Z",
          lastActivityAt: null,
        },
        {
          taskId: "started",
          taskRevision: 3,
          attemptId: "attempt-started",
          sessionId: "session-started",
          assignmentState: "consumed",
          runtimeState: "running",
          assignedAt: "2026-07-16T03:30:00.000Z",
          lastActivityAt: "2026-07-16T03:59:30.000Z",
        },
      ],
    });

    expect(
      Object.fromEntries(
        actions.map((action) => [action.subject.taskId, action.status]),
      ),
    ).toEqual({
      accepted: "accepted",
      queued: "pending",
      started: "satisfied",
    });
    expect(actions[0]).toMatchObject({
      kind: "assignment-delivery",
      key: "assignment-delivery:accepted:2:attempt-accepted",
      delivery: { maxAttempts: null },
      postcondition: { kind: "matching-worker-session-started" },
    });
  });

  test("uses the durable completion and reviewer result as payload authorities", () => {
    const actions = project({
      reviews: [
        {
          taskId: "missing-review",
          taskRevision: 1,
          attemptId: "attempt-missing",
          completedAt: "2026-07-16T03:30:00.000Z",
          latestDecision: null,
          latestDecisionId: null,
          latestDecisionAt: null,
          deliveryState: "missing",
        },
        {
          taskId: "decision-pending",
          taskRevision: 2,
          attemptId: "attempt-decision",
          completedAt: "2026-07-16T03:30:00.000Z",
          latestDecision: "accepted",
          latestDecisionId: "review-42",
          latestDecisionAt: "2026-07-16T03:45:00.000Z",
          deliveryState: "decision-pending-apply",
          actionDeliveryStatus: "pending",
        },
      ],
    });

    expect(actions).toContainEqual(
      expect.objectContaining({
        key: "completion-review-delivery:missing-review:1:attempt-missing",
        kind: "completion-review-delivery",
        status: "pending",
        payloadRef: expect.objectContaining({ source: "task-completion" }),
      }),
    );
    expect(actions).toContainEqual(
      expect.objectContaining({
        key: "completion-review-delivery:decision-pending:2:attempt-decision",
        status: "satisfied",
      }),
    );
    expect(actions).toContainEqual(
      expect.objectContaining({
        key: "review-application-delivery:decision-pending:2:attempt-decision:review-42",
        kind: "review-application-delivery",
        status: "pending",
        payloadRef: expect.objectContaining({ source: "reviewer-result" }),
      }),
    );
  });

  test("keeps accepted completion delivery distinct from reviewer satisfaction", () => {
    const actions = project({
      reviews: [
        {
          taskId: "accepted-completion",
          taskRevision: 2,
          controlPlaneVersion: 2,
          attemptId: "attempt-2",
          completedAt: "2026-07-16T03:50:00.000Z",
          latestDecision: null,
          latestDecisionId: null,
          latestDecisionAt: null,
          deliveryState: "within-grace",
          completionDeliveryStatus: "accepted",
          completionDeliveryAttempts: 1,
          completionAcceptedAt: "2026-07-16T03:50:01.000Z",
        },
      ],
    });

    expect(actions).toContainEqual(
      expect.objectContaining({
        key: "completion-review-delivery:accepted-completion:2:attempt-2",
        status: "accepted",
        delivery: {
          attempts: 1,
          acceptedAt: "2026-07-16T03:50:01.000Z",
          maxAttempts: 2,
        },
        postcondition: expect.objectContaining({
          kind: "matching-reviewer-decision-recorded",
          dueAt: "2026-07-16T04:05:00.000Z",
        }),
      }),
    );
  });

  test("suppresses replay of an accepted completion delivery before review satisfaction", () => {
    const source = {
      taskId: "completion",
      taskRevision: 2,
      controlPlaneVersion: 2,
      attemptId: "attempt-2",
      completedAt: "2026-07-16T03:50:00.000Z",
      latestDecision: null,
      latestDecisionId: null,
      latestDecisionAt: null,
      deliveryState: "within-grace" as const,
      completionDeliveryStatus: "pending" as const,
      completionDeliveryAttempts: 0,
      completionAcceptedAt: null,
    };
    const action = completionReviewPendingActionV2(source, 15 * 60_000)!;
    let dispatches = 0;
    const first = deliverPendingActionV2({
      action,
      now: "2026-07-16T03:50:01.000Z",
      dispatch: () => {
        dispatches += 1;
      },
    });
    const projectedAccepted = completionReviewPendingActionV2(
      {
        ...source,
        completionDeliveryStatus: "accepted",
        completionDeliveryAttempts: 1,
        completionAcceptedAt: first.receipt!.recordedAt,
      },
      15 * 60_000,
    )!;
    const replay = deliverPendingActionV2({
      action: projectedAccepted,
      now: "2026-07-16T03:51:00.000Z",
      priorReceipts: [first.receipt!],
      dispatch: () => {
        dispatches += 1;
      },
    });

    expect(first).toMatchObject({ accepted: true, dispatched: true });
    expect(projectedAccepted.status).toBe("accepted");
    expect(replay).toMatchObject({
      accepted: true,
      dispatched: false,
      replayed: true,
    });
    expect(dispatches).toBe(1);
  });

  test("keeps Condition continuation and fallback delivery as separate actions", () => {
    const actions = project({
      conditions: [
        {
          id: "condition:pipeline:ado:42:terminal",
          status: "resolved",
          subject: { id: "verify", revision: 3 },
          fallbackAction: "judge once",
          continuation: {
            recoveryKey:
              "condition-continuation:condition:pipeline:ado:42:terminal:3",
            status: "pending",
            createdAt: "2026-07-16T03:50:00.000Z",
            assignedAt: null,
            assignmentAttemptId: null,
            assignmentSessionId: null,
          },
          fallbackExecution: {
            recoveryKey:
              "condition-fallback:condition:pipeline:ado:42:terminal:3",
            claimId: "claim-42",
            status: "dispatched",
            attempts: 2,
            claimedAt: "2026-07-16T03:30:00.000Z",
            leaseExpiresAt: "2026-07-16T03:35:00.000Z",
            dispatchedAt: "2026-07-16T03:31:00.000Z",
            acknowledgementDueAt: "2026-07-16T03:46:00.000Z",
            acknowledgedAt: null,
          },
        },
      ],
    });

    expect(actions).toContainEqual(
      expect.objectContaining({
        kind: "condition-continuation-delivery",
        status: "pending",
        delivery: expect.objectContaining({ maxAttempts: null }),
      }),
    );
    expect(actions).toContainEqual(
      expect.objectContaining({
        kind: "condition-fallback-delivery",
        status: "accepted",
        delivery: expect.objectContaining({ attempts: 2, maxAttempts: 3 }),
      }),
    );
  });

  test("does not keep an assigned continuation pending after its subject leaves active work", () => {
    const condition = {
      id: "condition:pipeline:ado:42:terminal",
      status: "resolved" as const,
      subject: { id: "verify", revision: 3 },
      subjectState: "absent",
      fallbackAction: null,
      fallbackExecution: null,
      continuation: {
        recoveryKey:
          "condition-continuation:condition:pipeline:ado:42:terminal:3",
        status: "assigned",
        createdAt: "2026-07-16T03:30:00.000Z",
        assignedAt: "2026-07-16T03:31:00.000Z",
        assignmentAttemptId: "attempt-42",
        assignmentSessionId: "session-42",
      },
    };

    expect(project({ conditions: [condition] })[0].status).toBe("superseded");

    condition.subjectState = "review";
    expect(project({ conditions: [condition] })[0].status).toBe("satisfied");
  });

  test("exhausts only the automatic fallback budget and satisfaction remains observable", () => {
    const condition = {
      id: "condition:pipeline:ado:42:terminal",
      status: "resolved" as const,
      subject: { id: "verify", revision: 3 },
      fallbackAction: "judge once",
      continuation: null,
      fallbackExecution: {
        recoveryKey: "condition-fallback:condition:pipeline:ado:42:terminal:3",
        claimId: "claim-42",
        status: "dispatched",
        attempts: 3,
        claimedAt: "2026-07-16T03:00:00.000Z",
        leaseExpiresAt: "2026-07-16T03:05:00.000Z",
        dispatchedAt: "2026-07-16T03:10:00.000Z",
        acknowledgementDueAt: "2026-07-16T03:25:00.000Z",
        acknowledgedAt: null as string | null,
      },
    };

    expect(project({ conditions: [condition] })[0].status).toBe("exhausted");

    condition.fallbackExecution.status = "acknowledged";
    condition.fallbackExecution.acknowledgedAt = "2026-07-16T03:40:00.000Z";
    expect(project({ conditions: [condition] })[0]).toMatchObject({
      status: "satisfied",
      postcondition: { satisfiedAt: "2026-07-16T03:40:00.000Z" },
    });
  });

  test("delivers a keyed action once and bounds failed retries", () => {
    const action = reviewApplicationPendingActionV2(
      {
        taskId: "review",
        taskRevision: 2,
        attemptId: "attempt-review",
        completedAt: "2026-07-16T03:30:00.000Z",
        latestDecision: "accept",
        latestDecisionId: "review-42",
        latestDecisionAt: "2026-07-16T03:45:00.000Z",
        deliveryState: "decision-pending-apply",
        actionDeliveryStatus: "pending",
      },
      15 * 60_000,
    )!;
    let dispatches = 0;
    const accepted = deliverPendingActionV2({
      action,
      now: "2026-07-16T04:00:00.000Z",
      dispatch: () => {
        dispatches += 1;
      },
    });
    expect(accepted).toMatchObject({
      dispatched: true,
      accepted: true,
      replayed: false,
      receipt: { attempt: 1, status: "accepted" },
    });
    const replay = deliverPendingActionV2({
      action,
      now: "2026-07-16T04:01:00.000Z",
      priorReceipts: [accepted.receipt!],
      dispatch: () => {
        dispatches += 1;
      },
    });
    expect(replay).toMatchObject({
      dispatched: false,
      accepted: true,
      replayed: true,
    });
    expect(dispatches).toBe(1);
    const redelivery = deliverPendingActionV2({
      action,
      now: "2026-07-16T04:01:30.000Z",
      priorReceipts: [accepted.receipt!],
      redeliverAccepted: true,
      dispatch: () => {
        dispatches += 1;
      },
    });
    expect(redelivery).toMatchObject({
      dispatched: true,
      accepted: true,
      replayed: false,
      receipt: { attempt: 2, status: "accepted" },
    });
    expect(dispatches).toBe(2);

    const firstFailure = deliverPendingActionV2({
      action,
      now: "2026-07-16T04:02:00.000Z",
      dispatch: () => {
        throw new Error("first failure");
      },
    });
    const secondFailure = deliverPendingActionV2({
      action,
      now: "2026-07-16T04:03:00.000Z",
      priorReceipts: [firstFailure.receipt!],
      dispatch: () => {
        throw new Error("second failure");
      },
    });
    const exhausted = deliverPendingActionV2({
      action,
      now: "2026-07-16T04:04:00.000Z",
      priorReceipts: [firstFailure.receipt!, secondFailure.receipt!],
      dispatch: () => {
        throw new Error("must not run");
      },
    });
    expect(firstFailure.receipt).toMatchObject({
      attempt: 1,
      status: "failed",
    });
    expect(secondFailure.receipt).toMatchObject({
      attempt: 2,
      status: "failed",
    });
    expect(exhausted).toMatchObject({
      dispatched: false,
      accepted: false,
      exhausted: true,
    });
  });
});
