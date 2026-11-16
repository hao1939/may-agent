import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExecutionResult } from "@may-agent/sdk";
import type { AppWorkflowContext } from "@may-agent/sdk/app";
import {
  auditWorkflows,
  formatWorkflowAuditMarkdown,
  type WorkflowAuditReport,
} from "../../../scripts/audit-workflows.js";

export const name = "runtime-pattern-audit";
export const description =
  "Deterministically collect and compare latest vs. preceding runtime window workflow and contract evidence without a model call. Input {latestWindowMs?, compareWindowMs?, now?, rootDir?, dbPath?, persistSnapshot?}.";

export type RuntimePatternAuditInput = {
  latestWindowMs?: number;
  compareWindowMs?: number;
  now?: number;
  rootDir?: string;
  dbPath?: string;
  persistSnapshot?: boolean;
};

export type WindowDelta = {
  appId: string;
  agent: string;
  workflow: string;
  latestFinished: number;
  latestError: number;
  latestBlocked: number;
  precedingFinished: number;
  precedingError: number;
  precedingBlocked: number;
  errorDelta: number;
  blockedDelta: number;
  sampleRunIds: string[];
};

export type RuntimePatternAuditPacket = {
  generatedAt: number;
  latestWindow: { start: number; end: number; windowMs: number };
  precedingWindow: { start: number; end: number; windowMs: number };
  dbAvailable: boolean;
  latestTotals: WorkflowAuditReport["totals"];
  precedingTotals: WorkflowAuditReport["totals"];
  latestSignals: WorkflowAuditReport["signals"];
  regressions: WindowDelta[];
  snapshotPaths?: { jsonPath: string; markdownPath: string };
};

const DEFAULT_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * App workflows run with an App-scoped projectRoot, while the static inventory
 * spans sibling Apps under the installation's projects directory. appRoot is
 * the runtime contract for the owning App declaration, so its projects parent
 * identifies the captured definition inventory without assuming an install path.
 */
export function workflowInventoryRootFromAppRoot(appRoot: string): string {
  return dirname(dirname(resolve(appRoot)));
}

export function buildRuntimePatternAuditPacket(
  input: RuntimePatternAuditInput = {},
): RuntimePatternAuditPacket {
  const now =
    typeof input.now === "number" && Number.isFinite(input.now)
      ? input.now
      : Date.now();
  const latestWindowMs =
    typeof input.latestWindowMs === "number" && input.latestWindowMs > 0
      ? input.latestWindowMs
      : DEFAULT_WINDOW_MS;
  const compareWindowMs =
    typeof input.compareWindowMs === "number" && input.compareWindowMs > 0
      ? input.compareWindowMs
      : latestWindowMs;
  const rootDir = resolve(input.rootDir ?? process.cwd());
  const dbPath = input.dbPath ? resolve(input.dbPath) : undefined;

  const latest = auditWorkflows({
    rootDir,
    dbPath,
    now,
    windowMs: latestWindowMs,
  });
  const precedingEnd = now - latestWindowMs;
  const preceding = auditWorkflows({
    rootDir,
    dbPath,
    now: precedingEnd,
    windowMs: compareWindowMs,
  });

  const precedingByKey = new Map(
    preceding.workflows.map((wf) => [`${wf.appId}:${wf.name}`, wf]),
  );

  const regressions: WindowDelta[] = [];
  for (const wf of latest.workflows) {
    if (wf.isReexport || !wf.runtime) continue;
    const prev = precedingByKey.get(`${wf.appId}:${wf.name}`)?.runtime;
    const latestError = wf.runtime.error;
    const latestBlocked = wf.runtime.blocked;
    const precedingError = prev?.error ?? 0;
    const precedingBlocked = prev?.blocked ?? 0;
    const errorDelta = latestError - precedingError;
    const blockedDelta = latestBlocked - precedingBlocked;

    if (latestError > 0 || latestBlocked > 0 || errorDelta !== 0 || blockedDelta !== 0) {
      regressions.push({
        appId: wf.appId,
        agent: wf.agent,
        workflow: wf.name,
        latestFinished: wf.runtime.finished,
        latestError,
        latestBlocked,
        precedingFinished: prev?.finished ?? 0,
        precedingError,
        precedingBlocked,
        errorDelta,
        blockedDelta,
        sampleRunIds: wf.runtime.recentFailedRunIds,
      });
    }
  }

  regressions.sort(
    (a, b) =>
      b.errorDelta - a.errorDelta ||
      b.latestError - a.latestError ||
      b.blockedDelta - a.blockedDelta ||
      a.workflow.localeCompare(b.workflow),
  );

  let snapshotPaths: { jsonPath: string; markdownPath: string } | undefined;
  if (input.persistSnapshot === true) {
    const outDir = join(rootDir, ".state", "workflow-audits");
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, "latest.json");
    const markdownPath = join(outDir, "latest.md");
    writeFileSync(jsonPath, `${JSON.stringify(latest, null, 2)}\n`, "utf8");
    writeFileSync(markdownPath, formatWorkflowAuditMarkdown(latest), "utf8");
    snapshotPaths = { jsonPath, markdownPath };
  }

  return {
    generatedAt: now,
    latestWindow: latest.window,
    precedingWindow: preceding.window,
    dbAvailable: latest.dbAvailable,
    latestTotals: latest.totals,
    precedingTotals: preceding.totals,
    latestSignals: latest.signals,
    regressions: regressions.slice(0, 10),
    ...(snapshotPaths ? { snapshotPaths } : {}),
  };
}

