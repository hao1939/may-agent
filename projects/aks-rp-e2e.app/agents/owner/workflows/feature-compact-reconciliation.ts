import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type {
  ProjectAppTaskHandlerResult,
  ProjectAppTaskVerificationContext,
  ProjectAppTaskVerificationResult,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk/legacy";
import {
  defaultFeatureCompactLoopStatePath,
  hasDurableLiveProof,
  loadFeatureCompactLoopState,
  type FeatureCompactLoopState,
} from "../../app-ops/workflows/lib/feature-compact-loop-store.js";

export const name = "feature-compact-reconciliation";
export const description =
  "Route bounded feature-compact judgment to the domain owner and deterministically admit convergence only after the canonical feature row is current, terminal, and durably proven.";

function readState(path: string): FeatureCompactLoopState | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as FeatureCompactLoopState;
  } catch {
    return null;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const summary =
    "Feature-compact reconciliation requires current domain judgment; hand off with deterministic ledger admission retained at the completion boundary.";
  return ctx.done(summary, {
    state: "needs-owner",
    summary,
    evidence: [],
    actions: [],
  });
}

export async function verify(
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
): Promise<ProjectAppTaskVerificationResult> {
  if (result.state !== "converged") {
    return {
      accepted: true,
      summary:
        "Non-converged feature-compact disposition does not require terminal ledger admission.",
      evidence: [...result.evidence],
    };
  }

  const featureKey = text(context.intent.input?.featureKey);
  if (!featureKey) {
    return {
      accepted: false,
      summary:
        "Feature-compact convergence rejected: task input.featureKey is missing.",
      evidence: [...result.evidence],
    };
  }

  const statePath = defaultFeatureCompactLoopStatePath(context.appDir);
  const persisted = readState(statePath);
  const row = persisted?.features?.[featureKey];
  if (!row) {
    return {
      accepted: false,
      summary: `Feature-compact convergence rejected: canonical row ${featureKey} is absent from ${statePath}.`,
      evidence: [...result.evidence, `feature-compact-state:${statePath}`],
    };
  }

  const refreshed = loadFeatureCompactLoopState({
    appDir: context.appDir,
    projectDir: context.projectDir,
    loopTaskId: persisted?.loopTaskId || "aks-feature-compact-loop",
    windowSize: persisted?.windowSize || 3,
    statePath,
    featureKeys: [featureKey],
    refreshFromProject: true,
  }).state.features[featureKey];
  const staleFingerprint =
    !row.inputFingerprint ||
    !refreshed?.inputFingerprint ||
    row.inputFingerprint !== refreshed.inputFingerprint;
  const staleRepresentation = Boolean(
    row.taskId ||
    (row.frontierTaskIds?.length ?? 0) > 0 ||
    row.waitingFor ||
    row.waitingCondition ||
    row.resumeCondition,
  );
  const resultPath = row.lastResultPath
    ? isAbsolute(row.lastResultPath)
      ? row.lastResultPath
      : ([
          join(context.appDir, row.lastResultPath),
          join(context.projectDir, row.lastResultPath),
        ].find((candidate) => existsSync(candidate)) ?? "")
    : "";
  const durable = hasDurableLiveProof(row, {
    appDir: context.appDir,
    projectDir: context.projectDir,
    statePath,
  });

  if (
    row.status !== "done" ||
    staleFingerprint ||
    staleRepresentation ||
    !durable ||
    !resultPath ||
    !existsSync(resultPath)
  ) {
    return {
      accepted: false,
      summary: `Feature-compact convergence rejected for ${featureKey}: status=${row.status}, fingerprintCurrent=${!staleFingerprint}, staleRepresentation=${staleRepresentation}, durableProof=${durable}.`,
      evidence: [
        ...result.evidence,
        `feature-compact-state:${statePath}`,
        ...(resultPath ? [`feature-compact-result:${resultPath}`] : []),
      ],
    };
  }

  return {
    accepted: true,
    summary: `Feature-compact convergence admitted for ${featureKey}: canonical row is current, terminal, representation-free, and durably proven.`,
    evidence: [
      ...result.evidence,
      `feature-compact-state:${statePath}`,
      `feature-compact-fingerprint:${row.inputFingerprint}`,
      `feature-compact-result:${resultPath}`,
    ],
  };
}
