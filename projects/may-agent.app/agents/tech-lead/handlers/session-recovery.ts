/**
 * session-recovery — Shared runtime cleanup and bounded failure recovery.
 *
 * Subscribes to canonical `session.end` error/interrupted events.
 * Two-tier classification:
 *   Tier 1: Digest classifier (structured understanding of what happened)
 *   Tier 2: classifyError fallback (string matching)
 *
 * Actions: resume/requeue/escalate are dispatched to the session-recovery
 * workflow so the recovery attempt has a workflow trace. kill/nothing are
 * recorded as skipped.
 *
 * Replaces inline bus.subscribe() recovery logic that was in may.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CronEntry, EventEnvelope, HandlerContext, HandlerModule } from "./types.js";

const APP_PROJECT_ID = "may-agent";
const MAX_RECOVERY_ATTEMPTS = 2;
const STALE_AUTOCLOSE_MS = 30 * 60_000;
const STALE_IDLE_AUTOCLOSE_MS = 45 * 60_000; // sessions idle >45min with autoClose:"immediate"
const MAX_STALE_AUTOCLOSE_REAPS = 5;
const STALE_REAP_INTERVAL_MS = 5 * 60_000;

/** Key: "agent:taskPrefix", Value: recovery attempt count. */
const recoveryAttempts = new Map<string, number>();

type RunningSessionRow = {
  sessionId: string;
  agent: string;
  task?: string | null;
  status: string;
  startedAt: number;
};
function recoveryKey(agent: string, task: string): string {
  return `${agent}:${task.slice(0, 100)}`;
}

function emitSkip(ctx: HandlerContext, sessionId: string | null, reason: string, data: Record<string, unknown> = {}): void {
  ctx.sdk.log("info", `[recovery] skipped: ${reason}`);
  ctx.sdk.emit("handler.skipped", {
    handler: "session-recovery",
    sessionId,
    ...data,
    reason,
  });
}

function hasUnsupportedModelConfigError(error: string | undefined | null): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return e.includes("requested model is not supported")
    || (e.includes("model is not supported") && e.includes("model group"));
}

