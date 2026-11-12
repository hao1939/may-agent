/**
 * Pure formatting and inline-control helpers for Telegram human surfaces.
 *
 * Keeps Telegram presentation separate from provider polling, delivery receipts,
 * and surface session state.
 */

import type { AppConversationMessage, AppConversationTopic } from "@may-agent/sdk";
import type { ApprovalProposal, EventInput } from "@may-agent/control/events";
import {
  approvalProposalForTask,
  fullHumanActionTextForTask as fullHumanActionText,
  humanActionSummaryText as humanActionText,
  humanConditionActionsForTask as humanConditionActions,
  humanConditionAnchorForTask as humanConditionAnchor,
  type HumanAppView,
  type HumanTaskView,
} from "../human-task-service.js";

export type TelegramApprovalAnchor = ApprovalProposal;

/** One logical human conversation; provider chat/topic IDs are coordinates. */
export function primaryConversationId(agent: string): string {
  return `${agent.trim() || "host"}:primary`;
}

export function renderTelegramApps(apps: HumanAppView[], selectedApp?: string): string {
  if (apps.length === 0) return "No Apps found.";
  return [
    "Apps:",
    ...apps.map((app) => {
      const states = [
        `${app.openTasks ?? app.activeTasks} open`,
        `${app.activeTasks} active`,
        ...(app.idleTasks ? [`${app.idleTasks} idle`] : []),
        ...(app.queuedTasks ? [`${app.queuedTasks} queued`] : []),
        ...(app.runningTasks ? [`${app.runningTasks} running`] : []),
        ...(app.waitingTasks ? [`${app.waitingTasks} waiting`] : []),
        ...(app.attentionTasks ? [`${app.attentionTasks} attention`] : []),
      ];
      return `• ${app.id === selectedApp ? "✓ " : ""}${app.id} — ${states.join(" · ")}`;
    }),
  ].join("\n");
}

export function topicReference(topic: AppConversationTopic): string {
  const value = topic.id.startsWith("topic_") ? topic.id.slice("topic_".length) : topic.id;
  return value.slice(0, 8) || "????????";
}

