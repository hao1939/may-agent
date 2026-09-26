/**
 * Session subscribers — event-driven side effects for session lifecycle.
 *
 * Each function returns a bus subscriber that reacts to session events.
 * Decoupled from the manager — they only know events, not internals.
 *
 * Replaces inline side effects that were in manager.ts handleCompletion.
 */

import { join } from "node:path";
import { eventData, type AgentEvent } from "../app/core/events/bus.js";
import { resolveRuntimeAgentDirectory } from "../app/loader/agent-discovery.js";
import { log } from "./log.js";
import { createStartDigest, createEndDigest } from "./session-digest.js";
import { writeLastSession } from "./last-session.js";

// ── Digest Writer ───────────────────────────────────────────────────────
// Creates session digest entries on session lifecycle events.
// session.start creates the digest; session.end records its result.

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

function writableAgentDir(projectRoot: string, agent: string, agentRelativeDir?: string): string {
  // Completion belongs to the selected definition even after a marker or registry
  // change. Resolve against writable installation files, never a source release.
  if (agentRelativeDir) return join(projectRoot, agentRelativeDir);
  // Programmatic definitions without a discovered folder retain the legacy lookup.
  return resolveRuntimeAgentDirectory(join(projectRoot, "agents"), agent, join(projectRoot, "projects"))?.dir
    ?? join(projectRoot, "agents", agent);
}

// ── Last-Session Writer ─────────────────────────────────────────────────
// Writes the registered agent's last-session.md at session end so the next session
// can read a single summary; exact Task state and retained evidence remain authoritative.

export function createLastSessionWriter(projectRoot: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session.end") return;
    const info = eventData(event) as any;

    const finishParams = info.finishParams as any;
    // Only write if we have meaningful session data (finish() was called or we have a summary)
    const summary = finishParams?.summary ?? info.outcome ?? "";
    if (!summary) return;

    const agentDir = writableAgentDir(projectRoot, info.agent, info.agentRelativeDir);
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
