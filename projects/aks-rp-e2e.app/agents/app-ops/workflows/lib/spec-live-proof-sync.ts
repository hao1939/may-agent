import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

type SyncResult = {
  changed: boolean;
  taskId?: string;
  specId?: string;
  runId?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return record(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return {};
  }
}

function proofFile(evidence: unknown, appDir: string): string {
  if (!Array.isArray(evidence)) return "";
  const value = evidence.find(
    (entry): entry is string =>
      typeof entry === "string" && entry.startsWith("proof:"),
  );
  if (!value) return "";
  const path = value.slice("proof:".length).trim();
  return isAbsolute(path) ? path : join(appDir, path);
}

/** Project the accepted workflow receipt into the app-owned spec-loop read model. */
export function syncSpecLiveProof(appDir: string, taskId: string): SyncResult {
  const taskStatePath = join(appDir, ".state", "tasks", "state.json");
  const taskState = readJson(taskStatePath);
  const receipt = record(record(taskState.receipts)[taskId]);
  if (text(receipt.workflow) !== "spec-live-reconciliation") {
    return { changed: false, taskId };
  }
  const path = proofFile(receipt.evidence, appDir);
  const proof = path ? readJson(path) : {};
  const specId = text(proof.specId);
  const runId = text(proof.runId);
  const sourceCommit = text(proof.sourceCommit);
  if (!specId || !runId || !sourceCommit || proof.verdict !== "pass") {
    return { changed: false, taskId };
  }

  const statePath = join(appDir, ".state", "spec-loop", "state.json");
  const state = readJson(statePath);
  const specs = record(state.specs);
  const current = record(specs[specId]);
  const acceptedAt = text(proof.reviewedAt) || new Date().toISOString();
  const next = {
    ...current,
    status: "pass",
    taskId: null,
    lastRunId: runId,
    updatedAt: acceptedAt,
    terminalDisposition: false,
    review: {
      ...record(current.review),
      classification: "exact-live-tested-merged-source",
      acceptedRunId: runId,
      acceptedStatus: "pass",
      acceptedByTaskId: taskId,
      acceptedAt,
      sourceCommit,
      ...(text(proof.sourceBranch)
        ? { sourceBranch: text(proof.sourceBranch) }
        : {}),
      ...(text(proof.pullRequestId)
        ? { pullRequestId: text(proof.pullRequestId) }
        : {}),
      ...(text(proof.mergedCommit)
        ? { mergedCommit: text(proof.mergedCommit) }
        : {}),
    },
  };
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return { changed: false, taskId, specId, runId };
  }
  specs[specId] = next;
  state.specs = specs;
  state.updatedAt = new Date().toISOString();
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return { changed: true, taskId, specId, runId };
}
