#!/usr/bin/env bun
/**
 * Deterministic Workflow Inventory & Runtime Health Audit
 *
 * Discovers all workflows across active Agent Apps (`projects/<app>.app/agents/<agent>/workflows/*.ts`),
 * audits their static contract, test pairing, wiring, and schedule declarations,
 * and (when a SQLite database is present) computes bounded runtime health telemetry
 * and anomaly signals from `workflow_runs` with zero LLM calls.
 */

import { Database } from "bun:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import * as ts from "typescript";

export type WorkflowStaticEntry = {
  appId: string;
  agent: string;
  name: string;
  path: string;
  pairedTestPath: string | null;
  isReexport: boolean;
  hasValidContract: boolean;
  contractErrors: string[];
  appBound: boolean;
  scheduledIntervalMs: number | null;
  scheduleEnabled: boolean;
  executionTimeoutMs: number | null;
};

export type WorkflowRuntimeStats = {
  finished: number;
  done: number;
  error: number;
  blocked: number;
  interrupted: number;
  running: number;
  successRate: number | null;
  meanDurationMs: number | null;
  maxDurationMs: number | null;
  lastEndedAt: number | null;
  recentFailedRunIds: string[];
};

export type WorkflowAuditSignal = {
  severity: "warning" | "attention";
  appId: string;
  agent: string;
  workflow: string;
  code:
    | "contract-invalid"
    | "high-error-rate"
    | "high-blocked-rate"
    | "timeout-approaching"
    | "schedule-overdue";
  summary: string;
  sampleRunIds?: string[];
};

export type WorkflowAuditEntry = WorkflowStaticEntry & {
  runtime: WorkflowRuntimeStats | null;
};

export type WorkflowAuditReport = {
  generatedAt: number;
  window: { start: number; end: number; windowMs: number };
  dbAvailable: boolean;
  totals: {
    workflows: number;
    canonicalWorkflows: number;
    reexportWorkflows: number;
    contractErrors: number;
    finishedRuns: number;
    doneRuns: number;
    errorRuns: number;
    blockedRuns: number;
    interruptedRuns: number;
    runningRuns: number;
  };
  workflows: WorkflowAuditEntry[];
  unregisteredRuns: Array<{
    appId: string;
    workflow: string;
    finished: number;
    error: number;
  }>;
  signals: WorkflowAuditSignal[];
};

export type AuditOptions = {
  rootDir?: string;
  dbPath?: string;
  now?: number;
  windowMs?: number;
};

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const IGNORED_DIRS = new Set([
  ".git",
  ".state",
  "archive",
  "artifacts",
  "node_modules",
  "workspace",
  "worktrees",
]);

function isDisabledRetiredApp(appDir: string): boolean {
  return existsSync(join(appDir, ".disabled")) && !existsSync(join(appDir, "app.ts"));
}

function collectAppFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectAppFiles(p));
    else if (
      /\.(?:ts|tsx|js|mjs|cjs|md|json)$/.test(entry.name) &&
      !/\.test\.[^.]+$/.test(entry.name)
    ) {
      files.push(p);
    }
  }
  return files;
}

const KNOWN_SCHEDULE_WORKFLOW_MAP: Record<string, Record<string, number>> = {
  alex: {
    "task-outcome-selector": 5 * 60 * 1000,
    "learn-from-daily-work": 24 * 60 * 60 * 1000,
  },
  "scout-knowledge-lib": {
    "library-health": 6 * 60 * 60 * 1000,
    "scout-daily-digest": 24 * 60 * 60 * 1000,
  },
};

