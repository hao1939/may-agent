import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "daily-ops-digest";
export const description =
  "Deterministic daily platform alert digest. Writes a human-readable report, notifies the human, and wakes the project owner when the digest needs owner judgment.";

type Row = Record<string, unknown>;

type AlertRow = Row & {
  id: number;
  metric_id: string;
  message: string;
  created_at: number;
  resolved_at: number | null;
  owner: string;
  priority: string;
  current: number;
  threshold: number;
  alert_op: string;
  name: string;
};

type MetricGroup = {
  metricId: string;
  name: string;
  owner: string;
  priority: string;
  alerts: AlertRow[];
  open: number;
  resolved: number;
};

function field(task: string, name: string): string | undefined {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, "m");
  return task.match(pattern)?.[1]?.trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function dateId(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function age(ms: number, now = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function parseJson(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Row;
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Row)
      : {};
  } catch {
    return {};
  }
}

function queryRows(
  ctx: WorkflowContext,
  sql: string,
  params: unknown[],
): Row[] {
  try {
    return ctx.query.sql(sql, params, { limit: 500 }).rows;
  } catch (error) {
    ctx.log(
      `daily-ops-digest query failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

function alertFromRow(row: Row): AlertRow {
  return {
    ...row,
    id: numberValue(row.id),
    metric_id: stringValue(row.metric_id),
    message: stringValue(row.message),
    created_at: numberValue(row.created_at),
    resolved_at:
      row.resolved_at === null || row.resolved_at === undefined
        ? null
        : numberValue(row.resolved_at),
    owner: stringValue(row.owner),
    priority: stringValue(row.priority) || "P3",
    current: numberValue(row.current),
    threshold: numberValue(row.threshold),
    alert_op: stringValue(row.alert_op),
    name: stringValue(row.name) || stringValue(row.metric_id),
  };
}

function groupAlerts(alerts: AlertRow[]): MetricGroup[] {
  const groups = new Map<string, MetricGroup>();
  for (const alert of alerts) {
    const existing = groups.get(alert.metric_id);
    const group = existing ?? {
      metricId: alert.metric_id,
      name: alert.name,
      owner: alert.owner,
      priority: alert.priority,
      alerts: [],
      open: 0,
      resolved: 0,
    };
    group.alerts.push(alert);
    if (alert.resolved_at === null) group.open += 1;
    else group.resolved += 1;
    if (!existing) groups.set(alert.metric_id, group);
  }
  return [...groups.values()].sort((a, b) => b.alerts.length - a.alerts.length);
}

function markdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "None.";
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function summarizeEventCounts(rows: Row[]): string {
  if (rows.length === 0) return "None.";
  return rows
    .map((row) => `- ${stringValue(row.event_type)}: ${numberValue(row.count)}`)
    .join("\n");
}

function latestJudgmentsByMetric(rows: Row[]): Map<string, Row> {
  const result = new Map<string, Row>();
  for (const row of rows) {
    const data = parseJson(row.data);
    const metricId = stringValue(data.metricId);
    if (metricId && !result.has(metricId)) {
      result.set(metricId, {
        id: row.id,
        timestamp: row.timestamp,
        owner: row.owner,
        ...data,
      });
    }
  }
  return result;
}

function reportFor(ctx: WorkflowContext): {
  summary: string;
  reportPath: string;
  signal: Row;
} {
  const appDir =
    ctx.appDir ?? field(ctx.task, "app") ?? "/app/projects/may-agent.app";
  const now = Date.now();
  const since = now - 24 * 60 * 60_000;
  const day = dateId(new Date(now));

  const alertRows = queryRows(
    ctx,
    `SELECT ma.id, ma.metric_id, ma.alert_type, ma.message, ma.created_at,
            ma.resolved_at, m.name, m.owner, m.priority, m.current,
            m.threshold, m.alert_op
       FROM metric_alerts ma
       LEFT JOIN metrics m ON m.id = ma.metric_id
      WHERE ma.created_at >= ?
         OR ma.resolved_at IS NULL
      ORDER BY ma.created_at DESC, ma.id DESC`,
    [since],
  );
  const alerts = alertRows.map(alertFromRow);
  const groups = groupAlerts(alerts);
  const openAlerts = alerts.filter((alert) => alert.resolved_at === null);
  const missingOwnerGroups = groups.filter((group) => !group.owner);
  const noisyGroups = groups.filter((group) => group.alerts.length >= 3);

  const eventCounts = queryRows(
    ctx,
    `SELECT event_type, COUNT(*) as count
       FROM events
      WHERE timestamp >= ?
        AND event_type IN (
          'metric.breach',
          'metric.recovered',
          'metric.alert_judged',
          'handler.failed',
          'message.delivery_failed',
          'session.resume_failed'
        )
      GROUP BY event_type
      ORDER BY count DESC, event_type ASC`,
    [since],
  );

  const judgmentRows = queryRows(
    ctx,
    `SELECT id, event_type, owner, timestamp, data
       FROM events
      WHERE timestamp >= ?
        AND event_type = 'metric.alert_judged'
      ORDER BY timestamp DESC, id DESC`,
    [since],
  );
  const latestJudgments = latestJudgmentsByMetric(judgmentRows);

  const remediationRows = queryRows(
    ctx,
    `SELECT runId, workflow, status, startedAt, endedAt, result_summary
       FROM workflow_runs
      WHERE startedAt >= ?
        AND workflow IN (
          'metric-alert-triage',
          'platform-owner-review'
        )
      ORDER BY startedAt DESC`,
    [since],
  );

  const reportDir = join(appDir, ".state", "daily-ops-digests");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `${day}-alert-review.md`);

  const summary = `${alerts.length} alert(s) reviewed, ${openAlerts.length} open, ${noisyGroups.length} noisy metric group(s), ${missingOwnerGroups.length} missing owner group(s).`;
  const openTable = markdownTable(
    [
      "#",
      "Metric",
      "Priority",
      "Owner",
      "Age",
      "Current",
      "Threshold",
      "Status",
    ],
    openAlerts.map((alert) => [
      String(alert.id),
      alert.metric_id,
      alert.priority,
      alert.owner || "missing",
      age(alert.created_at, now),
      String(alert.current),
      `${alert.alert_op || ">"} ${alert.threshold}`,
      "open",
    ]),
  );
  const activityTable = markdownTable(
    ["Metric", "Alerts", "Resolved", "Open", "Owner", "Assessment"],
    groups.map((group) => {
      const latest = latestJudgments.get(group.metricId);
      const assessment =
        group.open > 0
          ? "needs closure"
          : group.alerts.length >= 3
            ? "noisy"
            : "normal";
      const judgment = latest
        ? `latest judgment: ${stringValue(latest.operation) || stringValue(latest.verdict) || "recorded"}`
        : "no judgment in window";
      return [
        group.metricId,
        String(group.alerts.length),
        String(group.resolved),
        String(group.open),
        group.owner || "missing",
        `${assessment}; ${judgment}`,
      ];
    }),
  );
  const remediationTable = markdownTable(
    ["Run", "Workflow", "Status", "Summary"],
    remediationRows
      .slice(0, 12)
      .map((row) => [
        stringValue(row.runId),
        stringValue(row.workflow),
        stringValue(row.status),
        stringValue(row.result_summary).replace(/\|/g, "\\|").slice(0, 160),
      ]),
  );

  const report = [
    `# Daily Ops Digest - ${day}`,
    "",
    "## Executive Summary",
    "",
    summary,
    "",
    "## Open Alerts",
    "",
    openTable,
    "",
    "## Alert Activity by Metric",
    "",
    activityTable,
    "",
    "## Event Correlation",
    "",
    summarizeEventCounts(eventCounts),
    "",
    "## Remediation Activity",
    "",
    remediationTable,
    "",
    "## Owner Follow-up",
    "",
    openAlerts.length > 0 ||
    noisyGroups.length > 0 ||
    missingOwnerGroups.length > 0
      ? [
          "- The project owner should review open alerts, noisy metrics, or missing owners.",
          "- Record closure as metric recovery, metric alert judgment, accepted exception, or a finite may-agent.app task.",
        ].join("\n")
      : "No owner action required from this digest.",
    "",
  ].join("\n");

  writeFileSync(reportPath, report, "utf8");
  appendFileSync(
    join(appDir, ".state", "daily-ops-digests.jsonl"),
    `${JSON.stringify({
      generated_at: new Date(now).toISOString(),
      reportPath,
      alertCount: alerts.length,
      openAlertCount: openAlerts.length,
      noisyMetricCount: noisyGroups.length,
      missingOwnerCount: missingOwnerGroups.length,
    })}\n`,
    "utf8",
  );

  return {
    summary,
    reportPath,
    signal: {
      reportPath,
      alertCount: alerts.length,
      openAlertCount: openAlerts.length,
      noisyMetricCount: noisyGroups.length,
      missingOwnerCount: missingOwnerGroups.length,
      openAlerts: openAlerts.slice(0, 8).map((alert) => ({
        id: alert.id,
        metricId: alert.metric_id,
        owner: alert.owner,
        priority: alert.priority,
        age: age(alert.created_at, now),
        message: alert.message,
      })),
      noisyMetrics: noisyGroups.slice(0, 8).map((group) => ({
        metricId: group.metricId,
        owner: group.owner,
        priority: group.priority,
        alerts: group.alerts.length,
        open: group.open,
      })),
    },
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const { summary, reportPath, signal } = reportFor(ctx);

  ctx.emit({
    type: "project.ops_digest.created",
    project: "may-agent",
    ...signal,
  });

  ctx.notify(
    [`Daily ops digest: ${summary}`, `Report: ${reportPath}`].join("\n"),
  );

  if (
    numberValue(signal.openAlertCount) > 0 ||
    numberValue(signal.noisyMetricCount) > 0 ||
    numberValue(signal.missingOwnerCount) > 0
  ) {
    ctx.emit({
      type: "project.owner.requested",
      project: "may-agent",
      reason: "daily-ops-digest",
      params: signal,
    });
  }

  const resultSummary = `Daily ops digest generated: ${summary}`;
  return ctx.done(resultSummary, {
    state: "converged",
    summary: resultSummary,
    evidence: [`report:${reportPath}`],
    actions: [],
  });
}
