import { statSync } from "node:fs";
import { join } from "node:path";
import { readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { log, type LogLevel } from "./log.js";
import { redactTranscriptSecrets } from "./persistence.js";

// Small author logs, not transcripts. Stop writing at the bound rather than
// repeatedly rewriting an ever-growing run artifact. No timer or collector.
export const MAX_WORKFLOW_DIAGNOSTICS_BYTES = 16_384;
const MAX_MESSAGE_CHARACTERS = 2_000;

export type WorkflowDiagnostics = {
  ref: string;
  state: "available" | "unavailable";
  truncated: boolean;
  entries: Array<{ at: number; level: LogLevel; message: string }>;
};

function diagnosticsRef(runId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error("Invalid workflow run identity");
  return `workflow-runs/${runId}/diagnostics.json`;
}

/** Bounded optional facts. A write failure must not change execution outcome. */
export function createWorkflowDiagnostics(persistDir: string | undefined, runId: string) {
  const ref = diagnosticsRef(runId);
  const entries: WorkflowDiagnostics["entries"] = [];
  let stopped = !persistDir;
  let truncated = false;
  const save = () => {
    if (stopped) return;
    try {
      writeJsonArtifact(persistDir!, ref, { entries, truncated });
    } catch {
      stopped = true;
      // Do not echo an arbitrary filesystem error or re-enter this logger.
      log("warn", `[workflow:${runId}] diagnostic persistence unavailable; execution continues`);
    }
  };
  save();
  return (level: LogLevel, message: string): string => {
    const safe = redactTranscriptSecrets(message);
    const bounded =
      safe.length > MAX_MESSAGE_CHARACTERS ? `${safe.slice(0, MAX_MESSAGE_CHARACTERS)}…[truncated]` : safe;
    if (!stopped) {
      entries.push({ at: Date.now(), level, message: bounded });
      truncated ||= safe !== bounded;
      // Match writeJsonArtifact's encoding and reserve room for the limit flag.
      if (
        Buffer.byteLength(JSON.stringify({ entries, truncated: false }, null, 2)) + 1 >
        MAX_WORKFLOW_DIAGNOSTICS_BYTES
      ) {
        entries.pop();
        truncated = true;
        save();
        stopped = true;
      } else {
        save();
      }
    }
    return bounded;
  };
}

export function readWorkflowDiagnostics(persistDir: string, runId: string): WorkflowDiagnostics {
  const ref = diagnosticsRef(runId);
  const unavailable: WorkflowDiagnostics = { ref, state: "unavailable", truncated: false, entries: [] };
  try {
    if (statSync(join(persistDir, ref)).size > MAX_WORKFLOW_DIAGNOSTICS_BYTES) return unavailable;
    const data = readJsonArtifact<Partial<WorkflowDiagnostics>>(persistDir, ref);
    if (!data || typeof data.truncated !== "boolean" || !Array.isArray(data.entries)) return unavailable;
    if (
      !data.entries.every(
        (entry) =>
          entry &&
          Number.isFinite(entry.at) &&
          ["debug", "info", "warn", "error"].includes(entry.level) &&
          typeof entry.message === "string",
      )
    )
      return unavailable;
    return { ref, state: "available", truncated: data.truncated, entries: data.entries };
  } catch {
    return unavailable;
  }
}
