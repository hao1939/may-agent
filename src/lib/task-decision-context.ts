import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { TaskDetail } from "@may-agent/sdk";
import { dirname, join } from "node:path";
import { writeContentAddressedJson } from "./artifacts.js";
import type { TaskExecutionContext } from "./task-execution-context.js";

const SECTION_BYTES = 1_600;
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8");
const pointerKey = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");

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

/** One worker's disposable model view. Task records and result accounting remain authoritative. */
export function createTaskDecisionContext(context: TaskExecutionContext): () => Promise<AgentMessage> {
  let known: TaskDetail | undefined = context.details?.task;
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
    const full = {
      assignment: { outcome: known?.outcome ?? rec.outcome, acceptance: known?.acceptance ?? rec.acceptance },
      current: {
        summary: known?.summary,
        result: known?.result,
        facts: known?.facts,
        response: known?.response,
        acceptedAttempt: known?.acceptedAttempt,
      },
      conditions: known?.conditions,
      obligations: known?.currentObligations,
      events: { attemptInput: rec.events, pendingInput: known?.pendingEvents },
      input: known?.input ?? rec.input,
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
        });
        detail = join(root, artifact.ref);
      } catch {
        detailError = "Detail snapshot could not be saved; use the scoped Task read and attempt-start context.";
      }
    } else detailError = "Detail snapshot unavailable; use the scoped Task read and supplied attempt context.";
    const sections = Object.fromEntries(
      Object.entries(full).map(([key, value]) => [
        key,
        preview(
          value,
          key === "input" || key === "related" || key === "previousAttempt" || key === "waitsAtAttemptStart"
            ? 800
            : SECTION_BYTES,
          `/${key}`,
        ),
      ]),
    );
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
        note: "An omitted preview links by JSON pointer into detail. Pending input may be bounded; remaining input stays queued for reconciliation. This is not complete history.",
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
            "Judge new input alongside accepted understanding. Progress, failures and waits coexist. Reading input is not fulfillment.",
            "When coverage is incomplete, read the linked detail before the action needing that evidence. A refresh failure leaves known facts usable within their snapshot scope; diagnose with ordinary reads. Verify current authority for actions that require it.",
            JSON.stringify(packet),
          ].join("\n"),
        },
      ],
    };
  };
}
