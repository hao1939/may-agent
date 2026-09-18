import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  configuredTaskReportRoot,
  isPublishedTaskReportPath,
  listTaskReports,
  ONGOING_TASK_RUBRIC_VERSION,
  readPublishedTaskReport,
  resolveTaskReportPath,
  TASK_OUTCOME_RUBRIC_VERSION,
  taskReportPaths,
  type AssessmentPurpose,
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

export type PublishedReportRequest = {
  appId: string;
  taskId: string;
  evidenceHash: string;
  executionId: string;
  report: string;
  facts: string;
  jsonHash: string;
  markdownHash: string;
  assessmentPurpose?: AssessmentPurpose;
  rubricVersion?: string;
  validityIdentity?: string;
};
export type PublishedReportRead =
  | { status: "publication-pending" }
  | { status: "invalid"; reason: string }
  | {
      status: "valid";
      jsonHash: string;
      markdownHash: string;
      facts: Record<string, unknown>;
    };

/** Public integrity boundary for consumers; staged bytes are never returned. */
export function readPublishedEvaluationReport(
  request: PublishedReportRequest,
  reportRoot = configuredTaskReportRoot(),
): PublishedReportRead {
  const assessmentPurpose = request.assessmentPurpose ?? "outcome";
  const rubricVersion = request.rubricVersion ?? TASK_OUTCOME_RUBRIC_VERSION;
  const validityIdentity = request.validityIdentity ?? "";
  if (
    (assessmentPurpose === "outcome" &&
      (rubricVersion !== TASK_OUTCOME_RUBRIC_VERSION || validityIdentity)) ||
    (assessmentPurpose === "ongoing" &&
      (rubricVersion !== ONGOING_TASK_RUBRIC_VERSION || !validityIdentity))
  )
    return {
      status: "invalid",
      reason: "publication purpose, rubric, and validity identity do not match",
    };
  const expected = taskReportPaths(
    request.appId,
    request.taskId,
    request.evidenceHash,
    rubricVersion,
    validityIdentity,
  );
  if (
    request.facts !== expected.jsonPath ||
    request.report !== expected.markdownPath
  )
    return {
      status: "invalid",
      reason: "publication paths do not match report identity",
    };
  const marker = resolveTaskReportPath(reportRoot, expected.publicationPath);
  if (!existsSync(marker)) return { status: "publication-pending" };
  const entry = readPublishedTaskReport(reportRoot, request.facts);
  if (
    !entry ||
    entry.appId !== request.appId ||
    entry.taskId !== request.taskId ||
    entry.evidenceHash !== request.evidenceHash ||
    entry.executionId !== request.executionId ||
    entry.purpose !== assessmentPurpose ||
    entry.rubricVersion !== rubricVersion ||
    entry.validityIdentity !== validityIdentity
  )
    return {
      status: "invalid",
      reason: "published report integrity check failed",
    };
  if (
    entry.jsonSha256 !== request.jsonHash ||
    entry.markdownSha256 !== request.markdownHash
  )
    return {
      status: "invalid",
      reason: "publication hashes do not match accepted bytes",
    };
  try {
    return {
      status: "valid",
      jsonHash: entry.jsonSha256,
      markdownHash: entry.markdownSha256,
      facts: JSON.parse(readFileSync(entry.absoluteJsonPath, "utf8")) as Record<
        string,
        unknown
      >,
    };
  } catch {
    return {
      status: "invalid",
      reason: "accepted report facts are unreadable",
    };
  }
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
