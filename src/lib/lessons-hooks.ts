/**
 * Lessons Integration Hooks — ready-to-wire functions for manager.ts
 *
 * Two hooks:
 * 1. `onSessionFinish()` — call after finish() to extract & persist lessons
 * 2. `getLessonsContext()` — call during buildSessionContext() to inject lessons
 *
 * Integration in manager.ts:
 *
 *   import { onSessionFinish, getLessonsContext } from "../agents/src/lib/lessons-hooks.js";
 *
 *   // In finish handler, after existing validations:
 *   onSessionFinish({ agent: agentName, task: taskDescription, finishOutput });
 *
 *   // In buildSessionContext(), append to prompt:
 *   const lessonsBlock = getLessonsContext(agentName, taskDescription);
 *   if (lessonsBlock) systemPrompt += "\n" + lessonsBlock;
 */

import { extractLessons, retrieveLessons, decayLessons } from "./lessons.ts";
import type { FinishOutput } from "./lessons.ts";

// ── Constants ─────────────────────────────────────────────────────────

function getAgentsRoot(): string {
  return process.env.AGENTS_ROOT || "/app/agents";
}

// ── Types ─────────────────────────────────────────────────────────────

export interface SessionFinishEvent {
  agent: string;
  task: string;
  finishOutput: FinishOutput;
}

// ── Hook 1: Post-Session Lesson Extraction ────────────────────────────

/**
 * Call after finish() is processed. Extracts lessons from the finish output
 * and persists them. Safe to call for any status — only extracts when
 * there are lessons or blockers to learn from.
 *
 * Non-throwing: logs errors but never fails the finish flow.
 */
export function onSessionFinish(event: SessionFinishEvent): void {
  try {
    const { agent, task, finishOutput } = event;

    // Skip if nothing to learn
    const hasLessons = finishOutput.lessons && finishOutput.lessons.length > 0;
    const hasBlockers = finishOutput.status === "failure" && finishOutput.blockers?.length;
    if (!hasLessons && !hasBlockers) return;

    extractLessons(getAgentsRoot(), agent, task, finishOutput);
  } catch (err) {
    // Never break the finish flow — lessons are best-effort
    console.error("[lessons-hooks] extractLessons failed:", err);
  }
}

// ── Hook 2: Session Context Injection ─────────────────────────────────

/**
 * Call during buildSessionContext() to get a formatted lessons block.
 * Returns empty string if no relevant lessons exist.
 *
 * Non-throwing: returns "" on any error.
 */
export function getLessonsContext(agentName: string, taskDescription: string): string {
  try {
    return retrieveLessons(getAgentsRoot(), agentName, taskDescription);
  } catch (err) {
    console.error("[lessons-hooks] retrieveLessons failed:", err);
    return "";
  }
}

// ── Hook 3: Maintenance (for heartbeat) ───────────────────────────────

/**
 * Run lesson decay for an agent. Call from heartbeat or daily cron.
 * Non-throwing.
 */
export function runLessonDecay(agentName: string): number {
  try {
    return decayLessons(getAgentsRoot(), agentName);
  } catch (err) {
    console.error("[lessons-hooks] decayLessons failed:", err);
    return 0;
  }
}
