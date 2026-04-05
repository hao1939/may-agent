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
import { appendActivity, truncateSummary } from "./activity.js";
import { appendMemoryEntry } from "./persistence.js";
import { log } from "./log.js";
import { createStartDigest, createEndDigest, upsertDigest } from "./session-digest.js";

// ── Activity Writer ─────────────────────────────────────────────────────
// Writes session lifecycle events to agents/<name>/workspace/activity.jsonl
// so agents can see what happened recently.

export function createActivityWriter(projectRoot: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    switch (event.type) {
      case "session_start":
        appendActivity(
          projectRoot,
          { ts: Date.now(), event: "start", sid: event.sessionId, agent: event.agent, task: truncateSummary(event.task, 500) },
          event.workspacePath,
        );
        break;

      case "session_end": {
        const summary = truncateSummary(event.outcome);
        if (event.status === "error" || event.status === "interrupted") {
          appendActivity(
            projectRoot,
            {
              ts: Date.now(), event: "error", sid: event.sessionId, agent: event.agent,
              turns: event.turnCount ?? 0, duration: event.duration ?? "?",
              summary, error: truncateSummary(event.error),
            },
            event.workspacePath,
          );
        } else {
          appendActivity(
            projectRoot,
            {
              ts: Date.now(), event: "done", sid: event.sessionId, agent: event.agent,
              turns: event.turnCount ?? 0, duration: event.duration ?? "?",
              summary, files: event.filesModified ?? [],
            },
            event.workspacePath,
          );
        }
        break;
      }
    }
  };
}

// ── Memory Writer ───────────────────────────────────────────────────────
// Appends a memory entry on session end so agents accumulate experience.

export function createMemoryWriter(persistDir: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session_end") return;
    try {
      const entry = {
        timestamp: Date.now(),
        sessionId: event.sessionId,
        task: truncateSummary(event.task, 200),
        status: event.status,
        duration: event.duration ?? "?",
        summary: truncateSummary(event.outcome, 300),
        error: event.error ? truncateSummary(event.error, 200) : undefined,
      };
      appendMemoryEntry(persistDir, event.agent, entry);
    } catch {
      /* best-effort */
    }
  };
}

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
      } catch {
        /* file doesn't exist yet */
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
    } catch {
      /* best-effort */
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
      import("./requests.js")
        .then((mod) => {
          for (const item of finishParams.new_items) {
            try {
              mod.trackRequest(persistDir, {
                fromEntity: event.agent,
                toAgent: event.agent,
                task: String(item).slice(0, 500),
                method: "send",
                source: "finish",
              });
            } catch {
              /* best-effort */
            }
          }
        })
        .catch(() => {});
    }

    // Mark completed items — fuzzy-match against pending requests
    if (Array.isArray(finishParams.completed_items) && finishParams.completed_items.length > 0) {
      import("./requests.js")
        .then((mod) => {
          try {
            const db = mod.getDb(persistDir);
            const pending = db
              .prepare(
                `SELECT requestId, task FROM requests
                 WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS') AND method = 'send'`,
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
                mod.updateRequest(persistDir, bestId, {
                  status: "COMPLETED",
                  completedAt: Date.now(),
                  summary: `Completed by ${event.agent} in session ${event.sessionId}`,
                });
              }
            }
          } catch {
            /* best-effort */
          }
        })
        .catch(() => {});
    }
  };
}

// ── Progress Writer ─────────────────────────────────────────────────────
// Writes workspace/progress.md on session end with task progress info.

export function createProgressWriter(projectRoot: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session_end") return;
    if (event.status !== "done") return;

    const finishParams = event.finishParams as any;
    if (!finishParams) return;

    try {
      const workspace = join(projectRoot, "agents", event.agent, "workspace");
      mkdirSync(workspace, { recursive: true });
      const progressPath = join(workspace, "progress.md");

      const lines: string[] = [
        `# Progress — ${event.agent}`,
        `Updated: ${new Date().toISOString().slice(0, 16)}`,
        "",
        `## Last Session`,
        `- Task: ${truncateSummary(event.task, 200)}`,
        `- Status: ${event.status}`,
        `- Summary: ${truncateSummary(event.outcome, 300)}`,
      ];

      if (finishParams.completed_items?.length) {
        lines.push("", "## Completed");
        for (const item of finishParams.completed_items) {
          lines.push(`- [x] ${item}`);
        }
      }
      if (finishParams.new_items?.length) {
        lines.push("", "## Next");
        for (const item of finishParams.new_items) {
          lines.push(`- [ ] ${item}`);
        }
      }

      writeFileSync(progressPath, lines.join("\n") + "\n");
    } catch {
      /* best-effort */
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
): (event: AgentEvent) => void {
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
      // Digest: stuck_detected (warning, not kill yet)
      if (persistDir) {
        upsertDigest(persistDir, {
          sessionId: event.sessionId,
          agent: event.agent,
          trigger: "stuck_detected",
          details: { consecutiveErrorTurns: s.consecutiveErrorTurns },
        }).catch(err => log("warn", `[digest] stuck_detected failed: ${err}`));
      }
    }

    if (s.consecutiveErrorTurns >= STUCK_TERMINATE_THRESHOLD) {
      const reason = `Stuck: ${s.consecutiveErrorTurns} consecutive error-only turns`;
      log("error", `[stuck] ${event.agent} (${event.sessionId}) stuck at ${s.consecutiveErrorTurns} error turns — cancelling`);
      // Digest: circuit_break (kill)
      if (persistDir) {
        upsertDigest(persistDir, {
          sessionId: event.sessionId,
          agent: event.agent,
          trigger: "circuit_break",
          details: { consecutiveErrorTurns: s.consecutiveErrorTurns, reason },
        }).catch(err => log("warn", `[digest] circuit_break failed: ${err}`));
      }
      emitCancel(event.sessionId, reason);
      // Notify for diagnosis (Task B: circuit-breaker → diagnosis feedback loop)
      if (onCircuitBreak) {
        try { onCircuitBreak(event.agent, event.sessionId, reason); } catch { /* best-effort */ }
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
): (event: AgentEvent) => void {
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
      // Digest: resume_exhausted
      if (persistDir) {
        upsertDigest(persistDir, {
          sessionId: event.sessionId,
          agent: event.agent,
          trigger: "resume_exhausted",
          details: { attempts: prev + 1, maxAttempts: MAX_RESUME_ATTEMPTS, error: event.error?.slice(0, 200), turnCount: event.turnCount },
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
      `[resume] ${event.agent} (${event.sessionId}) interrupted after ${event.turnCount ?? 0} turns — resuming in ${delay / 1000}s (attempt ${prev + 1}/${MAX_RESUME_ATTEMPTS})`,
    );

    // Digest: auto_resume
    if (persistDir) {
      upsertDigest(persistDir, {
        sessionId: event.sessionId,
        agent: event.agent,
        trigger: "auto_resume",
        details: { attempt: prev + 1, maxAttempts: MAX_RESUME_ATTEMPTS, delayMs: delay, error: event.error?.slice(0, 200), turnCount: event.turnCount },
      }).catch(err => log("warn", `[digest] auto_resume failed: ${err}`));
    }

    setTimeout(() => {
      emitResume(event.sessionId, event.agent, prev + 1);
    }, delay);
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
        try { log("warn", `[digest-subscriber] start failed: ${err}`); } catch {}
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
        try { log("warn", `[digest-subscriber] end failed: ${err}`); } catch {}
      }
    }
  };
}

