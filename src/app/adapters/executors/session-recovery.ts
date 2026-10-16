import type { AppTaskAttempt } from "../../core/tasks/app-task-state.js";
import type { AppTaskClaim } from "../../core/tasks/app-task-reconciler.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SubagentManager } from "../../../lib/index.js";
import { getDb } from "../../../lib/db/connection.js";
import { readSessionLastActivityAt, updateSessionDb } from "../../../lib/db/sessions.js";
import {
  appendSessionMessage,
  markSessionInactive,
  readActiveSessionProcessId,
  readSessionMeta,
  readSessionMetaRecoveryEvidence,
  readSessionRecoveryEvidence,
  writeSessionMeta,
  sessionDir,
} from "../../../lib/persistence.js";
import { extractFinishParams } from "../../../lib/agent-result.js";
import {
  readCheckpointRecoveryEvidence,
  type CheckpointEntry,
} from "../../../lib/tools/checkpoint.js";
import { drainPersistedSessionBashProcessGroups } from "../../../lib/tools/bash.js";
import { STATE_CHANGING_TOOLS } from "../../../lib/manager-utils.js";
import { writeSessionResult } from "../../../lib/artifacts.js";
import type { AgentEvent, EventBus } from "../../core/events/bus.js";
import { appTaskSessionBinding } from "../../core/tasks/session-binding.js";
import type { TaskSessionRecovery } from "../../core/tasks/execution.js";
import type { JsonlRecoveryEvidence, TaskBinding } from "../../../lib/persistence.js";

type TaskSessionAdapterOptions = {
  manager: SubagentManager;
  persistDir?: string;
  bus: EventBus;
  drainPersistedBashProcessGroups?: typeof drainPersistedSessionBashProcessGroups;
};

export function createTaskSessionRecovery(opts: TaskSessionAdapterOptions): TaskSessionRecovery {
  return {
    read: (id) => (opts.persistDir ? readSessionMeta(opts.persistDir, id) : null),
    isLive: (id) => hasLiveAppTaskSession(opts, id),
    lastActivityAt: (id) => (opts.persistDir ? readSessionLastActivityAt(opts.persistDir, id) : null),
    interrupt: (id, reason, taskId, expectedBinding) =>
      interruptSupersededAgentSession(opts, id, reason, taskId, expectedBinding),
    handoff: (attempt) => buildRecoveredSessionHandoff(opts.persistDir, attempt),
    workflowInterrupted: (id) => workflowWasInterruptedByRestart(opts.persistDir, id),
  };
}

function workflowWasInterruptedByRestart(persistDir: string | undefined, workflowRunId: string | null): boolean {
  if (!persistDir || !workflowRunId) return false;
  const row = getDb(persistDir)
    .prepare("SELECT status, result_reason FROM workflow_runs WHERE runId = ?")
    .get(workflowRunId) as { status?: unknown; result_reason?: unknown } | undefined;
  return row?.status === "interrupted" && row.result_reason === "Process restarted";
}

function isProcessAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function hasLiveAppTaskSession(opts: TaskSessionAdapterOptions, sessionId: string): boolean {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId) return false;
  if (opts.manager.hasActiveSession(cleanSessionId)) return true;
  if (!opts.persistDir) return false;
  const leasePid = readActiveSessionProcessId(opts.persistDir, cleanSessionId);
  if (leasePid && isProcessAlive(leasePid)) return true;
  const meta = readSessionMeta(opts.persistDir, cleanSessionId);
  if (!meta || (meta.status !== "running" && meta.status !== "idle")) return false;

  if (meta.detached && isProcessAlive(meta.pid)) return true;
  return false;
}

