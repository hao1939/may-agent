import { resolve } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  auditWorkflows,
  type WorkflowAuditReport,
} from "../../../../../scripts/audit-workflows.js";

export const name = "runtime-pattern-audit";
export const description =
  "Deterministically collect and compare latest vs. preceding runtime window workflow and contract evidence without a model call. Input {latestWindowMs?, compareWindowMs?, now?, rootDir?, dbPath?}.";

export type RuntimePatternAuditInput = {
  latestWindowMs?: number;
  compareWindowMs?: number;
  now?: number;
  rootDir?: string;
  dbPath?: string;
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
};

const DEFAULT_WINDOW_MS = 3 * 60 * 60 * 1000;

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

  return {
    generatedAt: now,
    latestWindow: latest.window,
    precedingWindow: preceding.window,
    dbAvailable: latest.dbAvailable,
    latestTotals: latest.totals,
    precedingTotals: preceding.totals,
    latestSignals: latest.signals,
    regressions: regressions.slice(0, 10),
  };
}

export async function execute(
  ctx: WorkflowContext<RuntimePatternAuditInput>,
): Promise<ExecutionResult> {
  ctx.signal.throwIfAborted();
  const rootDir = ctx.workspace?.projectRoot || process.cwd();
  const packet = buildRuntimePatternAuditPacket({
    ...ctx.input,
    rootDir: ctx.input?.rootDir ?? rootDir,
  });
  ctx.signal.throwIfAborted();

  const summary =
    packet.latestSignals.length === 0 && packet.regressions.length === 0
      ? `Runtime pattern audit: 0 signals across ${packet.latestTotals.workflows} workflows (${packet.latestTotals.finishedRuns} runs in latest window)`
      : `Runtime pattern audit: ${packet.latestSignals.length} signal(s), ${packet.regressions.length} workflow delta(s) across ${packet.latestTotals.workflows} workflows`;

  return ctx.done(summary, packet as unknown as Record<string, unknown>);
}
