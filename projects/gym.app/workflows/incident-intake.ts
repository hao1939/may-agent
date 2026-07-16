import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { safeKey, triggerDetails } from "./lib/trigger";

export const name = "incident-intake";
export const description =
  "Capture an actionable May incident and queue benchmark-owner review.";

function incidentKey(details: Record<string, unknown>): string {
  const evaluation =
    details.evaluation &&
    typeof details.evaluation === "object" &&
    !Array.isArray(details.evaluation)
      ? (details.evaluation as Record<string, unknown>)
      : {};
  const identity =
    evaluation.sessionId ??
    details.sessionId ??
    details.incidentId ??
    details.id;
  if (identity) return safeKey(identity, "incident");
  return createHash("sha256")
    .update(JSON.stringify(details))
    .digest("hex")
    .slice(0, 20);
}

export async function execute(
  ctx: WorkflowContext,
): Promise<WorkflowResult> {
  const details = triggerDetails(ctx.task);
  if (!details) return ctx.blocked("Incident trigger event is missing or invalid");

  const key = incidentKey(details);
  const incidentDir = join(ctx.projectsRoot, "gym.app", ".state", "incidents");
  const incidentPath = join(incidentDir, `${key}.json`);
  mkdirSync(incidentDir, { recursive: true });

  if (!existsSync(incidentPath)) {
    writeFileSync(
      incidentPath,
      `${JSON.stringify(
        {
          schema_version: 1,
          incident_id: key,
          captured_at: new Date().toISOString(),
          status: "needs-review",
          source: details,
        },
        null,
        2,
      )}\n`,
    );
  }

  ctx.emit({
    type: "gym.review.requested",
    project: "gym",
    kind: "incident",
    requestKey: `incident-${key}`,
    incidentId: key,
    incidentPath,
  });

  return ctx.done(`Captured incident ${key} at ${incidentPath}.`);
}
