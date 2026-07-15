import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  escalationPacket,
  projectHealthInputFingerprint,
  normalizeJudgment,
  projectHealthJudgmentFromResult,
  pruneProjectHealthReports,
  reconcileJudgmentWithFacts,
  scheduledProjectReviewDecision,
  shouldFeedbackTargetOwner,
  taskEscalationPacket,
  taskTreePacket,
} from "./project-health-evaluator.ts";

describe("project health correction contract", () => {
  test("preserves artifact-targeted owner feedback and verification", () => {
    expect(
      normalizeJudgment(
        {
          verdict: "concern",
          mainConcern: "Generated specs repeat an invalid request shape.",
          affectedArtifacts: ["workflows/spec-generator.ts"],
          recommendedChange: "Correct the shared request generator.",
          verification: [
            "The original spec and one sibling pass generated-request checks.",
          ],
          requestedHumanAction: "none",
          notify: false,
          dedupeKey: "aks-rp-e2e:invalid-request-shape",
          message: "Repair the shared generator.",
        },
        {
          verdict: "watch",
          mainConcern: "Fallback concern.",
          requestedHumanAction: "watch",
          notify: false,
          dedupeKey: "fallback",
          message: "Fallback message.",
        },
      ),
    ).toMatchObject({
      affectedArtifacts: ["workflows/spec-generator.ts"],
      recommendedChange: "Correct the shared request generator.",
      verification: [
        "The original spec and one sibling pass generated-request checks.",
      ],
    });
  });

  test("recovers structured judgment from a finish-tool deliverable", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "project-health-result-"));
    await mkdir(join(appDir, "reports"), { recursive: true });
    await writeFile(
      join(appDir, "reports", "audit.md"),
      `# Audit\n\n\`\`\`json\n${JSON.stringify({
        verdict: "watch",
        mainConcern: "A real concern from the delivered report.",
        affectedArtifacts: ["workflow:project-planner"],
        recommendedChange: "Repair the planner output.",
        verification: ["The next output passes review."],
        requestedHumanAction: "none",
        notify: false,
        dedupeKey: "target:planner-output",
        message: "No human action needed.",
      })}\n\`\`\`\n`,
    );

    const source = projectHealthJudgmentFromResult(
      {
        status: "done",
        lastAssistantText: null,
        finishResult: {
          summary: "Audit written to a deliverable.",
          deliverables: [{ path: "reports/audit.md" }],
        },
      },
      appDir,
    );

    expect(source.source).toBe("deliverable:reports/audit.md");
    expect(source.raw).toMatchObject({
      mainConcern: "A real concern from the delivered report.",
      affectedArtifacts: ["workflow:project-planner"],
      verification: ["The next output passes review."],
    });
  });
});

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
  test("matches a target escalation to a minimal closure by escalationId", async () => {
    const appDir = await makeAppDirWithTree({ tasks: {} });
    const escalationId = "esc_aks_closed";
    const packet = escalationPacket(
      {
        query: {
          sql: () => ({
            rows: [
              {
                id: 101,
                event_type: "escalation.created",
                timestamp: Date.now() - 60_000,
                data: JSON.stringify({
                  escalationId,
                  targetProject: "aks-rp-e2e.app",
                  reason: "A target issue",
                }),
              },
              {
                id: 102,
                event_type: "escalation.resolved",
                timestamp: Date.now(),
                data: JSON.stringify({ escalationId }),
              },
              {
                id: 103,
                event_type: "escalation.resolved",
                timestamp: Date.now(),
                data: JSON.stringify({ escalationId: "esc_other" }),
              },
            ],
          }),
        },
      } as never,
      {
        targetProject: "aks-rp-e2e.app",
        targetAppDir: appDir,
        targetDomainDir: appDir,
        reason: "test",
      },
    );

    expect(packet.counts).toMatchObject({
      created: 1,
      open: 0,
      closed: 1,
    });
    expect(packet.openSample).toEqual([]);
    expect(packet.closedSample).toEqual([
      expect.objectContaining({ key: escalationId, state: "closed" }),
    ]);
  });

  test("attributes an escalation through its source session project", async () => {
    const appDir = await makeAppDirWithTree({ tasks: {} });
    const escalationId = "esc_session_project";
    const packet = escalationPacket(
      {
        query: {
          sql: () => ({
            rows: [
              {
                id: 201,
                event_type: "escalation.created",
                source_project_id: "aks-rp-e2e",
                timestamp: Date.now(),
                data: JSON.stringify({
                  escalationId,
                  sourceSessionId: "s_task_without_project_in_payload",
                  reason: "A blocked worker result",
                }),
              },
            ],
          }),
        },
      } as never,
      {
        targetProject: "aks-rp-e2e.app",
        targetAppDir: appDir,
        targetDomainDir: appDir,
        reason: "test",
      },
    );

    expect(packet.counts).toMatchObject({ created: 1, open: 1 });
    expect(packet.openSample).toEqual([
      expect.objectContaining({ key: escalationId, state: "open" }),
    ]);
  });

  test("does not warn when approval dispatch deduplication is working", async () => {
    const appDir = await makeAppDirWithTree({ tasks: {} });
    await writeFile(
      join(appDir, ".state", "approval-dispatch-runs.jsonl"),
      `${JSON.stringify({ result: "duplicate-suppressed" })}\n`,
      "utf8",
    );
    const packet = escalationPacket(
      { query: { sql: () => ({ rows: [] }) } } as never,
      {
        targetProject: "aks-rp-e2e.app",
        targetAppDir: appDir,
        targetDomainDir: appDir,
        reason: "test",
      },
    );

    expect(packet.warnings).not.toContain(
      "some approval-dispatch attempts were ignored or failed",
    );
  });

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

