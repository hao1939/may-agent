import { createHash } from "node:crypto";

export type ReportRead =
  | { status: "publication-pending" }
  | { status: "invalid"; reason: string }
  | { status: "valid"; jsonHash: string; markdownHash: string };

export interface IntakeEvidence {
  appId: string;
  taskId: string;
  evidenceHash: string;
  jsonHash: string;
  markdownHash: string;
  read: ReportRead;
  currentEvidenceHash: string;
  recovered: boolean;
  prior?: { evidenceHash: string; disposition: string; linkedTaskId?: string };
}

export type IntakePlan = {
  disposition:
    | "retry-publication"
    | "invalid"
    | "stale"
    | "recovered"
    | "reuse"
    | "investigate";
  handoffKey?: string;
  linkedTaskId?: string;
};

/** Deterministic mechanics only; May owns the later judgment. */
export function planReportIntake(input: IntakeEvidence): IntakePlan {
  if (input.appId === "evaluation" || input.appId === "evaluation.app")
    return { disposition: "invalid" };
  if (input.read.status === "publication-pending")
    return { disposition: "retry-publication" };
  if (input.read.status === "invalid") return { disposition: "invalid" };
  if (
    input.read.jsonHash !== input.jsonHash ||
    input.read.markdownHash !== input.markdownHash
  )
    return { disposition: "invalid" };
  if (input.currentEvidenceHash !== input.evidenceHash)
    return { disposition: "stale" };
  if (input.recovered) return { disposition: "recovered" };
  if (input.prior?.evidenceHash === input.evidenceHash)
    return {
      disposition: "reuse",
      ...(input.prior.linkedTaskId
        ? { linkedTaskId: input.prior.linkedTaskId }
        : {}),
    };
  const handoffKey = createHash("sha256")
    .update(`${input.appId}\0${input.taskId}\0${input.evidenceHash}`)
    .digest("hex");
  return { disposition: "investigate", handoffKey };
}
