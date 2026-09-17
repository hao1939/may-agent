import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  configuredTaskReportRoot,
  isPublishedTaskReportPath,
  listTaskReports,
  resolveTaskReportPath,
} from "./lib/task-report-store.js";

export const name = "evaluation-report-reader";
export const description =
  "List or read retained Evaluation reports without starting a new evaluation.";

type Input = { operation?: string; path?: string; limit?: number };
const MAX_LIST_ITEMS = 5;
const MAX_PREVIEW_BYTES = 8_000;
const MAX_PREVIEW_JSON_BYTES = 8_000;
const MAX_RESULT_BYTES = 9_000;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function boundedPreview(bytes: Buffer): string {
  const source = bytes.subarray(0, MAX_PREVIEW_BYTES).toString("utf8");
  let low = 0;
  let high = source.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (
      Buffer.byteLength(JSON.stringify(source.slice(0, middle))) <=
      MAX_PREVIEW_JSON_BYTES
    )
      low = middle;
    else high = middle - 1;
  }
  return source.slice(0, low);
}

export async function readEvaluationReports(
  ctx: WorkflowContext<Input>,
  reportRoot = configuredTaskReportRoot(),
): Promise<ExecutionResult> {
  const operation = text(ctx.input?.operation) || "list";
  if (operation === "list") {
    const requested = Number(ctx.input?.limit) || MAX_LIST_ITEMS;
    const discovered = listTaskReports(
      reportRoot,
      Math.min(MAX_LIST_ITEMS, requested),
    );
    const reports = [] as typeof discovered;
    for (const report of discovered) {
      const candidate = [...reports, report];
      if (Buffer.byteLength(JSON.stringify(candidate)) > MAX_RESULT_BYTES)
        break;
      reports.push(report);
    }
    const summary = reports.length
      ? `Found ${reports.length} retained Evaluation report(s).`
      : "No retained Evaluation task-outcome reports were found.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      response: summary,
      result: { reports },
      facts: reports.map(
        (item) =>
          `report:${item.appId}/${item.taskId}:${item.evidenceHash}:${item.markdownPath}`,
      ),
      actions: [],
    });
  }
  if (operation !== "read")
    return ctx.blocked(`Unsupported report operation: ${operation}`);
  const path = text(ctx.input?.path);
  if (path.length > 512)
    return ctx.blocked("Report path exceeds 512 characters.");
  try {
    if (!isPublishedTaskReportPath(reportRoot, path))
      return ctx.blocked("Report is not an accepted published report.");
    const absolute = resolveTaskReportPath(reportRoot, path);
    const bytes = readFileSync(absolute);
    const content = boundedPreview(bytes);
    const truncated = Buffer.byteLength(content) < bytes.byteLength;
    const hash = createHash("sha256").update(bytes).digest("hex");
    const summary = `Read retained Evaluation report ${path}${truncated ? " (bounded preview; use the canonical path for full content)" : ""}.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      response: summary,
      result: {
        path,
        absolutePath: absolute,
        content,
        bytes: bytes.byteLength,
        sha256: hash,
        truncated,
        continuation: truncated
          ? { offset: Buffer.byteLength(content), path: absolute }
          : null,
      },
      facts: [
        `report-read:${path}`,
        `report-bytes:${bytes.byteLength}`,
        `report-sha256:${hash}`,
      ],
      actions: [],
    });
  } catch (error) {
    return ctx.blocked(
      `Unable to read retained Evaluation report: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  return readEvaluationReports(ctx);
}
