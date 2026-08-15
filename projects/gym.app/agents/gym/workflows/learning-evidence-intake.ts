import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import { gymAppRoot } from "./lib/context";
import { safeKey, triggerDetails } from "./lib/trigger";

export const name = "learning-evidence-intake";
export const description =
  "Preserve one reviewed May session as positive or negative learning evidence.";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function evidenceKey(details: Record<string, unknown>): string {
  const evaluation = record(details.evaluation);
  const identity =
    evaluation.reviewSessionId ??
    evaluation.sessionId ??
    details.reviewSessionId ??
    details.sessionId;
  if (identity) return safeKey(identity, "learning-evidence");
  return createHash("sha256")
    .update(JSON.stringify(details))
    .digest("hex")
    .slice(0, 20);
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const details = triggerDetails(ctx);
  if (!details)
    return ctx.blocked("Learning-evidence trigger is missing or invalid");

  const polarity = String(details.polarity ?? "");
  if (polarity !== "positive" && polarity !== "negative") {
    return ctx.blocked(`Unsupported learning-evidence polarity: ${polarity}`);
  }
  const key = evidenceKey(details);
  const evidenceDir = join(
    gymAppRoot(ctx),
    ".state",
    "learning",
    "evidence",
  );
  const evidencePath = join(evidenceDir, `${key}.json`);
  const journalPath = join(evidenceDir, "observations.jsonl");
  mkdirSync(evidenceDir, { recursive: true });

  if (!existsSync(evidencePath)) {
    const row = {
      schema_version: 1,
      evidence_id: key,
      captured_at: new Date().toISOString(),
      polarity,
      status: "unclassified",
      source: details,
    };
    writeFileSync(evidencePath, `${JSON.stringify(row, null, 2)}\n`);
    appendFileSync(journalPath, `${JSON.stringify(row)}\n`);
  }

  const summary = `Recorded ${polarity} May learning evidence ${key}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [evidencePath],
    actions: [],
  });
}
