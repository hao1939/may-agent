import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { TaskDetail, TaskReconciliationEvents } from "@may-agent/sdk/app";
import { dirname, join } from "node:path";
import { writeContentAddressedJson } from "./artifacts.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import { taskWorkContext, taskWorkGuidance } from "./task-work-context.js";

const SECTION_BYTES = 1_600;
const INPUT_EVENT_BYTES = 1_100;
const INPUT_CONTENT_BYTES = 700;
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8");
const pointerKey = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/** Structural previews only: never infer importance, truth or fulfillment from content. */
function preview(value: unknown, budget: number, pointer: string, depth = 0): unknown {
  if (bytes(value) <= budget) return value;
  const omitted = { omitted: true, pointer };
  if (typeof value === "string") {
    // Code points preserve Unicode; the final byte check also covers JSON escaping.
    const points = [...value].slice(0, Math.max(0, Math.floor(budget / 8)));
    let text = points.join("");
    while (bytes({ ...omitted, preview: text }) > budget && points.length) {
      points.pop();
      text = points.join("");
    }
    return { ...omitted, preview: text };
  }
  if (!value || typeof value !== "object" || depth >= 6) return omitted;
  const entries = Object.entries(value);
  const selected: Array<[string, unknown]> = [];
  for (const [key, item] of entries) {
    const next = preview(item, Math.min(600, Math.floor(budget / 2)), `${pointer}/${pointerKey(key)}`, depth + 1);
    const candidate = [...selected, [key, next] as [string, unknown]];
    if (bytes({ ...omitted, preview: Object.fromEntries(candidate), totalItems: entries.length }) > budget) break;
    selected.push([key, next]);
  }
  return {
    ...omitted,
    preview: Array.isArray(value) ? selected.map(([, item]) => item) : Object.fromEntries(selected),
    totalItems: entries.length,
  };
}

function previewTaskInputEvent(value: unknown, pointer: string): unknown {
  if (bytes(value) <= INPUT_EVENT_BYTES) return value;
  const item = record(value);
  const event = record(item?.event);
  const data = record(event?.data);
  const request = record(data?.request);
  const input = record(request?.input ?? data?.input);
  if (!item || !event || !data || !input) return preview(value, INPUT_EVENT_BYTES, pointer);

  const inputPointer = `${pointer}/event/data/${request ? "request/input" : "input"}`;
  const inputPreview = {
    kind: input.kind,
    data: preview(input.data, INPUT_CONTENT_BYTES, `${inputPointer}/data`),
  };
  return {
    omitted: true,
    pointer,
    preview: {
      ...(item.eventId === undefined ? {} : { eventId: item.eventId }),
      observedAt: item.observedAt,
      event: {
        type: event.type,
        data: {
          ...(data.appId === undefined ? {} : { appId: data.appId }),
          ...(data.taskId === undefined ? {} : { taskId: data.taskId }),
          ...(data.idempotencyKey === undefined ? {} : { idempotencyKey: data.idempotencyKey }),
          ...(request ? { request: { id: request.id, input: inputPreview } } : { input: inputPreview }),
        },
      },
    },
  };
}

function previewTaskInputItems(value: unknown, pointer: string): unknown {
  if (!Array.isArray(value) || bytes(value) <= SECTION_BYTES) return value;
  const selected: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const next = previewTaskInputEvent(value[index], `${pointer}/${index}`);
    if (bytes({ omitted: true, pointer, preview: [...selected, next], totalItems: value.length }) > SECTION_BYTES)
      break;
    selected.push(next);
  }
  return { omitted: true, pointer, preview: selected, totalItems: value.length };
}

function previewTaskInputBatch(value: unknown, pointer: string): unknown {
  if (bytes(value) <= SECTION_BYTES) return value;
  const batch = record(value);
  if (!batch) return preview(value, SECTION_BYTES, pointer);
  return {
    omitted: true,
    pointer,
    preview: Object.fromEntries(
      Object.entries(batch).map(([key, item]) => [
        key,
        key === "items" || key === "continuedInputs"
          ? previewTaskInputItems(item, `${pointer}/${pointerKey(key)}`)
          : preview(item, 300, `${pointer}/${pointerKey(key)}`),
      ]),
    ),
    totalItems: Object.keys(batch).length,
  };
}

function previewTaskInputs(value: unknown): unknown {
  const groups = record(value);
  if (!groups) return preview(value, SECTION_BYTES, "/events");
  return Object.fromEntries(
    Object.entries(groups).map(([key, batch]) => [key, previewTaskInputBatch(batch, `/events/${pointerKey(key)}`)]),
  );
}

