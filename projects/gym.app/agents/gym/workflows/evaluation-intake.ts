import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  eventDetails,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import { extractTrigger, safeKey } from "./lib/trigger";

export const name = "evaluation-intake";
export const description =
  "Drain reviewed May evaluations through one sequential evidence and proposal frontier.";

type Row = { id: number; data: unknown };
type Checkpoint = {
  version: 1;
  lastProcessedEventId: number;
  updatedAt: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseData(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

function readCheckpoint(path: string): Checkpoint | null {
  if (!existsSync(path)) return null;
  try {
    const value = record(JSON.parse(readFileSync(path, "utf8")));
    return {
      version: 1,
      lastProcessedEventId: Number.isInteger(value.lastProcessedEventId)
        ? Number(value.lastProcessedEventId)
        : 0,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    };
  } catch {
    return null;
  }
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
}

function evaluationIdentity(
  details: Record<string, unknown>,
  eventId: number,
): string {
  const raw =
    details.reviewSessionId ??
    details.sessionId ??
    details.id ??
    `event-${eventId}`;
  return safeKey(raw, `evaluation-${eventId}`);
}

function isFailure(details: Record<string, unknown>): boolean {
  const lane = String(details.lane ?? "").toLowerCase();
  const verdict = String(
    details.reviewedVerdict ?? details.verdict ?? "",
  ).toLowerCase();
  return (
    lane === "needs_triage" ||
    [
      "fail",
      "failed",
      "partial",
      "poor",
      "needs_improvement",
      "blocked",
    ].includes(verdict)
  );
}

function writeLearningEvidence(
  appDir: string,
  eventId: number,
  details: Record<string, unknown>,
  polarity: "positive" | "negative",
): string {
  const key = evaluationIdentity(details, eventId);
  const path = join(appDir, ".state", "learning", "evidence", `${key}.json`);
  if (!existsSync(path)) {
    writeJsonAtomic(path, {
      schema_version: 1,
      evidence_id: key,
      source_event_id: eventId,
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
  eventId: number,
  details: Record<string, unknown>,
): { id: string; path: string } {
  const identity = evaluationIdentity(details, eventId);
  const id = safeKey(identity, `incident-${eventId}`);
  const path = join(appDir, ".state", "incidents", `${id}.json`);
  if (!existsSync(path)) {
    writeJsonAtomic(path, {
      schema_version: 1,
      incident_id: id,
      source_event_id: eventId,
      captured_at: new Date().toISOString(),
      status: "needs-review",
      source: details,
    });
  }
  return { id, path };
}

function nextRows(ctx: WorkflowContext, afterId: number, limit: number): Row[] {
  return ctx.query
    .sql(
      `SELECT id, data
       FROM events
      WHERE event_type = 'evaluation.reviewed'
        AND id > ?
        AND lower(COALESCE(
          json_extract(data, '$.agent'),
          json_extract(data, '$.params.agent'),
          ''
        )) = 'may'
      ORDER BY id ASC`,
      [afterId],
      { limit },
    )
    .rows.filter(
      (row): row is Row =>
        typeof row.id === "number" &&
        Number.isInteger(row.id) &&
        row.id > afterId,
    );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir = ctx.appDir ?? join(ctx.projectsRoot, "gym.app");
  const checkpointPath = join(
    appDir,
    ".state",
    "learning",
    "evaluation-intake.json",
  );
  const checkpoint = readCheckpoint(checkpointPath);
  const triggerEventId = Number(extractTrigger(ctx.task ?? "")?.eventId);
  const initialAfterEventId =
    Number.isInteger(triggerEventId) && triggerEventId > 0
      ? triggerEventId - 1
      : 0;
  const [candidate, next] = nextRows(
    ctx,
    checkpoint?.lastProcessedEventId ?? initialAfterEventId,
    2,
  );
  if (!candidate) {
    const summary = "Evaluation intake is current.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [checkpointPath],
      actions: [],
    });
  }

  const raw = parseData(candidate.data);
  const details = eventDetails({
    type: "evaluation.reviewed",
    ...raw,
    data: raw,
  });
  const agent = String(details.agent ?? "").toLowerCase();
  const evidence: string[] = [];
  let disposition = "ignored non-May evaluation";

  if (agent === "may") {
    const failure = isFailure(details);
    evidence.push(
      writeLearningEvidence(
        appDir,
        candidate.id,
        details,
        failure ? "negative" : "positive",
      ),
    );
    disposition = failure
      ? "recorded May failure"
      : "recorded positive May evidence";
    if (failure) {
      const incident = writeIncident(appDir, candidate.id, details);
      evidence.push(incident.path);
      ctx.emit({
        type: "gym.review.requested",
        project: "gym",
        kind: "incident",
        requestKey: `incident-${incident.id}`,
        incidentId: incident.id,
        incidentPath: incident.path,
      });
    }
  }

  writeJsonAtomic(checkpointPath, {
    version: 1,
    lastProcessedEventId: candidate.id,
    updatedAt: new Date().toISOString(),
  } satisfies Checkpoint);
  evidence.push(checkpointPath);

  if (next) {
    ctx.emit({
      type: "project.task.tick",
      source: "gym-evaluation-intake",
      target: { project: "gym", taskId: "runtime/evaluation-intake" },
      data: {
        project: "gym",
        taskId: "runtime/evaluation-intake",
        task_id: "runtime/evaluation-intake",
        reason: "evaluation-intake-backlog-remains",
        afterEventId: candidate.id,
      },
    });
  }

  const summary = `Evaluation intake processed event ${candidate.id}: ${disposition}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence,
    actions: [],
  });
}