export function discoverStaticWorkflows(rootDir = process.cwd()): WorkflowStaticEntry[] {
  const projectsRoot = join(rootDir, "projects");
  if (!existsSync(projectsRoot)) return [];
  const entries: WorkflowStaticEntry[] = [];

  for (const appEntry of readdirSync(projectsRoot).sort()) {
    if (!appEntry.endsWith(".app")) continue;
    const appDir = join(projectsRoot, appEntry);
    if (!statSync(appDir).isDirectory() || isDisabledRetiredApp(appDir)) continue;
    const appId = appEntry.slice(0, -".app".length);
    const agentsDir = join(appDir, "agents");
    if (!existsSync(agentsDir)) continue;

    const appManifest = join(appDir, "app.ts");
    const appText = existsSync(appManifest) ? readFileSync(appManifest, "utf8") : "";
    const boundWorkflows = new Set<string>();
    if (appText) {
      const appAst = ts.createSourceFile(appManifest, appText, ts.ScriptTarget.Latest, true);
      const extractLiterals = (expr: ts.Expression): string[] => {
        if (ts.isStringLiteralLike(expr)) return [expr.text];
        if (ts.isConditionalExpression(expr)) {
          return [...extractLiterals(expr.whenTrue), ...extractLiterals(expr.whenFalse)];
        }
        return [];
      };
      const visit = (node: ts.Node): void => {
        if (
          ts.isPropertyAssignment(node) &&
          ((ts.isIdentifier(node.name) && node.name.text === "workflow") ||
            (ts.isStringLiteralLike(node.name) && node.name.text === "workflow"))
        ) {
          for (const lit of extractLiterals(node.initializer)) boundWorkflows.add(lit);
        }
        ts.forEachChild(node, visit);
      };
      visit(appAst);
    }

    const reachabilityTexts = new Map<string, string>();
    for (const file of collectAppFiles(appDir)) {
      reachabilityTexts.set(file, readFileSync(file, "utf8"));
    }

    for (const agentEntry of readdirSync(agentsDir).sort()) {
      const workflowDir = join(agentsDir, agentEntry, "workflows");
      if (!existsSync(workflowDir) || !statSync(workflowDir).isDirectory()) continue;

      for (const workflowEntry of readdirSync(workflowDir).sort()) {
        if (!workflowEntry.endsWith(".ts") || workflowEntry.endsWith(".test.ts")) continue;
        if (workflowEntry.includes("-helpers") || workflowEntry.includes("-utils")) continue;

        const workflowPath = join(workflowDir, workflowEntry);
        const relPath = relative(rootDir, workflowPath).replaceAll("\\", "/");
        const slug = basename(workflowEntry, ".ts");
        const text = readFileSync(workflowPath, "utf8");
        const source = ts.createSourceFile(workflowPath, text, ts.ScriptTarget.Latest, true);

        let exportedName: string | undefined;
        let hasNameExport = false;
        let hasDescriptionExport = false;
        let hasEmptyDescription = false;
        let hasExecuteExport = false;
        let isPureReexport = true;
        let executionTimeoutMs: number | null = null;

        for (const stmt of source.statements) {
          if (ts.isExportDeclaration(stmt)) {
            if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
              for (const el of stmt.exportClause.elements) {
                const exported = el.name.text;
                if (exported === "name") hasNameExport = true;
                if (exported === "description") hasDescriptionExport = true;
                if (exported === "execute") hasExecuteExport = true;
              }
            }
            continue;
          }
          if (ts.isImportDeclaration(stmt)) continue;
          isPureReexport = false;
          const isExported =
            ts.canHaveModifiers(stmt) &&
            ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
          if (!isExported) continue;

          if (ts.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
              if (!ts.isIdentifier(decl.name)) continue;
              if (decl.name.text === "name") {
                hasNameExport = true;
                if (decl.initializer && ts.isStringLiteralLike(decl.initializer)) {
                  exportedName = decl.initializer.text;
                }
              } else if (decl.name.text === "description") {
                hasDescriptionExport = true;
                if (
                  decl.initializer &&
                  ts.isStringLiteralLike(decl.initializer) &&
                  decl.initializer.text.trim().length === 0
                ) {
                  hasEmptyDescription = true;
                }
              } else if (decl.name.text === "execute") {
                hasExecuteExport = true;
              } else if (
                decl.name.text === "executionTimeoutMs" &&
                decl.initializer &&
                ts.isNumericLiteral(decl.initializer)
              ) {
                const parsed = Number(decl.initializer.text.replaceAll("_", ""));
                if (Number.isFinite(parsed) && parsed > 0) executionTimeoutMs = parsed;
              }
            }
          } else if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === "execute") {
            hasExecuteExport = true;
          }
        }

        const contractErrors: string[] = [];
        if (!hasNameExport) {
          contractErrors.push("missing exported const name");
        } else if (exportedName !== undefined && exportedName !== slug) {
          contractErrors.push(`exported name "${exportedName}" does not match slug "${slug}"`);
        }
        if (!hasDescriptionExport || hasEmptyDescription) {
          contractErrors.push("missing or empty exported description");
        }
        if (!hasExecuteExport) {
          contractErrors.push("missing exported execute(ctx)");
        }

        const pairedTestFull = join(workflowDir, `${slug}.test.ts`);
        const hasPairedTest = existsSync(pairedTestFull);
        if (!isPureReexport && !hasPairedTest) {
          contractErrors.push(`missing paired unit test ${slug}.test.ts`);
        }

        let referenced = false;
        for (const [file, fileText] of reachabilityTexts.entries()) {
          if (file === workflowPath) continue;
          if (fileText.includes(slug)) {
            referenced = true;
            break;
          }
        }
        if (!referenced) {
          contractErrors.push(`orphan workflow "${slug}" not referenced in App or agent docs`);
        }

        const scheduledIntervalMs = KNOWN_SCHEDULE_WORKFLOW_MAP[appId]?.[slug] ?? null;
        const scheduleEnabled =
          scheduledIntervalMs !== null &&
          !(
            appId === "alex" &&
            slug === "task-outcome-selector" &&
            process.env.EVALUATION_AUTO_REVIEW_ENABLED === "false"
          );

        entries.push({
          appId,
          agent: agentEntry,
          name: exportedName ?? slug,
          path: relPath,
          pairedTestPath: hasPairedTest
            ? relative(rootDir, pairedTestFull).replaceAll("\\", "/")
            : null,
          isReexport: isPureReexport,
          hasValidContract: contractErrors.length === 0,
          contractErrors,
          appBound: boundWorkflows.has(slug),
          scheduledIntervalMs,
          scheduleEnabled,
          executionTimeoutMs,
        });
      }
    }
  }

  return entries;
}