function sessionPayload(event: EventEnvelope): Record<string, unknown> {
  const raw = event.data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function workflowTask(input: {
  sessionId: string;
  agent: string;
  error: string;
  task?: string;
  action: string;
  source: string;
  attempt?: number;
  maxAttempts?: number;
  event?: EventEnvelope;
}): string {
  return [
    `[session-recovery] Handle failed session ${input.sessionId}.`,
    "",
    "Use the classified recovery action below. Keep the recovery simple:",
    "- resume/requeue: rerun the original task for the failed agent and report the new session id.",
    "- escalate: notify the responsible owner/human with the concrete reason.",
    "- do not mutate DB tables directly.",
    "",
    "## Recovery Decision",
    "```json",
    JSON.stringify({
      sessionId: input.sessionId,
      agent: input.agent,
      action: input.action,
      source: input.source,
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      error: input.error,
      task: input.task ?? "",
    }, null, 2),
    "```",
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify(input.event ?? null, null, 2),
    "```",
  ].join("\n");
}

function parseMeta(persistDir: string, sessionId: string): Record<string, unknown> | null {
  const metaPath = join(persistDir, "sessions", sessionId, "meta.json");
  if (!existsSync(metaPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(metaPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function hasAssistantLine(persistDir: string, sessionId: string): boolean {
  const jsonlPath = join(persistDir, "sessions", sessionId, "session.jsonl");
  if (!existsSync(jsonlPath)) return false;
  try {
    return readFileSync(jsonlPath, "utf8")
      .split("\n")
      .some((line) => line.includes('"role":"assistant"') || line.includes('"role": "assistant"'));
  } catch {
    return false;
  }
}

function parseCandidateFromReviewTask(task: string | undefined): Record<string, unknown> | null {
  if (!task) return null;
  const marker = "Candidate:\n";
  const index = task.lastIndexOf(marker);
  if (index < 0) return null;
  const jsonText = task.slice(index + marker.length).trim();
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function hasCompletedAdmissionReview(ctx: HandlerContext, sourceEventId: number): boolean {
  if (typeof ctx.sdk.getDb !== "function") return false;
  try {
    const db = ctx.sdk.getDb();
    const row = db.prepare(
      `SELECT id
       FROM events
       WHERE event_type = 'human.attention.reviewed'
         AND json_extract(data, '$.sourceEventId') = ?
         AND json_extract(data, '$.status') = 'completed'
       ORDER BY id DESC
       LIMIT 1`,
    ).get(sourceEventId) as { id?: number } | undefined;
    return typeof row?.id === "number";
  } catch {
    return false;
  }
}

function recoverFailedTelegramAdmission(
  ctx: HandlerContext,
  input: { sessionId: string; error: string; task?: string },
): boolean {
  const rootDir = ctx.sdk.paths?.root ?? process.cwd();
  const persistDir = ctx.sdk.paths?.persist ?? join(rootDir, ".state");
  const meta = parseMeta(persistDir, input.sessionId);
  const source = typeof meta?.source === "string" ? meta.source : "";
  if (source !== "telegram-human-attention-review") return false;

  const reviewTask = typeof meta?.task === "string" && meta.task.trim()
    ? meta.task
    : input.task;
  const candidate = parseCandidateFromReviewTask(reviewTask);
  const sourceEventId = Number(candidate?.sourceEventId);
  if (!Number.isInteger(sourceEventId) || sourceEventId <= 0) return false;
  if (hasCompletedAdmissionReview(ctx, sourceEventId)) return true;

  const eventType = typeof candidate?.eventType === "string" ? candidate.eventType : "message.created";
  const from = typeof candidate?.from === "string" ? candidate.from : "unknown";
  const content = typeof candidate?.content === "string" ? candidate.content : "";
  const projectId = typeof candidate?.projectId === "string" ? candidate.projectId : undefined;

  ctx.sdk.emit("human.attention.reviewed", {
    sourceEventId,
    mode: "enforce",
    admitted: false,
    delivered: false,
    attempts: null,
    candidate: {
      eventType,
      from,
      content,
      projectId,
    },
    status: "completed",
    disposition: "route",
    understoodIntent:
      "Recover the held Telegram admission candidate without delivering it to Hao until a later explicit deliver decision exists.",
    reason:
      "Session recovery found that the live Telegram admission review aborted before emitting a supported terminal disposition, so the candidate must stay internal while the platform owner completes bounded recovery.",
    nextAction:
      "Route bounded recovery to tech-lead under may-agent.app owner review and keep Telegram delivery blocked for this lineage.",
    owner: "tech-lead",
    evidence: [
      `Admission review session ${input.sessionId} ended without a terminal result: ${input.error.slice(0, 400)}.`,
      `The held candidate references exact sourceEventId ${sourceEventId} from ${from}.`,
      "No completed human.attention.reviewed closure for this exact sourceEventId existed when session recovery inspected the lineage.",
    ],
    actionTaken:
      "Session recovery recorded a safe route disposition for the held candidate lineage instead of skipping it as an unclassified failure.",
    closureCondition:
      "A later owner recovery or admission review records the bounded outcome for this exact sourceEventId, and no Telegram delivery occurs unless a later deliver disposition is issued.",
    reviewAgainWhen:
      "When tech-lead completes the may-agent.app telegram admission recovery review for this exact sourceEventId.",
    recovery: {
      failedSessionId: input.sessionId,
      reason: "telegram-admission-review-failed",
      decisionSource: "session-recovery",
    },
  });

  ctx.sdk.emit("project.owner.requested", {
    project: "may-agent",
    reason: "telegram-admission-review-failed",
    params: {
      instruction:
        "Recover the held Telegram admission candidate from bounded durable evidence only: the candidate payload, cited packet/artifact paths, current task-tree truth, and exact runtime lineage for this request. Retry or route it under the existing ownership convention, keep raw candidate text internal, avoid repository-wide search unless one exact cited file still needs inspection, and contact Hao only after a successful deliver disposition.",
      sourceEventId,
      candidateEventType: eventType,
      candidateFrom: from,
      candidateProjectId: projectId,
      reviewReason: input.error,
      attempts: 1,
      closureCondition:
        "A later admission review records a terminal handle, route, clarify-producer, reject, or deliver disposition.",
      recoveryDisposition: {
        allowedDispositions: ["handle", "route", "clarify-producer", "reject", "deliver"],
        fallbackRule:
          "If the recovery cannot be completed from bounded evidence in one turn, return the safest structured route or clarify-producer outcome instead of aborting without a terminal disposition.",
      },
      recovery: {
        failedSessionId: input.sessionId,
        reason: "telegram-admission-review-failed",
        style: "session-recovery-fallback",
      },
    },
  });
  ctx.sdk.log("info", `[recovery] recorded telegram admission fallback for sourceEventId=${sourceEventId} session=${input.sessionId}`);
  return true;
}

function isSafeAutocloseSession(ctx: HandlerContext, row: RunningSessionRow, now: number): boolean {
  if ((row.startedAt ?? now) > now - STALE_AUTOCLOSE_MS) return false;
  if (!row.sessionId || !row.agent) return false;

  const persistDir = ctx.sdk.paths.persist ?? join(ctx.sdk.paths.root, ".state");
  const meta = parseMeta(persistDir, row.sessionId);

  // If meta is corrupted/missing and session is extremely stale (4x threshold)
  // with no assistant activity, allow reaping as orphan cleanup.
  if (!meta) {
    const extremelyStale = (row.startedAt ?? now) < now - STALE_AUTOCLOSE_MS * 4;
    return extremelyStale && !hasAssistantLine(persistDir, row.sessionId);
  }

  return meta.status === "running"
    && meta.autoClose === "immediate"
    && meta.agent === row.agent
    && meta.task === (row.task ?? "")
    && !hasAssistantLine(persistDir, row.sessionId);
}

function reapStaleAutocloseSessions(ctx: HandlerContext): void {
  const now = Date.now();
  const db = ctx.sdk.getDb();
  const stale = db.prepare(
    `SELECT sessionId, agent, task, status, startedAt
     FROM sessions
     WHERE status IN ('running', 'idle')
       AND startedAt < ?
     ORDER BY startedAt ASC
     LIMIT ?`,
  ).all(now - STALE_AUTOCLOSE_MS, MAX_STALE_AUTOCLOSE_REAPS) as RunningSessionRow[];

  for (const row of stale) {
    if (!isSafeAutocloseSession(ctx, row, now)) continue;

    const error = "Auto-closed stale immediate session with no assistant activity";
    const result = db.prepare(
      `UPDATE sessions
       SET status = 'error', endedAt = ?, error = ?, outcome = 'error'
       WHERE sessionId = ?
         AND status IN ('running', 'idle')
         AND startedAt = ?`,
    ).run(now, error, row.sessionId, row.startedAt) as { changes?: number };

    if ((result.changes ?? 0) <= 0) continue;

    const event = {
      sessionId: row.sessionId,
      agent: row.agent,
      status: "error",
      outcome: "error",
      error,
      autoClosed: true,
      reason: "stale_immediate_no_assistant_activity",
    };
    ctx.sdk.emit("session.end", event);
    ctx.sdk.emit("handler.skipped", {
      handler: "session-recovery",
      sessionId: row.sessionId,
      agent: row.agent,
      reason: "auto-closed stale immediate session",
    });
    ctx.sdk.log("info", `[session-recovery] Auto-closed stale immediate session ${row.sessionId}`);
  }
}

/**
 * Reap sessions that have autoClose:"immediate" and have been idle (no DB
 * activity) for STALE_IDLE_AUTOCLOSE_MS, even if they produced assistant
 * output. These are typically sessions killed by handler timeout where the
 * DB row was never cleaned up.
 */
function reapIdleAutocloseSessions(ctx: HandlerContext): void {
  const now = Date.now();
  const db = ctx.sdk.getDb();
  const idleCutoff = now - STALE_IDLE_AUTOCLOSE_MS;
  const stale = db.prepare(
    `SELECT sessionId, agent, task, status, startedAt, lastActivityAt
     FROM sessions
     WHERE status IN ('running', 'idle')
       AND lastActivityAt < ?
       AND startedAt < ?
     ORDER BY lastActivityAt ASC
     LIMIT ?`,
  ).all(idleCutoff, idleCutoff, MAX_STALE_AUTOCLOSE_REAPS) as (RunningSessionRow & { lastActivityAt?: number })[];

  const persistDir = ctx.sdk.paths.persist ?? join(ctx.sdk.paths.root, ".state");

  for (const row of stale) {
    if (!row.sessionId || !row.agent) continue;

    // Only reap autoClose:"immediate" sessions
    const meta = parseMeta(persistDir, row.sessionId);
    if (!meta || meta.autoClose !== "immediate") continue;
    if (meta.status !== "running") continue;

    const error = "Auto-closed idle immediate session (no activity for >45min, likely handler timeout)";
    const result = db.prepare(
      `UPDATE sessions
       SET status = 'error', endedAt = ?, error = ?, outcome = 'error'
       WHERE sessionId = ?
         AND status IN ('running', 'idle')`,
    ).run(now, error, row.sessionId) as { changes?: number };

    if ((result.changes ?? 0) <= 0) continue;

    ctx.sdk.emit("session.end", {
      sessionId: row.sessionId,
      agent: row.agent,
      status: "error",
      outcome: "error",
      error,
      autoClosed: true,
      reason: "idle_immediate_autoclose",
    });
    ctx.sdk.log("info", `[session-recovery] Auto-closed idle immediate session ${row.sessionId} (idle since ${new Date(row.lastActivityAt ?? row.startedAt).toISOString()})`);
  }
}

/**
 * Reap sessions that have a non-null outcome but are still marked 'idle' or
 * 'running' with no activity for >30min. These are sessions that completed
 * their work (produced an outcome) but whose status was never transitioned.
 */
function reapCompletedIdleSessions(ctx: HandlerContext): void {
  const now = Date.now();
  const db = ctx.sdk.getDb();
  const cutoff = now - STALE_AUTOCLOSE_MS; // 30min
  const stale = db.prepare(
    `SELECT sessionId, agent, status, startedAt, lastActivityAt, outcome
     FROM sessions
     WHERE status IN ('running', 'idle')
       AND outcome IS NOT NULL
       AND outcome != ''
       AND lastActivityAt < ?
     ORDER BY lastActivityAt ASC
     LIMIT ?`,
  ).all(cutoff, MAX_STALE_AUTOCLOSE_REAPS) as (RunningSessionRow & { lastActivityAt?: number; outcome?: string })[];

  for (const row of stale) {
    if (!row.sessionId || !row.agent) continue;

    const result = db.prepare(
      `UPDATE sessions
       SET status = 'completed', endedAt = ?
       WHERE sessionId = ?
         AND status IN ('running', 'idle')`,
    ).run(now, row.sessionId) as { changes?: number };

    if ((result.changes ?? 0) <= 0) continue;

    ctx.sdk.emit("session.end", {
      sessionId: row.sessionId,
      agent: row.agent,
      status: "completed",
      outcome: "success",
      autoClosed: true,
      reason: "completed_idle_with_outcome",
    });
    ctx.sdk.log("info", `[session-recovery] Closed completed-idle session ${row.sessionId} (had outcome, idle since ${new Date(row.lastActivityAt ?? row.startedAt).toISOString()})`);
  }
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  let lastStaleReapAt = 0;

  return async (event?: EventEnvelope) => {
    const isTimerTick = !event || event.type === "timer.tick";
    const now = Date.now();
    if (
      typeof ctx.sdk.getDb === "function" &&
      (isTimerTick || now - lastStaleReapAt >= STALE_REAP_INTERVAL_MS)
    ) {
      lastStaleReapAt = now;
      reapStaleAutocloseSessions(ctx);
      reapIdleAutocloseSessions(ctx);
      reapCompletedIdleSessions(ctx);
    }

    if (isTimerTick) return;

    if (!event.data) {
      emitSkip(ctx, null, "missing session recovery event data", { eventType: event?.type ?? null });
      return;
    }

    const payload = sessionPayload(event);
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
    const agent = typeof payload.agent === "string" ? payload.agent : "";
    const task = typeof payload.task === "string" ? payload.task : undefined;
    const status = typeof payload.status === "string" ? payload.status : "";
    const outcome = typeof payload.outcome === "string" ? payload.outcome : "";
    const error = typeof payload.error === "string" && payload.error
      ? payload.error
      : `session ended with status=${status || "unknown"} outcome=${outcome || "unknown"}`;

    if (event.type === "session.end") {
      if (agent === "evaluator" || agent === "judge") return;
      const terminalFailure = [status, outcome].some((value) =>
        value === "error" || value === "failed" || value === "interrupted"
      );
      if (!terminalFailure) {
        if (!status && !outcome) {
          emitSkip(ctx, sessionId || null, "session.end is missing terminal status", {
            eventType: event.type,
          });
        }
        return;
      }
    }

    if (event.type !== "session.end") {
      emitSkip(ctx, sessionId || null, "unsupported session recovery event", {
        eventType: event.type,
      });
      return;
    }

    if (!sessionId || !agent) {
      emitSkip(ctx, sessionId || null, "session recovery event missing sessionId or agent", { eventType: event.type });
      return;
    }

    // ── Tier 1: Check digest classification ──────────────────────────
    let action: string | null = null;
    let source = "fallback";
    try {
      const digest = ctx.getLastDigest(sessionId);
      if (digest?.action) {
        action = digest.action;
        source = "digest";
      }
    } catch { /* best-effort — digest system shouldn't break recovery */ }

    // ── Tier 2: Fall back to classifyError (backward compat) ─────────
    if (!action) {
      const errorClass = ctx.classifyError(error);
      if (errorClass === "infra") action = "requeue";
      else action = "nothing";
    }

    if (hasUnsupportedModelConfigError(error)) {
      action = "escalate";
      source = "unsupported-model-config";
    }

    ctx.sdk.log("info", `[recovery] decision=${action} source=${source} session=${sessionId} agent=${agent}`);

    // ── Act on the decision ──────────────────────────────────────────
    if (action === "resume" || action === "requeue") {
      const rKey = recoveryKey(agent, task ?? "");
      const attempts = recoveryAttempts.get(rKey) || 0;
      if (attempts < MAX_RECOVERY_ATTEMPTS) {
        try {
          recoveryAttempts.set(rKey, attempts + 1);
          const result = await ctx.sdk.runWorkflow("session-recovery", workflowTask({
            sessionId,
            agent,
            error,
            task,
            action,
            source,
            attempt: attempts + 1,
            maxAttempts: MAX_RECOVERY_ATTEMPTS,
            event,
          }), {
            projectId: APP_PROJECT_ID,
          });
          ctx.sdk.emit("handler.workflow_dispatched", {
            handler: "session-recovery",
            workflow: "session-recovery",
            source: ctx.agentName,
            workflowRunId: result.runId ?? null,
            status: result.status,
            sessionId,
            agent,
            action,
            attempt: attempts + 1,
          });
          ctx.upsertDigest({
            sessionId,
            agent,
            trigger: "recovery_requeue",
            what_happened: `Recovery requeue attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS} (${source}): ${(error ?? "unknown error").slice(0, 200)}`,
            details: { attempt: attempts + 1, maxAttempts: MAX_RECOVERY_ATTEMPTS, workflowRunId: result.runId ?? null, error: (error ?? "").slice(0, 300), decisionSource: source },
          }).catch(() => { /* best-effort */ });
          ctx.sdk.log("info", `[recovery] Dispatched ${agent} recovery for ${sessionId} via workflow ${result.runId ?? "unknown"} (${source}, attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS})`);
        } catch (requeueErr) {
          const msg = requeueErr instanceof Error ? requeueErr.message : String(requeueErr);
          ctx.sdk.log("info", `[recovery] Failed to requeue ${agent}: ${msg}`);
          ctx.sdk.emit("handler.failed", {
            handler: "session-recovery",
            agent: "may",
            sessionId,
            error: msg,
          });
        }
      } else {
        ctx.sdk.log("info", `[recovery] ${agent} exhausted ${MAX_RECOVERY_ATTEMPTS} recovery attempts for task — escalating`);
        ctx.sdk.escalate(`Exhausted ${MAX_RECOVERY_ATTEMPTS} recovery retries for ${agent}`, {
          owner: `agent:${agent}`,
          requestedAction: "Review the failed task and choose a different recovery path.",
          evidence: { sessionId, agent, attempts, error },
          sourceSessionId: sessionId,
          dedupKey: `session-recovery-exhausted:${sessionId}`,
        });
      }
    } else if (action === "escalate") {
      const result = await ctx.sdk.runWorkflow("session-recovery", workflowTask({
        sessionId,
        agent,
        error,
        task,
        action,
        source,
        event,
      }), {
        projectId: APP_PROJECT_ID,
      });
      ctx.sdk.emit("handler.workflow_dispatched", {
        handler: "session-recovery",
        workflow: "session-recovery",
        source: ctx.agentName,
        workflowRunId: result.runId ?? null,
        status: result.status,
        sessionId,
        agent,
        action,
      });
    } else {
      const recoveredTelegramAdmission = action === "nothing"
        && agent === "may"
        && recoverFailedTelegramAdmission(ctx, { sessionId, error, task });
      if (!recoveredTelegramAdmission) {
        emitSkip(ctx, sessionId, `classifier chose ${action}`, { agent, decisionSource: source });
      }
    }
  };
};
