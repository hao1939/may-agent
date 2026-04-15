/**
 * run-agent-task.ts — Preflight check logic for cron-driven agent tasks.
 *
 * Provides functions to evaluate preflight checks that determine whether
 * an LLM session should be spawned.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PreflightCheck } from "../../../src/lib/cron-tool.js";

const PREFLIGHT_STATE_FILE = "preflight-state.json";

export interface PreflightState {
  [key: string]: {
    checkedAt: number;
    fileSize?: number;
    fileCount?: number;
  };
}

export function loadPreflightState(persistDir: string): PreflightState {
  try {
    const statePath = join(persistDir, PREFLIGHT_STATE_FILE);
    if (existsSync(statePath)) {
      return JSON.parse(readFileSync(statePath, "utf-8"));
    }
  } catch {
    // corrupted or missing
  }
  return {};
}

export function savePreflightState(persistDir: string, state: PreflightState): void {
  try {
    mkdirSync(persistDir, { recursive: true });
    writeFileSync(join(persistDir, PREFLIGHT_STATE_FILE), JSON.stringify(state, null, 2));
  } catch {
    // best-effort
  }
}

export function runPreflightCheck(
  check: PreflightCheck,
  projectRoot: string,
  persistDir: string,
  entryName: string,
  log: (msg: string) => void,
): boolean {
  const { type, path: relPath } = check;
  const fullPath = join(projectRoot, relPath);

  switch (type) {
    case "file-has-content": {
      if (!existsSync(fullPath)) {
        log(`Skip: ${relPath} not found`);
        return false;
      }

      const content = readFileSync(fullPath, "utf-8");
      const nonEmptyLines = content.split("\n").filter((l) => l.trim().length > 0);
      const minLines = check.minLines ?? 1;

      if (nonEmptyLines.length < minLines) {
        log(`Skip: ${relPath} has ${nonEmptyLines.length} lines (need ${minLines})`);
        return false;
      }

      log(`Pass: ${relPath} has ${nonEmptyLines.length} non-empty lines`);
      return true;
    }

    case "new-entries-since": {
      if (!existsSync(fullPath)) {
        log(`Skip: ${relPath} not found`);
        return false;
      }

      const stateKey = check.stateKey ?? entryName;
      const state = loadPreflightState(persistDir);
      const prevState = state[stateKey];

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        log(`Skip: ${relPath} unreadable`);
        return false;
      }

      if (stat.isDirectory()) {
        // Count files in directory
        const files = readdirSync(fullPath);
        const fileCount = files.length;

        if (prevState && prevState.fileCount !== undefined && fileCount <= prevState.fileCount) {
          log(`Skip: ${relPath} has ${fileCount} files (unchanged)`);
          return false;
        }

        log(`Pass: ${relPath} has ${fileCount} files`);
        return true;
      }

      // File: check size
      const fileSize = stat.size;

      if (prevState && prevState.fileSize !== undefined && fileSize <= prevState.fileSize) {
        log(`Skip: ${relPath} size unchanged (${fileSize} bytes)`);
        return false;
      }

      log(`Pass: ${relPath} has new entries (${fileSize} bytes)`);
      return true;
    }

    default:
      log(`Unknown check type: ${type} — passing (fail-open)`);
      return true;
  }
}

export function updatePreflightState(
  check: PreflightCheck,
  projectRoot: string,
  persistDir: string,
  entryName: string,
): void {
  const fullPath = join(projectRoot, check.path);
  const stateKey = check.stateKey ?? entryName;

  if (!existsSync(fullPath)) return;

  const state = loadPreflightState(persistDir);
  const now = Date.now();

  let stat;
  try {
    stat = statSync(fullPath);
  } catch {
    return;
  }

  if (stat.isDirectory()) {
    const files = readdirSync(fullPath);
    state[stateKey] = { checkedAt: now, fileCount: files.length };
  } else {
    state[stateKey] = { checkedAt: now, fileSize: stat.size };
  }

  savePreflightState(persistDir, state);
}