function recoverPendingToolResultsFromTranscript(persistDir: string, sessionId: string, messages: any[]): string[] {
  const last = messages[messages.length - 1] as any;
  if (last?.role !== "assistant" || !Array.isArray(last.content)) return [];

  const pendingToolCalls = last.content.filter((block: any) => {
    if (block?.type !== "toolCall" || typeof block.id !== "string") return false;
    if (block.name === "finish") return false;
    return !messages.some((message) => message?.role === "toolResult" && message.toolCallId === block.id);
  });
  if (pendingToolCalls.length === 0) return [];

  for (const call of pendingToolCalls) {
    const toolName = typeof call.name === "string" ? call.name : "tool";
    const repairText = STATE_CHANGING_TOOLS.has(toolName)
      ? `Tool call result was not persisted before runtime recovery interrupted this orphaned session. ${toolName} may have completed and mutated state; inspect side effects before retrying.`
      : "Tool call result was not persisted before runtime recovery interrupted this orphaned session.";
    appendSessionMessage(persistDir, sessionId, {
      role: "toolResult",
      toolCallId: call.id,
      toolName,
      isError: true,
      content: [{ type: "text", text: repairText }],
      timestamp: Date.now(),
    } as any);
  }

  return pendingToolCalls
    .map((call: any) => (typeof call.name === "string" ? call.name : "tool"))
    .filter((name: string, index: number, names: string[]) => names.indexOf(name) === index);
}

function summarizeInterruptedAgentRecovery(input: {
  meta: { taskBinding?: unknown };
  persistDir: string;
  sessionId: string;
  reason: string;
  repairedPendingTools: string[];
  checkpoint: CheckpointEntry | null;
  evidenceFacts: string[];
  taskId?: string;
}): { summary: string; taskId: string | null; facts: string[] } {
  const taskId = input.taskId?.trim() || appTaskSessionBinding(input.meta.taskBinding)?.taskId || null;
  const summary =
    `Runtime recovery interrupted agent session${taskId ? ` for ${taskId}` : ""}. ` +
    "No committed finish result was available. Consult the Task's current state for accepted work and any remaining obligation.";
  const checkpoint = input.checkpoint;
  const facts = [
    ...(taskId ? [`task:${taskId}`] : []),
    `session:${input.sessionId}`,
    `artifact:sessions/${input.sessionId}/result.json`,
    `transcript:sessions/${input.sessionId}/session.jsonl`,
    checkpoint
      ? `checkpoint:checkpoints/${input.sessionId}.jsonl#step-${checkpoint.step}:${checkpoint.summary}`
      : `checkpoint:${input.evidenceFacts.length ? "unavailable" : "absent"}:${input.sessionId}`,
    ...input.evidenceFacts,
    `recovery-reason:${input.reason}`,
    ...(input.repairedPendingTools.length > 0
      ? [`recovered-pending-tools:${input.repairedPendingTools.join(",")}`]
      : []),
  ];
  return { summary, taskId, facts };
}

