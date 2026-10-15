import type { WorkflowContext } from "@may-agent/sdk";
import type { PublishedReportRequest } from "../evaluation-report-reader.js";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readReportFollowUp } from "./report-follow-up.js";
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
  // Recover the same decision from the immutable report on every publication
  // attempt. Legacy reports keep their original event bytes and routing.
  const bytes = readFileSync(resolveTaskReportPath(reportRoot, publication.facts));
  if (createHash("sha256").update(bytes).digest("hex") !== publication.jsonHash)
    throw new Error("Retained publication differs from the requested bytes");
  const payload = JSON.parse(bytes.toString("utf8"));
  const followUp = readReportFollowUp(payload.judgment?.followUp);
  const publicationEvent = followUp === undefined
    ? event
    : { ...event, data: { ...event.data, followUp } };
  const existing = readPublishedTaskReport(reportRoot, publication.facts);
  if (existing) {
    if (
      existing.jsonSha256 !== publication.jsonHash ||
      existing.markdownSha256 !== publication.markdownHash
    )
      throw new Error("Retained publication differs from the requested bytes");
    if (replayPublished) await ctx.events.emit(publicationEvent);
    return;
  }
  const markerPath = publication.facts.replace(/\.json$/, ".published.json");
  if (existsSync(resolveTaskReportPath(reportRoot, markerPath)))
    throw new Error("Retained publication marker failed integrity checks");
  await ctx.events.emit(publicationEvent);
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
