import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectAppContext, WorkflowContext } from "@may-agent/sdk";
import { routeGymEvent } from "../../../app.ts";
import { execute as captureIncident } from "./incident-intake.ts";
import { execute as reviewAndPropose } from "./review-and-propose.ts";

function task(event: Record<string, unknown>): string {
  return `app: test\n\n## Trigger Event\n\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

function reviewTask(event: Record<string, unknown>): string {
  return [
    "app: test",
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify({
      taskId: "runtime/review-proposal/s-e2e-failure",
      generation: 1,
      input: {
        kind: event.kind,
        requestKey: event.requestKey,
        incidentId: event.incidentId,
        incidentPath: event.incidentPath,
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

test("evaluation failure flows from app routing to a durable review proposal", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-app-e2e-"));
  const projectsRoot = join(root, "projects");
  const routed: Array<Record<string, unknown>> = [];
  const appCtx = {
    emit(event: Record<string, unknown>) {
      routed.push(event);
      return event;
    },
    noop(reason: string) {
      return { reason };
    },
  } as unknown as ProjectAppContext;

  await routeGymEvent(appCtx, {
    type: "evaluation.reviewed",
    agent: "may",
    lane: "needs_triage",
    reviewedVerdict: "needs_improvement",
    sessionId: "s_e2e_failure",
    artifactPath: "/app/example-review.md",
  });
  expect(routed).toHaveLength(2);
  expect(routed).toContainEqual(
    expect.objectContaining({
      type: "gym.learning.evidence.observed",
      params: expect.objectContaining({ polarity: "negative" }),
    }),
  );
  const incident = routed.find(
    (event) => event.type === "gym.incident.detected",
  );
  expect(incident).toBeDefined();

  const intakeEvents: Array<Record<string, unknown>> = [];
  const intakeCtx = {
    task: task(incident!),
    projectsRoot,
    emit(event: Record<string, unknown>) {
      intakeEvents.push(event);
    },
    done(summary: string) {
      return { type: "done" as const, summary };
    },
    blocked(reason: string) {
      return { type: "blocked" as const, reason };
    },
  } as unknown as WorkflowContext;
  expect((await captureIncident(intakeCtx)).type).toBe("done");
  expect(intakeEvents).toHaveLength(1);
  const incidentPath = String(intakeEvents[0]!.incidentPath);
  expect(existsSync(incidentPath)).toBe(true);

  const reviewEvents: Array<Record<string, unknown>> = [];
  const reviewDispatches: Array<Record<string, unknown>> = [];
  const reviewCtx = {
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
        messages: [
          {
            role: "assistant",
            content: [{ type: "text", text: proposal }],
          },
        ],
      };
    },
    emit(event: Record<string, unknown>) {
      reviewEvents.push(event);
    },
    dispatchEvent(type: string, data: Record<string, unknown>) {
      reviewDispatches.push({ type, ...data });
    },
    notify() {
      throw new Error("typed review approval must replace plain notifications");
    },
    done(summary: string, output?: unknown) {
      return { type: "done" as const, summary, output };
    },
    blocked(reason: string) {
      return { type: "blocked" as const, reason };
    },
  } as unknown as WorkflowContext;
  expect((await reviewAndPropose(reviewCtx)).type).toBe("done");

  expect(reviewEvents).toHaveLength(2);
  expect(reviewEvents[0]).toMatchObject({
    type: "gym.review.ready",
    humanApprovalRequired: true,
  });
  const reviewPath = String(reviewEvents[0]!.reviewPath);
  expect(readFileSync(reviewPath, "utf8")).toContain(
    "Replay the correction, add a paraphrase, and add an opposite control",
  );
  expect(reviewEvents[1]).toMatchObject({
    type: "project.approval.requested",
    approvalKind: "review-proposal",
    packetPath: reviewPath,
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
