import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTaskTreePath } from "@may-agent/sdk";
import {
  buildProjectSnapshotV2,
  type SnapshotReview,
} from "./lib/project-snapshot-v2.ts";
import {
  claimNextReviewHandoffActionV2,
  completeReviewHandoffActionV2,
  failReviewHandoffActionV2,
  supervisorRecoveryRegistryV2,
  terminalAttemptRecoveryCandidatesV2,
} from "./lib/project-supervisor-v2.ts";
import { readTaskTree } from "./lib/task-tree-store.ts";
import { taskTreeConfig } from "./lib/task-tree-tools.ts";

const BASE = Date.parse("2026-07-16T04:00:00.000Z");

async function fixture(revision = 2, v2Cohort = true) {
  const appDir = await mkdtemp(join(tmpdir(), "aks-supervisor-v2-"));
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        root_task_id: "project",
        updated_at: "2026-07-16T03:59:00.000Z",
        tasks: {
          project: {
            id: "project",
            state: "active",
            children: ["review-task"],
          },
          "review-task": {
            id: "review-task",
            parent_id: "project",
            state: "review",
            revision,
            children: [],
            goal: "Review the current claim.",
            outputs: ["evidence/review.md"],
            acceptance: ["The review is applied."],
            ...(v2Cohort ? { context: { controlPlaneVersion: 2 } } : {}),
            trace: {
              current_attempt_id: "attempt-2",
              last_worker_completed_at: "2026-07-16T03:00:00.000Z",
              last_worker_result: "done",
              last_worker_summary: "Current completion claim.",
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const config = taskTreeConfig({
    appDir,
    projectDir: appDir,
    worker: "aks-explorer",
    maxConcurrent: 2,
  });
  return { appDir, config };
}

function snapshot(
  config: ReturnType<typeof taskTreeConfig>,
  nowMs: number,
  reviews: SnapshotReview[],
) {
  return buildProjectSnapshotV2({
    projectId: "aks-rp-e2e",
    tree: readTaskTree(config),
    assignments: [],
    sessions: [],
    attemptHeartbeats: [],
    reviews,
    loops: [],
    deliveryGaps: [],
    nowMs,
  });
}

describe("Project Supervisor V2 review handoff", () => {
  test("converges missing review and unapplied decision as two distinct recovery keys", async () => {
    const { config } = await fixture();
    const missing = snapshot(config, BASE, []);
    const missingFinding = missing.invariants.find(
      (finding) => finding.type === "review-delivery-missing",
    );
    expect(missingFinding).toBeDefined();

    const completionClaim = claimNextReviewHandoffActionV2(config, missing, {
      now: "2026-07-16T04:00:00.000Z",
    });
    expect(completionClaim).toMatchObject({
      claimed: true,
      actionKind: "reemit-completion",
      taskId: "review-task",
      taskRevision: 2,
      attemptId: "attempt-2",
    });
    expect(
      completeReviewHandoffActionV2(config, {
        recoveryKey: completionClaim.recoveryKey!,
        leaseId: completionClaim.leaseId!,
        actionKind: "reemit-completion",
        completedAt: "2026-07-16T04:00:01.000Z",
      }),
    ).toBe(true);

    const reviews: SnapshotReview[] = [
      {
        taskId: "review-task",
        taskRevision: 2,
        attemptId: "attempt-2",
        decision: "accept",
        ts: "2026-07-16T04:01:00.000Z",
      },
    ];
    const pendingApply = snapshot(config, BASE + 61_000, reviews);
    const pendingFinding = pendingApply.invariants.find(
      (finding) => finding.type === "review-decision-not-applied",
    );
    expect(pendingFinding?.recoveryKey).toMatch(
      /^review-decision-not-applied:review-task:2:attempt-2:[a-f0-9]{24}$/,
    );
    const reviewedClaim = claimNextReviewHandoffActionV2(config, pendingApply, {
      now: "2026-07-16T04:01:01.000Z",
    });
    expect(reviewedClaim).toMatchObject({
      claimed: true,
      actionKind: "reemit-reviewed",
      taskId: "review-task",
      taskRevision: 2,
      attemptId: "attempt-2",
    });
    expect(reviewedClaim.decisionId).toMatch(/^[a-f0-9]{24}$/);

    const registry = supervisorRecoveryRegistryV2(readTaskTree(config));
    expect(registry[missingFinding!.recoveryKey].status).toBe("resolved");
    expect(registry[pendingFinding!.recoveryKey].status).toBe("claimed");
  });

  test("uses one automatic action, one postcondition grace, and one owner request", async () => {
    const { config } = await fixture();
    const first = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE, []),
      { now: "2026-07-16T04:00:00.000Z" },
    );
    expect(first.actionKind).toBe("reemit-completion");
    expect(
      completeReviewHandoffActionV2(config, {
        recoveryKey: first.recoveryKey!,
        leaseId: first.leaseId!,
        actionKind: "reemit-completion",
        completedAt: "2026-07-16T04:00:01.000Z",
      }),
    ).toBe(true);

    const withinGrace = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE + 3 * 60_000, []),
      { now: "2026-07-16T04:03:00.000Z" },
    );
    expect(withinGrace).toMatchObject({ claimed: false });

    const owner = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE + 6 * 60_000, []),
      { now: "2026-07-16T04:06:00.000Z" },
    );
    expect(owner).toMatchObject({
      claimed: true,
      actionKind: "request-owner",
      recoveryKey: first.recoveryKey,
    });
    expect(
      completeReviewHandoffActionV2(config, {
        recoveryKey: owner.recoveryKey!,
        leaseId: owner.leaseId!,
        actionKind: "request-owner",
        completedAt: "2026-07-16T04:06:01.000Z",
      }),
    ).toBe(true);

    const exhausted = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE + 10 * 60_000, []),
      { now: "2026-07-16T04:10:00.000Z" },
    );
    expect(exhausted).toMatchObject({ claimed: false });
    const record = supervisorRecoveryRegistryV2(readTaskTree(config))[
      first.recoveryKey!
    ];
    expect(record).toMatchObject({
      status: "exhausted",
      actionCount: 1,
      maxActions: 1,
      ownerRequestedAt: "2026-07-16T04:06:01.000Z",
    });
  });

  test("leases an automatic action and retries only after the lease expires", async () => {
    const { config } = await fixture();
    const first = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE, []),
      { now: "2026-07-16T04:00:00.000Z", leaseMs: 60_000 },
    );
    expect(first.claimed).toBe(true);

    const leased = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE + 30_000, []),
      { now: "2026-07-16T04:00:30.000Z", leaseMs: 60_000 },
    );
    expect(leased).toMatchObject({ claimed: false });

    const retry = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE + 61_000, []),
      { now: "2026-07-16T04:01:01.000Z", leaseMs: 60_000 },
    );
    expect(retry).toMatchObject({
      claimed: true,
      actionKind: "reemit-completion",
      recoveryKey: first.recoveryKey,
    });
    expect(retry.leaseId).not.toBe(first.leaseId);
  });

  test("keeps dispatch failure distinct and consumes the bounded automatic action", async () => {
    const { config } = await fixture();
    const first = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE, []),
      { now: "2026-07-16T04:00:00.000Z" },
    );
    expect(first.claimed).toBe(true);
    expect(
      failReviewHandoffActionV2(config, {
        recoveryKey: first.recoveryKey!,
        leaseId: first.leaseId!,
        actionKind: "reemit-completion",
        failedAt: "2026-07-16T04:00:01.000Z",
        reason: "event dispatcher unavailable",
      }),
    ).toBe(true);

    const record = supervisorRecoveryRegistryV2(readTaskTree(config))[
      first.recoveryKey!
    ];
    expect(record).toMatchObject({
      status: "failed",
      actionCount: 1,
      lastFailureReason: "event dispatcher unavailable",
    });
    const withinGrace = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE + 3 * 60_000, []),
      { now: "2026-07-16T04:03:00.000Z" },
    );
    expect(withinGrace.claimed).toBe(false);
    const owner = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE + 6 * 60_000, []),
      { now: "2026-07-16T04:06:00.000Z" },
    );
    expect(owner).toMatchObject({
      claimed: true,
      actionKind: "request-owner",
    });
  });

  test("leaves compatibility revision zero on the legacy recovery path", async () => {
    const { config } = await fixture(0);
    const claim = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE, []),
      { now: "2026-07-16T04:00:00.000Z" },
    );
    expect(claim).toMatchObject({
      claimed: false,
      reason: "no current review-handoff invariant",
    });
    expect(supervisorRecoveryRegistryV2(readTaskTree(config))).toEqual({});
  });

  test("does not infer V2 authority from a positive revision alone", async () => {
    const { config } = await fixture(2, false);
    const claim = claimNextReviewHandoffActionV2(
      config,
      snapshot(config, BASE, []),
      { now: "2026-07-16T04:00:00.000Z" },
    );
    expect(claim).toMatchObject({
      claimed: false,
      reason: "no current review-handoff invariant",
    });
  });
});

