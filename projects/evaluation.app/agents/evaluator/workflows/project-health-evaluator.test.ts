import {
  existsSync,
  mkdtempSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE,
  execute,
  normalizeJudgment,
  projectHealthEvaluatorAgentPrompt,
  projectHealthInputFingerprint,
  projectHealthJudgmentFromExecution,
  projectHealthOwnerFeedbackEvent,
  projectHealthPublication,
  projectHealthStateUpdate,
  pruneProjectHealthReports,
  reconcileJudgment,
  scheduledProjectReviewDecision,
  shouldFeedbackTargetOwner,
  shouldNotify,
  triggerReason,
  verifyProjectHealthDurability,
  type ProjectHealthJudgment,
} from "./project-health-evaluator.js";

const judgment: ProjectHealthJudgment = {
  verdict: "concern",
  mainConcern: "The public task projection shows an unresolved failure.",
  affectedArtifacts: ["task:runtime/example"],
  recommendedChange:
    "Reconcile the failed task through the declared App owner.",
  verification: ["A later task projection shows the task converged."],
  requestedHumanAction: "none",
  notify: false,
  dedupeKey: "gym.app:unresolved-task",
  message: "Review runtime/example and record its verified disposition.",
  observations: {
    task: { id: "runtime/example", status: "attention" },
    sourceRevisions: ["projects/gym.app/tasks/tree.json:abc123"],
  },
};

function reconciliation(reason = "scheduled") {
  const trigger = {
    type: "evaluation.project.review.requested",
    data: { targetProject: "gym.app", reason },
    target: { appId: "evaluation", project: "evaluation" },
  };
  return {
    appId: "evaluation",
    taskId: "runtime/project-audit/gym.app",
    generation: 2,
    resourceVersion: 4,
    agent: "evaluator",
    mode: "maintain" as const,
    outcome: "Maintain an independent health assessment for gym.app.",
    acceptance: ["A current report is recorded."],
    input: { targetProject: "gym.app" },
    children: { live: [], completed: [] },
    events: {
      items: [
        {
          eventId: 73,
          observedAt: "2026-08-21T00:00:00.000Z",
          event: trigger,
        },
      ],
      throughEventId: 73,
      truncated: false,
    },
  };
}