function interruptSupersededAgentSession(
  opts: TaskSessionAdapterOptions,
  sessionId: string,
  reason: string,
  taskId?: string,
  expectedBinding?: TaskBinding,
): boolean {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId) return false;
  const metaEvidence = opts.persistDir
    ? readSessionMetaRecoveryEvidence(opts.persistDir, cleanSessionId)
    : ({ state: "absent" } as const);
  const meta = metaEvidence.state === "valid" ? metaEvidence.meta : null;

  // Session identity and lifecycle are Host facts. Incomplete work history is
  // passed to the next attempt; it does not determine Task eligibility.
  if (metaEvidence.state === "corrupt") {
    throw new Error(`Cannot recover session ${cleanSessionId}: invalid session metadata; lifecycle and ownership need repair`);
  }
  if (expectedBinding && meta &&
    (!meta.taskBinding ||
      meta.taskBinding.appId !== expectedBinding.appId ||
      meta.taskBinding.taskId !== expectedBinding.taskId ||
      meta.taskBinding.generation !== expectedBinding.generation ||
      meta.taskBinding.attemptId !== expectedBinding.attemptId)) {
    throw new Error(`Cannot recover session ${cleanSessionId}: session Task binding does not match the retained attempt`);
  }

  if (opts.manager.hasActiveSession(cleanSessionId)) {
    opts.manager.cancel(cleanSessionId);
  } else if (hasLiveAppTaskSession(opts, cleanSessionId)) {
    throw new Error(`Cannot supersede session ${cleanSessionId}: its external owner is still live`);
  }

  // Replacement ownership cannot begin while the superseded exact session's
  // shell descendants remain live. Drain durable groups even when session meta
  // is already terminal: a terminal marker cannot prove descendant exit.
  // An unconfirmed drain preserves the durable session and PGID records and
  // stops recovery before terminal artifacts, session.end, attempt release,
  // requeue, or replacement execution.
  const confirmedDrained = opts.persistDir
    ? (opts.drainPersistedBashProcessGroups ?? drainPersistedSessionBashProcessGroups)(opts.persistDir, cleanSessionId)
    : true;
  if (!confirmedDrained) {
    throw new Error(
      `Cannot recover session ${cleanSessionId}: one or more durable bash process groups did not exit after bounded SIGTERM/SIGKILL drain`,
    );
  }

  if (!meta) {
    throw new Error(
      `Cannot recover session ${cleanSessionId}: session metadata is missing; lifecycle and ownership remain unconfirmed`,
    );
  }

  if (meta.status !== "running" && meta.status !== "idle") {
    if (!opts.persistDir) return false;
    // meta.json is authoritative. Repair only its known terminal lifecycle
    // fields in SQL; do not invent historical timing or rewrite retained
    // outcome/result evidence that may describe an accepted result.
    updateSessionDb(opts.persistDir, cleanSessionId, {
      status: meta.status,
      ...(meta.endedAt !== undefined ? { endedAt: meta.endedAt, lastActivityAt: meta.endedAt } : {}),
      ...(meta.error ? { error: meta.error } : {}),
    });
    markSessionInactive(opts.persistDir, cleanSessionId);
    return true;
  }

  const transcriptEvidence = readSessionRecoveryEvidence(opts.persistDir!, cleanSessionId);
  const checkpointEvidence = readCheckpointRecoveryEvidence(opts.persistDir!, cleanSessionId);
  const recoveredFinish = extractFinishParams(transcriptEvidence.entries as any[]);
  // Do not append synthetic tool results to damaged history: they could hide
  // valid partial evidence or merge with an unterminated corrupt line.
  const repairedPendingTools = transcriptEvidence.state === "valid"
    ? recoverPendingToolResultsFromTranscript(opts.persistDir!, cleanSessionId, transcriptEvidence.entries as any[])
    : [];
  const evidenceFacts = incompleteRecoveryFacts(
    join(sessionDir(opts.persistDir!, cleanSessionId), "session.jsonl"), transcriptEvidence,
    join(opts.persistDir!, "checkpoints", `${cleanSessionId}.jsonl`), checkpointEvidence,
  );
  const interruptedRecovery = summarizeInterruptedAgentRecovery({
    meta,
    persistDir: opts.persistDir!,
    sessionId: cleanSessionId,
    reason,
    repairedPendingTools,
    checkpoint: checkpointEvidence.entries.at(-1) ?? null,
    evidenceFacts,
    taskId,
  });
  const persistedFinish = recoveredFinish;
  const recoveredStatus: "done" | "error" | "interrupted" = recoveredFinish
    ? (meta.outputSchema && recoveredFinish.result === undefined) ||
      (!meta.outputSchema && recoveredFinish.status === "failure")
      ? "error"
      : "done"
    : "interrupted";
  const recoveredSummary = persistedFinish
    ? persistedFinish.summary ?? "Runtime recovery restored a committed finish result. Consult the Task's current state for acceptance."
    : interruptedRecovery.summary;
  const endedAt = Date.now();
  const resultArtifact = writeSessionResult(opts.persistDir!, cleanSessionId, {
    status: recoveredStatus,
    outcome: recoveredStatus,
    ...(recoveredStatus === "interrupted" ? { error: reason } : {}),
    summary: recoveredSummary,
    finishParams: persistedFinish ?? undefined,
    ...(recoveredStatus === "interrupted"
      ? {
          recovery: {
            disposition: "interrupted",
            summary: interruptedRecovery.summary,
            facts: interruptedRecovery.facts,
          },
        }
      : {}),
    endedAt,
  });
  writeSessionMeta(opts.persistDir!, cleanSessionId, {
    ...meta,
    status: recoveredStatus,
    endedAt,
    ...(recoveredStatus === "interrupted" ? { error: reason } : {}),
  });
  updateSessionDb(opts.persistDir!, cleanSessionId, {
    status: recoveredStatus,
    endedAt,
    ...(recoveredStatus === "interrupted" ? { error: reason } : {}),
    outcome: recoveredSummary,
    lastActivityAt: endedAt,
    resultArtifact,
  });
  markSessionInactive(opts.persistDir!, cleanSessionId);
  opts.bus.emit({
    type: "session.end",
    source: meta.source ?? "app-task-reconciler",
    owner: `agent:${meta.agent}`,
    timestamp: endedAt,
    data: {
      sessionId: cleanSessionId,
      agent: meta.agent,
      agentRelativeDir: meta.agentRelativeDir ?? undefined,
      outcome: recoveredStatus,
      summary: recoveredSummary,
      ...(persistedFinish ? { finishParams: persistedFinish } : {}),
      ...(recoveredStatus === "interrupted" ? { error: reason } : {}),
      durationMs: Math.max(0, endedAt - meta.startedAt),
      status: recoveredStatus,
      task: meta.task,
      parentSessionId: meta.parentSessionId,
      workflowRunId: meta.workflowRunId,
      projectId: meta.projectId,
      kind: meta.kind,
      requestId: meta.requestId,
      stepLabel: meta.stepLabel,
      opCount: meta.opCount,
      ...(evidenceFacts.length > 0 ? { recoveryFacts: evidenceFacts } : {}),
      ...(repairedPendingTools.length > 0 ? { recoveredPendingTools: repairedPendingTools } : {}),
    },
  } as AgentEvent);
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function summarizeRecoveryTranscriptEntry(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const entry = message as Record<string, unknown>;
  const role = typeof entry.role === "string" ? entry.role : "message";
  const content = Array.isArray(entry.content)
    ? entry.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (!part || typeof part !== "object") return "";
          const text = (part as Record<string, unknown>).text;
          return typeof text === "string" ? text : "";
        })
        .join(" ")
    : typeof entry.content === "string"
      ? entry.content
      : "";
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const prefix =
    role === "toolResult" ? `tool:${typeof entry.toolName === "string" ? entry.toolName : "unknown"}` : role;
  return `${prefix} ${normalized}`.slice(0, 240);
}

