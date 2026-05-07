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
import { getDb } from "./requests.js";
import type { SubagentManager } from "./manager.js";
import { writeLastSession } from "./last-session.js";

// ── Context Updater ─────────────────────────────────────────────────────
// Applies context_updates from finish() to agents/<name>/context.md.

export function createContextUpdater(projectRoot: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session.end") return;
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
    if (event.type !== "session.end") return;

    const finishParams = event.finishParams as any;
    if (!finishParams) return;

    // Track new items from finish()
    if (Array.isArray(finishParams.new_items) && finishParams.new_items.length > 0) {
      try {
        for (const item of finishParams.new_items) {
          try {
            try {
              const db = getDb(persistDir);
              db.run("INSERT INTO events (event_type, source, owner, data, timestamp, status) VALUES (?,?,?,?,?,?)",
                ["message.created", event.agent, event.agent, JSON.stringify({ from: event.agent, to: event.agent, content: String(item).slice(0, 500), task: String(item).slice(0, 500), priority: "P2" }), Date.now(), "pending"]);
            } catch { /* best-effort */ }
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

    // completed_items: no longer tracked (requests table removed).
    // Agents act on inbox events directly — no ack needed.
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
    if (event.type === "session.start") {
      state.set(event.sessionId, { consecutiveErrorTurns: 0, warned: false });
      return;
    }

    if (event.type === "session.end") {
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
    if (event.type !== "session.end") return;
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
// Phase 1: session.start (CREATE) and session.end (END digest).

export function createDigestWriter(persistDir: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type === "session.start") {
      try {
        createStartDigest(persistDir, event.sessionId, event.agent, event.task ?? "");
      } catch (err) {
        /* best-effort — digest system shouldn't break sessions */
        try { log("warn", `[digest-subscriber] start failed: ${err}`); } catch (logErr) { console.error("[digest-subscriber] start logging failed:", logErr); }
      }
      return;
    }

    if (event.type === "session.end") {
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

// ── Last-Session Writer ─────────────────────────────────────────────────
// Writes agents/<name>/last-session.md at session end so the next session
// can read a single file instead of querying DB + scanning files.
// Part of: cold-start-fix milestone 1.

export function createLastSessionWriter(projectRoot: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session.end") return;

    const finishParams = event.finishParams as any;
    // Only write if we have meaningful session data (finish() was called or we have a summary)
    const summary = finishParams?.summary ?? event.outcome ?? "";
    if (!summary) return;

    const agentDir = join(projectRoot, "agents", event.agent);
    const status = finishParams?.status ?? event.status ?? "interrupted";
    const filesModified = finishParams?.deliverables?.map((d: any) => d.path).filter(Boolean) ?? event.filesModified ?? [];
    const nextSteps = finishParams?.next_steps ?? null;
    const blockers = finishParams?.blockers ?? null;
    const completedItems = finishParams?.completed_items ?? null;
    const newItems = finishParams?.new_items ?? null;

    try {
      writeLastSession(agentDir, {
        sessionId: event.sessionId,
        agent: event.agent,
        status,
        summary,
        duration: event.duration ?? (event as any).runtime,
        filesModified,
        nextSteps,
        blockers,
        completedItems,
        newItems,
        timestamp: Date.now(),
      });
    } catch (err) {
      log("warn", `[last-session-writer] failed for ${event.agent}: ${err}`);
    }
  };
}

// ── File Read Tracker ───────────────────────────────────────────────────
// Tracks which agents read which files, enabling "unread reports" detection.
// Listens for tool_call events where tool === "read".

const AGENT_PATH_RE = /^(?:\.\/)?agents\/([^/]+)\//;

/** Derive the "producer" agent from a file path, if it lives under agents/<name>/. */
function producerFromPath(filePath: string): string | null {
  const m = filePath.match(AGENT_PATH_RE);
  return m ? m[1] : null;
}

export function createFileReadTracker(persistDir: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "tool_call") return;
    if ((event as any).tool !== "read") return;

    const args = (event as any).args as { path?: string } | undefined;
    const filePath = args?.path;
    if (!filePath) return;

    const agent = (event as any).agent as string;
    const sessionId = (event as any).sessionId as string;
    const producer = producerFromPath(filePath);

    // Skip self-reads (agent reading its own files)
    if (producer === agent) return;

    try {
      const db = getDb(persistDir);
      db.prepare(
        `INSERT INTO file_reads (sessionId, agent, filePath, readAt, producerAgent)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(sessionId, agent, filePath, Date.now(), producer);
    } catch (err) {
      log("warn", `[file-read-tracker] failed to record read: ${err}`);
    }
  };
}

// ── Findings Tracker ────────────────────────────────────────────────────
// Auto-creates tracked requests from actionable findings in session deliverables.
// Part of: Feedback Loop M3.

/** Path patterns that indicate a finding source */
const FINDING_PATTERNS: Array<{ pattern: RegExp; producer: string }> = [
  { pattern: /^agents\/scout\/workspace\/deep-dives\/DD-.*\.md$/, producer: "scout" },
  { pattern: /^agents\/scout\/workspace\/findings\/.*\.md$/, producer: "scout" },
  { pattern: /^agents\/may\/workspace\/audits\/.*\.md$/, producer: "may" },
  { pattern: /^knowledge\/experiments\/EXP-.*\/results\.md$/, producer: "coach" },
];

/** Section headers that indicate actionable content */
const ACTION_SECTION_RE = /^(Recommend|Action|Next Step|Should|Fix|TODO)/i;

/** Max auto-created requests per session */
const MAX_FINDINGS_PER_SESSION = 5;

interface ActionItem {
  summary: string;
  source: string;
  severity: "P0" | "P1" | "P2";
  targetAgent: string;
}

function deriveSeverity(text: string): "P0" | "P1" | "P2" {
  const lower = text.toLowerCase();
  if (/\b(breaking|blocks|regression|data loss)\b/.test(lower)) return "P0";
  if (/\b(should fix|bug|incorrect)\b/.test(lower)) return "P1";
  return "P2";
}

function deriveAgent(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(code|implement|refactor|function|module|src\/)\b/.test(lower)) return "tech-lead";
  if (/\b(context|process|heartbeat|cron)\b/.test(lower)) return "may";
  if (/\b(research|investigate|explore|design)\b/.test(lower)) return "bob";
  if (/\b(scenario|training|experiment|gym)\b/.test(lower)) return "coach";
  return "may"; // default
}

function extractActionItems(content: string, filePath: string): ActionItem[] {
  const sections = content.split(/^##\s+/m);
  const actionSections = sections.filter(s => ACTION_SECTION_RE.test(s));

  // For coach experiment results, only process if there's an action/recommendation section
  if (/\/experiments\/EXP-/.test(filePath) && actionSections.length === 0) return [];

  const items: ActionItem[] = [];
  for (const section of actionSections) {
    const bullets = section.match(/^[-*]\s+.+$/gm) || [];
    for (const bullet of bullets) {
      const summary = bullet.replace(/^[-*]\s+/, "").trim();
      if (!summary || summary.length < 10) continue; // skip trivial bullets
      // Must contain imperative language
      if (!/\b(should|must|fix|add|implement|change|remove|update|create|migrate|refactor)\b/i.test(summary)) continue;
      items.push({
        summary,
        source: filePath,
        severity: deriveSeverity(summary),
        targetAgent: deriveAgent(summary),
      });
    }
  }
  return items;
}

/** Simple Jaccard similarity on word tokens */
function jaccardSimilarity(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const tokB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let intersection = 0;
  for (const w of tokA) if (tokB.has(w)) intersection++;
  return intersection / (tokA.size + tokB.size - intersection);
}

export function createFindingsTracker(projectRoot: string, persistDir: string): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session.end") return;

    const finishParams = event.finishParams as any;
    const deliverables = finishParams?.deliverables as Array<{ path?: string; description?: string }> | undefined;
    if (!deliverables?.length) return;

    try {
      // Filter deliverables matching finding patterns
      const findingFiles: Array<{ path: string; producer: string }> = [];
      for (const d of deliverables) {
        if (!d.path) continue;
        for (const fp of FINDING_PATTERNS) {
          if (fp.pattern.test(d.path)) {
            findingFiles.push({ path: d.path, producer: fp.producer });
            break;
          }
        }
      }
      if (findingFiles.length === 0) return;

      const db = getDb(persistDir);
      let created = 0;

      for (const ff of findingFiles) {
        if (created >= MAX_FINDINGS_PER_SESSION) break;

        // Read the finding file
        const fullPath = join(projectRoot, ff.path);
        let content: string;
        try {
          content = readFileSync(fullPath, "utf-8");
        } catch {
          continue; // file doesn't exist or can't be read
        }

        // Check for stale/superseded frontmatter
        if (/^status:\s*(stale|superseded)/m.test(content)) continue;

        // Extract action items
        const items = extractActionItems(content, ff.path);
        if (items.length === 0) continue;

        // Sort by severity for volume cap
        const severityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
        items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        // Check for existing requests from same source
        const existingFromSource = db
          .prepare(
            `SELECT id FROM events WHERE event_type = 'agent.finding' AND json_extract(data, '$.finding') = ? AND timestamp > ?`,
          )
          .all(ff.path, Date.now() - 7 * 24 * 60 * 60 * 1000) as { id: number }[];
        if (existingFromSource.length > 0) continue;

        // Get recent auto-findings for fuzzy dedup
        const existingAutoTasks = db
          .prepare(
            `SELECT json_extract(data, '$.task') as task FROM events WHERE event_type = 'agent.finding' AND timestamp > ?`,
          )
          .all(Date.now() - 7 * 24 * 60 * 60 * 1000) as { task: string }[];

        for (const item of items) {
          if (created >= MAX_FINDINGS_PER_SESSION) break;

          const taskText = `[Auto] ${item.summary.slice(0, 450)}`;

          // Fuzzy dedup against existing auto-requests
          const isDuplicate = existingAutoTasks.some(
            (r) => jaccardSimilarity(taskText, r.task) > 0.7,
          );
          if (isDuplicate) continue;

          try {
            const db = getDb(persistDir);
            db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
              ["agent.finding", ff.producer, item.targetAgent, JSON.stringify({ task: taskText, finding: ff.path }), Date.now()]);
          } catch { /* best-effort */ }

          // Add to existing list for intra-session dedup
          existingAutoTasks.push({ task: taskText });
          created++;
        }
      }

      if (created > 0) {
        log("info", `[findings-tracker] created ${created} request(s) from ${findingFiles.length} finding(s) in session ${event.sessionId}`);
      }
    } catch (err) {
      log("warn", `[findings-tracker] failed for session ${event.sessionId}: ${err}`);
    }
  };
}