describe("project health evaluator review gating", () => {
  test("skips unchanged scheduled reviews until the daily baseline", () => {
    const now = Date.parse("2026-07-14T12:00:00Z");
    expect(
      scheduledProjectReviewDecision(
        "scheduled",
        {
          lastReviewedAt: "2026-07-14T06:00:00Z",
          lastInputFingerprint: "same",
        },
        "same",
        now,
      ),
    ).toEqual({ run: false, reason: "unchanged-since-last-review" });
    expect(
      scheduledProjectReviewDecision(
        "scheduled",
        {
          lastReviewedAt: "2026-07-13T11:59:59Z",
          lastInputFingerprint: "same",
        },
        "same",
        now,
      ),
    ).toEqual({ run: true, reason: "daily-baseline" });
  });

  test("runs scheduled review on a meaningful fingerprint delta", () => {
    expect(
      scheduledProjectReviewDecision(
        "scheduled",
        {
          lastReviewedAt: "2026-07-14T06:00:00Z",
          lastInputFingerprint: "old",
        },
        "new",
      ),
    ).toEqual({ run: true, reason: "meaningful-delta" });
  });

  test("fingerprint ignores timestamps but changes with task state", () => {
    const base = {
      taskTree: {
        counts: { leafByState: { active: 1, blocked: 0 } },
        active: [{ id: "work", updated_at: "one" }],
      },
      selfRecovery: { status: "strong", missing: [] },
      escalations: { counts: { open: 0 }, warnings: [] },
      runtime: { metrics: [], workflows: [] },
    };
    expect(projectHealthInputFingerprint(base)).toBe(
      projectHealthInputFingerprint({
        ...base,
        sampledAt: "later",
        taskTree: {
          ...base.taskTree,
          active: [{ id: "work", updated_at: "two" }],
        },
      }),
    );
    expect(projectHealthInputFingerprint(base)).not.toBe(
      projectHealthInputFingerprint({
        ...base,
        taskTree: {
          counts: { leafByState: { active: 0, blocked: 1 } },
          active: [],
        },
      }),
    );
  });
});

describe("project health owner feedback gating", () => {
  const judgment = {
    verdict: "concern",
    mainConcern: "Blocked frontier.",
    requestedHumanAction: "watch",
    notify: false,
    dedupeKey: "target:no-executable-frontier-with-blocked-work",
    message: "Watch.",
  };

  test("suppresses repeated same-family feedback", () => {
    expect(
      shouldFeedbackTargetOwner(judgment, {
        lastFeedbackDedupeKey:
          "target:no-executable-frontier-with-blocked-work",
        lastFeedbackVerdict: "concern",
        lastRequestedHumanAction: "watch",
      }),
    ).toBe(false);
    expect(
      shouldFeedbackTargetOwner(
        {
          ...judgment,
          dedupeKey:
            "evaluation.app:self-recovery-watch:feedback23h49-reviewfailed3168749",
        },
        {
          lastFeedbackDedupeKey:
            "evaluation.app:review-failed-linkage-gap:3168749-3172789",
          lastFeedbackVerdict: "concern",
          lastRequestedHumanAction: "watch",
        },
      ),
    ).toBe(false);
  });

  test("emits feedback for a new family or severity increase", () => {
    expect(
      shouldFeedbackTargetOwner(judgment, {
        lastFeedbackDedupeKey: "target:different-family",
        lastFeedbackVerdict: "concern",
      }),
    ).toBe(true);
    expect(
      shouldFeedbackTargetOwner(
        { ...judgment, verdict: "urgent" },
        {
          lastFeedbackDedupeKey: judgment.dedupeKey,
          lastFeedbackVerdict: "concern",
        },
      ),
    ).toBe(true);
  });

  test("re-emits persistent feedback after its retry window or an explicit review", () => {
    const previous = {
      lastFeedbackDedupeKey: judgment.dedupeKey,
      lastFeedbackVerdict: "concern",
      lastRequestedHumanAction: "watch",
      lastFeedbackAt: "2026-07-14T10:00:00.000Z",
    };

    expect(
      shouldFeedbackTargetOwner(judgment, previous, {
        now: Date.parse("2026-07-14T10:30:00.000Z"),
      }),
    ).toBe(false);
    expect(
      shouldFeedbackTargetOwner(judgment, previous, {
        now: Date.parse("2026-07-14T11:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      shouldFeedbackTargetOwner(judgment, previous, {
        force: true,
        now: Date.parse("2026-07-14T10:01:00.000Z"),
      }),
    ).toBe(true);
  });
});

describe("project health report retention", () => {
  test("keeps only the newest report/facts pairs", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "project-health-reports-"));
    for (let index = 0; index < 5; index += 1) {
      const id = `20260714T00000${index}Z`;
      await writeFile(join(reportDir, `${id}.md`), `report ${index}\n`);
      await writeFile(join(reportDir, `${id}.facts.json`), "{}\n");
    }

    pruneProjectHealthReports(reportDir, 3);

    expect((await readdir(reportDir)).sort()).toEqual([
      "20260714T000002Z.facts.json",
      "20260714T000002Z.md",
      "20260714T000003Z.facts.json",
      "20260714T000003Z.md",
      "20260714T000004Z.facts.json",
      "20260714T000004Z.md",
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
