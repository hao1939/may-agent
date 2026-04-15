/**
 * Session subscribers — event-driven side effects for session lifecycle.
 *
 * Each function returns a bus subscriber that reacts to session events.
 * Decoupled from the manager — they only know events, not internals.
 *
 * Replaces inline side effects that were in manager.ts handleCompletion.
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { AgentEvent } from "../app/event-bus.js";
import { log } from "./log.js";
import { createStartDigest, createEndDigest, upsertDigest, logShadowComparison } from "./session-digest.js";
import { trackRequest, updateRequest, getDb } from "./requests.js";
import type { SubagentManager } from "./manager.js";

// ── Context Updater ─────────────────────────────────────────────────────
// Applies context_updates from finish() to agents/<name>/context.md.

export function createContextUpdater(projectRoot: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session_end") return;
    const updates = (event.finishParams as any)?.context_updates as
      | Array<{ action: string; content: string }>
      | undefined;
    if (!updates?.length) return;

    try {
      const contextPath = join(projectRoot, "agents", event.agent, "context.md");
      let content = "";
      try {
        content = readFileSync(contextPath, "utf-8");
      } catch (err) {
        /* file doesn't exist yet */
        log("warn", `[context-updater] could not read context file for ${event.agent}: ${err}`);
      }

      for (const update of updates) {
        const line = update.content.trim();
        if (!line) continue;
        if (update.action === "add" && !content.includes(line)) {
          content = content.trimEnd() + "\n" + `- ${line}` + "\n";
        } else if (update.action === "remove") {
          content = content
            .split("\n")
            .filter((l) => !l.includes(line))
            .join("\n");
        }
      }

      mkdirSync(dirname(contextPath), { recursive: true });
      writeFileSync(contextPath, content);
    } catch (err) {
      /* best-effort */
      log("warn", `[context-updater] failed to apply context updates for ${event.agent}: ${err}`);
    }
  };
}

// ── Request Tracker ─────────────────────────────────────────────────────
// Updates request DB entries when sessions complete.
// Handles: completed_items, new_items from finish(), and request status.