/** Shared facts for model presentation; the Task remains the only state authority. */
export function taskDecisionState(task: TaskDetail, events: TaskReconciliationEvents) {
  return {
    assignment: {
      agent: task.agent,
      creator: task.creator,
      outcome: task.outcome,
      acceptance: task.acceptance,
    },
    current: {
      summary: task.summary,
      result: task.result,
      facts: task.facts,
      response: task.response,
      acceptedAttempt: task.acceptedAttempt,
    },
    conditions: task.conditions,
    obligations: task.currentObligations,
    evidence: task.acceptedEvidence,
    events: { attemptInput: events, pendingInput: task.pendingEvents },
    input: task.input,
  };
}

/** Keep sections independently visible; omitted material keeps its JSON pointer. */
export function previewTaskDecisionSections(full: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(full).map(([key, value]) => [
      key,
      key === "events"
        ? previewTaskInputs(value)
        : preview(
            value,
            key === "input" || key === "related" || key === "previousAttempt" || key === "waitsAtAttemptStart"
              ? 800
              : SECTION_BYTES,
            `/${key}`,
          ),
    ]),
  );
}

/** One worker's disposable model view. Task records and result accounting remain authoritative. */
export function createTaskDecisionContext(context: TaskExecutionContext): () => Promise<AgentMessage> {
  let known = context.details?.task ?? context.reconciliation.task;
  let knownAt: string | undefined;
  return async () => {
    let refresh: Record<string, unknown> = { available: true };
    try {
      const current = await context.taskRead.get(context.taskBinding.taskId);
      if (!current) throw new Error("Current Task is unavailable");
      if (current.id !== context.taskBinding.taskId || current.generation !== context.taskBinding.generation) {
        refresh = {
          available: false,
          reason: "Execution binding no longer matches the current Task",
          bindingCurrent: false,
        };
      } else {
        known = current;
        knownAt = new Date().toISOString();
      }
    } catch (error) {
      refresh = { available: false, reason: String(error).slice(0, 300) };
    }
    const rec = context.reconciliation;
    const work = taskWorkContext(known, rec.events, rec.previousAttempt);
    const full = {
      ...taskDecisionState(known, rec.events),
      work,
      environment: { paths: context.executionPaths, declaredOutputs: context.details?.declaredOutputs },
      related: { childrenAtAttemptStart: rec.children, installedAppsAtAttemptStart: context.details?.dependencies },
      previousAttempt: rec.previousAttempt,
      waitsAtAttemptStart: rec.waits,
    };
    let detail: string | undefined;
    let detailError: string | undefined;
    const workspace = context.workspaceBrief;
    if (workspace && "taskFile" in workspace) {
      try {
        const root = dirname(workspace.taskFile);
        const artifact = writeContentAddressedJson(root, "decisions", {
          binding: context.taskBinding,
          resourceVersion: known?.resourceVersion,
          ...full,
        }, { pretty: true });
        detail = join(root, artifact.ref);
      } catch {
        detailError = "Detail snapshot could not be saved; use the scoped Task read and attempt-start context.";
      }
    } else detailError = "Detail snapshot unavailable; use the scoped Task read and supplied attempt context.";
    const sections = previewTaskDecisionSections(full);
    const packet = {
      binding: context.taskBinding,
      observed: {
        refresh,
        snapshot: knownAt ? "last-successful-read" : "attempt-start",
        ...(knownAt ? { readAt: knownAt } : {}),
        resourceVersion: known?.resourceVersion ?? null,
      },
      ...sections,
      coverage: {
        detail,
        detailError,
        ...(workspace && "taskFile" in workspace
          ? { attemptContext: join(dirname(workspace.taskFile), "context.json") }
          : {}),
        currentRead: {
          tool: "tasks",
          action: "get",
          taskId: context.taskBinding.taskId,
          target: { appId: context.taskBinding.appId },
        },
        note: "An omitted preview links by JSON pointer into detail. attemptInput is assigned to this attempt; pendingInput is not yet claimed. Either may be bounded, and this is not complete history.",
      },
    };
    return {
      role: "user",
      timestamp: Date.now(),
      content: [
        {
          type: "text",
          text: [
            "Task decision brief (source data). Your call request defines your contribution; shared facts do not expand authority.",
            taskWorkGuidance(work),
            "Judge new input alongside accepted understanding. Progress, failures and waits coexist. Reading input is not fulfillment.",
            "When coverage is incomplete, read the linked detail before the action needing that evidence. A refresh failure leaves known facts usable within their snapshot scope; diagnose with ordinary reads. Verify current authority for actions that require it.",
            JSON.stringify(packet),
          ].join("\n"),
        },
      ],
    };
  };
}
