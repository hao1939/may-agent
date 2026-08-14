import { describe, expect, test } from "bun:test";
import {
  matchesEventSelector,
  type AppEvent,
  type AppRequest,
} from "@may-agent/sdk";
import {
  canonicalAksSubscriptions,
  canonicalAksTaskSelectors,
  inputForAksEvent,
  resolveCanonicalAksTask,
  routeCanonicalAksRequest,
} from "./app.js";
import { specLoopTaskId } from "./task-loops.js";

const projectId = "aks-rp-e2e";

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data: { project: projectId, ...data },
    target: { appId: projectId, project: projectId },
    ...extra,
  };
}

function inboxRoutes(value: AppEvent<Record<string, unknown>>): string[] {
  return canonicalAksSubscriptions.flatMap((subscription) =>
    matchesEventSelector(subscription.event, value) &&
    subscription.toInput(value)
      ? [subscription.id]
      : [],
  );
}

function taskRoute(value: AppEvent<Record<string, unknown>>): string | null {
  const selected = canonicalAksTaskSelectors.some((selector) =>
    matchesEventSelector(selector, value),
  );
  return selected ? (resolveCanonicalAksTask(value)?.id ?? null) : null;
}

describe("AKS canonical route ledger", () => {
  test.each([
    ["project.owner.requested", "owner-review"],
    ["project.comment.created", "owner-review"],
    ["project.problem.investigation.requested", "problem-investigation"],
    ["project.stall.review.requested", "stall-review"],
    ["project.approval.requested", "approval-dispatch"],
  ])("admits addressed %s only through the inbox", (type, kind) => {
    const value = event(type);
    expect(inboxRoutes(value)).toHaveLength(1);
    expect(inputForAksEvent(value)?.kind).toBe(kind);
    expect(taskRoute(value)).toBeNull();
  });

  test("admits an approval message only when its intent is explicit", () => {
    const approval = event(
      "message.created",
      { intent: "approval-decision", content: "Decision: approve" },
      { owner: "agent:app-ops" },
    );
    expect(inboxRoutes(approval)).toEqual(["approval-message"]);
    expect(inboxRoutes(event("message.created", { intent: "chat" }))).toEqual(
      [],
    );
  });

  test.each([
    [
      event("aks.resource-migration.requested"),
      "runtime/unified-resource-migration-resource-liveness-v3",
    ],
    [
      event("pipeline.failure.observed", {
        specId: "network-policy",
        failureFingerprint: "failure-1",
      }),
      "domain/master-validation-failure/network-policy",
    ],
    [event("project.test_run.completed"), "runtime/owner-review"],
    [event("pipeline.test.nonpassing"), "runtime/owner-review"],
    [event("aks.workspace.integrity.changed"), "runtime/owner-review"],
    [
      event("aks.scenario-test-inventory.observed", { observation: {} }),
      "scenario-normalization",
    ],
    [
      event("pipeline.queue.overdue", { pipelineRunId: "12345" }),
      "runtime/pipeline-queue-overdue/12345",
    ],
  ])("admits deterministic facts only as task work", (value, taskId) => {
    expect(inboxRoutes(value)).toEqual([]);
    expect(taskRoute(value)).toBe(taskId);
  });

  test.each([
    event(
      "project.task.tick",
      { taskId: "spec-loop" },
      {
        action: "spec-loop",
        target: {
          appId: projectId,
          project: projectId,
          taskId: "spec-loop",
        },
      },
    ),
    event("pull-request.state", { pullRequestId: "42", state: "active" }),
    event("project.approval.submitted", {
      approvalId: "approval-1",
      decision: "approve",
    }),
    event("pipeline.completed", { pipelineRunId: "10" }),
    event("aks.node-image-publication.state", { publishedVersion: "v2" }),
    event("unrelated.fact"),
  ])(
    "does not manufacture broad work for exact/Condition/observation facts",
    (value) => {
      expect(inboxRoutes(value)).toEqual([]);
      expect(taskRoute(value)).toBeNull();
    },
  );

  test("treats an incomplete pipeline failure as observation-only", () => {
    const incomplete = event("pipeline.failure.observed", {
      specId: "network-policy",
    });
    expect(inboxRoutes(incomplete)).toEqual([]);
    expect(taskRoute(incomplete)).toBeNull();
  });

  test("keeps every declared inbox and task route mutually exclusive", () => {
    const representatives = [
      ...canonicalAksSubscriptions.map((subscription) =>
        event(
          typeof subscription.event === "string"
            ? subscription.event
            : subscription.event.type,
          { intent: "approval-decision" },
          { owner: "agent:app-ops" },
        ),
      ),
      ...canonicalAksTaskSelectors.map((selector) =>
        event(
          typeof selector === "string" ? selector : selector.type,
          {
            specId: "sample",
            failureFingerprint: "sample-failure",
            pipelineRunId: "sample-run",
          },
          {
            owner: typeof selector === "string" ? undefined : selector.owner,
          },
        ),
      ),
    ];

    for (const value of representatives) {
      expect(
        inboxRoutes(value).length > 0 &&
          canonicalAksTaskSelectors.some((selector) =>
            matchesEventSelector(selector, value),
          ),
      ).toBe(false);
    }
  });

  test("routes typed inputs to desired tasks while retaining inbox ownership", () => {
    const request = (kind: string, data: Record<string, unknown> = {}) =>
      ({
        id: `request-${kind}`,
        source: { kind: "human", id: "hao" },
        input: { kind, data },
      }) as AppRequest;

    expect(routeCanonicalAksRequest(request("owner-review"))).toMatchObject({
      type: "task",
      task: { kind: "desired", intent: { id: "runtime/owner-review" } },
    });
    expect(
      routeCanonicalAksRequest(
        request("task-control", {
          action: "spec-loop",
          taskId: "spec-loop",
        }),
      ),
    ).toMatchObject({
      type: "task",
      task: { kind: "desired", intent: { id: specLoopTaskId } },
    });
    expect(routeCanonicalAksRequest(request("approval-decision"))).toBeNull();
  });
});