export async function execute(
  ctx: AppWorkflowContext<RuntimePatternAuditInput>,
): Promise<ExecutionResult> {
  ctx.signal.throwIfAborted();
  const rootDir = ctx.workspace?.appRoot
    ? workflowInventoryRootFromAppRoot(ctx.workspace.appRoot)
    : process.cwd();
  const packet = buildRuntimePatternAuditPacket({
    ...ctx.input,
    rootDir: ctx.input?.rootDir ?? rootDir,
    persistSnapshot: ctx.input?.persistSnapshot ?? true,
  });
  ctx.signal.throwIfAborted();

  const summary =
    packet.latestSignals.length === 0 && packet.regressions.length === 0
      ? `Runtime pattern audit: 0 signals across ${packet.latestTotals.workflows} workflows (${packet.latestTotals.finishedRuns} runs in latest window)`
      : `Runtime pattern audit: ${packet.latestSignals.length} signal(s), ${packet.regressions.length} workflow delta(s) across ${packet.latestTotals.workflows} workflows`;

  const attentionSignals = packet.latestSignals.filter((s) => s.severity === "attention");
  const requests =
    attentionSignals.length > 0
      ? [
          {
            localKey: `workflow-audit:${createHash("sha256")
              .update(
                JSON.stringify(
                  attentionSignals.map((s) => ({
                    appId: s.appId,
                    workflow: s.workflow,
                    code: s.code,
                    sampleRunIds: s.sampleRunIds ?? [],
                  })),
                ),
              )
              .digest("hex")
              .slice(0, 16)}`,
            target: { appId: "alex" },
            input: {
              kind: "message",
              data: {
                message: `Workflow audit detected ${attentionSignals.length} attention signal(s): ${attentionSignals
                  .map((s) => s.summary)
                  .join("; ")}. Inspect the pinned workflow runs and repair or disposition the root cause.`,
                context: {
                  workflowAudit: {
                    generatedAt: packet.generatedAt,
                    signals: attentionSignals,
                    regressions: packet.regressions,
                  },
                },
              },
            },
          },
        ]
      : [];

  return ctx.done(summary, {
    state: "converged",
    summary,
    facts: [
      `workflows:${packet.latestTotals.workflows}`,
      `contractErrors:${packet.latestTotals.contractErrors}`,
      `finishedRuns:${packet.latestTotals.finishedRuns}`,
      `signals:${packet.latestSignals.length}`,
      `regressions:${packet.regressions.length}`,
    ],
    requests,
    result: packet,
  });
}

