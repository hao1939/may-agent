import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { openDatabase } from "../../lib/db.js";
import { applyDbSchema } from "../../lib/db/schema.js";
import { HumanTaskService, type HumanTaskView } from "../human-task-service.js";
import {
  renderTelegramTask,
  renderTelegramTodos,
  telegramApprovalReply,
  type TelegramApprovalAnchor,
} from "./telegram.js";

function proposal(letter: string, revision: number): HumanTaskView {
  return {
    appId: "may",
    taskId: "goal/proposal",
    ref: "abcdef12",
    status: "waiting",
    generation: 1,
    resourceVersion: revision,
    outcome: `Review proposal ${letter}`,
    updatedAt: revision,
    terminal: false,
    cancellable: true,
    diagnostics: {
      conditions: [
        {
          id: `approval-${letter}`,
          condition: {
            spec: {
              type: "project.approval.submitted",
              subject: `id:proposal-${letter}`,
              owner: "human",
              expected: {
                allowedDecisions: ["approve", "reject", "defer"],
                approvalId: `proposal-${letter}`,
                packetHash: letter.repeat(64),
                proposalRevision: revision,
                taskGeneration: 1,
                conditionId: `approval-${letter}`,
              },
              requestedAction:
                `Problem: stale approval ${letter}.\nVerified benefit: exact packet binding.\n` +
                `Total cost: one journal reread and no new service.\nSimpler option: reuse the existing Condition.\n` +
                `Application/activation scope: git-fast-forward:/an/intentionally/long/fixture/path/${letter}.\n` +
                `Evidence: artifact:verification-${letter}.json and artifact:full-diff-${letter}.patch.`,
            },
            status: { state: "false" },
          },
        },
      ],
    },
  };
}

function action(task: HumanTaskView): string {
  return task.diagnostics!.conditions[0]!.condition!.spec.requestedAction!;
}

const proposalA = proposal("a", 1);
const anchorA: TelegramApprovalAnchor = {
  approvalId: "proposal-a",
  displayedActionHash: createHash("sha256").update(action(proposalA)).digest("hex"),
  packetHash: "a".repeat(64),
  proposalRevision: 1,
  taskGeneration: 1,
  conditionId: "approval-a",
};