export function auditWorkflows(options: AuditOptions = {}): WorkflowAuditReport {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const now = options.now ?? Date.now();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const start = now - windowMs;
  const end = now;
  const dbPath = resolve(options.dbPath ?? join(rootDir, ".state", "may.db"));

  const staticWorkflows = discoverStaticWorkflows(rootDir);
  const signals: WorkflowAuditSignal[] = [];

  for (const wf of staticWorkflows) {
    if (!wf.hasValidContract) {
      signals.push({
        severity: "attention",
        appId: wf.appId,
        agent: wf.agent,
        workflow: wf.name,
        code: "contract-invalid",
        summary: `${wf.path}: ${wf.contractErrors.join("; ")}`,
      });
    }
  }

  let dbAvailable = false;
  const runtimeByAppWorkflow = new Map<string, WorkflowRuntimeStats>();
  const unregisteredRuns: WorkflowAuditReport["unregisteredRuns"] = [];

  let totalFinished = 0;
  let totalDone = 0;
  let totalError = 0;
  let totalBlocked = 0;
  let totalInterrupted = 0;
  let totalRunning = 0;

  if (existsSync(dbPath)) {
    let db: Database | undefined;
    try {
      db = new Database(dbPath, { readonly: true });
      const hasTable = db
        .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'workflow_runs'")
        .get();
      if (hasTable) {
        dbAvailable = true;
        const rows = db
          .query(
            `SELECT
              COALESCE(app_id, projectId, '') AS appId,
              workflow,
              COUNT(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') AND endedAt >= ? AND endedAt < ? THEN 1 END) AS finished,
              COUNT(CASE WHEN status = 'done' AND endedAt >= ? AND endedAt < ? THEN 1 END) AS done,
              COUNT(CASE WHEN status = 'error' AND endedAt >= ? AND endedAt < ? THEN 1 END) AS error,
              COUNT(CASE WHEN status = 'blocked' AND endedAt >= ? AND endedAt < ? THEN 1 END) AS blocked,
              COUNT(CASE WHEN status = 'interrupted' AND endedAt >= ? AND endedAt < ? THEN 1 END) AS interrupted,
              COUNT(CASE WHEN status = 'running' THEN 1 END) AS running,
              AVG(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') AND endedAt >= ? AND endedAt < ? AND startedAt >= 0 AND endedAt >= startedAt THEN endedAt - startedAt END) AS meanDurationMs,
              MAX(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') AND endedAt >= ? AND endedAt < ? AND startedAt >= 0 AND endedAt >= startedAt THEN endedAt - startedAt END) AS maxDurationMs,
              MAX(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') THEN endedAt END) AS lastEndedAt
            FROM workflow_runs
            GROUP BY COALESCE(app_id, projectId, ''), workflow`,
          )
          .all(
            start,
            end,
            start,
            end,
            start,
            end,
            start,
            end,
            start,
            end,
            start,
            end,
            start,
            end,
          ) as Array<{
          appId: string;
          workflow: string;
          finished: number;
          done: number;
          error: number;
          blocked: number;
          interrupted: number;
          running: number;
          meanDurationMs: number | null;
          maxDurationMs: number | null;
          lastEndedAt: number | null;
        }>;

        const failedSamplesStmt = db.prepare(
          `SELECT runId FROM workflow_runs
           WHERE COALESCE(app_id, projectId, '') = ?
             AND workflow = ?
             AND status IN ('error', 'blocked')
             AND endedAt >= ? AND endedAt < ?
           ORDER BY endedAt DESC, runId DESC
           LIMIT 3`,
        );

        const knownKeys = new Set(staticWorkflows.map((w) => `${w.appId}:${w.name}`));

        for (const r of rows) {
          const key = `${r.appId}:${r.workflow}`;
          const failedRuns =
            r.error + r.blocked > 0
              ? (
                  failedSamplesStmt.all(r.appId, r.workflow, start, end) as Array<{
                    runId: string;
                  }>
                ).map((item) => item.runId)
              : [];

          const stats: WorkflowRuntimeStats = {
            finished: r.finished,
            done: r.done,
            error: r.error,
            blocked: r.blocked,
            interrupted: r.interrupted,
            running: r.running,
            successRate: r.finished > 0 ? r.done / r.finished : null,
            meanDurationMs: r.meanDurationMs !== null ? Math.round(r.meanDurationMs) : null,
            maxDurationMs: r.maxDurationMs !== null ? Math.round(r.maxDurationMs) : null,
            lastEndedAt: r.lastEndedAt ?? null,
            recentFailedRunIds: failedRuns,
          };

          totalFinished += r.finished;
          totalDone += r.done;
          totalError += r.error;
          totalBlocked += r.blocked;
          totalInterrupted += r.interrupted;
          totalRunning += r.running;

          if (knownKeys.has(key)) {
            runtimeByAppWorkflow.set(key, stats);
          } else if (r.finished > 0) {
            unregisteredRuns.push({
              appId: r.appId || "(unscoped)",
              workflow: r.workflow,
              finished: r.finished,
              error: r.error,
            });
          }
        }
      }
    } finally {
      db?.close();
    }
  }

  const workflows: WorkflowAuditEntry[] = staticWorkflows.map((wf) => {
    const key = `${wf.appId}:${wf.name}`;
    const runtime: WorkflowRuntimeStats | null = dbAvailable
      ? (runtimeByAppWorkflow.get(key) ?? {
          finished: 0,
          done: 0,
          error: 0,
          blocked: 0,
          interrupted: 0,
          running: 0,
          successRate: null,
          meanDurationMs: null,
          maxDurationMs: null,
          lastEndedAt: null,
          recentFailedRunIds: [],
        })
      : null;

    if (runtime && !wf.isReexport) {
      if (runtime.finished >= 3 && runtime.error / runtime.finished >= 0.25) {
        signals.push({
          severity: "attention",
          appId: wf.appId,
          agent: wf.agent,
          workflow: wf.name,
          code: "high-error-rate",
          summary: `${wf.appId}/${wf.name} had ${runtime.error}/${runtime.finished} error runs (${Math.round((runtime.error / runtime.finished) * 100)}%) in window`,
          sampleRunIds: runtime.recentFailedRunIds,
        });
      } else if (runtime.finished >= 3 && runtime.blocked / runtime.finished >= 0.5) {
        signals.push({
          severity: "warning",
          appId: wf.appId,
          agent: wf.agent,
          workflow: wf.name,
          code: "high-blocked-rate",
          summary: `${wf.appId}/${wf.name} had ${runtime.blocked}/${runtime.finished} blocked runs (${Math.round((runtime.blocked / runtime.finished) * 100)}%) in window`,
          sampleRunIds: runtime.recentFailedRunIds,
        });
      }

      if (
        wf.executionTimeoutMs !== null &&
        runtime.maxDurationMs !== null &&
        runtime.maxDurationMs >= wf.executionTimeoutMs * 0.85
      ) {
        signals.push({
          severity: "warning",
          appId: wf.appId,
          agent: wf.agent,
          workflow: wf.name,
          code: "timeout-approaching",
          summary: `${wf.appId}/${wf.name} max duration (${runtime.maxDurationMs}ms) reached >=85% of executionTimeoutMs (${wf.executionTimeoutMs}ms)`,
        });
      }

      if (
        wf.scheduledIntervalMs !== null &&
        wf.scheduleEnabled &&
        runtime.lastEndedAt !== null &&
        now - runtime.lastEndedAt > wf.scheduledIntervalMs * 3
      ) {
        const overdueHours = ((now - runtime.lastEndedAt) / 3_600_000).toFixed(1);
        signals.push({
          severity: "warning",
          appId: wf.appId,
          agent: wf.agent,
          workflow: wf.name,
          code: "schedule-overdue",
          summary: `${wf.appId}/${wf.name} last finished ${overdueHours}h ago (expected interval ${(wf.scheduledIntervalMs / 60_000).toFixed(0)}m)`,
        });
      }
    }

    return {
      ...wf,
      runtime,
    };
  });

  return {
    generatedAt: now,
    window: { start, end, windowMs },
    dbAvailable,
    totals: {
      workflows: staticWorkflows.length,
      canonicalWorkflows: staticWorkflows.filter((w) => !w.isReexport).length,
      reexportWorkflows: staticWorkflows.filter((w) => w.isReexport).length,
      contractErrors: staticWorkflows.reduce((acc, w) => acc + w.contractErrors.length, 0),
      finishedRuns: totalFinished,
      doneRuns: totalDone,
      errorRuns: totalError,
      blockedRuns: totalBlocked,
      interruptedRuns: totalInterrupted,
      runningRuns: totalRunning,
    },
    workflows,
    unregisteredRuns,
    signals,
  };
}

