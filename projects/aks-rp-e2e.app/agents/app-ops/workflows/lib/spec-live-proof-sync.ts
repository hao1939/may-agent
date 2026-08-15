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

function evidencePath(evidence: unknown, prefix: string): string {
  if (!Array.isArray(evidence)) return "";
  const value = evidence.find(
    (entry): entry is string =>
      typeof entry === "string" && entry.startsWith(prefix),
  );
  return value ? value.slice(prefix.length).trim() : "";
}

function withoutRetiredResultFields(
  current: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...current };
  for (const key of [
    "successorDisposition",
    "successorEvidencePath",
    "successorRunId",
    "successorRunUrl",
    "successorResultPath",
    "successorStateReason",
    "resumeCondition",
    "lastError",
  ]) {
    delete next[key];
  }
  return next;
}

/** Project the accepted workflow receipt into the app-owned spec-loop read model. */
export function syncSpecLiveProof(
  appDir: string,
  completedChild: unknown,
): SyncResult {
  const receipt = record(completedChild);
  const taskId = text(receipt.taskId);
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
  const acceptedResultPath = evidencePath(
    receipt.evidence,
    "aggregate-artifact:",
  );
  const next = {
    ...withoutRetiredResultFields(current),
    status: "pass",
    catalogStatus: "pass",
    catalogSpecState: "verified",
    taskId: null,
    lastRunId: runId,
    lastRunUrl: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=${encodeURIComponent(runId)}`,
    lastResultPath: acceptedResultPath || null,
    updatedAt: acceptedAt,
    terminalDisposition: false,
    failureClass: null,
    diagnosis: null,
    inputFingerprint: null,
    errorFingerprint: null,
    review: {
      classification: "exact-live-tested-merged-source",
      acceptedRunId: runId,
      ...(acceptedResultPath ? { acceptedResultPath } : {}),
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

/** Refresh accepted child receipts before the standing spec loop reads its ledger. */
export function syncAcceptedSpecLiveProofs(
  appDir: string,
  completedChildren: readonly unknown[],
): SyncResult[] {
  return completedChildren
    .map((child) => syncSpecLiveProof(appDir, child))
    .filter((result) => result.changed);
}
