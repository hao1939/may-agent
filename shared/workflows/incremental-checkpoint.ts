/**
 * incremental-checkpoint — Saves and restores mid-iteration state so that
 * crashes don't lose partial work. Used by iterative workflows to persist
 * progress after significant steps.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export interface CheckpointData {
  sessionId: string;
  iteration: number;
  step: number;
  timestamp: number;
  task: string;
  toolsCalled: string[];
  partialResults: Record<string, unknown>;
  completed: boolean;
}

const CHECKPOINT_DIR = ".state/checkpoints/incremental";

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function checkpointPath(projectDir: string, sessionId: string): string {
  return join(projectDir, CHECKPOINT_DIR, `${sessionId}.json`);
}

/**
 * Save an incremental checkpoint after a tool call or significant step.
 */
export function saveIncrementalCheckpoint(
  projectDir: string,
  data: CheckpointData
): void {
  const dir = join(projectDir, CHECKPOINT_DIR);
  ensureDir(dir);
  const path = checkpointPath(projectDir, data.sessionId);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Detect an incomplete checkpoint from a previous crashed session.
 * Returns the checkpoint data if found and not marked completed, null otherwise.
 */
export function detectIncompleteCheckpoint(
  projectDir: string,
  sessionId?: string
): CheckpointData | null {
  const dir = join(projectDir, CHECKPOINT_DIR);
  if (!existsSync(dir)) return null;

  // If sessionId provided, check that specific checkpoint
  if (sessionId) {
    const path = checkpointPath(projectDir, sessionId);
    if (!existsSync(path)) return null;
    try {
      const data: CheckpointData = JSON.parse(readFileSync(path, "utf-8"));
      return data.completed ? null : data;
    } catch {
      return null;
    }
  }

  // Otherwise, find any incomplete checkpoint (most recent first)
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const data: CheckpointData = JSON.parse(
          readFileSync(join(dir, file), "utf-8")
        );
        if (!data.completed) return data;
      } catch {
        continue;
      }
    }
  } catch {}

  return null;
}

/**
 * Mark a checkpoint as completed (iteration finished successfully).
 */
export function markCheckpointComplete(
  projectDir: string,
  sessionId: string
): void {
  const path = checkpointPath(projectDir, sessionId);
  if (!existsSync(path)) return;
  try {
    const data: CheckpointData = JSON.parse(readFileSync(path, "utf-8"));
    data.completed = true;
    writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

/**
 * Clean up old completed checkpoints, keeping only the N most recent.
 */
export function cleanupCheckpoints(
  projectDir: string,
  keepCount: number = 5
): void {
  const dir = join(projectDir, CHECKPOINT_DIR);
  if (!existsSync(dir)) return;

  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith(".json"))
      .sort()
      .reverse();

    const completed: string[] = [];
    for (const file of files) {
      try {
        const data: CheckpointData = JSON.parse(
          readFileSync(join(dir, file), "utf-8")
        );
        if (data.completed) completed.push(file);
      } catch {
        completed.push(file); // corrupt files count as cleanable
      }
    }

    // Remove old completed checkpoints beyond keepCount
    for (const file of completed.slice(keepCount)) {
      try { unlinkSync(join(dir, file)); } catch {}
    }
  } catch {}
}