describe("Project Supervisor V2 terminal attempt shadow policy", () => {
  function activeSnapshot(input: {
    revision: number;
    controlPlaneVersion?: number;
    status?: string;
    outcome?: string | null;
    error?: string | null;
  }) {
    return buildProjectSnapshotV2({
      projectId: "aks-rp-e2e",
      tree: {
        version: 1,
        project: "aks-rp-e2e",
        root_task_id: "project",
        updated_at: "2026-07-16T04:00:00.000Z",
        tasks: {
          project: {
            id: "project",
            state: "active",
            children: ["active-task"],
          },
          "active-task": {
            id: "active-task",
            parent_id: "project",
            state: "active",
            revision: input.revision,
            session_id: "session-active",
            children: [],
            context: {
              controlPlaneVersion: input.controlPlaneVersion ?? 2,
            },
            trace: { current_attempt_id: "attempt-active" },
          },
        },
      },
      assignments: [],
      sessions: [
        {
          sessionId: "session-active",
          status: input.status ?? "done",
          startedAt: BASE - 60_000,
          endedAt: BASE,
          lastActivityAt: BASE,
          outcome: input.outcome ?? "done",
          error: input.error ?? null,
        },
      ],
      attemptHeartbeats: [],
      reviews: [],
      loops: [],
      deliveryGaps: [],
      nowMs: BASE,
    });
  }

  test("selects exact revisioned terminal-success attempts", () => {
    expect(
      terminalAttemptRecoveryCandidatesV2(activeSnapshot({ revision: 2 })),
    ).toEqual([
      {
        recoveryKey: "active-attempt-terminal:active-task:2:attempt-active",
        taskId: "active-task",
        taskRevision: 2,
        attemptId: "attempt-active",
        sessionId: "session-active",
        sessionStatus: "done",
        sessionOutcome: "done",
      },
    ]);
  });

  test("excludes revision zero and terminal failures", () => {
    expect(
      terminalAttemptRecoveryCandidatesV2(activeSnapshot({ revision: 0 })),
    ).toEqual([]);
    expect(
      terminalAttemptRecoveryCandidatesV2(
        activeSnapshot({ revision: 2, outcome: "error" }),
      ),
    ).toEqual([]);
    expect(
      terminalAttemptRecoveryCandidatesV2(
        activeSnapshot({
          revision: 2,
          outcome: "done",
          error: "provider failed",
        }),
      ),
    ).toEqual([]);
    expect(
      terminalAttemptRecoveryCandidatesV2(
        activeSnapshot({ revision: 2, controlPlaneVersion: 1 }),
      ),
    ).toEqual([]);
  });
});
