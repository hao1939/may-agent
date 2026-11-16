#!/usr/bin/env bun
/**
 * Canonical Workflow Audit wrapper (formerly legacy workflow-fork divergence report).
 *
 * The legacy `projects/<id>/workflows/<id>-iteration.ts` fork model has been
 * retired in favor of Agent App workflows (`projects/<app>.app/agents/<agent>/workflows/*.ts`).
 * This entrypoint delegates to `scripts/audit-workflows.ts` while preserving
 * `--json` and human-readable CLI flags.
 */

import { auditWorkflows, formatWorkflowAuditMarkdown } from "./audit-workflows.ts";

const args = new Set(process.argv.slice(2));
const wantJson = args.has("--json");

const report = auditWorkflows();
if (wantJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatWorkflowAuditMarkdown(report));
}
if (report.totals.contractErrors > 0) {
  process.exitCode = 1;
}