export function createRequestTracker(persistDir: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session_end") return;

    const finishParams = event.finishParams as any;
    if (!finishParams) return;

    // Track new items from finish()
    if (Array.isArray(finishParams.new_items) && finishParams.new_items.length > 0) {
      try {
        for (const item of finishParams.new_items) {
          try {
            trackRequest(persistDir, {
              fromEntity: event.agent,
              toAgent: event.agent,
              task: String(item).slice(0, 500),
              method: "message",
              source: "finish",
            });
          } catch (err) {
            /* best-effort */
            log("warn", `[request-tracker] failed to track new item for ${event.agent}: ${err}`);
          }
        }
      } catch (err) {
        /* best-effort */
        log("warn", `[request-tracker] failed to process new_items for ${event.agent}: ${err}`);
      }
    }

    // Mark completed items — fuzzy-match against pending requests
    if (Array.isArray(finishParams.completed_items) && finishParams.completed_items.length > 0) {
      try {
        const db = getDb(persistDir);
        const pending = db
          .prepare(
            `SELECT requestId, task FROM requests
             WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS') AND method IN ('message', 'send', 'fork', 'run')`,
          )
          .all(event.agent) as { requestId: string; task: string }[];

        for (const item of finishParams.completed_items) {
          const needle = String(item).trim().toLowerCase();
          let bestId: string | null = null;
          let bestScore = 0;
          for (const req of pending) {
            const reqText = req.task.toLowerCase();
            // Simple overlap scoring
            const words = needle.split(/\s+/);
            const score = words.filter((w) => reqText.includes(w)).length / Math.max(words.length, 1);
            if (score > bestScore && score > 0.3) {
              bestScore = score;
              bestId = req.requestId;
            }
          }
          if (bestId) {
            updateRequest(persistDir, bestId, {
              status: "COMPLETED",
              completedAt: Date.now(),
              summary: `Completed by ${event.agent} in session ${event.sessionId}`,
            });
          }
        }
      } catch (err) {
        /* best-effort */
        log("warn", `[request-tracker] failed to process completed_items for ${event.agent}: ${err}`);
      }
    }
  };
}

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
  /** Optional: persistDir for digest writes. */
  persistDir?: string,
  /** Optional: manager for LLM synthesis in digest classification (Phase 3 shadow classifier). Accepts a getter for deferred initialization. */
  managerOrGetter?: SubagentManager | (() => SubagentManager | undefined),
): (event: AgentEvent) => void {
  const getManager = () =>
    typeof managerOrGetter === "function" ? managerOrGetter() : managerOrGetter;
  const state = new Map<string, StuckState>();

  return (event: AgentEvent) => {
    if (event.type === "session_start") {
      state.set(event.sessionId, { consecutiveErrorTurns: 0, warned: false });
      return;
    }

    if (event.type === "session_end") {
      state.delete(event.sessionId);
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
      // Digest: stuck_detected (warning, not kill yet) — pass manager for LLM synthesis + classification
      if (persistDir) {
        upsertDigest(persistDir, {
          sessionId: event.sessionId,
          agent: event.agent,
          trigger: "stuck_detected",
          details: { consecutiveErrorTurns: s.consecutiveErrorTurns },
        }, getManager()).then(digest => {
          // Shadow comparison: existing system only warns on stuck_detected (no action)
          logShadowComparison(event.sessionId, "stuck_detected", "nothing", digest);
        }).catch(err => log("warn", `[digest] stuck_detected failed: ${err}`));
      }
    }

    if (s.consecutiveErrorTurns >= STUCK_TERMINATE_THRESHOLD) {
      const reason = `Stuck: ${s.consecutiveErrorTurns} consecutive error-only turns`;
      log("error", `[stuck] ${event.agent} (${event.sessionId}) stuck at ${s.consecutiveErrorTurns} error turns — evaluating`);

      // Phase 4a: Use digest classifier to decide action instead of always killing
      const fallbackKill = () => {
        log("info", `[stuck] decision=kill source=fallback session=${event.sessionId} agent=${event.agent}`);
        emitCancel(event.sessionId, reason);
        if (onCircuitBreak) {
          try { onCircuitBreak(event.agent, event.sessionId, reason); } catch (err) { log("warn", `[stuck] onCircuitBreak failed for ${event.sessionId}: ${err}`); }
        }
      };

      if (persistDir) {
        upsertDigest(persistDir, {
          sessionId: event.sessionId,
          agent: event.agent,
          trigger: "circuit_break",
          details: { consecutiveErrorTurns: s.consecutiveErrorTurns, reason },
        }, getManager()).then(digest => {
          const action = digest?.action ?? "kill";
          log("info", `[stuck] decision=${action} source=digest session=${event.sessionId} agent=${event.agent}`);
          if (action === "kill" || action === "nothing") {
            emitCancel(event.sessionId, reason);
            if (onCircuitBreak) {
              try { onCircuitBreak(event.agent, event.sessionId, reason); } catch (err) { log("warn", `[stuck] onCircuitBreak failed for ${event.sessionId}: ${err}`); }
            }
          } else if (action === "escalate") {
            emitCancel(event.sessionId, reason);
            if (onCircuitBreak) {
              try { onCircuitBreak(event.agent, event.sessionId, `${reason} (escalated by classifier)`); } catch (err) { log("warn", `[stuck] onCircuitBreak failed for ${event.sessionId}: ${err}`); }
            }
          }
          // "resume" or "requeue" → don't cancel, classifier says session has recoverable work
          // The session will continue running, and the auto-resume or P62 recovery will handle it
        }).catch(err => {
          log("warn", `[digest] circuit_break failed: ${err}`);
          fallbackKill();
        });
      } else {
        fallbackKill();
      }
      state.delete(event.sessionId);
    }
  };
}

// ── Auto-Resume ─────────────────────────────────────────────────────────
// Detects interrupted sessions that did real work and schedules a resume.
// Emits a resume command after a backoff delay.

const MAX_RESUME_ATTEMPTS = 2;

