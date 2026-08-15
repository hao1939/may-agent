import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute as captureIncident } from "./incident-intake.ts";
import { canonicalGymTestContext } from "./lib/test-context";
import { execute as reviewAndPropose } from "./review-and-propose.ts";

function task(event: Record<string, unknown>): string {
  return `app: test\n\n## Trigger Event\n\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

function reviewTask(event: Record<string, unknown>): string {
  const data = event.data as Record<string, unknown>;
  return [
    "app: test",
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify({
      taskId: "runtime/review-proposal/s-e2e-failure",
      generation: 1,
      input: {
        kind: data.kind,
        requestKey: data.requestKey,
        incidentId: data.incidentId,
        incidentPath: data.incidentPath,
      },
    }),
    "```",
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify(event),
    "```",
  ].join("\n");
}

test("a failure incident flows to a durable review proposal", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-app-e2e-"));
  const projectsRoot = join(root, "projects");
  const incident = {
    type: "gym.incident.detected",
    data: {
      reason: "may-evaluation-failure",
      evaluation: {
        agent: "may",
        lane: "needs_triage",
        reviewedVerdict: "needs_improvement",
        sessionId: "s_e2e_failure",
        artifactPath: "/app/example-review.md",
      },
    },
    target: { appId: "gym", project: "gym" },
  };

  const intakeEvents: Array<Record<string, unknown>> = [];
  const intakeCtx = canonicalGymTestContext({
    task: task(incident),
    projectsRoot,
    emit(event: Record<string, unknown>) {
      intakeEvents.push(event);
    },
  });
  expect((await captureIncident(intakeCtx)).status).toBe("done");
  expect(intakeEvents).toHaveLength(1);
  const incidentData = intakeEvents[0]!.data as Record<string, unknown>;
  const incidentPath = String(incidentData.incidentPath);
  expect(existsSync(incidentPath)).toBe(true);

  const reviewEvents: Array<Record<string, unknown>> = [];
  const reviewDispatches: Array<Record<string, unknown>> = [];
  const reviewCtx = canonicalGymTestContext({
    task: reviewTask(intakeEvents[0]!),
    projectsRoot,
    async runAgent(agent: string, prompt: string, options: unknown) {
      expect(agent).toBe("gym");
      expect(prompt).toContain(incidentPath);
      expect(options).toBeDefined();
      const proposal =
        "## Classification\nMay behavior. The incident conflicts with an explicit diagnosis-only boundary.\n\n## Proposed case\nReplay the correction, add a paraphrase, and add an opposite control where implementation is requested. Reproduce current May before changing guidance.\n\n## Approval\nHuman approval is required for intended behavior and benchmark activation.";
      return {
        status: "done" as const,
        sessionId: "s_gym_review",
        lastAssistantText: "Review complete.",
        structuredResult: {
          proposal,
          disposition: "human-review",
          matchedCoverage: [],
          dispositionReason:
            "This incident requires a new human-owned May behavior decision before benchmark activation.",
        },
      };
    },
    emit(event: Record<string, unknown>) {
      reviewEvents.push(event);
    },
    dispatchEvent(type: string, data: Record<string, unknown>) {
      reviewDispatches.push({ type, ...data });
    },
  });
  expect((await reviewAndPropose(reviewCtx)).status).toBe("done");

  expect(reviewEvents).toHaveLength(2);
  expect(reviewEvents[0]).toMatchObject({
    type: "gym.review.ready",
    data: { humanApprovalRequired: true },
  });
  const reviewData = reviewEvents[0]!.data as Record<string, unknown>;
  const reviewPath = String(reviewData.reviewPath);
  expect(readFileSync(reviewPath, "utf8")).toContain(
    "Replay the correction, add a paraphrase, and add an opposite control",
  );
  expect(reviewEvents[1]).toMatchObject({
    type: "project.approval.requested",
    data: {
      approvalKind: "review-proposal",
      packetPath: reviewPath,
    },
  });
  expect(reviewDispatches).toEqual([
    expect.objectContaining({
      type: "message.created",
      expectedResponse: expect.objectContaining({
        type: "project.approval.submitted",
      }),
    }),
  ]);
});
