import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { EVENT_ROW_ID, EventBus } from "../../src/app/core/events/bus.js";
import { createAppInboxItem } from "../../src/app/core/state/app-inbox-store.js";
import { admitTaskInput } from "../../src/app/core/state/inbox.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import {
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  recordAppTaskTrigger,
} from "../../src/app/core/tasks/app-task-reconciler.js";
import { appTaskTestContext } from "../../src/app/core/tasks/app-task-test-support.js";
import { startAppInboxRuntime } from "../../src/app/composition/app-inbox-runtime.js";
import { claimAppInboxItem, completeAppInboxClaim } from "../fixtures/legacy-inbox.js";
import { attachTelegramBot as attachTelegramBotRuntime } from "../../src/app/transport/telegram.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { HumanTaskService } from "../../src/app/human-task-service.js";
import { getDb } from "../../src/lib/requests.js";

function attachTelegramBot(
  options: Omit<Parameters<typeof attachTelegramBotRuntime>[0], "publishEvent">,
): ReturnType<typeof attachTelegramBotRuntime> {
  return attachTelegramBotRuntime({
    ...options,
    publishEvent(input) {
      const data = {
        ...input.data,
        ...(input.target ?? {}),
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      };
      const emitted = options.bus.emit({
        type: input.type,
        source: "telegram",
        owner: input.target?.appId ? `app:${input.target.appId}` : "agent:may",
        ...(input.target ? { target: input.target } : {}),
        data,
      } as any);
      return {
        eventId: Number(emitted[EVENT_ROW_ID]) || 1,
        eventType: input.type,
        delivery: "accepted",
      };
    },
  });
}

function jsonResponse(result: unknown) {
  return {
    json: async () => ({ ok: true, result }),
  } as Response;
}

async function waitFor(assertion: () => void, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastErr;
}

