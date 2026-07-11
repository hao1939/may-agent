import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  reconcileJudgmentWithFacts,
  taskEscalationPacket,
  taskTreePacket,
} from "./project-health-evaluator.ts";

async function makeAppDirWithTree(tree: Record<string, unknown>) {
  const appDir = await mkdtemp(join(tmpdir(), "project-health-evaluator-"));
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    `${JSON.stringify(tree, null, 2)}\n`,
    "utf8",
  );
  return appDir;
}

describe("project health evaluator escalation audit", () => {
  test("blocked wait linkage reads structured blocker fields", async () => {
    const appDir = await makeAppDirWithTree({
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["wait-runtime-input"],
        },
        "wait-runtime-input": {
          id: "wait-runtime-input",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Hold exact external runtime input wait.",
          blocker: {
            condition: "Missing approved underlay kubeconfig.",
            category: "external-wait",
            owner: "human",
            waiting_for: {
              type: "owner.decision",
              approvalId: "approval-underlay-kubeconfig",
            },
            resume_condition:
              "Resume when the owner returns the approved kubeconfig.",
            next_check_at: "2999-01-01T00:00:00.000Z",
            fallback_at: "2999-01-02T00:00:00.000Z",
            fallback_action: "Send one bounded follow-up.",
          },
        },
      },
    });

    const packet = taskEscalationPacket(appDir);

    expect(packet.counts).toMatchObject({
      blockedLeaves: 1,
      blockedWithEscalationHint: 1,
      blockedWithOwnerOrExternalPath: 1,
      blockedWithoutOwnerOrExternalPath: 0,
    });
  });

  test("exact blocked wait downgrades repeated owner-assignment notification", async () => {
    const appDir = await makeAppDirWithTree({
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["xhs-cookie-refresh-blocked"],
        },
        "xhs-cookie-refresh-blocked": {
          id: "xhs-cookie-refresh-blocked",
          parent_id: "project",
          state: "blocked",
          children: [],
          owner: "human",
          goal: "Refresh expired XHS session cookies so scout-explore can resume XHS scans.",
          context: {
            blocker:
              "XHS login wall reached; cookies expired. Manual browser login required.",
            requested_action:
              "Human logs into xiaohongshu.com and exports cookies.",
            resume_condition:
              "Valid XHS cookies are present and scout-explore succeeds without login-wall error.",
            fallback:
              "If not resolved by 2026-07-25, pause the XHS exploration lane.",
            escalation_ref: "event 3048759 (open)",
          },
        },
      },
    });
    const taskLinkage = taskEscalationPacket(appDir);
    const judgment = reconcileJudgmentWithFacts(
      { targetProject: "scout-knowledge-lib.app" },
      {
        escalations: {
          counts: { open: 1, closed: 0 },
          usage: taskLinkage.counts,
        },
      },
      {
        verdict: "watch",
        mainConcern:
          "The live escalation still lacks clear owner-to-action routing.",
        requestedHumanAction: "assign-owner",
        notify: true,
        dedupeKey:
          "scout-knowledge-lib.app:escalation-quality:xhs-cookie-manual-login-missing-resume",
        message: "Assign an owner for the XHS cookie escalation.",
      },
    );

    expect(taskLinkage.counts).toMatchObject({
      blockedLeaves: 1,
      blockedWithOwnerOrExternalPath: 1,
      blockedWithoutOwnerOrExternalPath: 0,
      blockedExactWaitLeaves: 1,
    });
    expect(taskLinkage.blockedExactWaitSample).toEqual([
      expect.objectContaining({
        id: "xhs-cookie-refresh-blocked",
        exactWait: {
          owner: "human",
          requestedAction:
            "Human logs into xiaohongshu.com and exports cookies.",
          resumeCondition:
            "Valid XHS cookies are present and scout-explore succeeds without login-wall error.",
          fallback:
            "If not resolved by 2026-07-25, pause the XHS exploration lane.",
          linkage: "event 3048759 (open)",
        },
      }),
    ]);
    expect(judgment).toMatchObject({
      verdict: "watch",
      requestedHumanAction: "watch",
      notify: false,
      dedupeKey: "scout-knowledge-lib.app:formal-escalation-closure-missing",
    });
    expect(judgment.message).toContain("Do not ask the human");
  });

  test("missing owner path keeps owner-assignment notification actionable", async () => {
    const judgment = reconcileJudgmentWithFacts(
      { targetProject: "scout-knowledge-lib.app" },
      {
        escalations: {
          counts: { open: 1, closed: 0 },
          usage: {
            blockedLeaves: 1,
            blockedWithOwnerOrExternalPath: 0,
            blockedWithoutOwnerOrExternalPath: 1,
            blockedExactWaitLeaves: 0,
          },
        },
      },
      {
        verdict: "concern",
        mainConcern: "Blocked work has no owner path.",
        requestedHumanAction: "assign-owner",
        notify: true,
        dedupeKey: "scout-knowledge-lib.app:missing-owner-path",
        message: "Assign an owner.",
      },
    );

    expect(judgment).toMatchObject({
      requestedHumanAction: "assign-owner",
      notify: true,
      dedupeKey: "scout-knowledge-lib.app:missing-owner-path",
    });
  });

  test("one exact wait does not hide another open escalation", async () => {
    const judgment = reconcileJudgmentWithFacts(
      { targetProject: "scout-knowledge-lib.app" },
      {
        escalations: {
          counts: { open: 2, closed: 0 },
          usage: {
            blockedLeaves: 1,
            blockedWithOwnerOrExternalPath: 1,
            blockedWithoutOwnerOrExternalPath: 0,
            blockedExactWaitLeaves: 1,
          },
        },
      },
      {
        verdict: "concern",
        mainConcern: "Another escalation still lacks an owner path.",
        requestedHumanAction: "assign-owner",
        notify: true,
        dedupeKey: "scout-knowledge-lib.app:second-open-escalation",
        message: "Assign an owner for the second escalation.",
      },
    );

    expect(judgment).toMatchObject({
      requestedHumanAction: "assign-owner",
      notify: true,
      dedupeKey: "scout-knowledge-lib.app:second-open-escalation",
    });
  });

  test("prose-only blocked task is not treated as an exact wait", async () => {
    const appDir = await makeAppDirWithTree({
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["prose-only-wait"],
        },
        "prose-only-wait": {
          id: "prose-only-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Human owner should approve this escalation, resume when done, and fallback tomorrow.",
          summary:
            "This text mentions requested action, resume condition, fallback, and escalation, but it does not expose structured fields.",
        },
      },
    });

    const packet = taskEscalationPacket(appDir);

    expect(packet.counts).toMatchObject({
      blockedLeaves: 1,
      blockedExactWaitLeaves: 0,
    });
    expect(packet.blockedExactWaitSample).toEqual([]);
  });

  test("exact wait can be normalized from context.blocker", async () => {
    const appDir = await makeAppDirWithTree({
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["nested-blocker-wait"],
        },
        "nested-blocker-wait": {
          id: "nested-blocker-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          context: {
            blocker: {
              owner: "agent:may",
              requested_action: "Refresh runtime credential.",
              resume_condition: "Credential refresh succeeds.",
              fallback_at: "2999-01-01T00:00:00.000Z",
              event_id: 12345,
            },
          },
        },
      },
    });

    const packet = taskEscalationPacket(appDir);

    expect(packet.counts).toMatchObject({
      blockedExactWaitLeaves: 1,
    });
    expect(packet.blockedExactWaitSample).toEqual([
      expect.objectContaining({
        exactWait: {
          owner: "agent:may",
          requestedAction: "Refresh runtime credential.",
          resumeCondition: "Credential refresh succeeds.",
          fallback: "2999-01-01T00:00:00.000Z",
          linkage: "12345",
        },
      }),
    ]);
  });
});