export function resolveConversationTopic(
  topics: AppConversationTopic[],
  ref: string,
): AppConversationTopic | undefined {
  const normalized = ref.trim().toLowerCase();
  const matches = topics.filter((topic) => {
    const id = topic.id.toLowerCase();
    return id === normalized || id === `topic_${normalized}` || topicReference(topic).toLowerCase() === normalized;
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function renderTelegramTopics(
  topics: AppConversationTopic[],
  selectedTopicId?: string,
  options: { older?: boolean; hasMore?: boolean } = {},
): string {
  if (topics.length === 0) return options.older ? "No older Topics." : "No recent Topics.";
  return [
    options.older ? "Older Topics:" : "Recent Topics:",
    ...topics.map(
      (topic) =>
        `• ${topic.id === selectedTopicId ? "✓ " : ""}${topicReference(topic)} · ${topic.title}${
          topic.taskRefs.length ? ` · ${topic.taskRefs.length} Task${topic.taskRefs.length === 1 ? "" : "s"}` : ""
        }`,
    ),
    ...(options.hasMore ? ["More Topics are available; use /topics more."] : []),
    "",
    "Use /topic <ref> to continue one Topic. Task progress remains under /task and /watch.",
  ].join("\n");
}

export function renderTelegramTopic(topic: AppConversationTopic, messages: AppConversationMessage[]): string {
  const tasks = topic.taskRefs.map((task) => `• ${task.ref ?? "????????"} · ${task.appId}`);
  const recent = messages
    .filter((message) => message.metadata?.topicId === topic.id)
    .slice(-8)
    .flatMap((message) => {
      const text = message.text.trim().replace(/\s+/g, " ");
      if (!text) return [];
      const speaker = message.author.kind === "human" ? "You" : message.author.kind === "agent" ? "May" : "View";
      return [`${speaker}: ${text.length > 180 ? `${text.slice(0, 177)}...` : text}`];
    });
  return [
    `Following ${topicReference(topic)} · ${topic.title}`,
    "Tasks:",
    ...(tasks.length ? tasks : ["• None"]),
    ...(recent.length ? ["", "Recent conversation:", ...recent] : []),
  ].join("\n");
}

function escapeTelegramHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function compactDuration(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function recurrenceLine(task: Pick<HumanTaskView, "recurring" | "recurrence">): string | null {
  if (!task.recurring) return null;
  const cadence = task.recurrence?.cadenceMs ? ` · every ${compactDuration(task.recurrence.cadenceMs)}` : "";
  const parsedNextRun = task.recurrence?.nextRunAt ? Date.parse(task.recurrence.nextRunAt) : Number.NaN;
  const nextRun = Number.isFinite(parsedNextRun)
    ? ` · next ${new Date(parsedNextRun).toISOString().replace("T", " ").slice(0, 16)} UTC`
    : "";
  return `  🔁 <b>Recurring</b>${cadence}${nextRun}`;
}

function taskSection(task: HumanTaskView): string {
  if (task.humanAction) return "Needs you";
  if (task.status === "pending" || task.status === "running") return "Working";
  if (task.status === "waiting") return "Waiting";
  if (task.status === "idle") return "Idle";
  if (task.status === "closed") return "Closed";
  if (task.status === "cancelled") return "Cancelled";
  if (task.terminal) return "Completed";
  return "Attention";
}

function taskStateMarker(task: Pick<HumanTaskView, "status" | "humanAction" | "terminal">): string {
  if (task.humanAction) return "🔴";
  if (task.status === "pending" || task.status === "running") return "🔵";
  if (task.status === "waiting") return "🟡";
  if (task.status === "idle") return "🟢";
  if (task.terminal) return "⚪";
  return "🟠";
}

function elapsedText(value: number): string {
  const minutes = Math.floor(Math.max(0, Date.now() - value) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function updatedAgeText(value: number): string {
  const age = elapsedText(value);
  return age === "just now" ? age : `${age} ago`;
}

function renderTaskCard(task: HumanTaskView): string {
  const result = task.response?.trim() || task.summary?.trim();
  return [
    `${taskStateMarker(task)} <b>${escapeTelegramHtml(task.outcome)}</b>`,
    `  ${escapeTelegramHtml(task.appId)} · <code>${escapeTelegramHtml(task.ref)}</code> · updated ${updatedAgeText(task.updatedAt)}`,
    ...(task.humanAction ? [`  ${escapeTelegramHtml(humanActionText(task))}`] : []),
    ...(recurrenceLine(task) ? [recurrenceLine(task)!] : []),
    ...(task.terminal && result ? [`  ${escapeTelegramHtml(result)}`] : []),
  ].join("\n");
}

export function renderTelegramTasks(tasks: HumanTaskView[], includeDone: boolean, hasMore = false): string {
  if (tasks.length === 0) return includeDone ? "No Tasks." : "No open Tasks.";
  const sections = ["Needs you", "Working", "Waiting", "Idle", "Attention", "Closed", "Cancelled", "Completed"];
  return [
    `<b>${includeDone ? "Tasks · open and history" : "Tasks · open"}</b>`,
    ...sections.flatMap((section) => {
      const matching = tasks.filter((task) => taskSection(task) === section);
      return matching.length > 0
        ? ["", `<b>${section}</b>`, ...matching.flatMap((task) => [renderTaskCard(task), ""]).slice(0, -1)]
        : [];
    }),
    ...(hasMore ? ["", "More Tasks are available; use /tasks more for the next page."] : []),
  ].join("\n");
}

function taskStatusLabel(task: Pick<HumanTaskView, "status" | "humanAction">): string {
  switch (task.status) {
    case "pending":
      return "queued";
    case "running":
      return "working";
    case "waiting":
      return "waiting";
    case "attention":
      return task.humanAction ? "needs you" : "needs review";
    case "idle":
      return "idle";
    case "done":
      return "done";
    case "closed":
      return "closed";
    case "cancelled":
      return "cancelled";
  }
}

function currentTaskText(task: HumanTaskView): string {
  const observed = task.terminal
    ? task.response?.trim() || task.summary?.trim()
    : task.progress?.message?.trim() || task.response?.trim() || task.summary?.trim();
  if (observed) return observed;
  switch (task.status) {
    case "pending":
      return "No attempt has started yet.";
    case "running":
      return "Work is active; no detailed progress has been reported yet.";
    case "waiting":
      return "No new progress has been reported while the Task waits.";
    case "attention":
      return "No recovery update has been reported yet.";
    case "idle":
      return "No work is runnable. The owner must retain a specific next responsibility or close this assignment.";
    case "done":
      return "No result summary was recorded.";
    case "cancelled":
    case "closed":
      return "The Task will not continue.";
  }
}

export function replyInstruction(_task: HumanTaskView, _conditionId?: string): string {
  return "Reply to this message with an exact response requested above, or with the requested completion evidence. A question, qualification, or requested change is feedback, not completion.";
}

function humanActionLine(task: HumanTaskView): string {
  const owner = task.humanAction?.task;
  const approval = approvalProposalForTask(task);
  const decisionAction = approval?.requestedAction ?? null;
  const otherActions = decisionAction ? humanConditionActions(task, approval?.conditionId) : [];
  const text = decisionAction
    ? [
        `Decision needed\n${decisionAction}`,
        `How to respond\n${replyInstruction(task, approval?.conditionId)}`,
        ...(otherActions.length > 0
          ? [`Other action needed (separate from this decision)\n${otherActions.join("\n\n")}`]
          : []),
      ].join("\n\n")
    : [`Action needed\n${fullHumanActionText(task)}`, `How to respond\n${replyInstruction(task)}`].join("\n\n");
  return owner ? `On Task ${owner.ref} · ${owner.appId}: ${text}` : text;
}

export function renderTelegramTodos(
  tasks: HumanTaskView[],
  total = tasks.length,
  appId?: string,
  hasMore = false,
): string {
  const scope = appId ? ` for ${appId}` : " across all Apps";
  if (tasks.length === 0) return `Nothing needs your action${scope}.`;
  return [
    `<b>Needs you${escapeTelegramHtml(scope)}</b>`,
    "",
    ...tasks
      .flatMap((task) => {
        const since = task.humanAction?.since;
        return [
          [
            `🔴 <b>Action: ${escapeTelegramHtml(humanActionText(task))}</b>`,
            `  Purpose: ${escapeTelegramHtml(task.outcome)}`,
            ...(recurrenceLine(task) ? [recurrenceLine(task)!] : []),
            `  ${escapeTelegramHtml(task.appId)} · <code>${escapeTelegramHtml(task.ref)}</code>${since === undefined ? "" : ` · waiting ${elapsedText(since)}`}`,
          ].join("\n"),
          "",
        ];
      })
      .slice(0, -1),
    ...(total > tasks.length
      ? ["", `${total - tasks.length} more action(s) are not shown.${hasMore ? " Use /todo more." : ""}`]
      : []),
  ].join("\n");
}

function formatWorkTime(value: number): string {
  return new Date(value)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

export function renderTelegramTask(task: HumanTaskView): string {
  const acceptance = (task.acceptance ?? []).filter((item) => item.trim());
  const currentHeading =
    !task.terminal && task.progress ? `Current · ${formatWorkTime(task.progress.updatedAt)}` : "Current";
  return [
    `Task ${task.ref} · ${task.appId}`,
    "",
    `Goal\n${task.outcome}`,
    "",
    `State\n${taskStatusLabel(task)}. ${task.statusDetail ?? ""}`.trimEnd(),
    "",
    `${currentHeading}\n${currentTaskText(task)}`,
    ...(task.waitingOn ?? []).map((wait) =>
      wait.kind === "task"
        ? `Waiting on ${wait.ref} · ${wait.appId} · ${taskStatusLabel(wait)}\n${wait.outcome}`
        : wait.kind === "app"
          ? `Waiting on App ${wait.appId} · ${wait.status}`
          : `Waiting for ${wait.type}\n${wait.subject}`,
    ),
    "",
    "Expected result",
    ...(acceptance.length > 0
      ? acceptance.map((item) => `• ${item}`)
      : ["No separate completion criteria were recorded."]),
    "",
    `You\n${task.humanAction ? humanActionLine(task) : "Nothing needed right now."}`,
    ...(task.requestedBy
      ? ["", `Related\nRequested by ${task.requestedBy.ref} · ${task.requestedBy.appId}\n${task.requestedBy.outcome}`]
      : []),
    "",
    `Updated\n${formatWorkTime(task.updatedAt)}`,
    "",
    `Details\nID: ${task.taskId}`,
    ...(task.execution?.sessionId ? [`Session: ${task.execution.sessionId}`] : []),
  ].join("\n");
}

function renderedWaits(task: HumanTaskView): string[] {
  return (task.waitingOn ?? []).map((wait) =>
    wait.kind === "task"
      ? `Waiting on ${wait.ref} · ${wait.appId} · ${taskStatusLabel(wait)}: ${wait.outcome}`
      : wait.kind === "app"
        ? `Waiting on App ${wait.appId} · ${wait.status}`
        : `Waiting for ${wait.type}: ${wait.subject}`,
  );
}

export function taskPresentationRevision(task: HumanTaskView): string {
  const decision = approvalProposalForTask(task)?.requestedAction ?? null;
  return JSON.stringify({
    outcome: task.outcome,
    status: taskStatusLabel(task),
    current: currentTaskText(task),
    waits: renderedWaits(task),
    decision,
    action: task.humanAction ? fullHumanActionText(task) : null,
    otherActions: decision ? humanConditionActions(task, approvalProposalForTask(task)?.conditionId) : [],
    approvalAnchor: approvalProposalForTask(task),
    humanCondition: humanConditionAnchor(task),
  });
}

export function representedTaskIdentities(task: HumanTaskView): Array<{ appId: string; taskId: string }> {
  return [
    { appId: task.appId, taskId: task.taskId },
    ...(task.requestedBy ? [{ appId: task.requestedBy.appId, taskId: task.requestedBy.taskId }] : []),
    ...(task.waitingOn ?? []).flatMap((wait) =>
      wait.kind === "task" ? [{ appId: wait.appId, taskId: wait.taskId }] : [],
    ),
  ];
}

export function renderTelegramTaskUpdate(task: HumanTaskView): string {
  const decisionAction = approvalProposalForTask(task)?.requestedAction ?? null;
  const otherActions = decisionAction ? humanConditionActions(task, approvalProposalForTask(task)?.conditionId) : [];
  return [
    task.outcome,
    taskStatusLabel(task),
    "",
    currentTaskText(task),
    ...renderedWaits(task).flatMap((wait) => ["", wait]),
    ...(task.humanAction
      ? decisionAction
        ? [
            "",
            `Decision needed\n${decisionAction}`,
            `How to respond\n${replyInstruction(task, approvalProposalForTask(task)?.conditionId)}`,
            ...(otherActions.length > 0
              ? [
                  "",
                  `Other action needed (separate from this decision)\n${otherActions.join("\n\n")}`,
                  "Reply separately with the requested answer or completion evidence.",
                ]
              : []),
          ]
        : [
            "",
            `Action needed\n${fullHumanActionText(task)}`,
            `How to respond\n${replyInstruction(task)}`,
          ]
      : []),
  ].join("\n");
}

export function renderTelegramSingleTodoNotification(proposal: HumanTaskView): string {
  const displayedApproval = approvalProposalForTask(proposal);
  const decisionAction = displayedApproval ? displayedApproval.requestedAction : null;
  const otherActions = displayedApproval
    ? humanConditionActions(proposal, approvalProposalForTask(proposal)?.conditionId)
    : [];
  if (decisionAction) {
    return [
      "Needs your decision",
      `Purpose\n${proposal.outcome}`,
      `Decision needed\n${decisionAction}`,
      `How to respond\n${replyInstruction(proposal, displayedApproval?.conditionId)}`,
      ...(otherActions.length > 0
        ? [
            "Other action needed (separate from this decision)",
            otherActions.join("\n\n"),
            "Reply separately with the requested answer or completion evidence.",
          ]
        : []),
      "Use Details for the current state and evidence.",
    ].join("\n\n");
  }
  return [
    "Needs your action",
    `Purpose\n${proposal.outcome}`,
    `Action needed\n${fullHumanActionText(proposal)}`,
    `How to respond\n${replyInstruction(proposal)}`,
    "Use Details for the current state and evidence.",
  ].join("\n\n");
}

export function taskReferences(value: unknown): Array<{ appId: string; taskId: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((task) =>
    task && typeof task.appId === "string" && task.appId && typeof task.taskId === "string" && task.taskId
      ? [{ appId: task.appId, taskId: task.taskId }]
      : [],
  );
}

export function singleTaskReference(value: unknown): { appId: string; taskId: string } | undefined {
  const tasks = taskReferences(value);
  return tasks.length === 1 ? tasks[0] : undefined;
}

export function taskButtons(taskRefs: unknown) {
  const tasks = taskReferences(taskRefs);
  if (tasks.length === 0) return undefined;
  if (tasks.length === 1)
    return {
      inline_keyboard: [
        [
          { text: "Details", callback_data: "task:details" },
          { text: "Follow updates", callback_data: "task:follow" },
        ],
      ],
    };
  return {
    inline_keyboard: tasks.map((task, index) => [
      {
        text: `Details · ${task.appId}/${task.taskId}`.slice(0, 64),
        callback_data: `task:details:${index}`,
      },
    ]),
  };
}

export function renderTelegramConversationMessage(message: AppConversationMessage): string {
  const channel = message.metadata?.channel?.trim() || "another surface";
  const text = message.text;
  if (channel === "telegram" && message.author.kind === "agent") return text;
  if (message.author.kind === "tool" && message.metadata?.command === "task-admitted") {
    return `Background work accepted\n${message.text.replace(/^Accepted durable work:\s*/, "")}`;
  }
  const surface = channel === "may-console" ? "Console" : channel;
  const speaker =
    message.author.kind === "human"
      ? "You"
      : message.author.kind === "agent"
        ? "May"
        : message.author.kind === "command"
          ? "View"
          : "Tool";
  return `${surface} · ${speaker}\n${text}`;
}

export const TELEGRAM_HELP_MARKDOWN =
  "🤖 *May*\n\n" +
  "Tell May what you need. Reply to an update to follow up.\n" +
  "You can ask ‘What's still running?’ or ‘Where were we?’ without remembering IDs.\n" +
  "Background work continues when you close Telegram.\n\n" +
  "*Optional shortcuts:*\n" +
  "/apps \[app\] — List or select an App\n" +
  "/topics — List Topics; use /topics more for older pages\n" +
  "/topic \[ref\|clear\] — Show, follow, or leave a Topic\n" +
  "/tasks \[all\] \[history\], /tasks more — Show Tasks\n" +
  "/todo \[all\], /todo more — Show Tasks that need your action\n" +
  "/task <ref> — Show one Task\n" +
  "/watch \[ref\] — Watch or show one Task\n" +
  "/unwatch — Stop watching without changing the Task\n" +
  "/cancel \[ref\] — Cancel a Task\n" +
  "/help — Show this message\n\n" +
  "Use Stop this turn to interrupt the current turn; background Tasks continue. New messages wait their turn.\n\n" +
  "*Host administration (all Apps):*\n" +
  "/reload — Reload Host definitions";

export function telegramConversationInputEvent(input: {
  appId: string;
  message: string;
  chatId: string;
  messageId: number;
  conversationId: string;
  topicId?: string | number;
  conversationTopicId?: string;
  replyToMessageId?: number;
  replyToSourceId?: string;
  context?: Record<string, unknown>;
}): EventInput {
  const sourceId = `telegram:${input.chatId}:${input.messageId}`;
  return {
    type: "conversation.message.created",
    target: { appId: input.appId },
    data: {
      conversationId: input.conversationId,
      author: { kind: "human", id: sourceId },
      text: input.message,
      ...(input.context ? { context: input.context } : {}),
      ...(input.replyToSourceId
        ? { replyTo: input.replyToSourceId }
        : input.replyToMessageId === undefined
          ? {}
          : { replyTo: `telegram:${input.chatId}:${input.replyToMessageId}` }),
      metadata: {
        channel: "telegram",
        channelTargetId: input.chatId,
        ...(input.topicId === undefined ? {} : { channelThreadId: String(input.topicId) }),
        channelMessageId: input.messageId,
        ...(input.conversationTopicId ? { topicId: input.conversationTopicId } : {}),
      },
    },
    idempotencyKey: sourceId,
  };
}
