/**
 * Session subscribers — event-driven side effects for session lifecycle.
 *
 * Each function returns a bus subscriber that reacts to session events.
 * Decoupled from the manager — they only know events, not internals.
 *
 * Replaces inline side effects that were in manager.ts handleCompletion.
 */

import { appendFileSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { AgentEvent } from "../app/event-bus.js";
import { appendActivity, truncateSummary } from "./activity.js";
import { appendMemoryEntry } from "./persistence.js";
import { log } from "./log.js";

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
    }

    if (s.consecutiveErrorTurns >= STUCK_TERMINATE_THRESHOLD) {
      log("error", `[stuck] ${event.agent} (${event.sessionId}) stuck at ${s.consecutiveErrorTurns} error turns — cancelling`);
      emitCancel(event.sessionId, `Stuck: ${s.consecutiveErrorTurns} consecutive error-only turns`);
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
): (event: AgentEvent) => void {
  const attempts = new Map<string, number>();

  return (event: AgentEvent) => {
    if (event.type !== "session_end") return;
    if (event.status !== "interrupted") return;
    if ((event.turnCount ?? 0) === 0) return; // No work done — nothing to resume

    const prev = attempts.get(event.sessionId) ?? 0;
    if (prev >= MAX_RESUME_ATTEMPTS) {
      // Exhausted retries — escalate immediately
      attempts.delete(event.sessionId);
      emitEscalate(
        event.agent,
        event.sessionId,
        `Interrupted ${MAX_RESUME_ATTEMPTS + 1}x after ${event.turnCount ?? 0} turns. Error: ${event.error?.slice(0, 200) ?? "unknown"}. Task: ${(event.task ?? "").slice(0, 200)}`,
      );
      return;
    }

    attempts.set(event.sessionId, prev + 1);
    const delay = 10_000 * (prev + 1); // 10s, 20s backoff
    log(
      "info",
      `[resume] ${event.agent} (${event.sessionId}) interrupted after ${event.turnCount ?? 0} turns — resuming in ${delay / 1000}s (attempt ${prev + 1}/${MAX_RESUME_ATTEMPTS})`,
    );

    setTimeout(() => {
      emitResume(event.sessionId, event.agent, prev + 1);
    }, delay);
  };
}