describe("project health evaluator task reporting", () => {
  test("surfaces design and legacy hygiene tasks separately from runnable sample", async () => {
    const tasks: Record<string, unknown> = {
      project: {
        id: "project",
        state: "active",
        children: [
          "work-1",
          "work-2",
          "work-3",
          "work-4",
          "work-5",
          "work-6",
          "legacy-design-hygiene-audit",
        ],
      },
    };
    for (let i = 1; i <= 6; i += 1) {
      tasks[`work-${i}`] = {
        id: `work-${i}`,
        parent_id: "project",
        state: "backlog",
        children: [],
        goal: `Generic backlog work ${i}`,
      };
    }
    tasks["legacy-design-hygiene-audit"] = {
      id: "legacy-design-hygiene-audit",
      parent_id: "project",
      state: "backlog",
      children: [],
      goal: "Review legacy terms, stale design assumptions, and hygiene debt.",
      conflict_scope: ["evaluation-design-hygiene"],
    };

    const appDir = await makeAppDirWithTree({ tasks });
    const packet = taskTreePacket(appDir);

    expect(packet.runnable).toHaveLength(7);
    expect(packet.designHygiene).toEqual([
      expect.objectContaining({ id: "legacy-design-hygiene-audit" }),
    ]);
  });

  test("normalizes list-shaped task trees before reporting", async () => {
    const appDir = await makeAppDirWithTree({
      tasks: [
        {
          id: "project",
          state: "active",
          children: ["task-a"],
        },
        {
          id: "task-a",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "Runnable task from an array-shaped tree.",
        },
      ],
    });

    const taskPacket = taskTreePacket(appDir);
    const escalationPacket = taskEscalationPacket(appDir);

    expect(taskPacket.counts).toMatchObject({
      total: 2,
      leaves: 1,
    });
    expect(taskPacket.runnable).toEqual([
      expect.objectContaining({ id: "task-a" }),
    ]);
    expect(escalationPacket.counts).toMatchObject({
      leafTasks: 1,
    });
  });
});
