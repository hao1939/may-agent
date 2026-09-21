import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../../lib/db.js";
import { applyDbSchema } from "../../lib/db/schema.js";
import { closeDb, getDb } from "../../lib/requests.js";
import { EventBus } from "../core/events/bus.js";
import { HumanTaskService, type HumanTaskView } from "../human-task-service.js";
import {
  attachTelegramBot,
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

  it("renders complete service Conditions in native action cards", async () => {
    const longAction =
      "Inspect the approved maintenance procedure and retain the exact evidence. ".repeat(5) +
      "IMPORTANT: preserve existing creators and report completion only after independent verification.";
    const decisionAction = "Approve only candidate A with the documented scope.";
    const independentAction = "Independent blocker: provide the rollback observation window.";

    for (const scenario of [
      { name: "long-general-action", actions: [longAction, independentAction], approval: false },
      { name: "approval-plus-independent-action", actions: [decisionAction, independentAction], approval: true },
    ]) {
      const root = mkdtempSync(join(tmpdir(), "may-telegram-action-card-"));
      const db = getDb(root);
      const priorFetch = globalThis.fetch;
      const priorToken = process.env.TELEGRAM_BOT_TOKEN;
      const priorChat = process.env.TELEGRAM_CHAT_ID;
      const sent: string[] = [];
      let releaseUpdates: ((value: Response) => void) | undefined;
      let bot: ReturnType<typeof attachTelegramBot> | undefined;
      try {
        const conditions = scenario.actions.map((requestedAction, index) => ({
          metadata: { id: `condition-${index}`, generation: 1, resourceVersion: 1 },
          spec: {
            type: scenario.approval && index === 0 ? "project.approval.submitted" : "human.answer.received",
            subject: `id:condition-${index}`,
            owner: "human",
            requestedAction,
            expected: {
              answer: true,
              ...(scenario.approval && index === 0
                ? {
                    allowedDecisions: ["approve", "reject", "defer"],
                    approvalId: "condition-0",
                    taskGeneration: 1,
                    conditionId: "condition-0",
                  }
                : {}),
            },
          },
          status: { state: "false" },
        }));
        const stored = {
          metadata: { id: "goal/proposal", generation: 1, resourceVersion: 1 },
          spec: { parentId: "root", outcome: scenario.name, acceptance: ["Resolve every action"], owner: "may" },
          status: {
            observedGeneration: 1,
            phase: "waiting",
            summary: "Waiting for human action.",
            updatedAt: "2026-09-21T00:00:00.000Z",
            conditionIds: conditions.map((condition) => condition.metadata.id),
          },
        };
        db.prepare(
          `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, updated_at, resource_json)
           VALUES ('may', 'goal/proposal', 1, 1, 1, 'waiting', 'normal', 0, 0, 1, ?)`,
        ).run(JSON.stringify(stored));
        for (const condition of conditions) {
          db.prepare(
            "INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json) VALUES ('may', ?, 'false', ?)",
          ).run(condition.metadata.id, JSON.stringify(condition));
          db.prepare(
            "INSERT INTO app_task_condition_routes(app_id, task_id, condition_id) VALUES ('may', 'goal/proposal', ?)",
          ).run(condition.metadata.id);
        }
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
        const serviceDetail = service.getTask({ appId: "may", taskId: "goal/proposal" })!;
        if (!scenario.approval) {
          expect(serviceDetail.humanAction?.requestedAction).not.toContain("IMPORTANT:");
        }
        const watchCard = renderTelegramTask(serviceDetail);
        for (const requestedAction of scenario.actions) expect(watchCard).toContain(requestedAction);
        if (scenario.approval) {
          expect(watchCard).toContain(`Needs your decision: ${decisionAction}`);
          expect(watchCard).toContain("Also needs your action (separate from the decision):");
        }

        globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
          const method = String(url).split("/").at(-1);
          if (method === "getMe") return Response.json({ ok: true, result: { username: "fixture" } });
          if (method === "getUpdates")
            return await new Promise<Response>((resolve) => {
              releaseUpdates = resolve;
            });
          if (method === "sendMessage") {
            sent.push((JSON.parse(String(init?.body)) as { text: string }).text);
            return Response.json({ ok: true, result: { message_id: 900 + sent.length } });
          }
          throw new Error(`Unexpected Telegram method ${method}`);
        }) as typeof fetch;
        process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
        process.env.TELEGRAM_CHAT_ID = "123";
        const bus = new EventBus();
        bot = attachTelegramBot({
          bus,
          interfaceAgent: "may",
          persistDir: root,
          humanTasks: service,
          publishEvent: () => ({ eventId: 1, eventType: "fixture", delivery: "accepted" }),
        });
        bus.emit({
          type: "project.task.reconciled",
          source: "fixture",
          owner: "app:may",
          data: { appId: "may", taskId: "goal/proposal" },
        });
        const deadline = Date.now() + 2_000;
        while (sent.length === 0 && Date.now() < deadline) await Bun.sleep(5);
        expect(sent).toHaveLength(1);
        for (const requestedAction of scenario.actions) expect(sent[0]).toContain(requestedAction);
        if (scenario.approval) {
          expect(sent[0]).toContain("Needs your decision:");
          expect(sent[0]).toContain("Also needs your action (separate from the decision):");
          expect(sent[0]).toContain("Reply here with your decision.");
          const notification = db
            .prepare("SELECT data FROM notification_messages WHERE event_type = 'task.human-action'")
            .get() as { data: string };
          expect(JSON.parse(notification.data).approvalAnchor.displayedActionHash).toBe(
            createHash("sha256").update(decisionAction).digest("hex"),
          );
        }
      } finally {
        bot?.close();
        releaseUpdates?.(Response.json({ ok: true, result: [] }));
        await Bun.sleep(20);
        closeDb(root);
        rmSync(root, { recursive: true, force: true });
        globalThis.fetch = priorFetch;
        if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = priorToken;
        if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = priorChat;
      }
    }
  });

  it("shows canonical human-role and legacy Hao actions without guessing among approvals", () => {
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
          requestedAction: "Approve the legacy Hao-owned rollout wait.",
          reviewAfterMs: 60_000,
        },
        status: { state: "false" },
      },
    } as any);
    const rendered = renderTelegramTask(withClarification);
    expect(rendered).toContain("Verified benefit: exact packet binding.");
    expect(rendered).toContain("Clarify the preferred rollback observation window.");
    expect(rendered).toContain("Run checks, obtain review, and merge the May-owned change.");
    expect(rendered).toContain("Approve the legacy Hao-owned rollout wait.");
    expect(telegramApprovalReply("approve", withClarification, anchorA)).not.toBeNull();

    const roleOwnedApproval = proposal("a", 1);
    roleOwnedApproval.diagnostics!.conditions[0]!.condition!.spec.owner = "human:github-maintainer";
    expect(telegramApprovalReply("approve", roleOwnedApproval, anchorA)).not.toBeNull();

    const legacyHaoApproval = proposal("a", 1);
    legacyHaoApproval.diagnostics!.conditions[0]!.condition!.spec.owner = "Hao";
    expect(telegramApprovalReply("approve", legacyHaoApproval, anchorA)).not.toBeNull();

    const ambiguous = proposal("a", 1);
    ambiguous.humanAction = { requestedAction: "Choose one proposal." };
    ambiguous.diagnostics!.conditions.push(proposal("b", 2).diagnostics!.conditions[0]!);
    expect(telegramApprovalReply("approve", ambiguous, anchorA)).toBeNull();
    expect(renderTelegramTask(ambiguous)).toContain("artifact:full-diff-a.patch");
    expect(renderTelegramTask(ambiguous)).toContain("artifact:full-diff-b.patch");
  });
});
