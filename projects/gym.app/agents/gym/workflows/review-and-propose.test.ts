import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./review-and-propose";

function task(trigger: Record<string, unknown>): string {
  return [
    "## Reconciliation Task",
    "```json",
    JSON.stringify({
      taskId: "runtime/review-proposal/incident-42",
      generation: 3,
      input: {
        kind: "incident",
        requestKey: "incident-42",
        incidentId: "incident-42",
        incidentPath: "/evidence/incident-42.json",
      },
    }),
    "```",
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify(trigger),
    "```",
  ].join("\n");
}

function context(input: {
  task: string;
  projectsRoot: string;
  emitted: Record<string, unknown>[];
  dispatched: Record<string, unknown>[];
  rejectAgentRun?: boolean;
}): WorkflowContext {
  return {
    task: input.task,
    projectsRoot: input.projectsRoot,
    async runAgent() {
      if (input.rejectAgentRun) {
        throw new Error("approved replay must reuse the preserved proposal");
      }
      return {
        status: "done",
        sessionId: "s_review",
        structuredResult: {
          proposal:
            "## Classification\nPrimary May behavior gap.\n\n## Evidence\nThe incident shows a missing disposition before unsupported repair work.\n\n## Smallest next action\nAdd one replay, one paraphrase, and one opposite control; run the approved improvement path and preserve the original evidence.\n\n## Approval boundary\nHao decides whether this proposal should start improvement work.",
        },
      } as never;
    },
    emit(event: Record<string, unknown>) {
      input.emitted.push(event);
    },
    dispatchEvent(type: string, data?: Record<string, unknown>) {
      input.dispatched.push({ type, ...data });
    },
    notify() {
      throw new Error("review proposals use the typed approval convention");
    },
    done(summary: string, output?: unknown) {
      return { type: "done" as const, summary, output };
    },
    blocked(reason: string, context?: unknown) {
      return { type: "blocked" as const, reason, context };
    },
  } as unknown as WorkflowContext;
}

test("review proposal requests one typed project approval", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-review-approval-"));
  const emitted: Record<string, unknown>[] = [];
  const dispatched: Record<string, unknown>[] = [];
  try {
    const result = await execute(
      context({
        task: task({
          type: "gym.review.requested",
          requestKey: "incident-42",
          kind: "incident",
        }),
        projectsRoot: join(root, "projects"),
        emitted,
        dispatched,
      }),
    );

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "waiting",
        conditions: [
          expect.objectContaining({ type: "project.approval.submitted" }),
        ],
      },
    });
    const requested = emitted.find(
      (event) => event.type === "project.approval.requested",
    );
    expect(requested).toMatchObject({
      project: "gym",
      taskId: "runtime/review-proposal/incident-42",
      taskGeneration: 3,
      approvalKind: "review-proposal",
      approvalId: expect.stringMatching(/^gym:review-proposal:incident-42:g3:/),
      expectedResponse: expect.objectContaining({
        type: "project.approval.submitted",
      }),
    });
    expect(dispatched).toEqual([
      expect.objectContaining({
        type: "message.created",
        to: "human",
        projectPath: "projects/gym.app",
        approvalId: requested?.approvalId,
        expectedResponse: expect.objectContaining({
          type: "project.approval.submitted",
        }),
      }),
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("approved review starts the existing improvement path", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-review-approved-"));
  const projectsRoot = join(root, "projects");
  const firstEvents: Record<string, unknown>[] = [];
  try {
    await execute(
      context({
        task: task({
          type: "gym.review.requested",
          requestKey: "incident-42",
          kind: "incident",
        }),
        projectsRoot,
        emitted: firstEvents,
        dispatched: [],
      }),
    );
    const requested = firstEvents.find(
      (event) => event.type === "project.approval.requested",
    )!;
    const expected = requested.expectedResponse as Record<string, unknown>;
    const emitted: Record<string, unknown>[] = [];
    const result = await execute(
      context({
        task: task({
          type: "project.approval.submitted",
          data: {
            ...expected,
            decision: "approve",
            message: "approve",
          },
        }),
        projectsRoot,
        emitted,
        dispatched: [],
        rejectAgentRun: true,
      }),
    );

    expect(result).toMatchObject({
      type: "done",
      output: { state: "converged" },
    });
    expect(emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "gym.review.approved",
          approvalId: expected.approvalId,
        }),
        expect.objectContaining({
          type: "gym.improvement.requested",
          reason: "approved-review-proposal",
          requestKey: "incident-42",
          incidentId: "incident-42",
          approvalId: expected.approvalId,
        }),
      ]),
    );
    expect(
      emitted.some((event) => event.type === "project.approval.requested"),
    ).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("approval recovery restores lineage without asking the human again", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-review-recovery-"));
  const emitted: Record<string, unknown>[] = [];
  const dispatched: Record<string, unknown>[] = [];
  try {
    const result = await execute(
      context({
        task: task({
          type: "gym.review.requested",
          requestKey: "incident-42",
          kind: "incident",
          approvedBy: "telegram:46020",
        }),
        projectsRoot: join(root, "projects"),
        emitted,
        dispatched,
      }),
    );

    expect(result).toMatchObject({
      type: "done",
      output: { state: "waiting" },
    });
    expect(
      emitted.some((event) => event.type === "project.approval.requested"),
    ).toBe(true);
    expect(dispatched).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