function latestReceiptedTranscriptCheckpoint(messages: unknown[]): Pick<CheckpointEntry, "summary" | "data"> | null {
  const calls = new Map<string, Pick<CheckpointEntry, "summary" | "data">>();
  let latest: Pick<CheckpointEntry, "summary" | "data"> | null = null;
  for (const message of messages) {
    if (!isRecord(message)) continue;
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (!isRecord(block) || block.type !== "toolCall" || block.name !== "checkpoint") continue;
        if (typeof block.id !== "string" || !isRecord(block.arguments)) continue;
        const summary = block.arguments.summary;
        const data = block.arguments.data;
        if (typeof summary !== "string" || !summary.trim() || (data !== undefined && !isRecord(data))) continue;
        calls.set(block.id, { summary: summary.trim(), data: data ?? {} });
      }
      continue;
    }
    if (
      message.role === "toolResult" &&
      typeof message.toolCallId === "string" &&
      message.isError !== true &&
      (message.toolName === undefined || message.toolName === "checkpoint")
    ) {
      const call = calls.get(message.toolCallId);
      if (call) latest = call;
    }
  }
  return latest;
}

function incompleteRecoveryFacts(
  transcriptPath: string,
  transcript: JsonlRecoveryEvidence<unknown>,
  checkpointPath: string,
  checkpoint: JsonlRecoveryEvidence<unknown>,
): string[] {
  return [
    ...(transcript.state === "corrupt"
      ? [`Recovery history incomplete: malformed transcript ${transcriptPath} lines ${transcript.corruptLineNumbers.join(",")}; retained entries cannot establish all prior effects`]
      : []),
    ...(checkpoint.state === "corrupt"
      ? [`Recovery history incomplete: malformed checkpoint JSONL ${checkpointPath} lines ${checkpoint.corruptLineNumbers.join(",")}; retained entries may omit later progress`]
      : []),
  ];
}