describe("Telegram exact approval reply", () => {
  it("accepts only a literal allowed decision for the displayed current proposal", () => {
    expect(telegramApprovalReply("approve", proposal("a", 1), anchorA)).toMatchObject({
      decision: "approve",
      approvalId: "proposal-a",
      packetHash: "a".repeat(64),
    });
    expect(telegramApprovalReply("yes", proposal("a", 1), anchorA)).toBeNull();
    expect(telegramApprovalReply("approve if checks pass", proposal("a", 1), anchorA)).toBeNull();
  });

  it("keeps a stale displayed A from deciding replacement B", () => {
    expect(telegramApprovalReply("approve", proposal("b", 2), anchorA)).toBeNull();
    expect(telegramApprovalReply("reject", proposal("b", 2), anchorA)).toBeNull();
    expect(telegramApprovalReply("defer", proposal("b", 2), anchorA)).toBeNull();
  });

  it("rejects terminal tasks and retained conditions from a newer generation", () => {
    const terminal = proposal("a", 1);
    terminal.status = "cancelled";
    terminal.terminal = true;
    expect(telegramApprovalReply("approve", terminal, anchorA)).toBeNull();

    const regenerated = proposal("a", 1);
    regenerated.generation = 2;
    expect(telegramApprovalReply("approve", regenerated, anchorA)).toBeNull();
  });

  it("binds the exact displayed bytes even when producer hashes and revision stay stale", () => {
    const changed = proposal("a", 1);
    changed.diagnostics!.conditions[0]!.condition!.spec.requestedAction =
      "The candidate now adds a recurring paid service and has a newly discovered data-loss risk.";
    expect(telegramApprovalReply("approve", changed, anchorA)).toBeNull();
  });

  it("renders the full Condition proposal in an exact Task card", () => {
    const exact = proposal("a", 1);
    exact.humanAction = { requestedAction: "Problem: stale approval…" };
    const card = renderTelegramTask(exact);
    expect(card).toContain("Verified benefit: exact packet binding.");
    expect(card).toContain("one journal reread and no new service");
    expect(card).toContain("Simpler option: reuse the existing Condition.");
    expect(card).toContain("git-fast-forward:/an/intentionally/long/fixture/path/a");
    expect(card).toContain("artifact:full-diff-a.patch");
  });

  it("reads the full proposal from real HumanTaskService detail while its aggregate todo stays compact", () => {
    const db = openDatabase(":memory:");
    applyDbSchema(db);
    const stored = {
      metadata: { id: "goal/proposal", generation: 1, resourceVersion: 1 },
      spec: { parentId: "root", outcome: "Review proposal a", acceptance: ["Record the exact decision"], owner: "may" },
      status: {
        observedGeneration: 1,
        phase: "waiting",
        summary: "Problem: stale approval…",
        updatedAt: "2026-09-18T00:00:00.000Z",
        conditionIds: ["approval-a"],
      },
    };
    const condition = proposalA.diagnostics!.conditions[0]!.condition!;
    db.prepare(
      `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, updated_at, resource_json)
      VALUES ('may', 'goal/proposal', 1, 1, 1, 'waiting', 'normal', 0, 0, 1, ?)`,
    ).run(JSON.stringify(stored));
    db.prepare(
      "INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json) VALUES ('may', 'approval-a', 'false', ?)",
    ).run(JSON.stringify(condition));
    db.prepare(
      "INSERT INTO app_task_condition_routes(app_id, task_id, condition_id) VALUES ('may', 'goal/proposal', 'approval-a')",
    ).run();
    const service = new HumanTaskService(db, {
      snapshot: () => ({
        id: "test",
        generation: 1,
        entries: [
          {
            appDir: "/tmp/may.app",
            definition: { id: "may", version: 1, owner: "may", description: "test", inputSchema: {} },
          },
        ],
      }),
    } as any);
    try {
      const detail = service.getTask({ appId: "may", taskId: "goal/proposal" })!;
      const list = service.listTasks({ appId: "may", humanActionOnly: true }).items;
      expect(renderTelegramTask(detail)).toContain(action(proposalA));
      expect(renderTelegramTodos(list)).not.toContain("artifact:full-diff-a.patch");
    } finally {
      db.close();
    }
  });

  it("shows every canonical human action and accepts a role-owned approval without guessing among approvals", () => {
    const withClarification = proposal("a", 1);
    withClarification.humanAction = { requestedAction: "Two human actions remain." };
    withClarification.diagnostics!.conditions.push({
      id: "clarification-1",
      condition: {
        metadata: { id: "clarification-1", generation: 1, resourceVersion: 1 },
        spec: {
          type: "human.answer.received",
          subject: "question:rollback-window",
          expected: { answer: true },
          owner: "human",
          requestedAction: "Clarify the preferred rollback observation window.",
          reviewAfterMs: 60_000,
        },
        status: { state: "false" },
      },
    } as any);
    withClarification.diagnostics!.conditions.push({
      id: "maintainer-merge",
      condition: {
        metadata: { id: "maintainer-merge", generation: 1, resourceVersion: 1 },
        spec: {
          type: "human.answer.received",
          subject: "pull-request:199",
          expected: { merged: true },
          owner: "human:github-maintainer",
          requestedAction: "Run checks, obtain review, and merge the May-owned change.",
          reviewAfterMs: 60_000,
        },
        status: { state: "false" },
      },
    } as any);
    withClarification.diagnostics!.conditions.push({
      id: "display-name",
      condition: {
        metadata: { id: "display-name", generation: 1, resourceVersion: 1 },
        spec: {
          type: "human.answer.received",
          subject: "question:display-name",
          expected: { answer: true },
          owner: "Hao",
          requestedAction: "This display-name owner must stay hidden.",
          reviewAfterMs: 60_000,
        },
        status: { state: "false" },
      },
    } as any);
    const rendered = renderTelegramTask(withClarification);
    expect(rendered).toContain("Verified benefit: exact packet binding.");
    expect(rendered).toContain("Clarify the preferred rollback observation window.");
    expect(rendered).toContain("Run checks, obtain review, and merge the May-owned change.");
    expect(rendered).not.toContain("This display-name owner must stay hidden.");
    expect(telegramApprovalReply("approve", withClarification, anchorA)).not.toBeNull();

    const roleOwnedApproval = proposal("a", 1);
    roleOwnedApproval.diagnostics!.conditions[0]!.condition!.spec.owner = "human:github-maintainer";
    expect(telegramApprovalReply("approve", roleOwnedApproval, anchorA)).not.toBeNull();

    const ambiguous = proposal("a", 1);
    ambiguous.humanAction = { requestedAction: "Choose one proposal." };
    ambiguous.diagnostics!.conditions.push(proposal("b", 2).diagnostics!.conditions[0]!);
    expect(telegramApprovalReply("approve", ambiguous, anchorA)).toBeNull();
    expect(renderTelegramTask(ambiguous)).toContain("artifact:full-diff-a.patch");
    expect(renderTelegramTask(ambiguous)).toContain("artifact:full-diff-b.patch");
  });
});