export function formatWorkflowAuditMarkdown(report: WorkflowAuditReport): string {
  const lines: string[] = [
    "# Workflow Audit Report",
    "",
    `**Generated:** ${new Date(report.generatedAt).toISOString()}`,
    `**Window:** ${(report.window.windowMs / 3_600_000).toFixed(1)}h (` +
      `${new Date(report.window.start).toISOString()} -> ${new Date(report.window.end).toISOString()})`,
    `**SQLite Runtime Telemetry:** ${report.dbAvailable ? "available" : "unavailable (static contract audit only)"}`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Registered Workflows | ${report.totals.workflows} (${report.totals.canonicalWorkflows} canonical, ${report.totals.reexportWorkflows} re-exports) |`,
    `| Contract Errors | ${report.totals.contractErrors} |`,
    `| Finished Runs (Window) | ${report.totals.finishedRuns} (done: ${report.totals.doneRuns}, error: ${report.totals.errorRuns}, blocked: ${report.totals.blockedRuns}, interrupted: ${report.totals.interruptedRuns}) |`,
    `| Signals | ${report.signals.length} |`,
    "",
    "## Workflows by App & Agent",
    "",
    "| App | Agent | Workflow | Kind | Contract | Test Paired | Finished (Window) | Done | Error | Blocked | Mean ms |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const wf of report.workflows) {
    const kind = wf.isReexport ? "re-export" : wf.appBound ? "app-bound" : "helper/tool";
    const contract = wf.hasValidContract ? "OK" : `ERR (${wf.contractErrors.length})`;
    const testPaired = wf.isReexport ? "n/a" : wf.pairedTestPath ? "yes" : "NO";
    const r = wf.runtime;
    const finished = r ? String(r.finished) : "-";
    const done = r ? String(r.done) : "-";
    const error = r ? String(r.error) : "-";
    const blocked = r ? String(r.blocked) : "-";
    const meanMs = r && r.meanDurationMs !== null ? String(r.meanDurationMs) : "-";
    lines.push(
      `| ${wf.appId} | ${wf.agent} | \`${wf.name}\` | ${kind} | ${contract} | ${testPaired} | ${finished} | ${done} | ${error} | ${blocked} | ${meanMs} |`,
    );
  }

  lines.push("");
  lines.push("## Signals");
  lines.push("");
  if (report.signals.length === 0) {
    lines.push("No contract errors or runtime workflow anomalies detected in the selected window.");
  } else {
    for (const sig of report.signals) {
      const samples =
        sig.sampleRunIds && sig.sampleRunIds.length > 0
          ? ` (runs: ${sig.sampleRunIds.map((id) => `\`${id}\``).join(", ")})`
          : "";
      lines.push(`- **[${sig.severity.toUpperCase()}]** \`${sig.code}\`: ${sig.summary}${samples}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const wantJson = args.includes("--json");
  const wantMarkdown = args.includes("--markdown");
  const strict = args.includes("--strict");
  const hoursIdx = args.indexOf("--hours");
  const hours = hoursIdx >= 0 && args[hoursIdx + 1] ? Number(args[hoursIdx + 1]) : 24;
  const windowMs = Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : DEFAULT_WINDOW_MS;

  const report = auditWorkflows({ windowMs });
  if (wantJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (wantMarkdown) {
    process.stdout.write(formatWorkflowAuditMarkdown(report));
  } else {
    console.log(formatWorkflowAuditMarkdown(report));
  }

  if (report.totals.contractErrors > 0 || (strict && report.signals.some((s) => s.severity === "attention"))) {
    process.exitCode = 1;
  }
}