describe("telegram reply e2e", () => {
  let persistDir: string;
  let oldToken: string | undefined;
  let oldChatId: string | undefined;
  let humanTasks: HumanTaskService;

  beforeEach(() => {
    persistDir = mkdtempSync(resolve(tmpdir(), "telegram-e2e-"));
    oldToken = process.env.TELEGRAM_BOT_TOKEN;
    oldChatId = process.env.TELEGRAM_CHAT_ID;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
    humanTasks = new HumanTaskService(getDb(persistDir), new AppRegistry(async () => []));
  });

  afterEach(() => {
    if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = oldToken;
    if (oldChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = oldChatId;
    vi.restoreAllMocks();
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("admits one durable May request for a quoted Telegram reply", async () => {
    const sentMessages: Array<{ chat_id: string; text: string }> = [];
    let getUpdatesCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (method === "getMe") {
        return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      }

      if (method === "getUpdates") {
        getUpdatesCount++;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            {
              update_id: 1,
              message: {
                message_id: 200,
                chat: { id: 12345 },
                text: "show details",
                reply_to_message: {
                  message_id: 100,
                  text: "Project needs attention: projects/example",
                },
              },
            },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }

      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 300 + sentMessages.length });
      }

      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const conversationMessages: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") conversationMessages.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });

    await waitFor(() => {
      expect(conversationMessages).toHaveLength(1);
      expect(conversationMessages[0]).toMatchObject({
        source: "telegram",
        owner: "app:may",
        data: {
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "human", id: "telegram:12345:200" },
          replyTo: "telegram:12345:100",
          metadata: { channel: "telegram", channelMessageId: 200 },
          context: {
            reply: {
              channel: "telegram",
              messageId: 100,
              quotedText: "Project needs attention: projects/example",
            },
          },
        },
      });
      const input = String(conversationMessages[0].data?.text);
      expect(input).toBe("show details");
    });
    expect(sentMessages).toHaveLength(0);

    bot.close();
  });

  it("projects generic human help through Telegram and correlates replies without proving external work", async () => {
    const db = getDb(persistDir);
    const registry = new AppRegistry(async () => [
      {
        appDir: persistDir,
        definition: {
          id: "may",
          version: 1,
          owner: "may",
          inputSchema: { type: "object" },
          task: (input: any) => {
            const focusedTask = input.input?.data?.context?.focusedTask;
            if (!focusedTask || focusedTask.appId !== "may" || typeof focusedTask.taskId !== "string") {
              throw new Error("Human reply requires one focused May Task");
            }
            return { kind: "existing" as const, taskId: focusedTask.taskId };
          },
          tasks: {},
        },
      },
    ]);
    await registry.reload();
    const store = AppTaskResourceStore.fromDb(db, "may");
    const config = appTaskTestContext({
      appDir: persistDir,
      appId: "may",
      agent: "may",
      maxConcurrent: 1,
      resourceStore: store,
      tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
    });
    const createWait = (taskId: string, conditions: Record<string, unknown> | Record<string, unknown>[]) => {
      observeAppTaskIntent(config, {
        appAgent: "may",
        intent: { id: taskId, parentId: "root", outcome: `Resolve ${taskId}`, acceptance: ["Resolved"] },
      });
      const claim = claimObservedAppTask(config, { taskId, appAgent: "may", handler: "agent" });
      if (claim.kind !== "claimed") throw new Error(`Expected ${taskId} claim`);
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "Waiting for human help",
        facts: ["help:requested"],
        conditions: (Array.isArray(conditions) ? conditions : [conditions]) as any[],
      });
    };
    const answerCondition = {
      id: "answer-choice",
      type: "app.task.requested",
      subject: "task:answer",
      expected: {
        source: "human",
        conditionId: "answer-choice",
        conditionGeneration: 1,
        taskGeneration: 1,
      },
      owner: "human",
      requestedAction: "Reply with blue or green.",
      reviewAfterMs: 60_000,
    };
    createWait("answer", answerCondition);

    const updates: any[] = [{ update_id: 1, message: { message_id: 10, chat: { id: 12345 }, text: "/apps may" } }];
    const sentMessages: Array<Record<string, any>> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        if (updates.length) return jsonResponse(updates.splice(0));
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        const body = JSON.parse(String(init?.body));
        sentMessages.push(body);
        return jsonResponse({ message_id: 100 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const routedEvents: any[] = [];
    bus.subscribe((event: any) => routedEvents.push(event));
    const runtime = await startAppInboxRuntime({
      registry,
      db,
      bus,
      attachTask: ({ appDir: _appDir, ...input }) => admitTaskInput(config, input),
      scanIntervalMs: 10_000,
    });
    const service = new HumanTaskService(db, registry);
    const bot = attachTelegramBot({ persistDir, bus, interfaceAgent: "may", humanTasks: service });
    const notify = (taskId: string) =>
      bus.emit({
        type: "project.task.reconciled",
        source: "test-task",
        owner: "app:may",
        data: { project: "may", appId: "may", taskId, attemptId: `attempt-${taskId}` },
      } as any);
    const notifications = () =>
      sentMessages.filter((message) => String(message.text).startsWith("Needs your decision:"));
    const savedNotification = (messageId: number) => {
      const row = db
        .prepare("SELECT data FROM notification_messages WHERE chat_id = '12345' AND telegram_msg_id = ?")
        .get(messageId) as { data: string } | null;
      return row ? JSON.parse(row.data) : null;
    };

    try {
      await waitFor(() =>
        expect(sentMessages.some((message) => String(message.text).includes("Selected App"))).toBe(true),
      );
      notify("answer");
      await waitFor(() => expect(notifications()).toHaveLength(1));
      const answerMessageId = 100 + sentMessages.indexOf(notifications()[0]!) + 1;
      await waitFor(() =>
        expect(savedNotification(answerMessageId)).toMatchObject({
          taskRefs: [{ appId: "may", taskId: "answer" }],
          humanCondition: { taskGeneration: 1, conditionId: "answer-choice", conditionGeneration: 1 },
        }),
      );
      recordAppTaskTrigger(config, "answer", { type: "test.reconsider", eventId: 81, data: {} });
      const changedQuestion = claimObservedAppTask(config, { taskId: "answer", appAgent: "may", handler: "agent" });
      if (changedQuestion.kind !== "claimed") throw new Error("Expected changed-question claim");
      const answerConditionV2 = {
        ...answerCondition,
        expected: {
          source: "human",
          conditionId: "answer-choice",
          conditionGeneration: 2,
          taskGeneration: 1,
        },
        requestedAction: "Reply with red or yellow.",
      };
      deferAppTask(config, changedQuestion, {
        disposition: "waiting",
        summary: "Waiting for the corrected answer",
        facts: ["help:corrected"],
        acceptedLiveEventIds: [81],
        conditions: [answerConditionV2],
      });
      notify("answer");
      await waitFor(() => expect(notifications()).toHaveLength(2));
      const currentAnswerNotice = notifications()[1]!;
      const currentAnswerMessageId = 100 + sentMessages.indexOf(currentAnswerNotice) + 1;
      expect(savedNotification(currentAnswerMessageId)).toMatchObject({
        humanCondition: { taskGeneration: 1, conditionId: "answer-choice", conditionGeneration: 2 },
      });

      updates.push({
        update_id: 2,
        message: {
          message_id: 11,
          chat: { id: 12345 },
          from: { id: 7 },
          text: "blue",
          reply_to_message: { message_id: answerMessageId, text: notifications()[0]!.text },
        },
      });
      await waitFor(() =>
        expect(
          db
            .prepare(
              "SELECT status, waiting_on_kind, waiting_on_id FROM app_inbox_items WHERE target_task_id = 'answer' ORDER BY created_at LIMIT 1",
            )
            .get(),
        ).toEqual({ status: "handling", waiting_on_kind: "task", waiting_on_id: "answer" }),
      );
      expect(store.readTaskContext({ taskIds: ["answer"] }).conditions?.["answer-choice"]?.status.state).toBe(
        "unknown",
      );
      const staleAnswerClaim = claimObservedAppTask(config, { taskId: "answer", appAgent: "may", handler: "agent" });
      if (staleAnswerClaim.kind !== "claimed") throw new Error("Expected stale-answer reconsideration");
      const staleEvent = staleAnswerClaim.events.find(({ event }) => event.type === "app.task.requested")?.event;
      expect(staleEvent?.data).toMatchObject({
        conditionId: "answer-choice",
        conditionGeneration: 1,
        taskGeneration: 1,
      });
      const staleRequest = staleEvent?.data.request as any;
      expect(staleRequest.input.data).toMatchObject({
        message: "blue",
        context: {
          focusedTask: { appId: "may", taskId: "answer" },
          displayedHumanCondition: { taskGeneration: 1, conditionId: "answer-choice", conditionGeneration: 1 },
        },
      });
      expect(() =>
        completeAppTask(config, staleAnswerClaim, {
          summary: "Reject stale answer correlation",
          facts: ["answer:stale"],
          actions: [
            {
              kind: "retire-condition",
              conditionId: "answer-choice",
              expectedConditionGeneration: 1,
              reason: "The displayed answer was supplied",
            },
          ],
          acceptedLiveEventIds: staleAnswerClaim.events
            .map(({ event }) => Number(event.eventId))
            .filter(Number.isSafeInteger),
        }),
      ).toThrow("Condition answer-choice generation changed");
      deferAppTask(config, staleAnswerClaim, {
        disposition: "waiting",
        summary: "The old answer did not answer the corrected question",
        facts: ["answer:stale"],
        acceptedLiveEventIds: staleAnswerClaim.events
          .map(({ event }) => Number(event.eventId))
          .filter(Number.isSafeInteger),
      });

      recordAppTaskTrigger(config, "answer", { type: "test.reconsider", eventId: 82, data: {} });
      const runningAnswer = claimObservedAppTask(config, { taskId: "answer", appAgent: "may", handler: "agent" });
      if (runningAnswer.kind !== "claimed") throw new Error("Expected answer attempt before concurrent reply");
      updates.push({
        update_id: 3,
        message: {
          message_id: 12,
          chat: { id: 12345 },
          from: { id: 7 },
          text: "blue again",
          reply_to_message: { message_id: answerMessageId, text: notifications()[0]!.text },
        },
      });
      await waitFor(() =>
        expect(
          db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE target_task_id = 'answer'").get(),
        ).toEqual({ count: 2 }),
      );
      deferAppTask(config, runningAnswer, {
        disposition: "waiting",
        summary: "The concurrently arriving old answer is still stale",
        facts: ["answer:concurrent-stale"],
        acceptedLiveEventIds: [82],
      });
      expect(store.readTaskContext({ taskIds: ["answer"] }).conditions?.["answer-choice"]?.status.state).toBe(
        "unknown",
      );

      updates.push({
        update_id: 4,
        message: {
          message_id: 13,
          chat: { id: 12345 },
          from: { id: 7 },
          text: "red",
          reply_to_message: { message_id: currentAnswerMessageId, text: currentAnswerNotice.text },
        },
      });
      await waitFor(() =>
        expect(
          db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE target_task_id = 'answer'").get(),
        ).toEqual({ count: 3 }),
      );
      expect(store.readTaskContext({ taskIds: ["answer"] }).conditions?.["answer-choice"]?.status.state).toBe(
        "unknown",
      );
      const answerClaim = claimObservedAppTask(config, { taskId: "answer", appAgent: "may", handler: "agent" });
      if (answerClaim.kind !== "claimed") throw new Error("Expected current-answer claim");
      const answerEvent = answerClaim.events
        .map(({ event }) => event)
        .find(
          (event) => event.type === "app.task.requested" && (event.data.request as any)?.input?.data?.message === "red",
        );
      expect(answerEvent?.data).toMatchObject({
        conditionId: "answer-choice",
        conditionGeneration: 2,
        taskGeneration: 1,
      });
      const answerRequest = answerEvent?.data.request as any;
      expect(answerRequest.input.data).toMatchObject({
        message: "red",
        context: {
          focusedTask: { appId: "may", taskId: "answer" },
          displayedHumanCondition: { taskGeneration: 1, conditionId: "answer-choice", conditionGeneration: 2 },
        },
      });
      expect(
        completeAppTask(config, answerClaim, {
          summary: "The human answered the displayed question",
          facts: ["answer:red"],
          actions: [
            {
              kind: "retire-condition",
              conditionId: "answer-choice",
              expectedConditionGeneration: 2,
              reason: "The reply answered the exact displayed question",
            },
          ],
          acceptedLiveEventIds: answerClaim.events
            .map(({ event }) => Number(event.eventId))
            .filter(Number.isSafeInteger),
        }),
      ).toMatchObject({ status: "applied", actionsApplied: ["retired condition answer-choice generation 2"] });
      expect(store.readTaskContext({ taskIds: ["answer"] }).conditions?.["answer-choice"]).toBeUndefined();
      expect(routedEvents.filter((event) => event.type === "subscriber.failed")).toEqual([]);

      const externalCondition = {
        id: "deployment-proof",
        type: "deployment.completed",
        subject: "deployment:release-42",
        expected: { state: "done" },
        owner: "human",
        requestedAction: "Deploy release 42, then wait for independent deployment observation.",
        reviewAfterMs: 60_000,
      };
      createWait("external", externalCondition);
      notify("external");
      await waitFor(() => expect(notifications()).toHaveLength(3));
      const externalNotice = notifications()[2]!;
      const externalMessageId = 100 + sentMessages.indexOf(externalNotice) + 1;
      const displayed = savedNotification(externalMessageId);
      expect(displayed).toMatchObject({
        taskRefs: [{ appId: "may", taskId: "external" }],
        humanCondition: { taskGeneration: 1, conditionId: "deployment-proof", conditionGeneration: 1 },
      });

      updates.push({
        update_id: 5,
        message: {
          message_id: 14,
          chat: { id: 12345 },
          from: { id: 7 },
          text: "done",
          reply_to_message: { message_id: externalMessageId, text: externalNotice.text },
        },
      });
      await waitFor(() =>
        expect(
          db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE target_task_id = 'external'").get(),
        ).toEqual({ count: 1 }),
      );
      expect(store.readTaskContext({ taskIds: ["external"] }).conditions?.["deployment-proof"]?.status.state).toBe(
        "unknown",
      );
      const externalClaim = claimObservedAppTask(config, { taskId: "external", appAgent: "may", handler: "agent" });
      if (externalClaim.kind !== "claimed") throw new Error("Expected external-action reply claim");
      const externalRequest = externalClaim.events.find(({ event }) => event.type === "app.task.requested")?.event.data
        .request as any;
      expect(externalRequest.input.data).toMatchObject({
        message: "done",
        context: {
          focusedTask: { appId: "may", taskId: "external" },
          displayedHumanCondition: displayed.humanCondition,
        },
      });
      const acceptedLiveEventIds = externalClaim.events
        .map(({ event }) => Number(event.eventId))
        .filter(Number.isSafeInteger);
      deferAppTask(config, externalClaim, {
        disposition: "waiting",
        summary: "The reply is input, not independent deployment evidence",
        facts: ["reply:received", "deployment:unverified"],
        acceptedLiveEventIds,
        conditions: [
          externalCondition,
          {
            id: "rollout-window",
            type: "rollout.window.selected",
            subject: "deployment:release-42",
            expected: { field: "window", anyOf: ["now", "later"] },
            owner: "human",
            requestedAction: "Choose now or later for the rollout window.",
            reviewAfterMs: 60_000,
          },
        ],
      });
      expect(store.readTaskContext({ taskIds: ["external"] }).conditions?.["deployment-proof"]?.status.state).toBe(
        "unknown",
      );

      notify("external");
      await waitFor(() => expect(notifications()).toHaveLength(4));
      const ambiguousNotice = notifications()[3]!;
      const ambiguousMessageId = 100 + sentMessages.indexOf(ambiguousNotice) + 1;
      await waitFor(() =>
        expect(savedNotification(ambiguousMessageId)?.taskRefs).toEqual([{ appId: "may", taskId: "external" }]),
      );
      expect(savedNotification(ambiguousMessageId)).not.toHaveProperty("humanCondition");

      updates.push({
        update_id: 6,
        message: {
          message_id: 15,
          chat: { id: 12345 },
          from: { id: 7 },
          text: "later",
          reply_to_message: { message_id: ambiguousMessageId, text: ambiguousNotice.text },
        },
      });
      await waitFor(() =>
        expect(
          db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE target_task_id = 'external'").get(),
        ).toEqual({ count: 2 }),
      );
      const ambiguousClaim = claimObservedAppTask(config, { taskId: "external", appAgent: "may", handler: "agent" });
      if (ambiguousClaim.kind !== "claimed") throw new Error("Expected ambiguous reply claim");
      const ambiguousRequest = ambiguousClaim.events.find(({ event }) => event.type === "app.task.requested")?.event
        .data.request as any;
      expect(ambiguousRequest.input.data.context).toMatchObject({ focusedTask: { appId: "may", taskId: "external" } });
      expect(ambiguousRequest.input.data.context).not.toHaveProperty("displayedHumanCondition");
      deferAppTask(config, ambiguousClaim, {
        disposition: "waiting",
        summary: "An uncorrelated reply does not select either open Condition",
        facts: ["reply:ambiguous"],
        acceptedLiveEventIds: ambiguousClaim.events
          .map(({ event }) => Number(event.eventId))
          .filter(Number.isSafeInteger),
      });
      const openConditions = store.readTaskContext({ taskIds: ["external"] }).resources?.external?.status.conditionIds;
      expect(openConditions).toEqual(["deployment-proof", "rollout-window"]);

      const approvalCondition = (letter: string) => ({
        id: `approval-${letter}`,
        type: "project.approval.submitted",
        subject: `id:proposal-${letter}`,
        expected: {
          allowedDecisions: ["approve", "reject", "defer"],
          approvalId: `proposal-${letter}`,
          packetHash: letter.repeat(64),
          proposalRevision: 1,
          taskGeneration: 1,
          conditionId: `approval-${letter}`,
        },
        owner: "human",
        requestedAction: `Review proposal ${letter}.`,
        reviewAfterMs: 60_000,
      });
      createWait("mixed", [
        approvalCondition("a"),
        approvalCondition("b"),
        {
          id: "clarify-mixed",
          type: "app.task.requested",
          subject: "task:mixed",
          expected: {
            source: "human",
            conditionId: "clarify-mixed",
            conditionGeneration: 1,
            taskGeneration: 1,
          },
          owner: "human",
          requestedAction: "Clarify the preferred proposal before approval.",
          reviewAfterMs: 60_000,
        },
      ]);
      const mixedRef = service.getTask({ appId: "may", taskId: "mixed" })!.ref;
      updates.push({
        update_id: 7,
        message: { message_id: 16, chat: { id: 12345 }, from: { id: 7 }, text: `/watch ${mixedRef}` },
      });
      await waitFor(() =>
        expect(sentMessages.some((message) => String(message.text).includes("Following updates."))).toBe(true),
      );
      recordAppTaskTrigger(config, "mixed", { type: "test.reconsider", eventId: 83, data: {} });
      const refreshedMixed = claimObservedAppTask(config, { taskId: "mixed", appAgent: "may", handler: "agent" });
      if (refreshedMixed.kind !== "claimed") throw new Error("Expected mixed-condition refresh claim");
      deferAppTask(config, refreshedMixed, {
        disposition: "waiting",
        summary: "Mixed conditions refreshed",
        facts: ["help:mixed"],
        acceptedLiveEventIds: [83],
      });
      notify("mixed");
      const savedMixedWatch = () =>
        db
          .prepare(
            "SELECT telegram_msg_id, data FROM notification_messages WHERE chat_id = '12345' AND event_type = 'task.watch' ORDER BY telegram_msg_id DESC LIMIT 1",
          )
          .get() as { telegram_msg_id: number; data: string } | null;
      await waitFor(() =>
        expect(savedMixedWatch() ? JSON.parse(savedMixedWatch()!.data).taskRefs : null).toEqual([
          { appId: "may", taskId: "mixed" },
        ]),
      );
      const mixedWatch = savedMixedWatch()!;
      const mixedNotice = sentMessages.find((message) => String(message.text).includes("Mixed conditions refreshed"))!;
      const mixedReceipt = JSON.parse(mixedWatch.data);
      expect(mixedReceipt).not.toHaveProperty("approvalAnchor");
      expect(mixedReceipt).not.toHaveProperty("humanCondition");

      updates.push({
        update_id: 8,
        message: {
          message_id: 17,
          chat: { id: 12345 },
          from: { id: 7 },
          text: "Prefer proposal a",
          reply_to_message: { message_id: mixedWatch.telegram_msg_id, text: mixedNotice.text },
        },
      });
      await waitFor(() =>
        expect(
          db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE target_task_id = 'mixed'").get(),
        ).toEqual({ count: 1 }),
      );
      const mixedClaim = claimObservedAppTask(config, { taskId: "mixed", appAgent: "may", handler: "agent" });
      if (mixedClaim.kind !== "claimed") throw new Error("Expected mixed-condition reply claim");
      const mixedRequest = mixedClaim.events.find(({ event }) => event.type === "app.task.requested")?.event.data
        .request as any;
      expect(mixedRequest.input.data).toMatchObject({
        message: "Prefer proposal a",
        context: { focusedTask: { appId: "may", taskId: "mixed" } },
      });
      expect(mixedRequest.input.data.context).not.toHaveProperty("displayedHumanCondition");
      deferAppTask(config, mixedClaim, {
        disposition: "waiting",
        summary: "The ordinary reply remains Task input without selecting a Condition",
        facts: ["reply:mixed"],
        acceptedLiveEventIds: mixedClaim.events.map(({ event }) => Number(event.eventId)).filter(Number.isSafeInteger),
      });
    } finally {
      bot.close();
      runtime.close();
    }
  });

  it("does not turn raw session or legacy human-targeted events into Telegram output", async () => {
    const sentMessages: Array<{ text: string }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 300 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const bot = attachTelegramBot({ persistDir, bus, interfaceAgent: "may", humanTasks });
    bus.emit({ type: "text", sessionId: "legacy-session", agent: "may", text: "raw session text" } as any);
    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: { from: "may", to: "human", content: "legacy notification" },
    } as any);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(sentMessages).toHaveLength(0);
    bot.close();
  });

  it("mirrors a May Conversation result to the exact originating chat and topic", async () => {
    process.env.TELEGRAM_CHAT_ID = "111,222";
    const sentMessages: Array<Record<string, unknown>> = [];
    let getUpdatesCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount += 1;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            {
              update_id: 1,
              message: { message_id: 80, message_thread_id: 7, chat: { id: 222 }, text: "Review this" },
            },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 81 });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    let input: any;
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created" && event.data?.author?.kind === "human") input = event;
    });
    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });
    await waitFor(() => expect(input).toBeTruthy());

    const db = getDb(persistDir);
    createAppInboxItem(db, {
      id: "item-80",
      appId: "may",
      source: { kind: "human", id: input.data.author.id },
      input: { kind: "message", data: { message: "Review this" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "telegram",
      channelTargetId: input.data.metadata.channelTargetId,
      channelThreadId: input.data.metadata.channelThreadId,
      channelMessageId: input.data.metadata.channelMessageId,
      now: 1,
    });
    const claim = claimAppInboxItem(db, "item-80", "test", 1_000, 2);
    if (!claim) throw new Error("expected May request claim");
    completeAppInboxClaim(db, claim, { summary: "Reviewed.", response: "Reviewed.", facts: ["test:accepted"] }, 3);
    bus.emit({
      type: "conversation.updated",
      source: "app-inbox",
      owner: "app:may",
      data: { appId: "may", conversationId: "may:primary" },
    });

    await waitFor(() => expect(sentMessages).toHaveLength(1));
    expect(sentMessages[0]).toMatchObject({
      chat_id: "222",
      message_thread_id: 7,
      text: "Reviewed.",
      reply_parameters: { message_id: 80, allow_sending_without_reply: true },
    });
    bot.close();
  });

  it("renders a new Console message from the shared Conversation without appending a duplicate", async () => {
    const sentMessages: Array<Record<string, unknown>> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 600 });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const conversationEvents: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") conversationEvents.push(event);
    });
    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });
    createAppInboxItem(getDb(persistDir), {
      id: "console-message-1",
      appId: "may",
      source: { kind: "human", id: "may-console:instance:1" },
      input: { kind: "message", data: { message: "Message sent from Console" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "may-console",
      now: 1,
    });
    bus.emit({
      type: "conversation.updated",
      source: "app-inbox",
      owner: "app:may",
      data: { appId: "may", conversationId: "may:primary" },
    });

    await waitFor(() => expect(sentMessages).toHaveLength(1));
    expect(sentMessages[0]).toMatchObject({
      chat_id: "12345",
      text: "Console · You\nMessage sent from Console",
    });
    expect(conversationEvents).toEqual([]);
    bot.close();
  });

  it("coalesces Conversation wake storms while one Telegram sync is in flight", async () => {
    const db = getDb(persistDir) as any;
    const prepare = db.prepare.bind(db);
    let conversationReads = 0;
    db.prepare = (sql: string) => {
      // One resource read prepares separate message and command projections.
      // Count only the message projection so this measures Conversation reads,
      // not internal SQL statements.
      if (
        sql.includes("event_type = 'conversation.message.created'") &&
        sql.includes("author.kind') IN ('agent', 'tool')")
      ) {
        conversationReads++;
      }
      return prepare(sql);
    };
    let releaseSend!: () => void;
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    let sendCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL) => {
      const method = String(url).split("/").pop();
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sendCalls++;
        if (sendCalls === 1) await sendGate;
        return jsonResponse({ message_id: 700 + sendCalls });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const bot = attachTelegramBot({ persistDir, bus, interfaceAgent: "may", humanTasks });
    const baselineReads = conversationReads;
    createAppInboxItem(db, {
      id: "console-storm-message",
      appId: "may",
      source: { kind: "human", id: "may-console:storm:1" },
      input: { kind: "message", data: { message: "One durable message" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "may-console",
      now: 1,
    });
    const wake = {
      type: "conversation.updated",
      source: "app-inbox",
      owner: "app:may",
      data: { appId: "may", conversationId: "may:primary" },
    } as const;
    bus.emit(wake);
    await waitFor(() => expect(sendCalls).toBe(1));
    for (let index = 0; index < 50; index++) bus.emit(wake);
    releaseSend();

    // The initial read plus one dirty retry is sufficient for all 50 wakes.
    await waitFor(() => expect(conversationReads).toBe(baselineReads + 2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(conversationReads).toBe(baselineReads + 2);
    expect(sendCalls).toBe(1);
    bot.close();
  });

  it("rejects removed session commands and unknown commands locally without creating May work", async () => {
    const sentMessages: Array<Record<string, unknown>> = [];
    let getUpdatesCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount += 1;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            { update_id: 1, message: { message_id: 90, chat: { id: 12345 }, text: "/status" } },
            { update_id: 2, message: { message_id: 91, chat: { id: 12345 }, text: "/does-not-exist" } },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 100 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const messages: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") messages.push(event);
    });
    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });

    await waitFor(() => expect(sentMessages).toHaveLength(2));
    expect(sentMessages.map((message) => message.text)).toEqual([
      "Unknown command: /status. Use /help to see available commands.",
      "Unknown command: /does-not-exist. Use /help to see available commands.",
    ]);
    expect(messages).toEqual([]);
    bot.close();
  });

  it("keeps Task cancellation local, forwards reload and rejects the retired shutdown command", async () => {
    let getUpdatesCount = 0;
    const replies: string[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();

      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount++;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            {
              update_id: 31,
              message: { message_id: 1001, chat: { id: 12345 }, text: "/cancel s_active_telegram" },
            },
            { update_id: 32, message: { message_id: 1002, chat: { id: 12345 }, text: "/reload" } },
            { update_id: 33, message: { message_id: 1003, chat: { id: 12345 }, text: "/close" } },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        replies.push(JSON.parse(String(init?.body)).text);
        return jsonResponse({ message_id: 1100 });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const events: any[] = [];
    bus.subscribe((event: any) => events.push(event));

    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });

    await waitFor(() => {
      expect(events).toContainEqual({
        type: "runtime.reload.requested",
        source: "telegram",
        owner: "agent:may",
        data: {
          requestId: "telegram:12345:1002:reload",
          idempotencyKey: "telegram:12345:1002:reload",
        },
      });
      expect(replies).toContain("Unknown command: /close. Use /help to see available commands.");
      expect(replies).toContainEqual(expect.stringContaining("Ask May to find the work"));
      expect(events.some((event) => event.type === "runtime.shutdown.requested")).toBe(false);
      expect(events.some((event) => event.type === "session.cancel.requested")).toBe(false);
      expect(events.some((event) => event.type === "input")).toBe(false);
    });

    bot.close();
  });
});
