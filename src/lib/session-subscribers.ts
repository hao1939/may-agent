/**
 * Session subscribers — event-driven side effects for session lifecycle.
 *
 * Each function returns a bus subscriber that reacts to session events.
 * Decoupled from the manager — they only know events, not internals.
 *
 * Replaces inline side effects that were in manager.ts handleCompletion.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eventData, type AgentEvent } from "../app/event-bus.js";
import { resolveRuntimeAgentDirectory } from "../app/loader/agent-discovery.js";
import { log } from "./log.js";
import { createStartDigest, createEndDigest } from "./session-digest.js";
import { writeLastSession } from "./last-session.js";
import { getDb } from "./requests.js";

// ── Stuck Detection ─────────────────────────────────────────────────────
// Detects sessions making no progress (consecutive turns with only errors).
// Emits cancel event on the bus when threshold is hit.

const STUCK_WARNING_THRESHOLD = 4;
const STUCK_TERMINATE_THRESHOLD = 6;

interface StuckState {
  consecutiveErrorTurns: number;
  warned: boolean;
}

export function createStuckDetector(
  emitCancel: (sessionId: string, reason: string) => void,
  /** Optional: called when circuit breaker fires so the system can diagnose the failure. */
  onCircuitBreak?: (agent: string, sessionId: string, reason: string) => void,
): (event: AgentEvent) => void {
  const state = new Map<string, StuckState>();

  return (event: AgentEvent) => {
    if (event.type === "session.start") {
      const info = eventData(event) as any;
      state.set(info.sessionId, { consecutiveErrorTurns: 0, warned: false });
      return;
    }

    if (event.type === "session.end") {
      const info = eventData(event) as any;
      state.delete(info.sessionId);
      return;
    }

    if (event.type !== "turn_end") return;
    const s = state.get(event.sessionId);
    if (!s) return;

    const errorOnly = (event.errorCount ?? 0) > 0 && event.toolCalls === (event.errorCount ?? 0);

    if (errorOnly) {
      s.consecutiveErrorTurns++;
    } else if (event.toolCalls > 0) {
      s.consecutiveErrorTurns = 0;
      s.warned = false;
    }

    if (s.consecutiveErrorTurns >= STUCK_WARNING_THRESHOLD && !s.warned) {
      s.warned = true;
      log("warn", `[stuck] ${event.agent} (${event.sessionId}) has ${s.consecutiveErrorTurns} consecutive error turns`);
    }

    if (s.consecutiveErrorTurns >= STUCK_TERMINATE_THRESHOLD) {
      const reason = `Stuck: ${s.consecutiveErrorTurns} consecutive error-only turns`;
      log(
        "error",
        `[stuck] ${event.agent} (${event.sessionId}) stuck at ${s.consecutiveErrorTurns} error turns — cancelling`,
      );
      emitCancel(event.sessionId, reason);
      if (onCircuitBreak) {
        try {
          onCircuitBreak(event.agent, event.sessionId, reason);
        } catch (err) {
          log("warn", `[stuck] onCircuitBreak failed for ${event.sessionId}: ${err}`);
        }
      }
      state.delete(event.sessionId);
    }
  };
}

// ── Auto-Resume ─────────────────────────────────────────────────────────
// Detects interrupted independent jobs that did real work and schedules a resume.
// Emits a resume command after a backoff delay.

const MAX_RESUME_ATTEMPTS = 2;

