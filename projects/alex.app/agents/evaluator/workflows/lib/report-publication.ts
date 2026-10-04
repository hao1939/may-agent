import type { WorkflowContext } from "@may-agent/sdk";
import type { PublishedReportRequest } from "../evaluation-report-reader.js";
import { existsSync } from "node:fs";
import {
  markTaskReportPublished,
  readPublishedTaskReport,
  resolveTaskReportPath,
} from "./task-report-store.js";

/** Task and metric assessments share the same immutable publication boundary. */
export async function publishRetainedReport(
  ctx: WorkflowContext<any>,
  event: {
    type: string;
    localKey: string;
    data: PublishedReportRequest & Record<string, unknown>;
    target: { appId: string };
  },
  reportRoot: string,
  replayPublished = false,
) {
  const publication = event.data;
  const existing = readPublishedTaskReport(reportRoot, publication.facts);
  if (existing) {
    if (
      existing.jsonSha256 !== publication.jsonHash ||
      existing.markdownSha256 !== publication.markdownHash
    )
      throw new Error("Retained publication differs from the requested bytes");
    if (replayPublished) await ctx.events.emit(event);
    return;
  }
  const markerPath = publication.facts.replace(/\.json$/, ".published.json");
  if (existsSync(resolveTaskReportPath(reportRoot, markerPath)))
    throw new Error("Retained publication marker failed integrity checks");
  await ctx.events.emit(event);
  markTaskReportPublished(reportRoot, {
    appId: publication.appId,
    taskId: publication.taskId,
    metricId: publication.metricId,
    evidenceHash: publication.evidenceHash,
    executionId: publication.executionId,
    reviewer: publication.reviewer,
    rubricVersion: publication.rubricVersion,
    validityIdentity: publication.validityIdentity,
    jsonPath: publication.facts,
    markdownPath: publication.report,
    jsonSha256: publication.jsonHash,
    markdownSha256: publication.markdownHash,
  });
}