describe("canonical project-health evaluator", () => {
  test("builds a bounded inspection prompt without runtime-private paths", () => {
    const prompt = projectHealthEvaluatorAgentPrompt(
      { targetProject: "gym.app", reason: "scheduled" },
      reconciliation().events.items.at(-1)?.event,
    );
    expect(prompt).toStartWith(PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE);
    expect(prompt).toContain("Agent App gym.app");
    expect(prompt).toContain("query_db");
    expect(prompt).toContain("Do not mutate the target");
    expect(prompt).not.toContain(".state/tasks/state.json");
    expect(prompt).not.toContain("/app/projects");
  });

  test("normalizes structured output and rejects assign-owner as a human action", () => {
    const fallback = { ...judgment, verdict: "watch", dedupeKey: "fallback" };
    const normalized = normalizeJudgment(
      {
        judgment: {
          ...judgment,
          requestedHumanAction: "assign-owner",
          observations: { metric: "red" },
        },
      },
      fallback,
    );
    expect(normalized.observations).toEqual({ metric: "red" });
    expect(reconcileJudgment("gym.app", normalized)).toMatchObject({
      requestedHumanAction: "none",
      notify: false,
      dedupeKey: "gym.app:declared-owner-follow-up",
    });
  });

  test("preserves a manual reason admitted through an App task request", () => {
    const ctx = createTestAppWorkflowContext({
      input: { targetProject: "scout-knowledge-lib.app" },
      reconciliation: {
        ...reconciliation(),
        events: {
          items: [
            {
              observedAt: "2026-08-21T00:00:00.000Z",
              event: {
                type: "app.task.requested",
                data: {
                  request: {
                    input: {
                      kind: "project-review",
                      data: { reason: "manual-routing-replay" },
                    },
                  },
                },
              },
            },
          ],
          truncated: false,
        },
      },
    });
    expect(triggerReason(ctx)).toBe("manual-routing-replay");
  });

  test("uses stable semantic evidence for scheduled-review gating", () => {
    const first = projectHealthInputFingerprint(judgment);
    const reordered = projectHealthInputFingerprint({
      ...judgment,
      observations: {
        sourceRevisions: ["projects/gym.app/tasks/tree.json:abc123"],
        task: { status: "attention", id: "runtime/example" },
      },
    });
    expect(first).toBe(reordered);
    expect(
      scheduledProjectReviewDecision(
        "scheduled",
        {
          lastReviewedAt: new Date().toISOString(),
          lastInputFingerprint: first,
        },
        first,
      ),
    ).toEqual({ run: false, reason: "unchanged-since-last-review" });
    expect(scheduledProjectReviewDecision("manual", {}, first)).toEqual({
      run: true,
      reason: "explicit-request",
    });
  });

  test("notifies May only for a new actionable human decision", () => {
    const approval = {
      ...judgment,
      verdict: "blocked-on-human",
      requestedHumanAction: "approve",
      notify: true,
      dedupeKey: "gym.app:approval",
    };
    expect(shouldNotify(approval, {})).toBe(true);
    expect(
      shouldNotify(approval, {
        lastDedupeKey: "gym.app:approval-old",
        lastVerdict: "blocked-on-human",
      }),
    ).toBe(true);
    expect(
      shouldNotify({ ...approval, requestedHumanAction: "watch" }, {}),
    ).toBe(false);
    expect(
      shouldNotify(approval, {
        lastDedupeKey: approval.dedupeKey,
        lastVerdict: approval.verdict,
        lastRequestedHumanAction: "none",
      }),
    ).toBe(true);
  });

  test("deduplicates owner feedback but retries a persistent finding after its window", () => {
    expect(shouldFeedbackTargetOwner(judgment, {})).toBe(true);
    const previous = {
      lastFeedbackAt: "2026-08-15T00:00:00.000Z",
      lastFeedbackDedupeKey: judgment.dedupeKey,
      lastFeedbackVerdict: judgment.verdict,
    };
    expect(
      shouldFeedbackTargetOwner(judgment, previous, {
        now: Date.parse("2026-08-15T00:30:00.000Z"),
      }),
    ).toBe(false);
    expect(
      shouldFeedbackTargetOwner(judgment, previous, {
        now: Date.parse("2026-08-15T02:00:00.000Z"),
      }),
    ).toBe(true);
  });

  test("turns a malformed or failed evaluator result into a non-actionable visible fallback", () => {
    const result = projectHealthJudgmentFromExecution("gym.app", {
      id: "s_failed",
      kind: "agent",
      status: "error",
      summary: "provider unavailable",
    });
    expect(result.complete).toBe(false);
    expect(result.judgment).toMatchObject({
      verdict: "watch",
      requestedHumanAction: "none",
      notify: false,
      dedupeKey: "gym.app:audit-execution-error",
    });
    expect(
      projectHealthJudgmentFromExecution("gym.app", {
        id: "s_malformed",
        kind: "agent",
        status: "done",
        summary: "partial output",
        output: {
          verdict: "concern",
          mainConcern: "This omits its evidence contract.",
          requestedHumanAction: "none",
          dedupeKey: "gym.app:partial",
        },
      }).complete,
    ).toBe(false);
  });

  test("rejects non-ok approval concerns without an exact public artifact", () => {
    const base = {
      ...judgment,
      mainConcern: "An approval request may not have reached its recipient.",
      affectedArtifacts: [],
      dedupeKey: "aks-rp-e2e.app:approval-delivery-evidence-gap",
      observations: {
        approvalDelivery: { undelivered: 1 },
        sourceRevisions: ["events:5686269"],
      },
    };
    const incomplete = projectHealthJudgmentFromExecution("aks-rp-e2e.app", {
      id: "s_approval_gap",
      kind: "agent",
      status: "done",
      summary: "approval audit",
      output: base,
    });
    expect(incomplete.complete).toBe(false);

    const grounded = projectHealthJudgmentFromExecution("aks-rp-e2e.app", {
      id: "s_approval_grounded",
      kind: "agent",
      status: "done",
      summary: "approval audit",
      output: {
        ...base,
        affectedArtifacts: [
          "event:5686269#project.approval.requested#approvalId=aks-rp-e2e:approval:cleanup",
        ],
      },
    });
    expect(grounded.complete).toBe(true);
    expect(grounded.judgment.affectedArtifacts).toEqual([
      "event:5686269#project.approval.requested#approvalId=aks-rp-e2e:approval:cleanup",
    ]);
  });

  test("publishes one compact report and state record", () => {
    const publication = projectHealthPublication("gym.app", judgment, {
      id: "s_audit",
      kind: "agent",
      status: "done",
      summary: "audited",
      output: judgment,
    });
    expect(publication.facts).toMatchObject({
      targetProject: "gym.app",
      auditExecution: { id: "s_audit", status: "done" },
      judgment: { verdict: "concern" },
    });
    expect(publication.report).toContain("task:runtime/example");
    expect(
      projectHealthStateUpdate(
        {},
        "gym.app",
        judgment,
        "reports/project-health/gym.app/review.md",
        "fingerprint",
        true,
        "2026-08-15T00:00:00.000Z",
      ),
    ).toMatchObject({
      targetProject: "gym.app",
      lastDedupeKey: "gym.app:unresolved-task",
      lastFeedbackAt: "2026-08-15T00:00:00.000Z",
    });
  });

  test("selects an admitted owner-feedback contract for every watched target", () => {
    const reviewed = {
      reportPath: "reports/project-health/target/review.md",
      executionId: "s_project_health",
    };
    const sourceTask = {
      appId: "evaluation",
      taskId: "runtime/project-audit/target.app",
      generation: 3,
      resourceVersion: 7,
    };
    for (const targetProject of [
      "aks-rp-e2e.app",
      "may-agent.app",
      "gym.app",
      "evaluation.app",
    ]) {
      expect(
        projectHealthOwnerFeedbackEvent(
          targetProject,
          reviewed,
          judgment,
          sourceTask,
        ),
      ).toMatchObject({
        type: "project.owner.requested",
        data: {
          reason: "evaluation-project-health-feedback",
          sourceTask,
        },
        target: {
          appId: targetProject.replace(/\.app$/, ""),
          project: targetProject.replace(/\.app$/, ""),
        },
      });
    }

    expect(
      projectHealthOwnerFeedbackEvent(
        "scout-knowledge-lib.app",
        reviewed,
        { ...judgment, requestedHumanAction: "none" },
        sourceTask,
      ),
    ).toMatchObject({
      type: "project.owner.requested",
      data: {
        project: "scout-knowledge-lib",
        reason: "owner-message",
        sourceSessionId: "s_project_health",
        sourceTask,
        finding: {
          targetAppId: "scout-knowledge-lib",
          requestedHumanAction: "none",
          dedupeKey: judgment.dedupeKey,
          message: judgment.message,
          evidence: [
            "report:reports/project-health/target/review.md",
            "task:evaluation/runtime/project-audit/target.app@generation=3#resourceVersion=7",
            ...judgment.affectedArtifacts,
            ...judgment.verification,
          ],
        },
      },
      target: {
        appId: "scout-knowledge-lib",
        project: "scout-knowledge-lib",
      },
    });
  });

  test("uses one stable task-owned owner request key for Scout", async () => {
    const root = mkdtempSync(join(tmpdir(), "project-health-scout-routing-"));
    const events: Array<Record<string, unknown>> = [];
    const ctx = createTestAppWorkflowContext({
      input: { targetProject: "scout-knowledge-lib.app" },
      reconciliation: {
        ...reconciliation("manual-routing-replay"),
        taskId: "runtime/project-audit/scout-knowledge-lib.app",
        input: { targetProject: "scout-knowledge-lib.app" },
      },
      workspace: { root, output: root },
      callAgent: async () => ({
        id: "s_scout_audit",
        kind: "agent",
        status: "done",
        summary: "audited",
        output: {
          ...judgment,
          dedupeKey: "scout-knowledge-lib.app:library-health-event-localkey",
        },
      }),
      emit: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({ status: "done" });
    const requests = events.filter(
      (event) => event.type === "project.owner.requested",
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      localKey: "event-73:owner-feedback-requested",
      data: {
        reason: "owner-message",
        sourceTask: {
          appId: "evaluation",
          taskId: "runtime/project-audit/scout-knowledge-lib.app",
          generation: 2,
          resourceVersion: 4,
        },
      },
      target: {
        appId: "scout-knowledge-lib",
        project: "scout-knowledge-lib",
      },
    });
  });

  test("runs from canonical input and routes owner feedback without a human message event", async () => {
    const root = mkdtempSync(join(tmpdir(), "project-health-canonical-"));
    const events: Array<Record<string, unknown>> = [];
    const prompts: string[] = [];
    const ctx = createTestAppWorkflowContext({
      input: { targetProject: "gym.app" },
      reconciliation: reconciliation("manual"),
      workspace: { root, output: root },
      callAgent: async (_agent, prompt) => {
        prompts.push(prompt);
        return {
          id: "s_audit",
          kind: "agent",
          status: "done",
          summary: "audited",
          output: judgment,
        };
      },
      emit: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        facts: [expect.stringContaining("report:"), "execution:s_audit"],
      },
    });
    expect(prompts).toHaveLength(1);
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.project.review_started",
      "evaluation.project.reviewed",
      "project.owner.requested",
    ]);
    expect(events.map((event) => event.localKey)).toEqual([
      "event-73:review-started",
      "event-73:reviewed",
      "event-73:owner-feedback-requested",
    ]);
    expect(events[2]).toMatchObject({
      target: { appId: "gym", project: "gym" },
    });
    expect(events.some((event) => event.type === "message.created")).toBe(
      false,
    );
    expect(
      readdirSync(join(root, "reports", "project-health", "gym.app")),
    ).toHaveLength(2);
    expect(
      existsSync(
        join(root, ".state", "project-health", "targets", "gym.app.json"),
      ),
    ).toBe(true);
    expect(verifyProjectHealthDurability(root, ["gym.app"])).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  test("creates a correlated May request for a genuine human decision", async () => {
    const root = mkdtempSync(join(tmpdir(), "project-health-decision-"));
    const events: Array<Record<string, unknown>> = [];
    const approval = {
      ...judgment,
      verdict: "blocked-on-human",
      requestedHumanAction: "approve",
      notify: true,
      dedupeKey: "gym.app:approval",
    };
    const ctx = createTestAppWorkflowContext({
      input: { targetProject: "gym.app" },
      reconciliation: reconciliation("manual"),
      workspace: { root, output: root },
      callAgent: async () => ({
        id: "s_approval",
        kind: "agent",
        status: "done",
        summary: "approval required",
        output: approval,
      }),
      emit: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
      },
    });

    await execute(ctx);

    expect(events.at(-1)).toMatchObject({
      type: "evaluation.human_decision.requested",
      localKey: "event-73:human-decision-requested",
      data: {
        targetProject: "gym.app",
        requestedHumanAction: "approve",
      },
      target: { appId: "may", project: "may" },
    });
  });

  test("does not blame the target or notify May when the inner audit fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "project-health-failed-"));
    const events: Array<Record<string, unknown>> = [];
    const ctx = createTestAppWorkflowContext({
      input: { targetProject: "gym.app" },
      reconciliation: reconciliation("scheduled"),
      workspace: { root, output: root },
      callAgent: async () => ({
        id: "s_failed",
        kind: "agent",
        status: "error",
        summary: "provider unavailable",
      }),
      emit: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "blocked",
      summary:
        "gym.app project/App review produced no complete judgment: provider unavailable",
      facts: ["execution:s_failed", "status:error"],
    });

    expect(events.map((event) => event.type)).toEqual([
      "evaluation.project.review_started",
      "evaluation.project.review_failed",
    ]);
    expect(events.map((event) => event.localKey)).toEqual([
      "event-73:review-started",
      "event-73:review-failed",
    ]);
    expect(
      events.some((event) => event.type === "project.owner.requested"),
    ).toBe(false);
    expect(
      events.some(
        (event) => event.type === "evaluation.human_decision.requested",
      ),
    ).toBe(false);
    expect(existsSync(join(root, "reports", "project-health"))).toBe(false);
    expect(existsSync(join(root, "generated", "project-health-state"))).toBe(
      false,
    );
  });

  test("rejects a durability claim when a pointer's claimed artifact is absent", async () => {
    const root = mkdtempSync(join(tmpdir(), "project-health-durability-"));
    const ctx = createTestAppWorkflowContext({
      input: { targetProject: "gym.app" },
      reconciliation: reconciliation("manual"),
      workspace: { root, output: root },
      callAgent: async () => ({
        id: "s_durability",
        kind: "agent",
        status: "done",
        summary: "audited",
        output: judgment,
      }),
    });
    await expect(execute(ctx)).resolves.toMatchObject({ status: "done" });
    const reportDir = join(root, "reports", "project-health", "gym.app");
    const facts = readdirSync(reportDir).find((entry) =>
      entry.endsWith(".facts.json"),
    );
    expect(facts).toBeDefined();
    unlinkSync(join(reportDir, facts!));
    expect(verifyProjectHealthDurability(root, ["gym.app"])).toMatchObject({
      ok: false,
      evidence: [],
      errors: ["gym.app: claimed publication pair is absent"],
    });
  });

  test("keeps only the newest report/facts pairs", () => {
    const root = mkdtempSync(join(tmpdir(), "project-health-retention-"));
    for (let index = 0; index < 4; index += 1) {
      writeFileSync(join(root, `202608150${index}.md`), "report");
      writeFileSync(join(root, `202608150${index}.facts.json`), "{}");
    }
    pruneProjectHealthReports(root, 2);
    expect(readdirSync(root).sort()).toEqual([
      "2026081502.facts.json",
      "2026081502.md",
      "2026081503.facts.json",
      "2026081503.md",
    ]);
  });

  test("excludes Evaluation before model and publication side effects", async () => {
    let calls = 0;
    const root = mkdtempSync(join(tmpdir(), "project-health-self-"));
    const ctx = createTestAppWorkflowContext({
      input: { targetProject: "evaluation.app" },
      workspace: { root, appRoot: root, projectRoot: root, output: root },
      reconciliation: reconciliation(),
      callAgent: async () => {
        calls += 1;
        throw new Error("must not call");
      },
    });
    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        facts: ["excluded-owner:evaluation", "excluded-target:evaluation.app"],
      },
    });
    expect(calls).toBe(0);
    expect(readdirSync(root)).toEqual([]);
  });

  test("blocks when canonical task context or workspace is missing", async () => {
    const noTask = createTestAppWorkflowContext({
      input: { targetProject: "gym.app" },
    });
    await expect(execute(noTask)).resolves.toMatchObject({
      status: "blocked",
      summary:
        "project-health-evaluator requires canonical reconciliation context",
    });

    const noWorkspace = createTestAppWorkflowContext({
      input: { targetProject: "gym.app" },
      reconciliation: reconciliation(),
    });
    await expect(execute(noWorkspace)).resolves.toMatchObject({
      status: "blocked",
      summary: "project-health-evaluator requires an allocated App workspace",
    });
  });
});