export function createAutoResume(
  emitResume: (sessionId: string, agent: string, attempt: number) => void,
  emitEscalate: (agent: string, sessionId: string, reason: string) => void,
): (event: AgentEvent) => void {
  const attempts = new Map<string, number>();

  return (event: AgentEvent) => {
    if (event.type !== "session.end") return;
    const info = eventData(event) as any;
    if (info.status !== "interrupted") return;
    // A call is one bounded execution owned by its caller. Its workflow/Task
    // already receives this interruption; resuming the session separately
    // would outlive that attempt and bypass its admission and result fences.
    if (info.kind === "call" || info.interruptionKind === "cancelled") return;
    const finishStatus = typeof info.finishParams?.status === "string" ? info.finishParams.status : "";
    if (finishStatus && finishStatus !== "success") return;
    // Use opCount as the work indicator — turnCount is not reliably persisted
    const workDone = (info.opCount ?? info.turnCount ?? 0) > 0;
    if (!workDone) return; // No work done — nothing to resume
    // Deliberate close (e.g., /new command) — not a crash, don't resume
    if (info.error === "Closed") return;

    const prev = attempts.get(info.sessionId) ?? 0;
    if (prev >= MAX_RESUME_ATTEMPTS) {
      const reason = `Interrupted ${MAX_RESUME_ATTEMPTS + 1}x after ${info.turnCount ?? 0} turns. Error: ${info.error?.slice(0, 200) ?? "unknown"}. Task: ${(info.task ?? "").slice(0, 200)}`;
      attempts.delete(info.sessionId);
      emitEscalate(info.agent, info.sessionId, reason);
      return;
    }

    attempts.set(info.sessionId, prev + 1);
    const delay = 10_000 * (prev + 1); // 10s, 20s backoff
    log(
      "info",
      `[resume] ${info.agent} (${info.sessionId}) interrupted after ${info.turnCount ?? 0} turns — scheduling attempt ${prev + 1}/${MAX_RESUME_ATTEMPTS}`,
    );
    setTimeout(() => {
      emitResume(info.sessionId, info.agent, prev + 1);
    }, delay);
  };
}

// ── Digest Writer ───────────────────────────────────────────────────────
// Creates session digest entries on session lifecycle events.
// Phase 1: session.start (CREATE) and session.end (END digest).

export function createDigestWriter(persistDir: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type === "session.start") {
      const info = eventData(event) as any;
      try {
        createStartDigest(persistDir, info.sessionId, info.agent, info.task ?? "");
      } catch (err) {
        /* best-effort — digest system shouldn't break sessions */
        try { log("warn", `[digest-subscriber] start failed: ${err}`); } catch (logErr) { console.error("[digest-subscriber] start logging failed:", logErr); }
      }
      return;
    }

    if (event.type === "session.end") {
      const info = eventData(event) as any;
      try {
        const finishParams = info.finishParams as any;
        const summary = finishParams?.summary ?? info.outcome ?? "";
        const status = finishParams?.status ?? info.status ?? "interrupted";
        const filesModified = finishParams?.deliverables?.map((d: any) => d.path).filter(Boolean) ?? info.filesModified ?? [];
        const nextSteps = finishParams?.next_steps ?? finishParams?.blockers?.map((b: any) => b.reason).join("; ") ?? null;

        // Map finish status to digest outcome
        const outcomeMap: Record<string, string> = {
          success: "success",
          partial: "partial",
          failure: "failure",
          blocked: "failure",
          done: "success",
          error: "failure",
          interrupted: "interrupted",
        };
        const outcome = outcomeMap[status] ?? "interrupted";

        createEndDigest(persistDir, info.sessionId, info.agent, {
          what_happened: summary,
          outcome,
          still_open: nextSteps,
          files_modified: filesModified,
          details: {
            duration: info.duration,
            turnCount: info.turnCount,
            opCount: info.opCount,
            error: info.error,
          },
        });
      } catch (err) {
        /* best-effort */
        try { log("warn", `[digest-subscriber] end failed: ${err}`); } catch (logErr) { console.error("[digest-subscriber] end logging failed:", logErr); }
      }
    }
  };
}

// ── Context Updater ─────────────────────────────────────────────────────
// Applies durable `finish().context_updates` to the registered agent's context.md.

function writableAgentDir(projectRoot: string, agent: string): string {
  return resolveRuntimeAgentDirectory(join(projectRoot, "agents"), agent, join(projectRoot, "projects"))?.dir
    ?? join(projectRoot, "agents", agent);
}

