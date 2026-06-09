/**
 * Checkpoint tool — structured mid-session state saving.
 *
 * Allows agents to save structured progress during a session so that
 * if the session crashes or times out, the next session can resume.
 *
 * Writes append-only JSONL to `.state/checkpoints/<sessionId>.jsonl`.
 *
 * Policy: Common Sense 3.5 (Your state is the filesystem),
 *         P1 (Simplest thing), P5 (Data Integrity)
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import type { TSchema } from "@earendil-works/pi-ai";
import { mkdirSync, appendFileSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createCheckpointDigest } from "../session-digest.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface CheckpointToolOptions {
  /** Session ID for namespacing checkpoint files.
   *  Can be a string (fixed) or a function (resolved at call time).
   *  When used with wrapToolsWithReceipts, the manager injects
   *  the session ID dynamically. */
  sessionId: string | (() => string);
  /** Agent name — used for the per-agent latest-checkpoint pointer.
   *  Can be a string (fixed) or a function (resolved at call time).
   *  Injected by the manager alongside sessionId. */
  agentName: string | (() => string);
  /** Directory for .state/ files. */
  persistDir: string;
}

export interface CheckpointEntry {
  sessionId: string;
  agentName: string;
  step: number;
  summary: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// ── Schema ─────────────────────────────────────────────────────────────

const checkpointSchema: TSchema = Type.Object({
  summary: Type.String({
    description:
      "Brief description of what was accomplished at this checkpoint (1-2 sentences). Include what's done and what remains.",
  }),
  data: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description:
        "Structured key-value data to persist. Useful keys: files_modified (list of paths changed), decisions (key choices made), next_steps (what to do if resumed). This data is available to the next session via readCheckpoints.",
    }),
  ),
});

interface CheckpointParams {
  summary: string;
  data?: Record<string, unknown>;
}

// ── Read helper ────────────────────────────────────────────────────────

/**
 * Read all checkpoints for a given session.
 * Returns them in order (oldest first).
 */
export function readCheckpoints(persistDir: string, sessionId: string): CheckpointEntry[] {
  const dir = resolve(persistDir, "checkpoints");
  const filePath = resolve(dir, `${sessionId}.jsonl`);
  if (!existsSync(filePath)) return [];

  const lines = readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((line) => line.trim());

  const entries: CheckpointEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

/**
 * Read the latest checkpoint for a session.
 * Returns null if no checkpoints exist.
 */
export function readLatestCheckpoint(persistDir: string, sessionId: string): CheckpointEntry | null {
  const entries = readCheckpoints(persistDir, sessionId);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

/**
 * Read the latest checkpoint for an agent (across all sessions).
 * Uses the per-agent latest pointer at `.state/checkpoints/latest/<agentName>.json`.
 * Returns null if no checkpoints exist for this agent.
 */
export function readLatestCheckpointForAgent(persistDir: string, agentName: string): CheckpointEntry | null {
  const filePath = resolve(persistDir, "checkpoints", "latest", `${agentName}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

// ── Step counter ───────────────────────────────────────────────────────

/** Track step counters per session (in-memory, resets on process restart) */
const stepCounters = new Map<string, number>();

/** Clean up step counter when a session ends (prevents memory leak). */
export function cleanupStepCounter(sessionId: string): void {
  stepCounters.delete(sessionId);
}

// ── Tool factory ───────────────────────────────────────────────────────

/**
 * Create a `checkpoint` tool for mid-session state saving.
 *
 * When called:
 * 1. Writes a structured JSON line to `.state/checkpoints/<sessionId>.jsonl`
 * 2. Returns confirmation with step number
 *
 * The checkpoint is append-only — each call adds a new entry.
 * The last entry represents the most recent state.
 */
export function createCheckpointTool(options: CheckpointToolOptions): AgentTool<TSchema> {
  const { persistDir } = options;
  const resolveSessionId = () => (typeof options.sessionId === "function" ? options.sessionId() : options.sessionId);
  const resolveAgentName = () => (typeof options.agentName === "function" ? options.agentName() : options.agentName);
  const checkpointDir = resolve(persistDir, "checkpoints");
  const latestDir = resolve(checkpointDir, "latest");

  return {
    name: "checkpoint",
    label: "Checkpoint",
    description:
      "Save structured progress mid-session. Use this after completing a significant step " +
      "so work isn't lost if the session crashes or times out. " +
      "Data is written to .state/checkpoints/ and can be read by the next session.",
    parameters: checkpointSchema,
    execute: async (_toolCallId: string, _params: unknown) => {
      const params = _params as CheckpointParams;
      const { summary, data } = params;

      // Validate summary
      if (!summary || !summary.trim()) {
        return {
          content: [
            {
              type: "text" as const,
              text: "checkpoint() error: 'summary' is required.",
            },
          ],
          details: undefined,
        };
      }

      // Increment step counter
      const sid = resolveSessionId();
      const currentStep = (stepCounters.get(sid) ?? 0) + 1;
      stepCounters.set(sid, currentStep);

      // Build checkpoint entry
      const entry: CheckpointEntry = {
        sessionId: sid,
        agentName: resolveAgentName(),
        step: currentStep,
        summary: summary.trim(),
        data: data ?? {},
        timestamp: Date.now(),
      };

      // Write to file
      try {
        mkdirSync(checkpointDir, { recursive: true });
        appendFileSync(resolve(checkpointDir, `${sid}.jsonl`), JSON.stringify(entry) + "\n", "utf-8");
        // Write per-agent latest pointer for session injection
        mkdirSync(latestDir, { recursive: true });
        writeFileSync(resolve(latestDir, `${entry.agentName}.json`), JSON.stringify(entry) + "\n", "utf-8");
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `checkpoint() error: Failed to write checkpoint — ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          details: undefined,
        };
      }

      // Build response
      const dataKeys = data ? Object.keys(data) : [];
      const dataInfo = dataKeys.length > 0 ? ` Data keys: ${dataKeys.join(", ")}.` : "";

      // ── Trigger checkpoint digest (Phase 1: session digest system) ────
      try {
        createCheckpointDigest(persistDir, sid, entry.agentName, {
          summary: summary.trim(),
          data: data ?? {},
        });
      } catch {
        /* best-effort — digest system shouldn't break checkpoints */
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Checkpoint #${currentStep} saved.${dataInfo}\nSummary: ${summary.trim()}`,
          },
        ],
        details: undefined,
      };
    },
  };
}
