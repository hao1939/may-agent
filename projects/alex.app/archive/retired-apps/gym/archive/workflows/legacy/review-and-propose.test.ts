import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { canonicalGymTestContext } from "./lib/test-context";
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

function factData(event: Record<string, unknown>): Record<string, unknown> {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? (event.data as Record<string, unknown>)
    : {};
}

function context(input: {
  task: string;
  projectsRoot: string;
  emitted: Record<string, unknown>[];
  dispatched: Record<string, unknown>[];
  rejectAgentRun?: boolean;
  reviewDecision?: {
    disposition: "human-review" | "covered" | "runtime" | "invalid" | "weak";
    matchedCoverage: string[];
    dispositionReason: string;
  };
  agentTasks?: string[];
}): WorkflowContext {
  return canonicalGymTestContext({
    task: input.task,
    projectsRoot: input.projectsRoot,
    async runAgent(_agent: string, agentTask: string) {
      input.agentTasks?.push(agentTask);
      if (input.rejectAgentRun) {
        throw new Error("approved replay must reuse the preserved proposal");
      }
      return {
        status: "done",
        sessionId: "s_review",
        structuredResult: {
          proposal:
            "## Classification\nPrimary May behavior gap.\n\n## Evidence\nThe incident shows a missing disposition before unsupported repair work.\n\n## Smallest next action\nAdd one replay, one paraphrase, and one opposite control; run the approved improvement path and preserve the original evidence.\n\n## Approval boundary\nHao decides whether this proposal should start improvement work.",
          ...input.reviewDecision,
        },
      } as never;
    },
    emit(event: Record<string, unknown>) {
      input.emitted.push(event);
    },
    dispatchEvent(type: string, data?: Record<string, unknown>) {
      input.dispatched.push({ type, ...data });
    },
  });
}

test("semantic novelty gate files covered evidence without asking the human", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-review-covered-"));
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
        reviewDecision: {
          disposition: "covered",
          matchedCoverage: ["may-alignment/durable-submission-path"],
          dispositionReason:
            "The approved durable-submission case already teaches the same closure behavior.",
        },
      }),
    );

    expect(result).toMatchObject({
      status: "done",
      output: { state: "converged" },
    });
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.review.filtered",
        localKey: expect.stringMatching(/-filtered$/),
        data: expect.objectContaining({
          disposition: "covered",
          matchedCoverage: ["may-alignment/durable-submission-path"],
        }),
      }),
      expect.objectContaining({
        type: "project.approval.resolved",
        localKey: expect.stringMatching(/-approval-superseded$/),
        data: expect.objectContaining({
          taskId: "runtime/review-proposal/incident-42",
          taskGeneration: 3,
          resolution: "superseded",
          disposition: "covered",
        }),
      }),
    ]);
    expect(dispatched).toEqual([]);
    expect(
      emitted.some((event) => event.type === "project.approval.requested"),
    ).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("novelty policy keeps app mechanics out of May learning", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-review-boundary-"));
  const agentTasks: string[] = [];
  try {
    await execute(
      context({
        task: task({
          type: "gym.review.requested",
          requestKey: "incident-42",
          kind: "incident",
        }),
        projectsRoot: join(root, "projects"),
        emitted: [],
        dispatched: [],
        agentTasks,
        reviewDecision: {
          disposition: "runtime",
          matchedCoverage: [],
          dispositionReason:
            "Relative report-path lookup is an app-internal file-resolution mechanic, not new May behavior.",
        },
      }),
    );

    expect(agentTasks).toHaveLength(1);
    expect(agentTasks[0]).toContain(
      "App-internal mechanics are not May learning",
    );
    expect(agentTasks[0]).toContain(
      "Classify an app-internal mechanics issue as runtime",
    );
    expect(agentTasks[0]).toContain(
      "never create a May benchmark that teaches those internals",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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
      status: "done",
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
    expect(
      emitted.find((event) => event.type === "gym.review.ready"),
    ).toMatchObject({ localKey: expect.stringMatching(/-ready$/) });
    expect(requested).toMatchObject({
      type: "project.approval.requested",
      localKey: expect.stringMatching(/-approval-requested$/),
      data: expect.objectContaining({
        project: "gym",
        taskId: "runtime/review-proposal/incident-42",
        taskGeneration: 3,
        approvalKind: "review-proposal",
        approvalId: expect.stringMatching(/^gym:review-proposal:incident-42:g3:/),
        expectedResponse: expect.objectContaining({
          type: "project.approval.submitted",
        }),
      }),
    });
    expect(dispatched).toEqual([
      expect.objectContaining({
        type: "message.created",
        to: "human",
        projectPath: "projects/gym.app",
        approvalId: expect.stringMatching(/^gym:review-proposal:incident-42:g3:/),
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
    const benchmarkDir = join(
      projectsRoot,
      "gym",
      "benchmarks",
      "incident-review",
    );
    mkdirSync(benchmarkDir, { recursive: true });
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      `${JSON.stringify({ scenarios: ["incident-replay"], labels_file: "labels.json" })}\n`,
    );
    writeFileSync(
      join(benchmarkDir, "labels.json"),
      `${JSON.stringify({ labels: { "incident-replay": { status: "approved", source: "incident-42-approved-review" } } })}\n`,
    );
    const expected = factData(requested).expectedResponse as Record<string, unknown>;
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
      status: "done",
      output: { state: "converged" },
    });
    expect(emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "gym.review.approved",
          localKey: expect.stringMatching(/-approved$/),
          data: expect.objectContaining({ approvalId: expected.approvalId }),
        }),
        expect.objectContaining({
          type: "gym.improvement.requested",
          localKey: expect.stringMatching(/-improvement-requested$/),
          data: expect.objectContaining({
            reason: "approved-review-proposal",
            requestKey: "incident-42",
            incidentId: "incident-42",
            approvalId: expected.approvalId,
            benchmark: "incident-review",
            scenarios: ["incident-replay"],
          }),
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

test("approved review never falls back to an unrelated benchmark", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-review-no-target-"));
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
    const expected = factData(requested).expectedResponse as Record<string, unknown>;
    const emitted: Record<string, unknown>[] = [];
    const result = await execute(
      context({
        task: task({
          type: "project.approval.submitted",
          data: { ...expected, decision: "approve" },
        }),
        projectsRoot,
        emitted,
        dispatched: [],
        rejectAgentRun: true,
      }),
    );

    expect(result).toMatchObject({
      status: "done",
      output: { state: "needs-owner" },
    });
    expect(
      (result as { output?: Record<string, unknown> }).output,
    ).not.toHaveProperty("actions");
    expect(
      emitted.some((event) => event.type === "gym.improvement.requested"),
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
      status: "done",
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