export function createContextUpdater(projectRoot: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session.end") return;
    const info = eventData(event) as any;

    const updates = (info.finishParams as any)?.context_updates;
    if (!Array.isArray(updates) || updates.length === 0) return;

    const agentDir = writableAgentDir(projectRoot, info.agent);
    const contextPath = join(agentDir, "context.md");

    try {
      mkdirSync(agentDir, { recursive: true });
      const existing = existsSync(contextPath) ? readFileSync(contextPath, "utf-8") : "";
      let lines = existing.split(/\r?\n/).filter((line) => line.length > 0);

      for (const update of updates) {
        if (!update || typeof update.content !== "string") continue;
        const content = update.content.trim();
        if (!content) continue;

        if (update.action === "remove") {
          lines = lines.filter((line) => !line.includes(content));
        } else if (update.action === "add") {
          const normalized = content.startsWith("- ") ? content : `- ${content}`;
          if (!lines.includes(normalized)) lines.push(normalized);
        }
      }

      writeFileSync(contextPath, `${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`);
    } catch (err) {
      log("warn", `[context-updater] failed for ${info.agent}: ${err}`);
    }
  };
}

// ── File Read Tracker ───────────────────────────────────────────────────
// Records cross-agent and shared file reads for observability.

function producerFromPath(path: string): string | null {
  const normalized = path.replace(/^\.\//, "").replace(/\/+/g, "/");
  const match = normalized.match(/^agents\/([^/]+)\//);
  return match?.[1] ?? null;
}

export function createFileReadTracker(persistDir: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "tool_call" || event.tool !== "read") return;

    const path = (event.args as any)?.path;
    if (typeof path !== "string" || !path.trim()) return;

    const producerAgent = producerFromPath(path);
    if (producerAgent === event.agent) return;

    try {
      const db = getDb(persistDir);
      db.prepare(
        "INSERT INTO file_reads (sessionId, agent, filePath, readAt, producerAgent) VALUES (?, ?, ?, ?, ?)",
      ).run(event.sessionId, event.agent, path, Date.now(), producerAgent);
    } catch (err) {
      log("warn", `[file-read-tracker] failed for ${event.agent}: ${err}`);
    }
  };
}

export interface FileReadStat {
  reader: string;
  producer: string | null;
  fileCount: number;
  readCount: number;
}

export function getFileReadStats(persistDir: string, days = 7): FileReadStat[] {
  const since = Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000;
  const db = getDb(persistDir);
  return db.prepare(
    `SELECT agent as reader,
            producerAgent as producer,
            COUNT(DISTINCT filePath) as fileCount,
            COUNT(*) as readCount
       FROM file_reads
      WHERE readAt >= ?
      GROUP BY agent, producerAgent
      ORDER BY readCount DESC, reader ASC`,
  ).all(since) as unknown as FileReadStat[];
}

// ── Last-Session Writer ─────────────────────────────────────────────────
// Writes the registered agent's last-session.md at session end so the next session
// can read a single file instead of querying DB + scanning files.
// Part of: cold-start-fix milestone 1.

export function createLastSessionWriter(projectRoot: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session.end") return;
    const info = eventData(event) as any;

    const finishParams = info.finishParams as any;
    // Only write if we have meaningful session data (finish() was called or we have a summary)
    const summary = finishParams?.summary ?? info.outcome ?? "";
    if (!summary) return;

    const agentDir = writableAgentDir(projectRoot, info.agent);
    const status = finishParams?.status ?? info.status ?? "interrupted";
    const filesModified = finishParams?.deliverables?.map((d: any) => d.path).filter(Boolean) ?? info.filesModified ?? [];
    const nextSteps = finishParams?.next_steps ?? null;
    const blockers = finishParams?.blockers ?? null;
    const completedItems = finishParams?.completed_items ?? null;
    const newItems = finishParams?.new_items ?? null;

    try {
      writeLastSession(agentDir, {
        sessionId: info.sessionId,
        agent: info.agent,
        status,
        summary,
        duration: info.duration ?? info.runtime,
        filesModified,
        nextSteps,
        blockers,
        completedItems,
        newItems,
        timestamp: Date.now(),
      });
    } catch (err) {
      log("warn", `[last-session-writer] failed for ${info.agent}: ${err}`);
    }
  };
}