export function createAutoResume(
  emitResume: (sessionId: string, agent: string, attempt: number) => void,
  emitEscalate: (agent: string, sessionId: string, reason: string) => void,
  /** Optional: persistDir for digest writes. */
  persistDir?: string,
  /** Optional: manager for LLM synthesis in digest classification (Phase 3 shadow classifier). Accepts a getter for deferred initialization. */
  managerOrGetter?: SubagentManager | (() => SubagentManager | undefined),
): (event: AgentEvent) => void {
  const getManager = () =>
    typeof managerOrGetter === "function" ? managerOrGetter() : managerOrGetter;
  const attempts = new Map<string, number>();

  return (event: AgentEvent) => {
    if (event.type !== "session_end") return;
    if (event.status !== "interrupted") return;
    // Use opCount as the work indicator — turnCount is not reliably persisted
    const workDone = (event.opCount ?? (event as any).turnCount ?? 0) > 0;
    if (!workDone) return; // No work done — nothing to resume
    // Deliberate close (e.g., /new command) — not a crash, don't resume
    if (event.error === "Closed") return;

    const prev = attempts.get(event.sessionId) ?? 0;
    if (prev >= MAX_RESUME_ATTEMPTS) {
      // Exhausted retries — escalate immediately
      const reason = `Interrupted ${MAX_RESUME_ATTEMPTS + 1}x after ${event.turnCount ?? 0} turns. Error: ${event.error?.slice(0, 200) ?? "unknown"}. Task: ${(event.task ?? "").slice(0, 200)}`;
      // Digest: resume_exhausted — pass manager for LLM synthesis + classification
      if (persistDir) {
        upsertDigest(persistDir, {
          sessionId: event.sessionId,
          agent: event.agent,
          trigger: "resume_exhausted",
          details: { attempts: prev + 1, maxAttempts: MAX_RESUME_ATTEMPTS, error: event.error?.slice(0, 200), turnCount: event.turnCount },
        }, getManager()).then(digest => {
          // Shadow comparison: existing system always escalates on resume_exhausted
          logShadowComparison(event.sessionId, "resume_exhausted", "escalate", digest);
        }).catch(err => log("warn", `[digest] resume_exhausted failed: ${err}`));
      }
      attempts.delete(event.sessionId);
      emitEscalate(event.agent, event.sessionId, reason);
      return;
    }

    attempts.set(event.sessionId, prev + 1);
    const delay = 10_000 * (prev + 1); // 10s, 20s backoff
    log(
      "info",
      `[resume] ${event.agent} (${event.sessionId}) interrupted after ${event.turnCount ?? 0} turns — evaluating via digest classifier (attempt ${prev + 1}/${MAX_RESUME_ATTEMPTS})`,
    );

    // Phase 4c: Use digest classifier to decide whether to resume
    const fallbackResume = () => {
      log("info", `[resume] decision=resume source=fallback session=${event.sessionId} agent=${event.agent}`);
      setTimeout(() => {
        emitResume(event.sessionId, event.agent, prev + 1);
      }, delay);
    };

    if (persistDir) {
      upsertDigest(persistDir, {
        sessionId: event.sessionId,
        agent: event.agent,
        trigger: "auto_resume",
        what_happened: `Auto-resume attempt ${prev + 1}/${MAX_RESUME_ATTEMPTS} after ${delay}ms delay: ${(event.error ?? "unknown error").slice(0, 200)}`,
        details: { attempt: prev + 1, maxAttempts: MAX_RESUME_ATTEMPTS, delayMs: delay, error: event.error?.slice(0, 200), turnCount: event.turnCount },
      }, getManager()).then(digest => {
        const action = digest?.action ?? "resume";
        log("info", `[resume] decision=${action} source=digest session=${event.sessionId} agent=${event.agent} reason=${digest?.action_reason ?? "no_digest"}`);
        if (action === "resume" || action === "requeue") {
          setTimeout(() => {
            emitResume(event.sessionId, event.agent, prev + 1);
          }, delay);
        } else if (action === "escalate") {
          // Don't resume — escalate instead
          attempts.delete(event.sessionId);
          emitEscalate(event.agent, event.sessionId, `Digest classifier rejected resume: ${digest?.action_reason ?? "unknown"}`);
        } else {
          // "kill" or "nothing" — skip resume, clean up attempts
          log("info", `[resume] skipping resume: classifier says ${action} for ${event.sessionId}`);
          attempts.delete(event.sessionId);
        }
      }).catch(err => {
        log("warn", `[digest] auto_resume failed: ${err}`);
        fallbackResume();
      });
    } else {
      fallbackResume();
    }
  };
}

// ── Digest Writer ───────────────────────────────────────────────────────
// Creates session digest entries on session lifecycle events.
// Phase 1: session_start (CREATE) and session_end (END digest).

export function createDigestWriter(persistDir: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type === "session_start") {
      try {
        createStartDigest(persistDir, event.sessionId, event.agent, event.task ?? "");
      } catch (err) {
        /* best-effort — digest system shouldn't break sessions */
        try { log("warn", `[digest-subscriber] start failed: ${err}`); } catch (logErr) { console.error("[digest-subscriber] start logging failed:", logErr); }
      }
      return;
    }

    if (event.type === "session_end") {
      try {
        const finishParams = event.finishParams as any;
        const summary = finishParams?.summary ?? event.outcome ?? "";
        const status = finishParams?.status ?? event.status ?? "interrupted";
        const filesModified = finishParams?.deliverables?.map((d: any) => d.path).filter(Boolean) ?? event.filesModified ?? [];
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

        createEndDigest(persistDir, event.sessionId, event.agent, {
          what_happened: summary,
          outcome,
          still_open: nextSteps,
          files_modified: filesModified,
          details: {
            duration: event.duration,
            turnCount: event.turnCount,
            opCount: event.opCount,
            error: event.error,
          },
        });
      } catch (err) {
        /* best-effort */
        try { log("warn", `[digest-subscriber] end failed: ${err}`); } catch (logErr) { console.error("[digest-subscriber] end logging failed:", logErr); }
      }
    }
  };
}

