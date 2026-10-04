import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import { emitGymEvent, gymAppRoot, gymEvent } from "./lib/context";
import { extractTrigger, safeKey } from "./lib/trigger";

export const name = "evaluation-intake";
export const description =
  "Preserve the durable May evaluation fact that triggered this canonical task attempt.";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
}

function evaluationIdentity(details: Record<string, unknown>): string {
  const raw = details.reviewSessionId ?? details.sessionId ?? details.id;
  const fallback = createHash("sha256")
    .update(JSON.stringify(details))
    .digest("hex")
    .slice(0, 20);
  return safeKey(raw, `evaluation-${fallback}`);
}

type EvaluationEmission = "incident-review-requested";

export function evaluationEmissionLocalKey(
  details: Record<string, unknown>,
  emission: EvaluationEmission,
): string {
  const identityHash = createHash("sha256")
    .update(evaluationIdentity(details))
    .digest("hex")
    .slice(0, 20);
  return `evaluation-${identityHash}-${emission}`;
}

function isFailure(details: Record<string, unknown>): boolean {
  const lane = String(details.lane ?? "").toLowerCase();
  const reviewedVerdict = String(details.reviewedVerdict ?? "").toLowerCase();
  const verdict = String(details.verdict ?? "").toLowerCase();
  const failureVerdicts = [
    "fail",
    "failed",
    "partial",
    "poor",
    "needs_improvement",
    "blocked",
  ];
  if (reviewedVerdict) return failureVerdicts.includes(reviewedVerdict);
  return lane === "needs_triage" || failureVerdicts.includes(verdict);
}

function writeLearningEvidence(
  appDir: string,
  details: Record<string, unknown>,
  polarity: "positive" | "negative",
): string {
  const key = evaluationIdentity(details);
  const path = join(appDir, ".state", "learning", "evidence", `${key}.json`);
  if (!existsSync(path)) {
    writeJsonAtomic(path, {
      schema_version: 1,
      evidence_id: key,
      source_identity: key,
      captured_at: new Date().toISOString(),
      polarity,
      status: "unclassified",
      source: details,
    });
  }
  return path;
}

function writeIncident(
  appDir: string,
  details: Record<string, unknown>,
): { id: string; path: string } {
  const identity = evaluationIdentity(details);
  const id = safeKey(identity, "incident");
  const path = join(appDir, ".state", "incidents", `${id}.json`);
  if (!existsSync(path)) {
    writeJsonAtomic(path, {
      schema_version: 1,
      incident_id: id,
      source_identity: identity,
      captured_at: new Date().toISOString(),
      status: "needs-review",
      source: details,
    });
  }
  return { id, path };
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const appDir = gymAppRoot(ctx);
  const trigger = extractTrigger(ctx);
  if (!trigger || trigger.type !== "evaluation.recorded") {
    return ctx.blocked(
      "Evaluation intake requires its canonical evaluation.recorded trigger",
    );
  }
  const data = record(trigger.data);
  const details = {
    ...record(trigger.target),
    ...record(data.evaluation),
    ...data,
    ...record(data.params),
  };
  const agent = String(details.agent ?? "").toLowerCase();
  if (agent !== "may") {
    return ctx.blocked("Evaluation intake received a non-May evaluation", {
      agent,
    });
  }
  const evidence: string[] = [];
  const failure = isFailure(details);
  evidence.push(
    writeLearningEvidence(appDir, details, failure ? "negative" : "positive"),
  );
  const disposition = failure
    ? "recorded May failure"
    : "recorded positive May evidence";
  if (failure) {
    const incident = writeIncident(appDir, details);
    evidence.push(incident.path);
    await emitGymEvent(ctx, {
      ...gymEvent("gym.review.requested", {
        kind: "incident",
        requestKey: `incident-${incident.id}`,
        incidentId: incident.id,
        incidentPath: incident.path,
      }),
      localKey: evaluationEmissionLocalKey(
        details,
        "incident-review-requested",
      ),
    });
  }
  const identity = evaluationIdentity(details);
  const summary = `Evaluation intake processed ${identity}: ${disposition}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence,
    actions: [],
  });
}