function checkpointRecoveryFacts(
  checkpointPath: string,
  transcriptPath: string,
  checkpoint: CheckpointEntry | null,
  transcriptCheckpoint: Pick<CheckpointEntry, "summary" | "data"> | null,
  sessionId: string,
  incomplete: boolean,
): string {
  if (checkpoint) {
    return `Recovered latest ${incomplete ? "readable" : "durable"} checkpoint: ${checkpointPath} step=${checkpoint.step} summary=${checkpoint.summary} data=${JSON.stringify(stableValue(checkpoint.data))}`;
  }
  if (transcriptCheckpoint) {
    return `Recovered latest receipted transcript checkpoint: ${transcriptPath} summary=${transcriptCheckpoint.summary} data=${JSON.stringify(stableValue(transcriptCheckpoint.data))}`;
  }
  if (incomplete) return `Recovery checkpoint unavailable in incomplete history for session ${sessionId}; this does not establish that no checkpoint was saved`;
  return `Recovered durable checkpoint: absent for session ${sessionId}; no matching successful checkpoint receipt in ${transcriptPath}`;
}

export function buildRecoveredSessionHandoff(
  persistDir: string | undefined,
  attempt: AppTaskAttempt | undefined,
): AppTaskClaim["handoff"] | undefined {
  if (!persistDir || !attempt?.sessionId ||
    (attempt.failureReason !== "previous-runtime-attempt-requeued" &&
      attempt.failureReason !== "terminal-agent-session-expired-lease-requeued")) {
    return undefined;
  }
  const interruptedSessionPath = sessionDir(persistDir, attempt.sessionId);
  const metaPath = join(interruptedSessionPath, "meta.json");
  const meta = readSessionMeta(persistDir, attempt.sessionId);
  const resultPath = join(interruptedSessionPath, "result.json");
  const transcriptPath = join(interruptedSessionPath, "session.jsonl");
  const sessionLabel =
    attempt.handler.startsWith("agent:") || attempt.handler.startsWith("owner:")
      ? "agent session"
      : `${attempt.handler} session`;
  const checkpointPath = join(persistDir, "checkpoints", `${attempt.sessionId}.jsonl`);
  const checkpointEvidence = readCheckpointRecoveryEvidence(persistDir, attempt.sessionId);
  const checkpoint = checkpointEvidence.entries.at(-1) ?? null;
  const transcriptEvidence = existsSync(transcriptPath)
    ? readSessionRecoveryEvidence(persistDir, attempt.sessionId)
    : { state: "absent" as const, entries: [], corruptLineNumbers: [] as [] };
  const transcriptMessages = transcriptEvidence.entries;
  const transcriptCheckpoint = checkpoint ? null : latestReceiptedTranscriptCheckpoint(transcriptMessages);
  const facts = [
    `Recovered interrupted ${sessionLabel} path: ${interruptedSessionPath}`,
    `Recovered interrupted ${sessionLabel} metadata: ${metaPath}`,
    `Recovered interrupted ${sessionLabel} artifact: ${resultPath}`,
    `Recovered interrupted ${sessionLabel} transcript: ${transcriptPath}`,
    ...incompleteRecoveryFacts(transcriptPath, transcriptEvidence, checkpointPath, checkpointEvidence),
    checkpointRecoveryFacts(checkpointPath, transcriptPath, checkpoint, transcriptCheckpoint, attempt.sessionId,
      checkpointEvidence.state === "corrupt" || transcriptEvidence.state === "corrupt"),
  ];
  if (transcriptMessages.length > 0) {
    for (const snippet of transcriptMessages
      .map(summarizeRecoveryTranscriptEntry)
      .filter((entry): entry is string => Boolean(entry))
      .slice(-3)) {
      facts.push(`Recovered transcript snippet: ${snippet}`);
    }
  }
  return {
    reason: "recovered-session",
    summary:
      meta?.error?.trim() ||
      `Previous runtime ${sessionLabel} ${attempt.sessionId} was interrupted during recovery before a task decision was persisted`,
    facts,
  };
}
